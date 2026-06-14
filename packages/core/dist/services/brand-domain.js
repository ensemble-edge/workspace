/**
 * Brand-domain service.
 *
 * Lets a workspace serve public surfaces under the tenant's own domain
 * (curalisto.com) instead of workspace.curalisto.com. Two lookups, both
 * over the workspace_domains table (migration 017):
 *
 *   • byDomain(host)      reverse: host → workspace (PK hit) — for the
 *                         resolver's resolveByDomain Strategy 3.
 *   • primaryFor(wsId)    forward: workspace → its brand domain — set on
 *                         context even when the request arrived on the
 *                         workspace host, so canonical/hreflang still
 *                         point at the brand domain.
 *
 * Plus the render-time core: absoluteUrl(c, path) qualifies a path
 * against the brand domain when set, else the request host. Only SEO
 * metadata (canonical, hreflang) needs absolute URLs; same-host links
 * stay path-relative and resolve under whatever host served the page.
 *
 * A per-isolate cache (~5 min) keeps the lookups off D1 on the hot path;
 * brand domains change rarely. See docs/plan/brand-domain.md.
 */
// ── Per-isolate cache ─────────────────────────────────────────────
// Two maps: host→workspaceId (reverse) and workspaceId→BrandDomain|null
// (forward). 5-minute TTL. `null` is cached too (negative caching) so a
// workspace with no brand domain doesn't re-query every request.
const TTL_MS = 5 * 60 * 1000;
const byHostCache = new Map();
const primaryCache = new Map();
// Date.now() is unavailable in some sandboxes; guard so import never throws.
function now() {
    try {
        return Date.now();
    }
    catch {
        return 0;
    }
}
/** Strip a :port and lowercase — the stored domain is host-only. */
function normalizeHost(host) {
    return host.split(':')[0].trim().toLowerCase();
}
/**
 * Reverse lookup: which workspace owns this host? PK hit on
 * workspace_domains. Returns null if the host isn't a registered (and
 * verified) brand domain. Cached per isolate.
 */
export async function workspaceIdForDomain(env, host) {
    const key = normalizeHost(host);
    const t = now();
    const hit = byHostCache.get(key);
    if (hit && hit.exp > t)
        return hit.value;
    let value = null;
    try {
        const row = await env.DB.prepare(`SELECT workspace_id, proto FROM workspace_domains WHERE domain = ? AND verified = 1`)
            .bind(key)
            .first();
        if (row)
            value = { workspaceId: row.workspace_id, proto: row.proto };
    }
    catch {
        value = null; // table may not exist yet (pre-migration)
    }
    byHostCache.set(key, { value, exp: t + TTL_MS });
    return value;
}
/**
 * Forward lookup: the workspace's primary brand domain (lowest rowid =
 * first added), or null. Cached per isolate.
 */
export async function primaryDomainForWorkspace(env, workspaceId) {
    const t = now();
    const hit = primaryCache.get(workspaceId);
    if (hit && hit.exp > t)
        return hit.value;
    let value = null;
    try {
        const row = await env.DB.prepare(`SELECT domain, proto FROM workspace_domains
        WHERE workspace_id = ? AND verified = 1
        ORDER BY created_at ASC, domain ASC LIMIT 1`)
            .bind(workspaceId)
            .first();
        if (row)
            value = { domain: row.domain, proto: row.proto };
    }
    catch {
        value = null;
    }
    primaryCache.set(workspaceId, { value, exp: t + TTL_MS });
    return value;
}
/** Invalidate caches for a workspace after a domains write. */
export function invalidateDomainCache(workspaceId, domain) {
    primaryCache.delete(workspaceId);
    if (domain)
        byHostCache.delete(normalizeHost(domain));
    else
        byHostCache.clear();
}
/**
 * The origin (`proto://host`) that fully-qualified URLs for this request
 * should use: the brand domain when the tenant has one, else the request
 * host. Reads the `brandDomain` already placed on context by the resolver.
 */
export function originForRequest(c) {
    const brand = c.get('brandDomain');
    if (brand?.domain)
        return `${brand.proto}://${brand.domain}`;
    const url = new URL(c.req.url);
    return `${url.protocol}//${url.host}`;
}
/** Fully-qualify a root-relative path against the brand domain / host. */
export function absoluteUrl(c, path) {
    return `${originForRequest(c)}${path}`;
}
/**
 * Validate a brand-domain hostname on write. Returns an error string, or
 * null if valid. Host only: no protocol, no path, no trailing slash, no
 * port. A permissive FQDN check — real-world hostnames, not a full RFC.
 */
export function validateBrandDomain(value) {
    const v = value.trim();
    if (!v)
        return 'Domain is required';
    if (/^https?:\/\//i.test(v))
        return 'Enter the host only — no http(s):// prefix';
    if (v.includes('/'))
        return 'Enter the host only — no path or trailing slash';
    if (v.includes(':'))
        return 'Enter the host only — no port';
    if (v !== v.toLowerCase())
        return 'Use lowercase';
    // labels: a-z 0-9 hyphen, 1-63 chars, dot-separated, 2+ labels, TLD alpha.
    if (!/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(v)) {
        return 'Not a valid domain (e.g. curalisto.com)';
    }
    return null;
}
//# sourceMappingURL=brand-domain.js.map