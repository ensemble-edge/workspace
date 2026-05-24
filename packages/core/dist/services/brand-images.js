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
/**
 * Pure resolver — takes the brand_tokens map and returns the best URL
 * for the requested (kind, mode, format). No DB or fetch.
 *
 * `tokens` is the flat map of brand_token rows for the workspace,
 * shaped { logo_wordmark: '/path', logo_wordmark_dark: '/dark', ... }.
 */
export function resolveBrandImage(tokens, kind, opts = {}) {
    const mode = opts.mode ?? 'light';
    const format = opts.format ?? 'raster';
    const candidates = buildCandidates(kind, mode, format);
    for (const key of candidates) {
        const v = tokens[key];
        if (v && v.trim())
            return v;
    }
    return null;
}
/**
 * Build the lookup order for a given (kind, mode, format). Most-specific
 * first. Exported separately so tests + the LogosTab UI can show
 * operators which key will be used for which context.
 */
export function buildCandidates(kind, mode, format) {
    const base = `logo_${kind}`;
    const out = [];
    if (mode === 'dark' && format === 'svg') {
        out.push(`${base}_dark_svg`, `${base}_dark`, `${base}_svg`, base);
    }
    else if (mode === 'dark') {
        out.push(`${base}_dark`, base, `${base}_svg`);
    }
    else if (format === 'svg') {
        out.push(`${base}_svg`, base);
    }
    else {
        out.push(base, `${base}_svg`);
    }
    return out;
}
/**
 * Resolve all standard logo slots in one pass. Convenience for callers
 * (especially the public brand guide page) that want every variant at
 * once.
 */
export function resolveAllBrandImages(tokens, mode = 'light') {
    const kinds = [
        'wordmark', 'icon_mark', 'favicon', 'social_avatar', 'og_image',
    ];
    const out = {};
    for (const k of kinds)
        out[k] = resolveBrandImage(tokens, k, { mode });
    return out;
}
//# sourceMappingURL=brand-images.js.map