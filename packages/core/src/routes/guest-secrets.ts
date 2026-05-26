/**
 * Guest-app secret routes.
 *
 * Mounted under /_ensemble/apps/:appId/_secrets/ — the `_secrets`
 * prefix means the workspace serves these directly rather than
 * forwarding to the guest worker (the guest gateway only forwards
 * non-underscore-prefixed paths). The guest app calls these to
 * read/write its own encrypted secrets.
 *
 * Routes:
 *   GET    /_ensemble/apps/:appId/_secrets             — list (metadata only)
 *   GET    /_ensemble/apps/:appId/_secrets/:key        — read decrypted value
 *   PUT    /_ensemble/apps/:appId/_secrets/:key        — set encrypted value
 *   DELETE /_ensemble/apps/:appId/_secrets/:key        — remove
 *
 * All accept ?scope=app (default) or ?scope=user. App-global secrets
 * are usable by any authenticated caller of that app; per-user
 * secrets are scoped to the request's authenticated user.
 *
 * Trust model:
 *   • App-global: any authenticated workspace member can read; only
 *     workspace admins can write (the app's "saved API key" pattern).
 *   • Per-user: the authenticated user reads + writes their own.
 *     Admins cannot read or write another user's secrets — the
 *     workspace's privileged-proxy model intentionally stops here
 *     so users have a "private" surface even from operators.
 */

import { Hono } from 'hono';
import type { Env, ContextVariables } from '../types';
import { auth } from '../middleware';
import {
  getSecret, setSecret, deleteSecret, listSecrets,
} from '../services/guest-secrets';

type GuestSecretsScope = 'app' | 'user';

function parseScope(raw: string | undefined): GuestSecretsScope {
  return raw === 'user' ? 'user' : 'app';
}

export function createGuestSecretsRoutes(): Hono<{
  Bindings: Env;
  Variables: ContextVariables;
}> {
  const app = new Hono<{ Bindings: Env; Variables: ContextVariables }>();

  // All secrets routes require auth. We DON'T require admin — guest
  // apps are accessible to members + guests with the role gate set
  // on the app itself; secrets follow the same trust boundary.
  app.use('/:appId/_secrets', auth());
  app.use('/:appId/_secrets/*', auth());

  // GET /:appId/_secrets — list keys (no values)
  app.get('/:appId/_secrets', async (c) => {
    const workspace = c.get('workspace');
    const user = c.get('user');
    const membership = c.get('membership');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);
    const appId = c.req.param('appId');
    const scope = parseScope(c.req.query('scope'));

    if (scope === 'user') {
      if (!user?.id) return c.json({ error: 'authentication required' }, 401);
      const secrets = await listSecrets(c.env, {
        workspaceId: workspace.id, appId, userId: user.id,
      });
      return c.json({ scope, secrets });
    }
    // app-global: any authenticated member can list
    const secrets = await listSecrets(c.env, {
      workspaceId: workspace.id, appId, userId: null,
    });
    return c.json({ scope, secrets });
  });

  // GET /:appId/_secrets/:key — read decrypted value
  app.get('/:appId/_secrets/:key', async (c) => {
    const workspace = c.get('workspace');
    const user = c.get('user');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);
    const appId = c.req.param('appId');
    const key = c.req.param('key');
    const scope = parseScope(c.req.query('scope'));

    const userId = scope === 'user' ? user?.id ?? null : null;
    if (scope === 'user' && !userId) {
      return c.json({ error: 'authentication required for user-scoped secrets' }, 401);
    }
    const value = await getSecret(c.env, {
      workspaceId: workspace.id, appId, userId,
    }, key);
    if (value === null) return c.json({ error: 'not found' }, 404);
    return c.json({ scope, key, value });
  });

  // PUT /:appId/_secrets/:key — write encrypted value
  app.put('/:appId/_secrets/:key', async (c) => {
    const workspace = c.get('workspace');
    const user = c.get('user');
    const membership = c.get('membership');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);
    const appId = c.req.param('appId');
    const key = c.req.param('key');
    const scope = parseScope(c.req.query('scope'));

    let body: { value?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid JSON body' }, 400);
    }
    if (typeof body.value !== 'string') {
      return c.json({ error: 'body must be { value: string }' }, 400);
    }

    if (scope === 'user') {
      if (!user?.id) return c.json({ error: 'authentication required' }, 401);
      await setSecret(c.env, {
        workspaceId: workspace.id, appId, userId: user.id,
      }, key, body.value, { updatedByUserId: user.id });
      return c.json({ ok: true, scope, key });
    }

    // app-global writes: admin only. (Members can READ app-global
    // secrets but only admins can SET them — they're the equivalent
    // of operator-configured provider keys.)
    if (membership?.role !== 'owner' && membership?.role !== 'admin') {
      return c.json({ error: 'admin role required to write app-global secrets' }, 403);
    }
    await setSecret(c.env, {
      workspaceId: workspace.id, appId, userId: null,
    }, key, body.value, { updatedByUserId: user?.id ?? null });
    return c.json({ ok: true, scope, key });
  });

  // DELETE /:appId/_secrets/:key
  app.delete('/:appId/_secrets/:key', async (c) => {
    const workspace = c.get('workspace');
    const user = c.get('user');
    const membership = c.get('membership');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);
    const appId = c.req.param('appId');
    const key = c.req.param('key');
    const scope = parseScope(c.req.query('scope'));

    if (scope === 'user') {
      if (!user?.id) return c.json({ error: 'authentication required' }, 401);
      const removed = await deleteSecret(c.env, {
        workspaceId: workspace.id, appId, userId: user.id,
      }, key);
      return c.json({ ok: removed });
    }
    if (membership?.role !== 'owner' && membership?.role !== 'admin') {
      return c.json({ error: 'admin role required to delete app-global secrets' }, 403);
    }
    const removed = await deleteSecret(c.env, {
      workspaceId: workspace.id, appId, userId: null,
    }, key);
    return c.json({ ok: removed });
  });

  return app;
}
