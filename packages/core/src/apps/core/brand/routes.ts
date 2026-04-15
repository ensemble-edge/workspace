/**
 * core:brand — Server-side API routes
 *
 * These routes handle brand token CRUD under /_ensemble/core/brand/*.
 * The public-facing brand delivery endpoints (/_ensemble/brand/theme,
 * /_ensemble/brand/css) remain in createWorkspace for now.
 */

import type { Hono } from 'hono';
import type { Env, ContextVariables } from '../../../types';

export function registerBrandRoutes(
  app: Hono<{ Bindings: Env; Variables: ContextVariables }>
): void {
  // GET /_ensemble/core/brand/tokens — List all brand tokens
  app.get('/_ensemble/core/brand/tokens', async (c) => {
    const workspace = c.get('workspace');
    if (!workspace?.id) {
      return c.json({ error: 'Workspace not found' }, 400);
    }

    try {
      const result = await c.env.DB.prepare(
        `SELECT category, key, value, type, locale, updated_at
         FROM brand_tokens
         WHERE workspace_id = ?
         ORDER BY category, key`
      ).bind(workspace.id).all();

      return c.json({ data: result.results || [] });
    } catch (error) {
      console.error('Failed to fetch brand tokens:', error);
      return c.json({ error: 'Failed to fetch brand tokens' }, 500);
    }
  });

  // GET /_ensemble/core/brand/tokens/:category — List tokens by category
  app.get('/_ensemble/core/brand/tokens/:category', async (c) => {
    const workspace = c.get('workspace');
    const category = c.req.param('category');
    if (!workspace?.id) {
      return c.json({ error: 'Workspace not found' }, 400);
    }

    try {
      const result = await c.env.DB.prepare(
        `SELECT key, value, type, locale, updated_at
         FROM brand_tokens
         WHERE workspace_id = ? AND category = ?
         ORDER BY key`
      ).bind(workspace.id, category).all();

      return c.json({ data: result.results || [] });
    } catch (error) {
      console.error('Failed to fetch brand tokens:', error);
      return c.json({ error: 'Failed to fetch brand tokens' }, 500);
    }
  });
}
