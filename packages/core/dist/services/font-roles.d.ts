/**
 * Font role resolution — server-side companion to shell/font-utils.ts.
 *
 * Reads brand_tokens for the five typographic roles (display, heading,
 * body, mono, wordmark) and produces:
 *   - A single Google Fonts <link> URL combining all needed weights/styles
 *   - CSS variables (`--font-<role>` / `--font-<role>-weight` / `--font-<role>-style`)
 *
 * Used by:
 *   - Shell entry HTML — to load the right fonts up front
 *   - /_ensemble/brand/css — to publish the CSS variables consumers reference
 *   - Email + login server-rendered HTML — to render the wordmark in the right face
 *
 * Wordmark falls back to display when its family is unset, so operators
 * don't have to configure wordmark typography unless they want it
 * different.
 */
import type { D1Database } from '@cloudflare/workers-types';
export type FontRole = 'display' | 'heading' | 'body' | 'mono' | 'wordmark';
export interface ResolvedRole {
    family: string;
    weight: string;
    style: 'normal' | 'italic';
    /** True if this role is a system stack (no Google Fonts load needed). */
    isSystem: boolean;
}
/**
 * Resolve all five role triples from a flat token map. Wordmark falls
 * back to display when its family is unset.
 */
export declare function resolveAllRoles(tokens: Record<string, string>): Record<FontRole, ResolvedRole>;
export declare function isSystem(family: string): boolean;
/** Resolve a family to its CSS font-family stack (server-side mirror). */
export declare function familyStack(family: string): string;
/**
 * Build the Google Fonts <link> URL combining every non-system family
 * across all five roles. Only loads the weights+styles actually in use.
 * Returns null when all five roles are system-stacked (no link needed).
 */
export declare function buildGoogleFontsHref(roles: Record<FontRole, ResolvedRole>): string | null;
/**
 * Build the CSS variable block for the five roles. Returns a string
 * suitable for inclusion in /_ensemble/brand/css.
 */
export declare function buildFontCssVars(roles: Record<FontRole, ResolvedRole>): string;
/**
 * Load typography + wordmark brand tokens directly from the DB and
 * resolve. One-stop helper for server-rendered consumers (login HTML,
 * email templates, brand CSS endpoint).
 */
export declare function loadAndResolveRoles(db: D1Database, workspaceId: string): Promise<Record<FontRole, ResolvedRole>>;
//# sourceMappingURL=font-roles.d.ts.map