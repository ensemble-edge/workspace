import { auth, requireRole } from '../../../middleware/index.js';
import { createApiKey, listApiKeys, revokeApiKey, regenerateApiKey, } from '../../../services/api-keys.js';
import { recordAudit, auditContext } from '../../../services/audit-log.js';
export function registerAdminRoutes(app) {
    app.use('/_ensemble/api-keys', auth(), requireRole('admin'));
    app.use('/_ensemble/api-keys/*', auth(), requireRole('admin'));
    // v0.1.77: audit log read route moved here from the (now removed)
    // standalone audit app. Same path so the UI continues to work.
    app.use('/_ensemble/core/audit/*', auth(), requireRole('admin'));
    // GET /_ensemble/core/audit/events — list workspace audit events.
    app.get('/_ensemble/core/audit/events', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'workspace not resolved' }, 400);
        const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 200);
        const offset = parseInt(c.req.query('offset') || '0', 10);
        const action = c.req.query('action');
        try {
            let query = `SELECT id, actor_id, actor_handle, app_id, action,
                          resource_type, resource_id, details_json, ip_address, created_at
                     FROM audit_log WHERE workspace_id = ?`;
            const params = [workspace.id];
            if (action) {
                query += ' AND action LIKE ?';
                params.push(`%${action}%`);
            }
            query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
            params.push(limit, offset);
            const result = await c.env.DB.prepare(query).bind(...params).all();
            return c.json({ data: result.results || [], meta: { limit, offset } });
        }
        catch (error) {
            // eslint-disable-next-line no-console
            console.error('Failed to fetch audit events:', error);
            return c.json({ error: 'Failed to fetch audit events' }, 500);
        }
    });
    // POST /_ensemble/api-keys
    app.post('/_ensemble/api-keys', async (c) => {
        const workspace = c.get('workspace');
        const user = c.get('user');
        if (!workspace?.id || !user?.id)
            return c.json({ error: 'unauthorized' }, 401);
        let body;
        try {
            body = await c.req.json();
        }
        catch {
            return c.json({ error: 'invalid JSON body' }, 400);
        }
        const name = (body.name ?? '').trim();
        if (!name)
            return c.json({ error: 'name is required' }, 400);
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
        if (!workspace?.id)
            return c.json({ error: 'unauthorized' }, 401);
        const keys = await listApiKeys(c.env, workspace.id);
        return c.json({ keys });
    });
    // POST /_ensemble/api-keys/:id/revoke
    app.post('/_ensemble/api-keys/:id/revoke', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'unauthorized' }, 401);
        const id = c.req.param('id');
        const revoked = await revokeApiKey(c.env, workspace.id, id);
        if (!revoked)
            return c.json({ error: 'not found or already revoked' }, 404);
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
        if (!workspace?.id || !user?.id)
            return c.json({ error: 'unauthorized' }, 401);
        const id = c.req.param('id');
        const result = await regenerateApiKey(c.env, workspace.id, id, user.id);
        if (!result)
            return c.json({ error: 'not found' }, 404);
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
//# sourceMappingURL=routes.js.map