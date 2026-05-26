/**
 * Workspace context routes — the SDK's window into per-workspace +
 * per-user state.
 *
 * Exposes:
 *   GET  /_ensemble/workspace/context            — full workspace context
 *   PUT  /_ensemble/workspace/preferences/locale — set user-preferred locale
 *   GET  /_ensemble/workspace/preferences/locale — read user-preferred locale
 *
 * Contract: see services/workspace-context.ts for the resolver + type
 * definition. The endpoint is intentionally thin — all the real work
 * lives in the resolver so guest-app authors can reason about it
 * cleanly.
 */
import { Hono } from 'hono';
import { resolveWorkspaceContext, setUserPreference, getUserPreference, } from '../services/workspace-context.js';
export function createWorkspaceContextRoutes() {
    const app = new Hono();
    /**
     * Single source of truth for what guest apps + the SDK know about
     * the current workspace + user. See services/workspace-context.ts
     * for the resolver. Unauthenticated callers receive a context with
     * `user: null` and `locale.userPreferred: null` — workspace-level
     * fields stay populated.
     */
    app.get('/_ensemble/workspace/context', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'workspace_not_resolved' }, 400);
        const user = c.get('user');
        const ctx = await resolveWorkspaceContext({
            env: c.env,
            workspaceId: workspace.id,
            userId: user?.id ?? null,
        });
        // Short cache; revalidate frequently because user-preferred locale
        // changes need to propagate fast. Full ETag-based caching is a
        // follow-up if profiling shows it matters.
        return c.json(ctx, 200, { 'Cache-Control': 'private, max-age=10' });
    });
    /**
     * Set the current user's preferred locale. Validates against the
     * workspace's supported locales — a user can't pick a language the
     * workspace doesn't ship.
     */
    app.put('/_ensemble/workspace/preferences/locale', async (c) => {
        const user = c.get('user');
        if (!user?.id)
            return c.json({ error: 'unauthenticated' }, 401);
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'workspace_not_resolved' }, 400);
        const body = await c.req.json().catch(() => ({ locale: '' }));
        const locale = (body.locale ?? '').trim();
        if (!locale) {
            // Empty = clear the preference (fall back to workspace default).
            await setUserPreference(c.env.DB, user.id, 'locale', '');
            return c.json({ ok: true, userPreferred: null });
        }
        // Validate against the workspace's supported list — silent rejection
        // would be a footgun. Tell the operator exactly what went wrong.
        const supported = await c.env.DB.prepare(`SELECT code FROM workspace_locales WHERE workspace_id = ?`).bind(workspace.id).all().catch(() => ({ results: [] }));
        const allowed = new Set((supported.results ?? []).map((r) => r.code));
        if (allowed.size > 0 && !allowed.has(locale)) {
            return c.json({
                error: 'unsupported_locale',
                detail: `Workspace does not support '${locale}'. Supported: ${Array.from(allowed).join(', ')}.`,
            }, 422);
        }
        await setUserPreference(c.env.DB, user.id, 'locale', locale);
        return c.json({ ok: true, userPreferred: locale });
    });
    /**
     * Read the current user's preferred locale (for clients that want
     * just this slice without fetching full context).
     */
    app.get('/_ensemble/workspace/preferences/locale', async (c) => {
        const user = c.get('user');
        if (!user?.id)
            return c.json({ error: 'unauthenticated' }, 401);
        const value = await getUserPreference(c.env.DB, user.id, 'locale');
        return c.json({ userPreferred: value || null });
    });
    return app;
}
//# sourceMappingURL=workspace-context.js.map