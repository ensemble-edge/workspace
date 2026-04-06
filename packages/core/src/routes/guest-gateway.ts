/**
 * Guest App Gateway Routes
 *
 * Proxies requests to guest apps (connectors, tools, agents) via:
 * - Service bindings (same-zone Cloudflare Workers, 0ms latency)
 * - HTTP fetch (remote services)
 *
 * Route pattern: /_ensemble/apps/{app-id}/*
 *
 * The gateway:
 * - Resolves app from registry
 * - Validates capability token
 * - Injects context headers (workspace, user, permissions)
 * - Proxies request to guest app
 * - Logs to audit trail
 */

import { Hono } from 'hono';
import type { Env, ContextVariables } from '../types';

// Header names for context injection
const ENSEMBLE_HEADERS = {
  WORKSPACE_ID: 'X-Ensemble-Workspace-Id',
  USER_ID: 'X-Ensemble-User-Id',
  USER_EMAIL: 'X-Ensemble-User-Email',
  USER_ROLE: 'X-Ensemble-User-Role',
  APP_ID: 'X-Ensemble-App-Id',
  CAPABILITY_TOKEN: 'X-Ensemble-Capability-Token',
  REQUEST_ID: 'X-Ensemble-Request-Id',
} as const;

/**
 * App registration in the registry.
 */
interface AppRegistration {
  id: string;
  name: string;
  version: string;
  category: 'tool' | 'connector' | 'agent' | 'panel';
  enabled: boolean;
  // Connection type
  connection_type: 'service_binding' | 'http';
  // For service binding
  binding_name?: string;
  // For HTTP
  endpoint_url?: string;
  // Required permissions to use this app
  required_role?: 'guest' | 'member' | 'admin' | 'owner';
}

/**
 * Create guest app gateway routes.
 */
export function createGuestGatewayRoutes() {
  const app = new Hono<{
    Bindings: Env;
    Variables: ContextVariables;
  }>();

  // List installed apps
  app.get('/', async (c) => {
    const workspace = c.get('workspace');
    if (!workspace?.id) {
      return c.json({ error: 'Workspace not found' }, 400);
    }

    try {
      const apps = await c.env.DB.prepare(
        `SELECT id, name, version, category, enabled, connection_type, required_role
         FROM guest_apps
         WHERE workspace_id = ? AND enabled = 1
         ORDER BY name`
      ).bind(workspace.id).all<AppRegistration>();

      return c.json({
        data: apps.results || [],
        meta: {
          total: apps.results?.length || 0,
          request_id: crypto.randomUUID(),
        },
      });
    } catch (error) {
      console.error('Failed to list apps:', error);
      return c.json({ error: 'Failed to list apps' }, 500);
    }
  });

  // Get app manifest
  app.get('/:appId/manifest', async (c) => {
    const appId = c.req.param('appId');
    const workspace = c.get('workspace');

    if (!workspace?.id) {
      return c.json({ error: 'Workspace not found' }, 400);
    }

    try {
      const app = await c.env.DB.prepare(
        `SELECT * FROM guest_apps WHERE workspace_id = ? AND id = ?`
      ).bind(workspace.id, appId).first<AppRegistration>();

      if (!app) {
        return c.json({ error: 'App not found' }, 404);
      }

      // Fetch manifest from the app itself
      const manifest = await fetchAppManifest(c.env, app);

      return c.json(manifest);
    } catch (error) {
      console.error('Failed to get app manifest:', error);
      return c.json({ error: 'Failed to get manifest' }, 500);
    }
  });

  // Proxy all other requests to the guest app
  app.all('/:appId/*', async (c) => {
    const appId = c.req.param('appId');
    const workspace = c.get('workspace');
    const user = c.get('user');
    const membership = c.get('membership');

    if (!workspace?.id) {
      return c.json({ error: 'Workspace not found' }, 400);
    }

    // Get app registration
    const appReg = await c.env.DB.prepare(
      `SELECT * FROM guest_apps WHERE workspace_id = ? AND id = ?`
    ).bind(workspace.id, appId).first<AppRegistration & {
      binding_name: string | null;
      endpoint_url: string | null;
    }>();

    if (!appReg) {
      return c.json({ error: 'App not found' }, 404);
    }

    if (!appReg.enabled) {
      return c.json({ error: 'App is disabled' }, 403);
    }

    // Check user role against required role
    if (appReg.required_role && membership) {
      const roleHierarchy = { guest: 0, member: 1, admin: 2, owner: 3 };
      const userRoleLevel = roleHierarchy[membership.role as keyof typeof roleHierarchy] ?? 0;
      const requiredLevel = roleHierarchy[appReg.required_role] ?? 0;

      if (userRoleLevel < requiredLevel) {
        return c.json({ error: 'Insufficient permissions' }, 403);
      }
    }

    // Build the path to forward (remove /_ensemble/apps/:appId prefix)
    const fullPath = new URL(c.req.url).pathname;
    const appPath = fullPath.replace(`/_ensemble/apps/${appId}`, '') || '/';

    // Generate request ID for tracing
    const requestId = crypto.randomUUID();

    // Build context headers
    const contextHeaders = new Headers(c.req.raw.headers);
    contextHeaders.set(ENSEMBLE_HEADERS.WORKSPACE_ID, workspace.id);
    contextHeaders.set(ENSEMBLE_HEADERS.APP_ID, appId);
    contextHeaders.set(ENSEMBLE_HEADERS.REQUEST_ID, requestId);

    if (user) {
      contextHeaders.set(ENSEMBLE_HEADERS.USER_ID, user.id);
      contextHeaders.set(ENSEMBLE_HEADERS.USER_EMAIL, user.email);
      if (membership) {
        contextHeaders.set(ENSEMBLE_HEADERS.USER_ROLE, membership.role);
      }
    }

    // Generate capability token for the guest app
    // (short-lived token that proves this request came from the gateway)
    const capabilityToken = await generateCapabilityToken(c.env, {
      workspaceId: workspace.id,
      appId,
      userId: user?.id,
      requestId,
    });
    contextHeaders.set(ENSEMBLE_HEADERS.CAPABILITY_TOKEN, capabilityToken);

    try {
      let response: Response;

      if (appReg.connection_type === 'service_binding' && appReg.binding_name) {
        // Use service binding (0ms latency, same-zone Workers)
        response = await proxyViaServiceBinding(
          c.env,
          appReg.binding_name,
          appPath,
          c.req.raw,
          contextHeaders
        );
      } else if (appReg.endpoint_url) {
        // Use HTTP fetch (remote services)
        response = await proxyViaHttp(
          appReg.endpoint_url,
          appPath,
          c.req.raw,
          contextHeaders
        );
      } else {
        return c.json({ error: 'App has no valid connection' }, 500);
      }

      // Log to audit trail (async, don't wait)
      logAuditEntry(c.env, {
        workspace_id: workspace.id,
        user_id: user?.id ?? 'anonymous',
        action: 'app_request',
        resource_type: 'guest_app',
        resource_id: appId,
        details: {
          path: appPath,
          method: c.req.method,
          status: response.status,
          request_id: requestId,
        },
      }).catch(console.error);

      return response;
    } catch (error) {
      console.error(`Failed to proxy to app ${appId}:`, error);
      return c.json({
        error: 'Failed to reach app',
        code: 'GATEWAY_ERROR',
        request_id: requestId,
      }, 502);
    }
  });

  return app;
}

/**
 * Fetch manifest from a guest app.
 */
async function fetchAppManifest(
  env: Env,
  app: AppRegistration & { binding_name?: string | null; endpoint_url?: string | null }
): Promise<unknown> {
  const manifestPath = '/.well-known/ensemble-manifest.json';

  if (app.connection_type === 'service_binding' && app.binding_name) {
    // Service binding
    const binding = (env as unknown as Record<string, unknown>)[app.binding_name] as { fetch?: typeof fetch };
    if (binding?.fetch) {
      const response = await binding.fetch(new Request(`https://guest-app${manifestPath}`));
      return response.json();
    }
  } else if (app.endpoint_url) {
    // HTTP fetch
    const response = await fetch(`${app.endpoint_url}${manifestPath}`);
    return response.json();
  }

  throw new Error('No valid connection to fetch manifest');
}

/**
 * Proxy request via Cloudflare service binding.
 */
async function proxyViaServiceBinding(
  env: Env,
  bindingName: string,
  path: string,
  originalRequest: Request,
  headers: Headers
): Promise<Response> {
  // Access dynamic binding by name
  const binding = (env as unknown as Record<string, unknown>)[bindingName] as { fetch?: typeof fetch };

  if (!binding?.fetch) {
    throw new Error(`Service binding '${bindingName}' not found`);
  }

  // Build the proxied request
  const url = new URL(path, 'https://guest-app');
  url.search = new URL(originalRequest.url).search;

  const proxyRequest = new Request(url.toString(), {
    method: originalRequest.method,
    headers,
    body: originalRequest.body,
    // @ts-expect-error - duplex is not in the type definitions
    duplex: 'half',
  });

  return binding.fetch(proxyRequest);
}

/**
 * Proxy request via HTTP fetch.
 */
async function proxyViaHttp(
  endpointUrl: string,
  path: string,
  originalRequest: Request,
  headers: Headers
): Promise<Response> {
  const url = new URL(path, endpointUrl);
  url.search = new URL(originalRequest.url).search;

  const proxyRequest = new Request(url.toString(), {
    method: originalRequest.method,
    headers,
    body: originalRequest.body,
    // @ts-expect-error - duplex is not in the type definitions
    duplex: 'half',
  });

  return fetch(proxyRequest);
}

/**
 * Generate a short-lived capability token for the guest app.
 */
async function generateCapabilityToken(
  env: Env,
  payload: {
    workspaceId: string;
    appId: string;
    userId?: string;
    requestId: string;
  }
): Promise<string> {
  // Create a simple signed token (5 minute expiry)
  const tokenData = {
    ...payload,
    exp: Date.now() + 5 * 60 * 1000,
    iat: Date.now(),
  };

  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(tokenData));

  // Use HMAC-SHA256 for signing
  const secret = env.JWT_SECRET || 'ensemble-dev-capability-secret';
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, data);
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

  // Return as base64-encoded JSON + signature
  const tokenBase64 = btoa(JSON.stringify(tokenData));
  return `cap_${tokenBase64}.${signatureBase64}`;
}

/**
 * Log an entry to the audit trail.
 */
async function logAuditEntry(
  env: Env,
  entry: {
    workspace_id: string;
    user_id: string;
    action: string;
    resource_type: string;
    resource_id: string;
    details: Record<string, unknown>;
  }
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO audit_log (id, workspace_id, user_id, action, resource_type, resource_id, details_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).bind(
    crypto.randomUUID(),
    entry.workspace_id,
    entry.user_id,
    entry.action,
    entry.resource_type,
    entry.resource_id,
    JSON.stringify(entry.details)
  ).run();
}
