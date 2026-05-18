/**
 * Brand image resolver.
 *
 * Operators can upload multiple variants per logo slot (light, dark,
 * SVG master). Consumers — sidebar, login screen, email templates,
 * favicon link tags, the public brand guide — should never duplicate
 * the resolution logic. They call `resolveBrandImage(tokens, kind, opts)`
 * and get back the most-specific URL we have, or null.
 *
 * Token naming convention (stored in brand_tokens with category='identity'):
 *   logo_<kind>             - base raster
 *   logo_<kind>_dark        - dark-mode raster
 *   logo_<kind>_svg         - vector master (mode-neutral)
 *   logo_<kind>_dark_svg    - dark-mode vector
 *
 * Resolution precedence for `mode='dark'`, `format='svg'`:
 *   1. logo_<kind>_dark_svg
 *   2. logo_<kind>_dark
 *   3. logo_<kind>_svg
 *   4. logo_<kind>
 *   5. null
 *
 * Adding new kinds: just upload tokens with the new prefix. The
 * resolver is shape-agnostic.
 */
export type LogoKind = 'wordmark' | 'icon_mark' | 'favicon' | 'social_avatar' | 'og_image';
export type LogoMode = 'light' | 'dark';
export type LogoFormat = 'svg' | 'raster';
export interface ResolveOptions {
    /** 'light' (default) or 'dark'. Selects which variant pair to prefer. */
    mode?: LogoMode;
    /** 'svg' prefers vector when available. 'raster' forces raster. Default 'raster'. */
    format?: LogoFormat;
}
/**
 * Pure resolver — takes the brand_tokens map and returns the best URL
 * for the requested (kind, mode, format). No DB or fetch.
 *
 * `tokens` is the flat map of brand_token rows for the workspace,
 * shaped { logo_wordmark: '/path', logo_wordmark_dark: '/dark', ... }.
 */
export declare function resolveBrandImage(tokens: Readonly<Record<string, string | null | undefined>>, kind: LogoKind, opts?: ResolveOptions): string | null;
/**
 * Build the lookup order for a given (kind, mode, format). Most-specific
 * first. Exported separately so tests + the LogosTab UI can show
 * operators which key will be used for which context.
 */
export declare function buildCandidates(kind: LogoKind, mode: LogoMode, format: LogoFormat): string[];
/**
 * Resolve all standard logo slots in one pass. Convenience for callers
 * (especially the public brand guide page) that want every variant at
 * once.
 */
export declare function resolveAllBrandImages(tokens: Readonly<Record<string, string | null | undefined>>, mode?: LogoMode): Record<LogoKind, string | null>;
//# sourceMappingURL=brand-images.d.ts.map