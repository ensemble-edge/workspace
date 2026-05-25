/**
 * core:admin — API key CRUD routes.
 *
 * Routes (all require admin role on the workspace):
 *   POST   /_ensemble/api-keys              — create + return plaintext ONCE
 *   GET    /_ensemble/api-keys              — list (no plaintext, hashes only)
 *   POST   /_ensemble/api-keys/:id/revoke   — revoke
 *   POST   /_ensemble/api-keys/:id/regenerate — revoke old, create new with
 *                                              same name+scopes, return new plaintext
 */
import type { Hono } from 'hono';
import type { Env, ContextVariables } from '../../../types';
import { auth, requireRole } from '../../../middleware';
import {
  createApiKey, listApiKeys, revokeApiKey, regenerateApiKey,
} from '../../../services/api-keys';
import { recordAudit, auditContext } from '../../../services/audit-log';

export function registerAdminRoutes(
  app: Hono<{ Bindings: Env; Variables: ContextVariables }>
): void {
  app.use('/_ensemble/api-keys', auth(), requireRole('admin'));
  app.use('/_ensemble/api-keys/*', auth(), requireRole('admin'));

  // POST /_ensemble/api-keys
  app.post('/_ensemble/api-keys', async (c) => {
    const workspace = c.get('workspace');
    const user = c.get('user');
    if (!workspace?.id || !user?.id) return c.json({ error: 'unauthorized' }, 401);
    let body: { name?: string; scopes?: string[]; expires_at?: string | null };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid JSON body' }, 400);
    }
    const name = (body.name ?? '').trim();
    if (!name) return c.json({ error: 'name is required' }, 400);
    const { key, plaintext } = await createApiKey(c.env, {
      workspaceId: workspace.id,
      userId: user.id,
      name,
      scopes: body.scopes,
      expiresAt: body.expires_at ?? null,
    });
    await recordAudit(c.env, {
      ...auditContext(c),
      action: 'api_key.created',
      resourceType: 'api_key',
      resourceId: key.id,
      details: { name: key.name, key_prefix: key.key_prefix, scopes: key.scopes },
    });
    // The ONLY moment the plaintext is returned. Client must capture it.
    return c.json({ key, plaintext });
  });

  // GET /_ensemble/api-keys
  app.get('/_ensemble/api-keys', async (c) => {
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'unauthorized' }, 401);
    const keys = await listApiKeys(c.env, workspace.id);
    return c.json({ keys });
  });

  // POST /_ensemble/api-keys/:id/revoke
  app.post('/_ensemble/api-keys/:id/revoke', async (c) => {
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'unauthorized' }, 401);
    const id = c.req.param('id');
    const revoked = await revokeApiKey(c.env, workspace.id, id);
    if (!revoked) return c.json({ error: 'not found or already revoked' }, 404);
    await recordAudit(c.env, {
      ...auditContext(c),
      action: 'api_key.revoked',
      resourceType: 'api_key',
      resourceId: id,
    });
    return c.json({ ok: true });
  });

  // POST /_ensemble/api-keys/:id/regenerate
  app.post('/_ensemble/api-keys/:id/regenerate', async (c) => {
    const workspace = c.get('workspace');
    const user = c.get('user');
    if (!workspace?.id || !user?.id) return c.json({ error: 'unauthorized' }, 401);
    const id = c.req.param('id');
    const result = await regenerateApiKey(c.env, workspace.id, id, user.id);
    if (!result) return c.json({ error: 'not found' }, 404);
    await recordAudit(c.env, {
      ...auditContext(c),
      action: 'api_key.regenerated',
      resourceType: 'api_key',
      resourceId: result.key.id,
      details: { name: result.key.name, replaces: id },
    });
    return c.json(result);
  });
}
