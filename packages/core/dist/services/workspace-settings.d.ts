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
export type SettingKey = 'session_ttl_seconds' | 'asset_public_alias_path' | 'public_brand_guide_enabled' | 'r2_selected_bucket' | 'r2_binding_name';
export declare const DEFAULT_SETTINGS: Record<SettingKey, string>;
/**
 * Reserved path segments that operators cannot use for the asset
 * alias. Anything that would shadow a real workspace route, plus
 * anything starting with `_` (the internal-namespace prefix). The
 * alias *can* still be set to `assets` — that's the suggested default
 * and doesn't shadow anything.
 */
export declare const RESERVED_ALIAS_PATHS: Set<string>;
/**
 * Validate a proposed alias-path value. Returns an error message
 * string if invalid; null if valid. Empty string is valid (disables
 * the alias).
 */
export declare function validateAliasPath(value: string): string | null;
/** Allowed session TTL values (in seconds) — the UI shows these as options. */
export declare const SESSION_TTL_OPTIONS: Array<{
    value: number;
    label: string;
}>;
export declare function getSetting(env: Env, workspaceId: string, key: SettingKey): Promise<string>;
export declare function setSetting(env: Env, workspaceId: string, key: SettingKey, value: string, updatedBy?: string): Promise<void>;
/**
 * Parse a session_ttl_seconds setting back to a number, with hard
 * bounds (15 minutes minimum, 365 days maximum) so a corrupt or
 * adversarially-set value can't disable the session entirely or hold
 * it open for years.
 */
export declare function parseSessionTtl(raw: string): number;
export {};
//# sourceMappingURL=workspace-settings.d.ts.map