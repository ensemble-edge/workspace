/**
 * core:legal — Server-side API routes.
 *
 * Three route families, all mounted by registerLegalRoutes:
 *
 *   1. CMS CRUD        /_ensemble/core/legal/*   (auth required)
 *   2. Public JSON     /api/legal/*              (public-read, cached)
 *   3. Public HTML     /legal, /legal/:slug      (public-read, cached)
 *
 * Families 2 + 3 live in public-routes.ts; this file owns the
 * authenticated CMS surface + settings.
 *
 * Every query is scoped by workspace.id — legal docs are per-tenant.
 */
import { ID_RE, SLUG_RE, parseDocRow } from './shared.js';
import { registerLegalPublicRoutes } from './public-routes.js';
const LEGAL_SETTING_KEYS = [
    'legal.company_name',
    'legal.business_address',
    'legal.support_email',
    'legal.support_phone',
    'legal.notices_email',
];
/** Actor email for updated_by / created_by audit columns. */
function actor(c) {
    const user = c.get('user');
    return user?.email ?? user?.id ?? null;
}
export function registerLegalRoutes(app) {
    // ── Public families (JSON + HTML). Registered here so the app has a
    //    single registerRoutes entry point; handlers gate themselves. ──
    registerLegalPublicRoutes(app);
    // ───────────────────────── CMS CRUD ─────────────────────────
    /** GET /_ensemble/core/legal/docs[?include_archived=1] — summaries. */
    app.get('/_ensemble/core/legal/docs', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'Workspace not found' }, 400);
        const includeArchived = c.req.query('include_archived') === '1';
        const where = includeArchived
            ? 'WHERE workspace_id = ?'
            : `WHERE workspace_id = ? AND status = 'active'`;
        const { results } = await c.env.DB.prepare(`SELECT id, slugs_json, title_json, description_json, body_md_json,
              last_updated, status, sort_order
         FROM legal_docs ${where}
        ORDER BY sort_order ASC, id ASC`)
            .bind(workspace.id)
            .all();
        const docs = (results ?? []).map(parseDocRow);
        return c.json({ docs });
    });
    /** GET /_ensemble/core/legal/docs/:id — full doc incl. body. */
    app.get('/_ensemble/core/legal/docs/:id', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'Workspace not found' }, 400);
        const id = c.req.param('id');
        const row = await c.env.DB.prepare(`SELECT id, slugs_json, title_json, description_json, body_md_json,
              last_updated, status, sort_order
         FROM legal_docs WHERE workspace_id = ? AND id = ?`)
            .bind(workspace.id, id)
            .first();
        if (!row)
            return c.json({ error: 'not_found' }, 404);
        return c.json({ doc: parseDocRow(row) });
    });
    /**
     * PUT /_ensemble/core/legal/docs/:id — UPSERT.
     *
     * Flow (spec §3.1): validate → check slug collisions → snapshot prior
     * row to versions → upsert legal_docs → rebuild slug junction. The
     * snapshot + upsert + junction rebuild run in one db.batch so a
     * concurrent reader never sees a half-rebuilt junction.
     */
    app.put('/_ensemble/core/legal/docs/:id', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'Workspace not found' }, 400);
        const id = c.req.param('id');
        if (!ID_RE.test(id))
            return c.json({ error: 'invalid_id' }, 400);
        let body;
        try {
            body = await c.req.json();
        }
        catch {
            return c.json({ error: 'invalid_json' }, 400);
        }
        if (!body.slugs || !body.title || !body.bodyMd || !body.lastUpdated) {
            return c.json({ error: 'slugs, title, bodyMd, and lastUpdated are required' }, 400);
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(body.lastUpdated)) {
            return c.json({ error: 'lastUpdated must be YYYY-MM-DD' }, 400);
        }
        // Validate every non-empty slug.
        const slugPairs = [];
        for (const [locale, slugRaw] of Object.entries(body.slugs)) {
            const slug = (slugRaw ?? '').trim();
            if (!slug)
                continue;
            if (!SLUG_RE.test(slug)) {
                return c.json({ error: 'invalid_slug', locale, slug }, 400);
            }
            slugPairs.push({ slug, locale });
        }
        // Slug-collision check: any (slug, locale) owned by a DIFFERENT doc?
        for (const { slug, locale } of slugPairs) {
            const hit = await c.env.DB.prepare(`SELECT doc_id FROM legal_doc_slugs
          WHERE workspace_id = ? AND slug = ? AND locale = ? AND doc_id != ?`)
                .bind(workspace.id, slug, locale, id)
                .first();
            if (hit) {
                return c.json({ error: 'slug_in_use', slug, locale, ownedBy: hit.doc_id }, 409);
            }
        }
        // Read existing row (for the version snapshot + field preservation).
        const existing = await c.env.DB.prepare(`SELECT id, slugs_json, title_json, description_json, body_md_json,
              last_updated, status, sort_order
         FROM legal_docs WHERE workspace_id = ? AND id = ?`)
            .bind(workspace.id, id)
            .first();
        const now = new Date().toISOString();
        const who = actor(c);
        // description: undefined preserves, null clears, object replaces.
        const descJson = body.description === undefined
            ? (existing?.description_json ?? null)
            : body.description === null
                ? null
                : JSON.stringify(body.description);
        // status / sortOrder: preserve existing when absent.
        const status = body.status ?? (existing?.status === 'archived' ? 'archived' : 'active');
        const sortOrder = body.sortOrder ?? existing?.sort_order ?? 100;
        const stmts = [];
        // 1. Snapshot the PRIOR row into versions (only if it existed).
        if (existing) {
            stmts.push(c.env.DB.prepare(`INSERT INTO legal_docs_versions
             (workspace_id, doc_id, slugs_json, title_json, description_json,
              body_md_json, last_updated, status, saved_by, saved_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(workspace.id, id, existing.slugs_json, existing.title_json, existing.description_json, existing.body_md_json, existing.last_updated, existing.status, who, now));
        }
        // 2. UPSERT legal_docs.
        stmts.push(c.env.DB.prepare(`INSERT INTO legal_docs
           (workspace_id, id, slugs_json, title_json, description_json,
            body_md_json, last_updated, status, sort_order,
            created_by, created_at, updated_by, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (workspace_id, id) DO UPDATE SET
           slugs_json = excluded.slugs_json,
           title_json = excluded.title_json,
           description_json = excluded.description_json,
           body_md_json = excluded.body_md_json,
           last_updated = excluded.last_updated,
           status = excluded.status,
           sort_order = excluded.sort_order,
           updated_by = excluded.updated_by,
           updated_at = excluded.updated_at`).bind(workspace.id, id, JSON.stringify(body.slugs), JSON.stringify(body.title), descJson, JSON.stringify(body.bodyMd), body.lastUpdated, status, sortOrder, who, now, who, now));
        // 3. Rebuild the slug junction: delete-all-for-doc, then re-insert.
        stmts.push(c.env.DB.prepare(`DELETE FROM legal_doc_slugs WHERE workspace_id = ? AND doc_id = ?`).bind(workspace.id, id));
        for (const { slug, locale } of slugPairs) {
            stmts.push(c.env.DB.prepare(`INSERT INTO legal_doc_slugs (workspace_id, slug, locale, doc_id)
           VALUES (?, ?, ?, ?)`).bind(workspace.id, slug, locale, id));
        }
        await c.env.DB.batch(stmts);
        return c.json({ ok: true, id });
    });
    /** GET /_ensemble/core/legal/docs/:id/versions — audit history. */
    app.get('/_ensemble/core/legal/docs/:id/versions', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'Workspace not found' }, 400);
        const id = c.req.param('id');
        const { results } = await c.env.DB.prepare(`SELECT version_id, last_updated, status, saved_by, saved_at
         FROM legal_docs_versions
        WHERE workspace_id = ? AND doc_id = ?
        ORDER BY version_id DESC`)
            .bind(workspace.id, id)
            .all();
        return c.json({ versions: results ?? [] });
    });
    /** PATCH /_ensemble/core/legal/docs/:id/status — flip active/archived. */
    app.patch('/_ensemble/core/legal/docs/:id/status', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'Workspace not found' }, 400);
        const id = c.req.param('id');
        let body;
        try {
            body = await c.req.json();
        }
        catch {
            return c.json({ error: 'invalid_json' }, 400);
        }
        if (body.status !== 'active' && body.status !== 'archived') {
            return c.json({ error: 'status must be active or archived' }, 400);
        }
        const res = await c.env.DB.prepare(`UPDATE legal_docs SET status = ?, updated_by = ?, updated_at = datetime('now')
        WHERE workspace_id = ? AND id = ?`)
            .bind(body.status, actor(c), workspace.id, id)
            .run();
        if (!res.meta.changes)
            return c.json({ error: 'not_found' }, 404);
        return c.json({ ok: true, id, status: body.status });
    });
    /** DELETE /_ensemble/core/legal/docs/:id — soft-delete (→ archived). */
    app.delete('/_ensemble/core/legal/docs/:id', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'Workspace not found' }, 400);
        const id = c.req.param('id');
        const res = await c.env.DB.prepare(`UPDATE legal_docs SET status = 'archived', updated_by = ?, updated_at = datetime('now')
        WHERE workspace_id = ? AND id = ?`)
            .bind(actor(c), workspace.id, id)
            .run();
        if (!res.meta.changes)
            return c.json({ error: 'not_found' }, 404);
        return c.json({ ok: true, id, status: 'archived' });
    });
    // ───────────────────────── Settings ─────────────────────────
    /**
     * GET /_ensemble/core/legal/settings — the five legal.* placeholder
     * values + the public-publish flag (`publicEnabled`).
     */
    app.get('/_ensemble/core/legal/settings', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'Workspace not found' }, 400);
        const { getSetting } = await import('../../../services/workspace-settings.js');
        const entries = await Promise.all(LEGAL_SETTING_KEYS.map(async (key) => [key, await getSetting(c.env, workspace.id, key)]));
        const publicEnabled = (await getSetting(c.env, workspace.id, 'legal_public_enabled')) === 'true';
        return c.json({ settings: Object.fromEntries(entries), publicEnabled });
    });
    /** PUT /_ensemble/core/legal/settings — patch one or more legal.* values. */
    app.put('/_ensemble/core/legal/settings', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'Workspace not found' }, 400);
        let body;
        try {
            body = await c.req.json();
        }
        catch {
            return c.json({ error: 'invalid_json' }, 400);
        }
        const { setSetting } = await import('../../../services/workspace-settings.js');
        const who = actor(c) ?? undefined;
        const updated = [];
        for (const key of LEGAL_SETTING_KEYS) {
            if (key in body) {
                const value = body[key];
                if (typeof value !== 'string') {
                    return c.json({ error: 'setting values must be strings', key }, 400);
                }
                await setSetting(c.env, workspace.id, key, value, who);
                updated.push(key);
            }
        }
        // The publish toggle. Accepts a boolean `publicEnabled`; stored as
        // the string 'true'/'false' the gate reads.
        if ('publicEnabled' in body) {
            if (typeof body.publicEnabled !== 'boolean') {
                return c.json({ error: 'publicEnabled must be a boolean' }, 400);
            }
            await setSetting(c.env, workspace.id, 'legal_public_enabled', body.publicEnabled ? 'true' : 'false', who);
            updated.push('legal_public_enabled');
        }
        return c.json({ ok: true, updated });
    });
}
//# sourceMappingURL=routes.js.map