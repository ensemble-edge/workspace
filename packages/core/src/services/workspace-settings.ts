/**
 * Workspace settings service.
 *
 * Operator-tunable policy that's neither brand identity nor an
 * integration credential. Values are strings; callers parse/validate
 * per-key. Defaults live in `DEFAULT_SETTINGS` below so reads always
 * return something sensible even on a fresh workspace.
 *
 * v0.1.15 keys: session_ttl_seconds.
 * Future keys: idle_timeout_seconds, mfa_required, ip_allowlist, ...
 */

interface Env {
  DB: D1Database;
}

export type SettingKey =
  | 'session_ttl_seconds'
  // v0.1.15.1: when 'true', R2-backed brand assets also serve from
  // /assets/<key> in addition to the canonical /_ensemble/brand/asset/<key>.
  // Presentation-only; stored brand_token values stay canonical so
  // changing this setting cannot break stored data.
  | 'asset_public_alias_enabled'
  // v0.1.15.1: when 'true', the public brand guide page at /brand is
  // reachable without auth. When 'false' or unset, /brand 404s.
  | 'public_brand_guide_enabled';

export const DEFAULT_SETTINGS: Record<SettingKey, string> = {
  // 30 days — matches typical workspace expectations. Operators can
  // dial this down to as little as 1 hour for sensitive deployments.
  session_ttl_seconds: String(30 * 24 * 60 * 60),
  // Pretty asset path off by default — operators opt in.
  asset_public_alias_enabled: 'false',
  // Brand guide off by default — operators opt in.
  public_brand_guide_enabled: 'false',
};

/** Allowed session TTL values (in seconds) — the UI shows these as options. */
export const SESSION_TTL_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 60 * 60,            label: '1 hour'  },
  { value: 24 * 60 * 60,       label: '1 day'   },
  { value: 7  * 24 * 60 * 60,  label: '7 days'  },
  { value: 14 * 24 * 60 * 60,  label: '14 days' },
  { value: 30 * 24 * 60 * 60,  label: '30 days' },
  { value: 90 * 24 * 60 * 60,  label: '90 days' },
];

export async function getSetting(
  env: Env,
  workspaceId: string,
  key: SettingKey,
): Promise<string> {
  const row = await env.DB.prepare(
    `SELECT value FROM workspace_settings WHERE workspace_id = ? AND key = ?`,
  )
    .bind(workspaceId, key)
    .first<{ value: string }>();
  return row?.value ?? DEFAULT_SETTINGS[key];
}

export async function setSetting(
  env: Env,
  workspaceId: string,
  key: SettingKey,
  value: string,
  updatedBy?: string,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO workspace_settings (workspace_id, key, value, updated_at, updated_by)
     VALUES (?, ?, ?, datetime('now'), ?)
     ON CONFLICT(workspace_id, key) DO UPDATE
       SET value = excluded.value,
           updated_at = excluded.updated_at,
           updated_by = excluded.updated_by`,
  )
    .bind(workspaceId, key, value, updatedBy ?? null)
    .run();
}

/**
 * Parse a session_ttl_seconds setting back to a number, with hard
 * bounds (15 minutes minimum, 365 days maximum) so a corrupt or
 * adversarially-set value can't disable the session entirely or hold
 * it open for years.
 */
export function parseSessionTtl(raw: string): number {
  const n = Number(raw);
  const MIN = 15 * 60;
  const MAX = 365 * 24 * 60 * 60;
  if (!Number.isFinite(n) || n < MIN) return MIN;
  if (n > MAX) return MAX;
  return n;
}
