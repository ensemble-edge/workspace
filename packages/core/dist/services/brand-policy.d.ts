/**
 * Brand logo policy — the source of truth for what compositions,
 * finishes, and backgrounds a workspace allows. Drives the
 * brand-asset generator (cannot produce banned combinations), the
 * brand guide (renders the approved finish × background matrix
 * AND the banned-uses gallery), and the Composition admin UI.
 *
 * Stored as a single JSON blob in brand_tokens under category
 * 'identity' key 'logo_policy'. Versioned in-band so we can migrate
 * the schema safely if it grows.
 */
import type { D1Database } from '@cloudflare/workers-types';
export type CompositionId = 'wordmark-only' | 'icon-only' | 'stacked' | 'horizontal';
export type FinishId = 'full-color' | 'mono-black' | 'mono-white' | 'mono-brand';
export interface CompositionConfig {
    allowed: boolean;
    /** Icon size relative to wordmark cap-height (stacked + horizontal only). */
    iconScale?: number;
    /** Spacing in em (relative to wordmark font-size). */
    spacing?: number;
    /** Horizontal alignment of icon vs wordmark (stacked only). */
    hAlign?: 'left' | 'center' | 'right';
    /** Vertical alignment of icon vs wordmark cap-height (horizontal only). */
    vAlign?: 'top' | 'middle' | 'bottom';
}
export interface FinishOption {
    id: FinishId;
    label: string;
    allowed: boolean;
    /**
     * Fill override for the finish. `currentColor` means "use the
     * theme's foreground." Hex values force a specific color. `null`
     * means "do not override fills" (the full-color finish).
     */
    fillOverride: string | null;
}
export interface BackgroundOption {
    id: string;
    label: string;
    allowed: boolean;
    /** CSS color value. 'transparent' is the literal CSS keyword. */
    color: string;
}
export interface BannedPair {
    finishId: FinishId;
    backgroundId: string;
    reason?: string;
}
export interface LogoPolicy {
    /** Schema version — bump on breaking changes. */
    version: 1;
    compositions: Record<CompositionId, CompositionConfig>;
    finishes: FinishOption[];
    backgrounds: BackgroundOption[];
    bannedPairs: BannedPair[];
}
/**
 * Default policy for a fresh workspace. Permissive on compositions and
 * finishes; auto-banned pairs computed at lookup time from the actual
 * background colors via WCAG contrast.
 */
export declare function defaultPolicy(): LogoPolicy;
/**
 * Load the policy. Returns the default when no policy is set.
 */
export declare function loadPolicy(db: D1Database, workspaceId: string): Promise<LogoPolicy>;
/**
 * Save the policy.
 */
export declare function savePolicy(db: D1Database, workspaceId: string, policy: LogoPolicy): Promise<void>;
/**
 * WCAG contrast ratio between two hex colors. Returns 1–21.
 */
export declare function contrastRatio(fgHex: string, bgHex: string): number;
/**
 * Compute auto-banned pairs based on WCAG contrast against the actual
 * brand background colors. Called at lookup time so changes to the
 * background pair invalidate stale auto-bans automatically.
 *
 * Threshold: 4.5:1 (WCAG AA for normal text). Logos are typically
 * larger than text but we use the strict threshold so the brand
 * guide's banned-uses gallery is conservative (better to flag a
 * borderline pair than to ship something illegible).
 */
export declare function computeAutoBannedPairs(policy: LogoPolicy, brandColors: {
    bgLight: string;
    bgDark: string;
    primary: string;
}): BannedPair[];
/**
 * Combine operator-curated bans with auto-computed contrast bans.
 * Used by the brand guide + variants matrix to know which cells
 * are forbidden.
 */
export declare function effectiveBannedPairs(policy: LogoPolicy, brandColors: {
    bgLight: string;
    bgDark: string;
    primary: string;
}): BannedPair[];
/**
 * Check whether a specific finish × background pair is allowed.
 * Used by the generator endpoint to refuse banned combinations.
 */
export declare function isPairAllowed(policy: LogoPolicy, brandColors: {
    bgLight: string;
    bgDark: string;
    primary: string;
}, finishId: FinishId, backgroundId: string): boolean;
//# sourceMappingURL=brand-policy.d.ts.map