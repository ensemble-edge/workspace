/**
 * core:brand — Server-side API routes
 *
 * Brand token CRUD + color group management.
 * Routes mounted under /_ensemble/core/brand/*
 */

import type { Hono } from 'hono';
import type { Env, ContextVariables } from '../../../types';
import { assembleBrandSpec, generateCssFromSpec, generateContextFromSpec, importBrandSpec } from './spec';
import type { EnsembleBrandSpec } from './spec';

export function registerBrandRoutes(
  app: Hono<{ Bindings: Env; Variables: ContextVariables }>
): void {
  // ── Brand Spec (the canonical format) ──

  // GET /_ensemble/brand/spec — Full brand spec (JSON)
  app.get('/_ensemble/brand/spec', async (c) => {
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'Workspace not found' }, 400);

    try {
      const baseUrl = new URL(c.req.url).origin;
      const spec = await assembleBrandSpec(c.env.DB, workspace.id, baseUrl);

      const format = c.req.query('format');
      if (format === 'yaml') {
        // Simple YAML-like output (no dependency needed for basic structure)
        return c.text(jsonToYaml(spec), 200, { 'Content-Type': 'text/yaml' });
      }

      return c.json(spec);
    } catch (error) {
      console.error('Failed to generate brand spec:', error);
      return c.json({ error: 'Failed to generate brand spec' }, 500);
    }
  });

  // GET /_ensemble/brand/context — AI-readable markdown
  app.get('/_ensemble/brand/context', async (c) => {
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'Workspace not found' }, 400);

    try {
      const spec = await assembleBrandSpec(c.env.DB, workspace.id);
      const markdown = generateContextFromSpec(spec);
      return c.text(markdown, 200, { 'Content-Type': 'text/markdown' });
    } catch (error) {
      console.error('Failed to generate brand context:', error);
      return c.text('Failed to generate brand context', 500);
    }
  });

  // POST /_ensemble/brand/import — Import a brand spec
  app.post('/_ensemble/brand/import', async (c) => {
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'Workspace not found' }, 400);

    try {
      const body = await c.req.json<{ spec?: EnsembleBrandSpec; url?: string; overwrite?: boolean }>();

      let spec: EnsembleBrandSpec;
      if (body.url) {
        // Fetch spec from URL
        const res = await fetch(body.url);
        if (!res.ok) return c.json({ error: `Failed to fetch spec from ${body.url}` }, 400);
        spec = await res.json() as EnsembleBrandSpec;
      } else if (body.spec) {
        spec = body.spec;
      } else {
        return c.json({ error: 'Provide either spec (JSON) or url' }, 400);
      }

      if (spec.ensemble_brand !== '1.0') {
        return c.json({ error: `Unsupported spec version: ${spec.ensemble_brand}` }, 400);
      }

      const result = await importBrandSpec(c.env.DB, workspace.id, spec, body.overwrite ?? false);
      return c.json({ success: true, ...result });
    } catch (error) {
      console.error('Failed to import brand spec:', error);
      return c.json({ error: 'Failed to import brand spec' }, 500);
    }
  });
  // GET /_ensemble/core/brand/tokens — List all brand tokens
  app.get('/_ensemble/core/brand/tokens', async (c) => {
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'Workspace not found' }, 400);

    try {
      const result = await c.env.DB.prepare(
        `SELECT category, key, value, type, label, description, group_slug, sort_order, updated_at
         FROM brand_tokens WHERE workspace_id = ? AND locale = ''
         ORDER BY category, sort_order, key`
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
    if (!workspace?.id) return c.json({ error: 'Workspace not found' }, 400);

    try {
      const result = await c.env.DB.prepare(
        `SELECT key, value, type, label, description, group_slug, sort_order, updated_at
         FROM brand_tokens WHERE workspace_id = ? AND category = ? AND locale = ''
         ORDER BY sort_order, key`
      ).bind(workspace.id, category).all();

      return c.json({ data: result.results || [] });
    } catch (error) {
      console.error('Failed to fetch brand tokens:', error);
      return c.json({ error: 'Failed to fetch brand tokens' }, 500);
    }
  });

  // GET /_ensemble/core/brand/groups — List color/custom groups
  app.get('/_ensemble/core/brand/groups', async (c) => {
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'Workspace not found' }, 400);

    try {
      const result = await c.env.DB.prepare(
        `SELECT slug, label, category, description, sort_order
         FROM brand_token_groups WHERE workspace_id = ?
         ORDER BY sort_order, label`
      ).bind(workspace.id).all();

      return c.json({ data: result.results || [] });
    } catch (error) {
      console.error('Failed to fetch groups:', error);
      return c.json({ error: 'Failed to fetch groups' }, 500);
    }
  });

  // POST /_ensemble/core/brand/groups — Create a color/custom group
  app.post('/_ensemble/core/brand/groups', async (c) => {
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'Workspace not found' }, 400);

    const body = await c.req.json<{
      slug: string;
      label: string;
      category?: string;
      description?: string;
    }>();

    if (!body.slug || !body.label) {
      return c.json({ error: 'slug and label are required' }, 400);
    }

    try {
      await c.env.DB.prepare(
        `INSERT INTO brand_token_groups (workspace_id, slug, label, category, description)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(workspace.id, body.slug, body.label, body.category || 'colors', body.description || null).run();

      return c.json({ success: true });
    } catch (error) {
      console.error('Failed to create group:', error);
      return c.json({ error: 'Failed to create group' }, 500);
    }
  });

  // DELETE /_ensemble/core/brand/groups/:slug — Delete group + its tokens
  app.delete('/_ensemble/core/brand/groups/:slug', async (c) => {
    const workspace = c.get('workspace');
    const slug = c.req.param('slug');
    if (!workspace?.id) return c.json({ error: 'Workspace not found' }, 400);

    try {
      // Delete tokens belonging to this group
      await c.env.DB.prepare(
        `DELETE FROM brand_tokens WHERE workspace_id = ? AND group_slug = ?`
      ).bind(workspace.id, slug).run();

      // Delete the group
      await c.env.DB.prepare(
        `DELETE FROM brand_token_groups WHERE workspace_id = ? AND slug = ?`
      ).bind(workspace.id, slug).run();

      return c.json({ success: true });
    } catch (error) {
      console.error('Failed to delete group:', error);
      return c.json({ error: 'Failed to delete group' }, 500);
    }
  });

  // PUT /_ensemble/core/brand/colors — Save a full color group
  // Accepts: { group: "slate", label: "Slate", colors: { "700": "#1E2630", "600": "#2D3A47", ... } }
  app.put('/_ensemble/core/brand/colors', async (c) => {
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'Workspace not found' }, 400);

    const body = await c.req.json<{
      group: string;
      label: string;
      colors: Record<string, string>;
    }>();

    if (!body.group || !body.colors) {
      return c.json({ error: 'group and colors are required' }, 400);
    }

    try {
      // Ensure group exists
      await c.env.DB.prepare(
        `INSERT INTO brand_token_groups (workspace_id, slug, label, category)
         VALUES (?, ?, ?, 'colors')
         ON CONFLICT (workspace_id, slug) DO UPDATE SET label = excluded.label`
      ).bind(workspace.id, body.group, body.label).run();

      // Upsert each color token
      let sortOrder = 0;
      for (const [shade, hex] of Object.entries(body.colors)) {
        const key = `${body.group}.${shade}`;
        await c.env.DB.prepare(
          `INSERT INTO brand_tokens (workspace_id, category, key, value, type, label, group_slug, sort_order, locale, updated_at)
           VALUES (?, 'colors', ?, ?, 'color', ?, ?, ?, '', datetime('now'))
           ON CONFLICT (workspace_id, category, key, locale)
           DO UPDATE SET value = excluded.value, label = excluded.label, group_slug = excluded.group_slug,
                         sort_order = excluded.sort_order, updated_at = datetime('now')`
        ).bind(workspace.id, key, hex, `${body.label} ${shade}`, body.group, sortOrder).run();
        sortOrder++;
      }

      return c.json({ success: true });
    } catch (error) {
      console.error('Failed to save colors:', error);
      return c.json({ error: 'Failed to save colors' }, 500);
    }
  });
}

/** Simple JSON to YAML-ish conversion (no external deps). */
function jsonToYaml(obj: unknown, indent: number = 0): string {
  const pad = '  '.repeat(indent);
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj === 'string') return obj.includes('\n') ? `|\n${obj.split('\n').map((l) => pad + '  ' + l).join('\n')}` : obj;
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return obj.map((item) => `${pad}- ${jsonToYaml(item, indent + 1).trimStart()}`).join('\n');
  }
  if (typeof obj === 'object') {
    const entries = Object.entries(obj as Record<string, unknown>).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return '{}';
    return entries.map(([k, v]) => {
      const val = jsonToYaml(v, indent + 1);
      if (typeof v === 'object' && v !== null) return `${pad}${k}:\n${val}`;
      return `${pad}${k}: ${val}`;
    }).join('\n');
  }
  return String(obj);
}
