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
import { getR2Bucket } from '../r2-binding';

/**
 * In-flight render Promises, keyed by cache key. Module-scoped so
 * concurrent requests in the same isolate share the result.
 */
const inFlight = new Map<string, Promise<CachedAsset>>();

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
export async function getOrGenerate(opts: CacheOpts): Promise<CachedAsset> {
  // In-flight short-circuit: piggy-back if any other request is
  // already producing this asset.
  const pending = inFlight.get(opts.key);
  if (pending) return pending;

  const promise = generateInner(opts);
  inFlight.set(opts.key, promise);
  try {
    return await promise;
  } finally {
    // Drop the entry after completion so future requests re-check
    // the persistent tiers (which now have the asset).
    inFlight.delete(opts.key);
  }
}

async function generateInner(opts: CacheOpts): Promise<CachedAsset> {
  const cache = await caches.open('brand-render-v1');
  const cacheKeyReq = new Request(`https://render.internal/v1/${opts.key}`);

  // Tier 1: Cache API.
  const cached = await cache.match(cacheKeyReq);
  if (cached) {
    return {
      body: await cached.arrayBuffer(),
      contentType: cached.headers.get('Content-Type') ?? 'application/octet-stream',
    };
  }

  // Tier 2: R2.
  const r2 = await getR2Bucket(opts.env, opts.workspaceId);
  const r2Path = `brand-render/${opts.key}`;
  if (r2) {
    const obj = await r2.get(r2Path);
    if (obj) {
      const body = await obj.arrayBuffer();
      const contentType = obj.httpMetadata?.contentType ?? 'application/octet-stream';
      // Backfill into Cache API for future hits.
      try {
        await cache.put(cacheKeyReq, new Response(body, {
          headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=2592000' },
        }));
      } catch { /* noop */ }
      return { body, contentType };
    }
  }

  // Tier 3: Produce.
  const fresh = await opts.produce();
  // Persist to R2 + Cache API for next time. Best-effort writes —
  // a failed persist doesn't fail the response.
  if (r2) {
    try {
      await r2.put(r2Path, fresh.body, {
        httpMetadata: { contentType: fresh.contentType },
      });
    } catch { /* noop */ }
  }
  try {
    await cache.put(cacheKeyReq, new Response(fresh.body, {
      headers: { 'Content-Type': fresh.contentType, 'Cache-Control': 'public, max-age=2592000' },
    }));
  } catch { /* noop */ }
  return fresh;
}

/* ──────────────────────────────────────────────────────────────
 * Stable JSON hash for cache keys
 * ──────────────────────────────────────────────────────────── */

/**
 * FNV-1a 32-bit hash of a stable JSON representation. Used to fold
 * the policy + brand-tokens snapshot into a compact path segment.
 * Same logical input → identical hash; any change → new hash, new
 * R2 path, automatic cache invalidation.
 */
export function hashSnapshot(snapshot: unknown): string {
  const s = stableStringify(snapshot);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}
