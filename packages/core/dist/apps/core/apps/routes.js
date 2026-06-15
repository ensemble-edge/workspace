/**
 * core:apps — App Manager server routes.
 *
 * The single surface that governs every app (core + guest): list them,
 * enable/disable, edit mounts, and emit the recommended CF routes block.
 * Reads/writes installed_apps via the app-registry service.
 *
 *   GET   /_ensemble/core/apps              list all apps + governance state
 *   PATCH /_ensemble/core/apps/:id          set status / mounts / settings
 *   GET   /_ensemble/core/apps/routes-hint  recommended wrangler [[routes]]
 *
 * Mutations are admin-gated. See docs/plan/app-manager-implementation.md.
 */
import { listApps, getApp } from '../../../services/app-registry.js';
function requireAdmin(c) {
    const m = c.get('membership');
    if (!m || (m.role !== 'admin' && m.role !== 'owner')) {
        return c.json({ error: 'admin role required' }, 403);
    }
    return { ok: true };
}
/** Validate a mounts array from a PATCH body. Returns error string or null. */
function validateMounts(mounts) {
    if (!Array.isArray(mounts))
        return 'mounts must be an array';
    for (const m of mounts) {
        if (!m || typeof m !== 'object')
            return 'each mount must be an object';
        const mm = m;
        if (typeof mm.host !== 'string' || !mm.host)
            return 'mount.host must be a non-empty string';
        if (typeof mm.path !== 'string' || !mm.path.startsWith('/'))
            return 'mount.path must start with /';
    }
    return null;
}
export function registerAppsRoutes(app) {
    /** GET /_ensemble/core/apps — every app + governance state. */
    app.get('/_ensemble/core/apps', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'workspace not resolved' }, 400);
        const apps = await listApps(c.env, workspace.id);
        return c.json({ apps });
    });
    /**
     * GET /_ensemble/core/apps/routes-hint — the recommended CF zone-route
     * blocks a tenant should set, derived from the mount map + surface
     * taxonomy. Read-only, copyable. Replaces the hand-maintained routing
     * convention (§3a/§3b of the plan).
     *
     * Registered BEFORE /:id so "routes-hint" isn't matched as an app id.
     */
    app.get('/_ensemble/core/apps/routes-hint', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'workspace not resolved' }, 400);
        const apps = await listApps(c.env, workspace.id);
        // Hosts that need a zone route come from TWO sources, not just mounts:
        //   1. Every REGISTERED brand domain — because the workspace already
        //      serves its domain-level public surfaces there the moment the
        //      domain is registered: the /brand guide, /legal/* pages, AND
        //      their assets under /_ensemble/brand/* (logos, favicons, CSS).
        //      These are NOT "app mounts" — they come for free with the
        //      domain — so a mount-only hint under-reported them and left the
        //      brand guide's logos (/_ensemble/brand/render/*) un-routed → 404.
        //   2. Any explicit non-'*' app mount host (guest apps on a brand path).
        const hosts = new Set();
        try {
            const { results } = await c.env.DB.prepare(`SELECT domain FROM workspace_domains WHERE workspace_id = ?`)
                .bind(workspace.id)
                .all();
            for (const r of results ?? [])
                hosts.add(r.domain);
        }
        catch {
            // workspace_domains missing → fall back to mount-derived hosts only.
        }
        for (const a of apps) {
            if (a.status !== 'active')
                continue;
            for (const m of a.mounts)
                if (m.host && m.host !== '*')
                    hosts.add(m.host);
        }
        // For each brand host, gather the COMPLETE set of path prefixes the
        // active apps serving there need routed (declared per-app via
        // routePrefixes — basePath + asset/sub-resource deps). This is the
        // scalable model: every built-in or guest app contributes its
        // prefixes, so the hint is correct as more apps mount on the domain.
        const zone = (host) => host.split('.').slice(-2).join('.');
        const hostPrefixes = {};
        for (const host of hosts) {
            const prefixes = new Set();
            for (const a of apps) {
                if (a.status !== 'active')
                    continue;
                // A core public page serves on any registered brand host; a guest
                // contributes only if it has a mount on THIS host.
                const onHost = a.tier === 'core'
                    ? a.surfaceKind === 'public'
                    : a.mounts.some((m) => m.host === host);
                if (!onHost)
                    continue;
                for (const p of a.routePrefixes)
                    prefixes.add(p);
            }
            hostPrefixes[host] = [...prefixes].sort();
        }
        // RECOMMENDED: a single `host/*` route per host — the complete,
        // opinionated answer that covers every prefix above (pages AND their
        // assets) in one line. `prefixes` is provided for transparency /
        // debugging and for operators who insist on narrowing (they must
        // include ALL listed prefixes, or assets 404).
        const blocks = [...hosts].map((host) => `[[routes]]\npattern = "${host}/*"\nzone_name = "${zone(host)}"`);
        return c.json({
            hosts: [...hosts],
            wrangler: blocks.join('\n\n'),
            // Per-host prefix breakdown: what host/* expands to. Generic across
            // all apps — no brand-specific special-casing.
            prefixes: hostPrefixes,
            note: 'Use the host/* route as-is — one line per host covers every app ' +
                'serving there AND its assets (e.g. logos at /_ensemble/brand/render/*, ' +
                '/brand/css). The `prefixes` map shows exactly what host/* expands to. ' +
                'If you narrow the route you MUST include every listed prefix or assets ' +
                '404. Point each host at the workspace worker (CNAME / CF custom ' +
                'hostname). Anonymous consumer surfaces (your own quiz/API workers) ' +
                'need their OWN routes — see the guest SDK docs.',
        });
    });
    /**
     * PATCH /_ensemble/core/apps/:id — set status / mounts / settings.
     * Admin only. Rejects disabling a non-governable app and mounts whose
     * host isn't one of the workspace's registered brand domains.
     */
    app.patch('/_ensemble/core/apps/:id', async (c) => {
        const check = requireAdmin(c);
        if (check instanceof Response)
            return check;
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'workspace not resolved' }, 400);
        const id = c.req.param('id');
        const current = await getApp(c.env, workspace.id, id);
        if (!current)
            return c.json({ error: 'not_found', id }, 404);
        let body;
        try {
            body = await c.req.json();
        }
        catch {
            return c.json({ error: 'invalid_json' }, 400);
        }
        // Status change.
        let nextStatus = current.status;
        if (body.status !== undefined) {
            if (body.status !== 'active' && body.status !== 'inactive' && body.status !== 'needs_config') {
                return c.json({ error: 'status must be active | inactive | needs_config' }, 400);
            }
            if (body.status !== 'active' && !current.governable) {
                return c.json({ error: `${id} cannot be disabled` }, 409);
            }
            nextStatus = body.status;
        }
        // Mounts change — every non-'*' host must be a registered brand domain.
        let nextMounts = current.mounts;
        if (body.mounts !== undefined) {
            const err = validateMounts(body.mounts);
            if (err)
                return c.json({ error: err }, 400);
            const mounts = body.mounts;
            const customHosts = mounts.map((m) => m.host).filter((h) => h !== '*');
            if (customHosts.length) {
                let known = new Set();
                try {
                    const { results } = await c.env.DB.prepare(`SELECT domain FROM workspace_domains WHERE workspace_id = ?`)
                        .bind(workspace.id)
                        .all();
                    known = new Set((results ?? []).map((r) => r.domain));
                }
                catch {
                    known = new Set(); // table missing → no registered domains
                }
                const bad = customHosts.find((h) => !known.has(h));
                if (bad) {
                    return c.json({ error: `host "${bad}" is not a registered brand domain`, host: bad }, 400);
                }
            }
            nextMounts = mounts;
        }
        // Settings merge (shallow).
        const nextSettings = body.settings && typeof body.settings === 'object'
            ? { ...current.settings, ...body.settings }
            : current.settings;
        // Persist as an installed_apps upsert. mounts live inside
        // settings_json alongside the app settings (the registry reads them
        // back out). manifest_json kept minimal for core apps.
        const settingsJson = JSON.stringify({ ...nextSettings, mounts: nextMounts });
        const user = c.get('user');
        await c.env.DB.prepare(`INSERT INTO installed_apps (workspace_id, app_id, manifest_json, settings_json, status, installed_by)
       VALUES (?, ?, '{}', ?, ?, ?)
       ON CONFLICT (workspace_id, app_id) DO UPDATE SET
         settings_json = excluded.settings_json,
         status = excluded.status`)
            .bind(workspace.id, id, settingsJson, nextStatus, user?.id ?? null)
            .run();
        const updated = await getApp(c.env, workspace.id, id);
        return c.json({ ok: true, app: updated });
    });
}
//# sourceMappingURL=routes.js.map