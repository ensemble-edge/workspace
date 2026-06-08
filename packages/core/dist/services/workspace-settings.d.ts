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
export type SettingKey = 'session_ttl_seconds' | 'asset_public_alias_path' | 'public_brand_guide_enabled' | 'r2_selected_bucket' | 'r2_binding_name' | 'legal.company_name' | 'legal.business_address' | 'legal.support_email' | 'legal.support_phone' | 'legal.notices_email' | 'legal_public_enabled';
export declare const DEFAULT_SETTINGS: Record<SettingKey, string>;
/**
 * Rewrite a canonical brand URL into the operator's configured
 * "pretty" alias form, when one is set.
 *
 * v0.1.93: canonical brand URLs live at `/brand/*` (no `/_ensemble/`
 * prefix). The alias transform rewrites either the legacy
 * `/_ensemble/brand/...` form OR the canonical `/brand/...` form into
 * `/<alias>/brand/...`. One transform, applied uniformly across the
 * full brand surface:
 *
 *   /brand/asset/<r2-key>      → /<alias>/brand/asset/<r2-key>
 *   /brand/render/<filename>   → /<alias>/brand/render/<filename>
 *   /brand/spec                → /<alias>/brand/spec
 *   /brand/css                 → /<alias>/brand/css
 *   /brand/favicon.svg         → /<alias>/brand/favicon.svg
 *   /brand/<future>            → /<alias>/brand/<future>
 *
 * The legacy `/_ensemble/brand/...` form is still matched so any
 * stored token values from earlier releases still alias correctly on
 * read.
 *
 * Stored brand_token values stay canonical — changing the alias path
 * never breaks stored data. This helper transforms on read.
 *
 * Inputs that pass through unchanged:
 *   - Empty / null URLs
 *   - Already-aliased URLs (don't start with /brand/ or /_ensemble/brand/)
 *   - Absolute URLs (https://...)
 *   - Non-brand /_ensemble paths (auth, runtime, etc. — system-internal,
 *     not operator-distributed)
 */
export declare function applyAssetAlias(url: string | null | undefined, aliasPath: string): string | null;
/**
 * Convenience: load the alias-path setting and return a transform
 * function. Callers that emit multiple URLs in one response do this
 * once and reuse the returned function.
 */
export declare function getAssetAliasTransform(env: Env, workspaceId: string): Promise<(url: string | null | undefined) => string | null>;
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