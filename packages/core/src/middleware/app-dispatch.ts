/**
 * App dispatch middleware (Track B).
 *
 * When the workspace worker is routed a tenant brand host (`<brand>.com/*`
 * via a CF zone route), this middleware lets a guest app — mounted at an
 * operator-chosen public path in the App Manager — actually serve there,
 * by forwarding the request to that guest worker. Core-app mounts and
 * unclaimed paths fall through to the normal route table untouched.
 *
 * Registered AFTER the workspace resolver (so workspace + brandDomain are
 * set) and BEFORE the core-app routes / SPA catch-all.
 *
 * Reuses the gateway's forward shape (service binding or HTTP + injected
 * context headers). The ROUTING DECISION (services/app-dispatch.ts) is
 * unit-tested; the live Worker→Worker hop is verified on deploy (service
 * bindings + zone routes aren't exercisable in the dev container).
 *
 * Error isolation: a guest worker being down or unbound returns a 502 for
 * THAT path only — it never 500s the whole zone. Adds an
 * `X-Ensemble-Dispatch` debug header so "which worker served this" is
 * answerable.
 */

import type { Context, Next, MiddlewareHandler } from 'hono';
import type { Env, ContextVariables } from '../types';

type Ctx = Context<{ Bindings: Env; Variables: ContextVariables }>;

// Mirror of the gateway's context headers (kept local; the gateway's set
// is module-private and we don't want to destabilize it by exporting).
const H = {
  WORKSPACE_ID: 'X-Ensemble-Workspace-Id',
  APP_ID: 'X-Ensemble-App-Id',
  USER_ID: 'X-Ensemble-User-Id',
  USER_EMAIL: 'X-Ensemble-User-Email',
  USER_ROLE: 'X-Ensemble-User-Role',
  REQUEST_ID: 'X-Ensemble-Request-Id',
};

interface GuestRow {
  connection_type: string;
  binding_name: string | null;
  endpoint_url: string | null;
}

export function appDispatch(): MiddlewareHandler<{ Bindings: Env; Variables: ContextVariables }> {
  return async (c: Ctx, next: Next) => {
    const workspace = c.get('workspace');
    const url = new URL(c.req.url);

    // Fast path: only the bare-public methods + only when a workspace is
    // resolved. Skip /_ensemble/* and the shell entirely — dispatch is
    // for operator-chosen PUBLIC mounts, never internal paths.
    if (!workspace?.id || url.pathname.startsWith('/_ensemble/')) {
      return next();
    }

    let target;
    try {
      const { listApps } = await import('../services/app-registry');
      const { resolveDispatch } = await import('../services/app-dispatch');
      const apps = await listApps(c.env, workspace.id);
      target = resolveDispatch(apps, url.host, url.pathname);
    } catch {
      return next(); // registry unavailable → behave as before
    }

    if (target.kind !== 'guest') {
      // passthrough (core mount) + fallthrough → normal routing.
      return next();
    }

    // Forward to the guest worker. Load its connection details.
    let row: GuestRow | null = null;
    try {
      row = await c.env.DB.prepare(
        `SELECT connection_type, binding_name, endpoint_url FROM guest_apps WHERE workspace_id = ? AND id = ?`,
      )
        .bind(workspace.id, target.guestId)
        .first<GuestRow>();
    } catch {
      row = null;
    }
    if (!row) return next(); // no connection info → let normal routing 404

    // Inject workspace context (same contract as the gateway).
    const headers = new Headers(c.req.raw.headers);
    headers.set(H.WORKSPACE_ID, workspace.id);
    headers.set(H.APP_ID, target.appId);
    const user = c.get('user');
    const requestId = c.get('requestId');
    if (requestId) headers.set(H.REQUEST_ID, requestId);
    if (user) {
      headers.set(H.USER_ID, user.id);
      headers.set(H.USER_EMAIL, user.email);
      const membership = c.get('membership');
      if (membership) headers.set(H.USER_ROLE, membership.role);
    }

    const proxyReq = new Request(c.req.url, {
      method: c.req.method,
      headers,
      body: c.req.raw.body,
      // @ts-expect-error duplex not in lib types
      duplex: 'half',
    });

    try {
      let res: Response;
      if (row.connection_type === 'service_binding' && row.binding_name) {
        const binding = (c.env as unknown as Record<string, unknown>)[row.binding_name] as
          | { fetch?: typeof fetch }
          | undefined;
        if (!binding?.fetch) {
          return c.json({ error: 'guest_binding_unavailable', app: target.appId }, 502, {
            'X-Ensemble-Dispatch': `${target.appId} (binding missing)`,
          });
        }
        res = await binding.fetch(proxyReq);
      } else if (row.endpoint_url) {
        const fwd = new URL(url.pathname + url.search, row.endpoint_url);
        res = await fetch(new Request(fwd.toString(), proxyReq));
      } else {
        return next(); // no usable connection → normal routing
      }
      // Tag the response so "which worker served this" is answerable.
      const out = new Response(res.body, res);
      out.headers.set('X-Ensemble-Dispatch', target.appId);
      return out;
    } catch {
      // Guest down / threw → isolate to this path, don't 500 the zone.
      return c.json({ error: 'guest_unavailable', app: target.appId }, 502, {
        'X-Ensemble-Dispatch': `${target.appId} (error)`,
      });
    }
  };
}
