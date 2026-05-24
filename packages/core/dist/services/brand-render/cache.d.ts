/**
 * Three-tier brand-asset cache.
 *
 * v0.1.51. Pattern lifted from heart-hands / tin-out-of-tin. The
 * render pipeline is expensive (font load + Satori layout + resvg
 * rasterize for PNG). We cache results aggressively:
 *
 *   Tier 1: Cache API (edge) — Workers' built-in CDN. Sub-ms hits.
 *   Tier 2: R2 (durable) — survives isolate restarts + region
 *           failover. ~30-50ms hits.
 *   Tier 3: Render fresh.
 *
 * In-flight coalescing prevents the variants matrix burst: when
 * 16 cells all hit /render/... simultaneously on a cold cache,
 * only ONE render actually runs; the other 15 await the same
 * Promise.
 *
 * Cache key
 * ─────────
 * The key is a hash over everything that affects the render:
 *   - policy version (composition config, finish definitions, etc.)
 *   - brand tokens version (font family, colors, wordmark text)
 *   - render request (composition, finish, bg, backgrounded, ext)
 *
 * Same inputs → same key → cache hit. Any operator save changes the
 * hash and naturally invalidates the cache — no manual purges, no
 * TTL games. This is structurally better than v0.1.50's 60s TTL
 * because cache reuse is bound to *correctness*, not time.
 *
 * Distribution URLs stay clean (no ?v=hash) because the hash is
 * encoded in the R2 storage key, not the URL. The URL grammar
 * `<slug>-<comp>-<finish>-<bg>.<ext>` is unchanged — it's the
 * STORAGE PATH that's versioned, not the URL.
 */
import type { Env } from '../../types';
export interface CachedAsset {
    body: ArrayBuffer;
    contentType: string;
}
interface CacheOpts {
    env: Env;
    workspaceId: string;
    /** Logical cache key (caller-built). Will be hashed for R2 path. */
    key: string;
    /** Render function — only called on full cache miss. */
    produce: () => Promise<CachedAsset>;
}
/**
 * Get-or-generate with all three tiers.
 *
 * 1. Edge Cache API. Fastest.
 * 2. R2 object at `brand-render/<hash>/<key>`. Survives isolate
 *    restart + region failover.
 * 3. Produce. Stash in R2 + Cache API on the way out.
 *
 * In-flight coalescing applies across all tiers — if another
 * request is already mid-flight for the same key, await its result
 * rather than racing.
 */
export declare function getOrGenerate(opts: CacheOpts): Promise<CachedAsset>;
/**
 * FNV-1a 32-bit hash of a stable JSON representation. Used to fold
 * the policy + brand-tokens snapshot into a compact path segment.
 * Same logical input → identical hash; any change → new hash, new
 * R2 path, automatic cache invalidation.
 */
export declare function hashSnapshot(snapshot: unknown): string;
export {};
//# sourceMappingURL=cache.d.ts.map