/**
 * Workspace brand-domain management API.
 *
 * Operators register the hostnames a tenant's public surfaces serve under
 * (e.g. curalisto.com). Backed by the workspace_domains table (migration
 * 017); the resolver reads it to map host → tenant. See
 * services/brand-domain.ts and docs/plan/brand-domain.md.
 *
 *   GET    /_ensemble/domains          list this workspace's domains
 *   POST   /_ensemble/domains          add one  { domain, proto? }
 *   DELETE /_ensemble/domains/:domain  remove one
 *
 * Admin-only (mutations). Mounted under auth in create-workspace.
 */
import { Hono } from 'hono';
import { validateBrandDomain, invalidateDomainCache } from '../services/brand-domain.js';
function requireAdmin(c) {
    const membership = c.get('membership');
    if (!membership || (membership.role !== 'admin' && membership.role !== 'owner')) {
        return c.json({ error: 'admin role required' }, 403);
    }
    return { ok: true };
}
export function createDomainsRoutes() {
    const app = new Hono();
    /** GET /_ensemble/domains — list the workspace's brand domains. */
    app.get('/_ensemble/domains', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'workspace not resolved' }, 400);
        const { results } = await c.env.DB.prepare(`SELECT domain, proto, verified, created_at FROM workspace_domains
        WHERE workspace_id = ? ORDER BY created_at ASC, domain ASC`)
            .bind(workspace.id)
            .all();
        return c.json({
            domains: (results ?? []).map((r) => ({
                domain: r.domain,
                proto: r.proto,
                verified: r.verified === 1,
                createdAt: r.created_at,
            })),
        });
    });
    /** POST /_ensemble/domains — add a brand domain. */
    app.post('/_ensemble/domains', async (c) => {
        const check = requireAdmin(c);
        if (check instanceof Response)
            return check;
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'workspace not resolved' }, 400);
        let body;
        try {
            body = await c.req.json();
        }
        catch {
            return c.json({ error: 'invalid_json' }, 400);
        }
        const domain = (body.domain ?? '').trim().toLowerCase();
        const err = validateBrandDomain(domain);
        if (err)
            return c.json({ error: err }, 400);
        const proto = body.proto === 'http' ? 'http' : 'https';
        // PRIMARY KEY(domain) enforces one-domain-one-tenant. A collision —
        // whether this workspace re-adds it or another tenant claims it — is
        // surfaced as a friendly 409 rather than a 500.
        const existing = await c.env.DB.prepare(`SELECT workspace_id FROM workspace_domains WHERE domain = ?`)
            .bind(domain)
            .first();
        if (existing) {
            const mine = existing.workspace_id === workspace.id;
            return c.json({ error: mine ? 'domain already added to this workspace' : 'domain already in use', domain }, 409);
        }
        const user = c.get('user');
        await c.env.DB.prepare(`INSERT INTO workspace_domains (domain, workspace_id, proto, verified, created_by)
       VALUES (?, ?, ?, 1, ?)`)
            .bind(domain, workspace.id, proto, user?.id ?? null)
            .run();
        invalidateDomainCache(workspace.id, domain);
        return c.json({ ok: true, domain, proto, verified: true });
    });
    /** DELETE /_ensemble/domains/:domain — remove a brand domain. */
    app.delete('/_ensemble/domains/:domain', async (c) => {
        const check = requireAdmin(c);
        if (check instanceof Response)
            return check;
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'workspace not resolved' }, 400);
        const domain = c.req.param('domain').trim().toLowerCase();
        const res = await c.env.DB.prepare(`DELETE FROM workspace_domains WHERE workspace_id = ? AND domain = ?`)
            .bind(workspace.id, domain)
            .run();
        invalidateDomainCache(workspace.id, domain);
        if (!res.meta.changes)
            return c.json({ error: 'not_found', domain }, 404);
        return c.json({ ok: true, domain });
    });
    return app;
}
//# sourceMappingURL=domains.js.map