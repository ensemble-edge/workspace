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

import { getCoreAppManifests } from '../apps/core';

/** Where an app's traffic comes from — drives routing decisions (§3a). */
export type SurfaceKind =
  | 'operator' // operator tool: authenticated, proxied via the gateway
  | 'public' // CMS-authored public page (legal, brand): anonymous + crawlers
  | 'consumer'; // anonymous consumer surface (not workspace-routed; tenant worker)

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
  /** Can the operator disable it? Load-bearing apps are NOT governable. */
  governable: boolean;
  /** App-specific settings blob (e.g. legal's `published`). */
  settings: Record<string, unknown>;
}

interface Env_ {
  DB: D1Database;
}

/**
 * Apps that cannot be disabled — disabling them would brick the
 * workspace's own chrome. The App Manager hides the toggle and the API
 * rejects an attempt to flip them.
 */
const NON_GOVERNABLE = new Set(['core:brand', 'core:people', 'core:admin', 'core:apps']);

/** Core apps whose public pages are crawlable surfaces (not operator tools). */
const PUBLIC_CORE = new Set(['core:legal', 'core:brand']);

interface InstalledRow {
  app_id: string;
  status: string;
  settings_json: string | null;
}

/** Parse settings_json → { mounts?, ...settings }. Tolerates garbage. */
function parseSettings(raw: string | null | undefined): {
  mounts?: AppMount[];
  settings: Record<string, unknown>;
} {
  if (!raw) return { settings: {} };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { settings: {} };
    const { mounts, ...rest } = parsed as Record<string, unknown>;
    const validMounts =
      Array.isArray(mounts) &&
      mounts.every((m) => m && typeof (m as AppMount).host === 'string' && typeof (m as AppMount).path === 'string')
        ? (mounts as AppMount[])
        : undefined;
    return { mounts: validMounts, settings: rest };
  } catch {
    return { settings: {} };
  }
}

/**
 * List every app in the workspace with its governance state. The single
 * source of truth for the App Manager, nav, and mount gate.
 */
export async function listApps(env: Env_, workspaceId: string): Promise<AppEntry[]> {
  // 1. The installed_apps overlay (status + settings/mounts), keyed by app_id.
  const overlay = new Map<string, { status: AppStatus; mounts?: AppMount[]; settings: Record<string, unknown> }>();
  try {
    const { results } = await env.DB.prepare(
      `SELECT app_id, status, settings_json FROM installed_apps WHERE workspace_id = ?`,
    )
      .bind(workspaceId)
      .all<InstalledRow>();
    for (const r of results ?? []) {
      const { mounts, settings } = parseSettings(r.settings_json);
      const status: AppStatus =
        r.status === 'inactive' ? 'inactive' : r.status === 'needs_config' ? 'needs_config' : 'active';
      overlay.set(r.app_id, { status, mounts, settings });
    }
  } catch {
    // installed_apps may not be seeded yet — treat as empty overlay
    // (everything defaults to active, so nothing breaks pre-migration).
  }

  const entries: AppEntry[] = [];

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
      governable: !NON_GOVERNABLE.has(m.id),
      settings: ov?.settings ?? {},
    });
  }

  // 3. Guest apps (installed per workspace).
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, name, icon, description, category, enabled FROM guest_apps WHERE workspace_id = ?`,
    )
      .bind(workspaceId)
      .all<{ id: string; name: string; icon: string | null; description: string | null; category: string; enabled: number }>();
    for (const g of results ?? []) {
      const appId = `guest:${g.id}`;
      const ov = overlay.get(appId);
      const basePath = `/_ensemble/apps/${g.id}`;
      // guest_apps.enabled is the legacy flag; installed_apps.status wins
      // when present, else fall back to the legacy flag.
      const status: AppStatus = ov?.status ?? (g.enabled === 0 ? 'inactive' : 'active');
      entries.push({
        id: appId,
        tier: 'guest',
        name: g.name,
        icon: g.icon ?? 'box',
        description: g.description ?? '',
        basePath,
        surfaceKind: 'operator', // guest apps proxy through the auth-gated gateway
        status,
        mounts: ov?.mounts ?? [{ host: '*', path: basePath }],
        governable: true,
        settings: ov?.settings ?? {},
      });
    }
  } catch {
    // guest_apps table may not exist yet — skip.
  }

  return entries;
}

/** A single app entry, or null. */
export async function getApp(env: Env_, workspaceId: string, appId: string): Promise<AppEntry | null> {
  const all = await listApps(env, workspaceId);
  return all.find((a) => a.id === appId) ?? null;
}

/**
 * Whether an app is active (enabled) for a workspace. Reads installed_apps
 * directly (cheap, single row) — used by route gates that must 404 a
 * disabled app's surfaces. Defaults to active when no row exists
 * (pre-migration / un-seeded), so nothing breaks before backfill.
 */
export async function isAppActive(env: Env_, workspaceId: string, appId: string): Promise<boolean> {
  try {
    const row = await env.DB.prepare(
      `SELECT status FROM installed_apps WHERE workspace_id = ? AND app_id = ?`,
    )
      .bind(workspaceId, appId)
      .first<{ status: string }>();
    if (!row) return true; // no row → not yet governed → active
    return row.status === 'active';
  } catch {
    return true; // table missing → active
  }
}

/** Core app ids that get an installed_apps row. Mirrors migration 018. */
export const SEEDED_CORE_APP_IDS = ['core:brand', 'core:people', 'core:admin', 'core:apps', 'core:legal'];

/**
 * Prepared statements seeding an `active` installed_apps row per core app
 * for a workspace. Folded into the bootstrap db.batch so NEW workspaces
 * get them (migration 018 backfills EXISTING ones). Idempotent.
 */
export function buildInstalledAppsSeed(db: D1Database, workspaceId: string): D1PreparedStatement[] {
  return SEEDED_CORE_APP_IDS.map((id) =>
    db
      .prepare(
        `INSERT INTO installed_apps (workspace_id, app_id, manifest_json, settings_json, status)
         VALUES (?, ?, '{}', '{}', 'active')
         ON CONFLICT (workspace_id, app_id) DO NOTHING`,
      )
      .bind(workspaceId, id),
  );
}
