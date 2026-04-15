/**
 * core:audit — Server-side API routes
 *
 * Read-only audit event log viewer.
 */

import type { Hono } from 'hono';
import type { Env, ContextVariables } from '../../../types';
import { auth } from '../../../middleware';

export function registerAuditRoutes(
  app: Hono<{ Bindings: Env; Variables: ContextVariables }>
): void {
  app.use('/_ensemble/core/audit/*', auth());

  // GET /_ensemble/core/audit/events — List audit events
  app.get('/_ensemble/core/audit/events', async (c) => {
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'Workspace not found' }, 400);

    const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 200);
    const offset = parseInt(c.req.query('offset') || '0', 10);
    const action = c.req.query('action');

    try {
      let query = `SELECT id, actor_id, actor_handle, app_id, action, resource_type, resource_id, details_json, ip_address, created_at
                    FROM audit_log WHERE workspace_id = ?`;
      const params: unknown[] = [workspace.id];

      if (action) {
        query += ' AND action LIKE ?';
        params.push(`%${action}%`);
      }

      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const result = await c.env.DB.prepare(query).bind(...params).all();

      return c.json({
        data: result.results || [],
        meta: { limit, offset },
      });
    } catch (error) {
      console.error('Failed to fetch audit events:', error);
      return c.json({ error: 'Failed to fetch audit events' }, 500);
    }
  });
}
