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
export type SettingKey = 'session_ttl_seconds';
export declare const DEFAULT_SETTINGS: Record<SettingKey, string>;
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