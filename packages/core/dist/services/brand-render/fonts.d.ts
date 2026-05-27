/**
 * Font loader — R2 → Cache API → Satori.
 *
 * v0.1.51. Pattern lifted from heart-hands' fonts.ts (R2 + Cache API
 * with synthetic Request keys), adapted to per-workspace lookup.
 *
 * Font storage model
 * ──────────────────
 * Operators install fonts via the Typography tab's Save flow:
 *   1. Operator picks "Playfair Display 700" in the picker
 *   2. POST /_ensemble/core/brand/typography/save
 *   3. Server: fetch woff2 from fonts.gstatic.com → wawoff2 decode →
 *      opentype.js re-emit as TTF → r2.put('fonts/google/...')
 *   4. brand_tokens commits with wordmark_family = "Playfair Display"
 *
 * After install, fonts are read from R2 directly by this module.
 * Google Fonts is never touched at render time — the slow path is
 * front-loaded to the operator's Save action.
 *
 * Backstop: first-render migration. Workspaces that had typography
 * saved BEFORE v0.1.51 deploy don't have TTFs in R2 yet. When a
 * render encounters a missing font, render.ts calls
 * installFontIfMissing() to fetch it inline. This adds ~300-500ms
 * to the very first render that needs each missing font; after that,
 * the font is in R2 like any normal install.
 *
 * Cache key versioning
 * ────────────────────
 * The synthetic Request URL embeds a `v1` segment. When we ever need
 * to invalidate all cached font Responses (e.g. we changed how we
 * pre-process TTFs), bump the version segment — old Responses are
 * orphaned and Cache API garbage-collects them on the standard
 * eviction schedule.
 */
import type { Env } from '../../types';
/**
 * Font metadata + binary as Satori expects. The `data` field is the
 * raw TTF as ArrayBuffer.
 */
export interface FontData {
    name: string;
    data: ArrayBuffer;
    weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
    style: 'normal' | 'italic';
}
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
export declare function googleFontR2Key(family: string, weight: number): string;
/**
 * Per-workspace custom font (operator uploaded a TTF themselves).
 * Stored under the workspace's own R2 namespace because there's no
 * shared canonical version.
 */
export declare function customFontR2Key(workspaceSlug: string, family: string, weight: number): string;
/**
 * Resolve `family + weight` to an R2 key. We currently only handle
 * the Google Fonts case. Custom uploads will be a separate code
 * path when the upload UI ships.
 */
export declare function resolveFontR2Key(family: string, weight: number): string;
interface LoadFontsRequest {
    family: string;
    weight: number;
    style?: 'normal' | 'italic';
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
export declare function loadFonts(env: Env, workspaceId: string, requests: LoadFontsRequest[]): Promise<FontData[]>;
/**
 * Distinguishable error so render.ts can attempt to install the
 * font inline before retrying. Any other R2 error (bucket missing,
 * permission denied) bubbles up as a regular Error and surfaces as
 * a 500 to the client.
 */
export declare class FontNotInR2Error extends Error {
    family: string;
    weight: FontData['weight'];
    r2Key: string;
    constructor(family: string, weight: FontData['weight'], r2Key: string);
}
export {};
//# sourceMappingURL=fonts.d.ts.map