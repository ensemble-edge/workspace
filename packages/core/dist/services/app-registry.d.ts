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
/** Where an app's traffic comes from — drives routing decisions (§3a). */
export type SurfaceKind = 'operator' | 'public' | 'consumer';
export type AppStatus = 'active' | 'inactive' | 'needs_config';
/** A single (host, path) the app answers on. host '*' = the workspace host(s). */
export interface AppMount {
    host: string;
    path: string;
}
export interface AppEntry {
    id: string;
    tier: 'core' | 'guest';
    name: string;
    icon: string;
    description: string;
    /** The app's base path (core: manifest nav.path; guest: gateway path). */
    basePath: string;
    surfaceKind: SurfaceKind;
    status: AppStatus;
    /** Mounts from installed_apps.settings_json; defaults to [{host:'*', path: basePath}]. */
    mounts: AppMount[];
    /**
     * EVERY path prefix this app serves or depends on when routed on a
     * host — not just its headline path. This is what makes routing
     * scalable + correct: a CF zone route for the host must cover ALL of
     * these, or the app's assets/sub-resources 404 (the brand-guide-logos
     * bug: the page is at /brand but its logos load from
     * /_ensemble/brand/render/*). The routes-hint composes these across all
     * active apps. See routePrefixesFor().
     */
    routePrefixes: string[];
    /** Can the operator disable it? Load-bearing apps are NOT governable. */
    governable: boolean;
    /** App-specific settings blob (e.g. legal's `published`). */
    settings: Record<string, unknown>;
}
interface Env_ {
    DB: D1Database;
}
/**
 * List every app in the workspace with its governance state. The single
 * source of truth for the App Manager, nav, and mount gate.
 */
export declare function listApps(env: Env_, workspaceId: string): Promise<AppEntry[]>;
/** A single app entry, or null. */
export declare function getApp(env: Env_, workspaceId: string, appId: string): Promise<AppEntry | null>;
/**
 * Whether an app is active (enabled) for a workspace. Reads installed_apps
 * directly (cheap, single row) — used by route gates that must 404 a
 * disabled app's surfaces. Defaults to active when no row exists
 * (pre-migration / un-seeded), so nothing breaks before backfill.
 */
export declare function isAppActive(env: Env_, workspaceId: string, appId: string): Promise<boolean>;
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
export declare function isAppPublished(env: Env_, workspaceId: string, appId: string, legacyKey: string): Promise<boolean>;
/** Core app ids that get an installed_apps row. Mirrors migration 018. */
export declare const SEEDED_CORE_APP_IDS: string[];
/**
 * Prepared statements seeding an `active` installed_apps row per core app
 * for a workspace. Folded into the bootstrap db.batch so NEW workspaces
 * get them (migration 018 backfills EXISTING ones). Idempotent.
 */
export declare function buildInstalledAppsSeed(db: D1Database, workspaceId: string): D1PreparedStatement[];
export {};
//# sourceMappingURL=app-registry.d.ts.map