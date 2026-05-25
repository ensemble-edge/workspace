import { getR2Bucket } from '../r2-binding.js';
/**
 * Canonical R2 key for a Google Font at a specific weight. Same key
 * across every workspace — Google Fonts is identical for everyone,
 * so the TTF is too. Sharing the R2 path means the first workspace
 * to install a popular font pays the conversion cost; every other
 * workspace gets an instant R2 head-hit.
 *
 * The key is intentionally under the bucket's `fonts/` prefix so it
 * sits alongside `brand/<workspace>/...` without colliding.
 */
export function googleFontR2Key(family, weight) {
    const slug = family.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return `fonts/google/${slug}-${weight}.ttf`;
}
/**
 * Per-workspace custom font (operator uploaded a TTF themselves).
 * Stored under the workspace's own R2 namespace because there's no
 * shared canonical version.
 */
export function customFontR2Key(workspaceSlug, family, weight) {
    const slug = family.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return `fonts/custom/${workspaceSlug}/${slug}-${weight}.ttf`;
}
/**
 * Resolve `family + weight` to an R2 key. We currently only handle
 * the Google Fonts case. Custom uploads will be a separate code
 * path when the upload UI ships.
 */
export function resolveFontR2Key(family, weight) {
    return googleFontR2Key(family, weight);
}
/**
 * Load fonts from R2, caching responses in the Cache API. Each
 * requested font becomes one FontData entry for Satori.
 *
 * Two-tier cache:
 *   - Cache API (edge, ~30 days)
 *   - R2 (durable, indefinite)
 *
 * Missing fonts throw — the call site is responsible for invoking
 * installFontIfMissing() first when migrating an existing workspace.
 * Failing loudly during render is intentional: silently substituting
 * a fallback would mean the wrong glyphs render and the operator
 * has no idea why.
 */
export async function loadFonts(env, workspaceId, requests) {
    const r2 = await getR2Bucket(env, workspaceId);
    if (!r2)
        throw new Error('R2 bucket not configured for workspace');
    const cache = await caches.open('brand-fonts-v1');
    const out = [];
    for (const req of requests) {
        const key = resolveFontR2Key(req.family, req.weight);
        const cacheKey = new Request(`https://fonts.internal/v1/${key}`);
        let response = await cache.match(cacheKey);
        if (!response) {
            const obj = await r2.get(key);
            if (!obj) {
                throw new FontNotInR2Error(req.family, req.weight, key);
            }
            const buf = await obj.arrayBuffer();
            response = new Response(buf, {
                headers: { 'Cache-Control': 'public, max-age=2592000' },
            });
            // Best-effort write to Cache API; if it fails, future requests
            // re-read from R2 (still fast).
            try {
                await cache.put(cacheKey, response.clone());
            }
            catch { /* noop */ }
        }
        const data = await response.arrayBuffer();
        out.push({
            name: req.family,
            data,
            weight: req.weight,
            style: req.style ?? 'normal',
        });
    }
    return out;
}
/**
 * Distinguishable error so render.ts can attempt to install the
 * font inline before retrying. Any other R2 error (bucket missing,
 * permission denied) bubbles up as a regular Error and surfaces as
 * a 500 to the client.
 */
export class FontNotInR2Error extends Error {
    family;
    weight;
    r2Key;
    constructor(family, weight, r2Key) {
        super(`Font ${family} ${weight} not in R2 at ${r2Key}`);
        this.family = family;
        this.weight = weight;
        this.r2Key = r2Key;
        this.name = 'FontNotInR2Error';
    }
}
//# sourceMappingURL=fonts.js.map