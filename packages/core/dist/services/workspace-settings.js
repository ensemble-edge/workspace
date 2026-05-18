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
export const DEFAULT_SETTINGS = {
    // 30 days — matches typical workspace expectations. Operators can
    // dial this down to as little as 1 hour for sensitive deployments.
    session_ttl_seconds: String(30 * 24 * 60 * 60),
    // Empty = alias disabled (canonical /_ensemble/brand/asset/<key> only).
    asset_public_alias_path: '',
    // Brand guide off by default — operators opt in.
    public_brand_guide_enabled: 'false',
    // No bucket selected by default — picker shows the operator's
    // account buckets and prompts them to pick one.
    r2_selected_bucket: '',
    // Default binding name. Operators integrating into an existing CF
    // project (where R2 may already be bound under another name) can
    // change this.
    r2_binding_name: 'R2',
};
/**
 * Reserved path segments that operators cannot use for the asset
 * alias. Anything that would shadow a real workspace route, plus
 * anything starting with `_` (the internal-namespace prefix). The
 * alias *can* still be set to `assets` — that's the suggested default
 * and doesn't shadow anything.
 */
export const RESERVED_ALIAS_PATHS = new Set([
    '_ensemble', // can't override the underscore-namespace anyway, but explicit
    'login', 'logout', 'register',
    'brand', // public brand guide
    'people', 'settings', 'admin', 'auth', 'apps', 'audit', 'home',
    'health', 'bootstrap',
    'api', // common third-party expectation
    'static', // operator could pick it but it's overloaded
    'public',
]);
const ALIAS_PATH_RE = /^[a-z][a-z0-9-]{0,30}$/;
/**
 * Validate a proposed alias-path value. Returns an error message
 * string if invalid; null if valid. Empty string is valid (disables
 * the alias).
 */
export function validateAliasPath(value) {
    const v = value.trim();
    if (v === '')
        return null; // empty = disabled, always valid
    if (!ALIAS_PATH_RE.test(v)) {
        return 'Use lowercase letters, digits, and hyphens. Must start with a letter. Max 31 chars.';
    }
    if (v.startsWith('_')) {
        return 'Cannot start with "_" (reserved for workspace internals).';
    }
    if (RESERVED_ALIAS_PATHS.has(v)) {
        return `"${v}" is reserved (it would shadow a workspace route). Try another name.`;
    }
    return null;
}
/** Allowed session TTL values (in seconds) — the UI shows these as options. */
export const SESSION_TTL_OPTIONS = [
    { value: 60 * 60, label: '1 hour' },
    { value: 24 * 60 * 60, label: '1 day' },
    { value: 7 * 24 * 60 * 60, label: '7 days' },
    { value: 14 * 24 * 60 * 60, label: '14 days' },
    { value: 30 * 24 * 60 * 60, label: '30 days' },
    { value: 90 * 24 * 60 * 60, label: '90 days' },
];
export async function getSetting(env, workspaceId, key) {
    const row = await env.DB.prepare(`SELECT value FROM workspace_settings WHERE workspace_id = ? AND key = ?`)
        .bind(workspaceId, key)
        .first();
    return row?.value ?? DEFAULT_SETTINGS[key];
}
export async function setSetting(env, workspaceId, key, value, updatedBy) {
    await env.DB.prepare(`INSERT INTO workspace_settings (workspace_id, key, value, updated_at, updated_by)
     VALUES (?, ?, ?, datetime('now'), ?)
     ON CONFLICT(workspace_id, key) DO UPDATE
       SET value = excluded.value,
           updated_at = excluded.updated_at,
           updated_by = excluded.updated_by`)
        .bind(workspaceId, key, value, updatedBy ?? null)
        .run();
}
/**
 * Parse a session_ttl_seconds setting back to a number, with hard
 * bounds (15 minutes minimum, 365 days maximum) so a corrupt or
 * adversarially-set value can't disable the session entirely or hold
 * it open for years.
 */
export function parseSessionTtl(raw) {
    const n = Number(raw);
    const MIN = 15 * 60;
    const MAX = 365 * 24 * 60 * 60;
    if (!Number.isFinite(n) || n < MIN)
        return MIN;
    if (n > MAX)
        return MAX;
    return n;
}
//# sourceMappingURL=workspace-settings.js.map