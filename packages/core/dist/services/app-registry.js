/**
 * App registry — the unifying read for the App Manager.
 *
 * One list of every app in a workspace, regardless of tier:
 *   • core apps   — from getCoreAppManifests() (compiled in)
 *   • guest apps  — from the guest_apps table (installed per workspace)
 * with each app's per-workspace governance state layered on from
 * installed_apps (status + mounts + settings).
 *
 * This replaces the scattered, ad-hoc knowledge of "what apps exist and
 * are they on": the nav handler's hand-listed core apps, the per-app
 * publish toggles, the guest_apps.enabled flag. One registry the App
 * Manager UI, the nav, and the mount gate all read.
 *
 * See docs/plan/app-manager-implementation.md.
 */
import { getCoreAppManifests } from '../apps/core/index.js';
/**
 * Apps that cannot be disabled — disabling them would brick the
 * workspace's own chrome. The App Manager hides the toggle and the API
 * rejects an attempt to flip them.
 */
const NON_GOVERNABLE = new Set(['core:brand', 'core:people', 'core:admin', 'core:apps']);
/** Core apps whose public pages are crawlable surfaces (not operator tools). */
const PUBLIC_CORE = new Set(['core:legal', 'core:brand']);
/**
 * Shared brand asset prefix every public page depends on — logos,
 * favicons, and the /brand/css stylesheet all live (or alias) under the
 * brand namespace. Any app rendered on a brand host that shows the
 * workspace's branding needs these routed too.
 */
const BRAND_ASSET_PREFIXES = ['/_ensemble/brand', '/brand'];
/**
 * The COMPLETE set of path prefixes an app serves/depends on when routed
 * on a host. The routes-hint composes these so a CF zone route covers
 * everything the app needs — not just its headline path. Scalable: a new
 * core or guest app declares its prefixes here (or gets the sensible
 * default) and routing Just Works on the primary domain.
 *
 * @param basePath the app's mount/base path (e.g. '/legal', or a guest's
 *                 public mount path).
 */
function routePrefixesFor(appId, tier, basePath) {
    const set = new Set([basePath]);
    switch (appId) {
        case 'core:brand':
            // The /brand guide page + every brand asset (logos via
            // /_ensemble/brand/render/*, favicons, /brand/css).
            set.add('/brand');
            for (const p of BRAND_ASSET_PREFIXES)
                set.add(p);
            break;
        case 'core:legal':
            // /legal pages + /api/legal/* read API; legal pages pull /brand/css
            // and the brand favicon, so they need the brand asset prefixes too.
            set.add('/legal');
            set.add('/api/legal');
            for (const p of BRAND_ASSET_PREFIXES)
                set.add(p);
            break;
        default:
            if (tier === 'guest') {
                // A guest mounted on a brand path: its mount + the guest runtime
                // assets it loads (the workspace serves these for iframe guests).
                set.add('/_ensemble/runtime');
                // Guests that render workspace branding also want the brand CSS.
                set.add('/brand');
            }
            break;
    }
    return [...set];
}
/** Parse settings_json → { mounts?, ...settings }. Tolerates garbage. */
function parseSettings(raw) {
    if (!raw)
        return { settings: {} };
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object')
            return { settings: {} };
        const { mounts, ...rest } = parsed;
        const validMounts = Array.isArray(mounts) &&
            mounts.every((m) => m && typeof m.host === 'string' && typeof m.path === 'string')
            ? mounts
            : undefined;
        return { mounts: validMounts, settings: rest };
    }
    catch {
        return { settings: {} };
    }
}
/**
 * List every app in the workspace with its governance state. The single
 * source of truth for the App Manager, nav, and mount gate.
 */
export async function listApps(env, workspaceId) {
    // 1. The installed_apps overlay (status + settings/mounts), keyed by app_id.
    const overlay = new Map();
    try {
        const { results } = await env.DB.prepare(`SELECT app_id, status, settings_json FROM installed_apps WHERE workspace_id = ?`)
            .bind(workspaceId)
            .all();
        for (const r of results ?? []) {
            const { mounts, settings } = parseSettings(r.settings_json);
            const status = r.status === 'inactive' ? 'inactive' : r.status === 'needs_config' ? 'needs_config' : 'active';
            overlay.set(r.app_id, { status, mounts, settings });
        }
    }
    catch {
        // installed_apps may not be seeded yet — treat as empty overlay
        // (everything defaults to active, so nothing breaks pre-migration).
    }
    const entries = [];
    // 2. Core apps (compiled-in manifests).
    for (const m of getCoreAppManifests()) {
        const ov = overlay.get(m.id);
        const basePath = m.nav.path;
        entries.push({
            id: m.id,
            tier: 'core',
            name: m.name,
            icon: m.icon,
            description: m.description,
            basePath,
            surfaceKind: PUBLIC_CORE.has(m.id) ? 'public' : 'operator',
            status: ov?.status ?? 'active',
            mounts: ov?.mounts ?? [{ host: '*', path: basePath }],
            routePrefixes: routePrefixesFor(m.id, 'core', basePath),
            governable: !NON_GOVERNABLE.has(m.id),
            settings: ov?.settings ?? {},
        });
    }
    // 3. Guest apps (installed per workspace).
    try {
        const { results } = await env.DB.prepare(`SELECT id, name, icon, description, category, enabled FROM guest_apps WHERE workspace_id = ?`)
            .bind(workspaceId)
            .all();
        for (const g of results ?? []) {
            const appId = `guest:${g.id}`;
            const ov = overlay.get(appId);
            const basePath = `/_ensemble/apps/${g.id}`;
            // guest_apps.enabled is the legacy flag; installed_apps.status wins
            // when present, else fall back to the legacy flag.
            const status = ov?.status ?? (g.enabled === 0 ? 'inactive' : 'active');
            const mounts = ov?.mounts ?? [{ host: '*', path: basePath }];
            // Route prefixes anchor on the guest's PUBLIC mount path (where it
            // serves on a brand host), not the internal gateway path — so the
            // emitted routes cover where it actually answers.
            const publicMount = mounts.find((m) => m.host !== '*')?.path ?? basePath;
            entries.push({
                id: appId,
                tier: 'guest',
                name: g.name,
                icon: g.icon ?? 'box',
                description: g.description ?? '',
                basePath,
                surfaceKind: 'operator', // guest apps proxy through the auth-gated gateway
                status,
                mounts,
                routePrefixes: routePrefixesFor(appId, 'guest', publicMount),
                governable: true,
                settings: ov?.settings ?? {},
            });
        }
    }
    catch {
        // guest_apps table may not exist yet — skip.
    }
    return entries;
}
/** A single app entry, or null. */
export async function getApp(env, workspaceId, appId) {
    const all = await listApps(env, workspaceId);
    return all.find((a) => a.id === appId) ?? null;
}
/**
 * Whether an app is active (enabled) for a workspace. Reads installed_apps
 * directly (cheap, single row) — used by route gates that must 404 a
 * disabled app's surfaces. Defaults to active when no row exists
 * (pre-migration / un-seeded), so nothing breaks before backfill.
 */
export async function isAppActive(env, workspaceId, appId) {
    try {
        const row = await env.DB.prepare(`SELECT status FROM installed_apps WHERE workspace_id = ? AND app_id = ?`)
            .bind(workspaceId, appId)
            .first();
        if (!row)
            return true; // no row → not yet governed → active
        return row.status === 'active';
    }
    catch {
        return true; // table missing → active
    }
}
/**
 * Whether an app's PUBLIC surface is published, read through the App
 * Manager. This consolidates the publish toggle into the app's
 * installed_apps settings (`settings.published`), but with a READ-THROUGH
 * SHIM to a legacy workspace setting so existing workspaces keep their
 * state without a data migration:
 *
 *   1. If installed_apps.settings_json has an explicit `published`
 *      boolean → use it (the App Manager wrote it; new source of truth).
 *   2. Else fall back to `legacyKey` in workspace_settings (e.g.
 *      legal_public_enabled / public_brand_guide_enabled).
 *
 * New writes go to settings.published (via the App Manager PATCH); the
 * legacy key is only ever read as a fallback. No backfill needed.
 */
export async function isAppPublished(env, workspaceId, appId, legacyKey) {
    // 1. explicit settings.published on the installed_apps row.
    try {
        const row = await env.DB.prepare(`SELECT settings_json FROM installed_apps WHERE workspace_id = ? AND app_id = ?`)
            .bind(workspaceId, appId)
            .first();
        if (row?.settings_json) {
            const parsed = JSON.parse(row.settings_json);
            if (typeof parsed.published === 'boolean')
                return parsed.published;
        }
    }
    catch {
        // installed_apps missing → fall through to legacy.
    }
    // 2. legacy workspace setting fallback.
    try {
        const { getSetting } = await import('./workspace-settings.js');
        return (await getSetting(env, workspaceId, legacyKey)) === 'true';
    }
    catch {
        return false;
    }
}
/** Core app ids that get an installed_apps row. Mirrors migration 018. */
export const SEEDED_CORE_APP_IDS = ['core:brand', 'core:people', 'core:admin', 'core:apps', 'core:legal'];
/**
 * Prepared statements seeding an `active` installed_apps row per core app
 * for a workspace. Folded into the bootstrap db.batch so NEW workspaces
 * get them (migration 018 backfills EXISTING ones). Idempotent.
 */
export function buildInstalledAppsSeed(db, workspaceId) {
    return SEEDED_CORE_APP_IDS.map((id) => db
        .prepare(`INSERT INTO installed_apps (workspace_id, app_id, manifest_json, settings_json, status)
         VALUES (?, ?, '{}', '{}', 'active')
         ON CONFLICT (workspace_id, app_id) DO NOTHING`)
        .bind(workspaceId, id));
}
//# sourceMappingURL=app-registry.js.map