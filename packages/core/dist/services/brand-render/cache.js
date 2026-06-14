import { getR2Bucket } from '../r2-binding.js';
/**
 * In-flight render Promises, keyed by cache key. Module-scoped so
 * concurrent requests in the same isolate share the result.
 */
const inFlight = new Map();
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
export async function getOrGenerate(opts) {
    // In-flight short-circuit: piggy-back if any other request is
    // already producing this asset.
    const pending = inFlight.get(opts.key);
    if (pending)
        return pending;
    const promise = generateInner(opts);
    inFlight.set(opts.key, promise);
    try {
        return await promise;
    }
    finally {
        // Drop the entry after completion so future requests re-check
        // the persistent tiers (which now have the asset).
        inFlight.delete(opts.key);
    }
}
async function generateInner(opts) {
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
            }
            catch { /* noop */ }
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
        }
        catch { /* noop */ }
    }
    try {
        await cache.put(cacheKeyReq, new Response(fresh.body, {
            headers: { 'Content-Type': fresh.contentType, 'Cache-Control': 'public, max-age=2592000' },
        }));
    }
    catch { /* noop */ }
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
export function hashSnapshot(snapshot) {
    const s = stableStringify(snapshot);
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(36);
}
function stableStringify(v) {
    if (v === null || typeof v !== 'object')
        return JSON.stringify(v);
    if (Array.isArray(v))
        return `[${v.map(stableStringify).join(',')}]`;
    const obj = v;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}
//# sourceMappingURL=cache.js.map