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

import type { Context } from 'hono';
import type { Env, ContextVariables } from '../types';

type Ctx = Context<{ Bindings: Env; Variables: ContextVariables }>;

export interface BrandDomain {
  domain: string;
  proto: string;
}

interface Env_ {
  DB: D1Database;
}

// ── Per-isolate cache ─────────────────────────────────────────────
// Two maps: host→workspaceId (reverse) and workspaceId→BrandDomain|null
// (forward). 5-minute TTL. `null` is cached too (negative caching) so a
// workspace with no brand domain doesn't re-query every request.
const TTL_MS = 5 * 60 * 1000;
const byHostCache = new Map<string, { value: { workspaceId: string; proto: string } | null; exp: number }>();
const primaryCache = new Map<string, { value: BrandDomain | null; exp: number }>();

// Date.now() is unavailable in some sandboxes; guard so import never throws.
function now(): number {
  try {
    return Date.now();
  } catch {
    return 0;
  }
}

/** Strip a :port and lowercase — the stored domain is host-only. */
function normalizeHost(host: string): string {
  return host.split(':')[0]!.trim().toLowerCase();
}

/**
 * Reverse lookup: which workspace owns this host? PK hit on
 * workspace_domains. Returns null if the host isn't a registered (and
 * verified) brand domain. Cached per isolate.
 */
export async function workspaceIdForDomain(
  env: Env_,
  host: string,
): Promise<{ workspaceId: string; proto: string } | null> {
  const key = normalizeHost(host);
  const t = now();
  const hit = byHostCache.get(key);
  if (hit && hit.exp > t) return hit.value;

  let value: { workspaceId: string; proto: string } | null = null;
  try {
    const row = await env.DB.prepare(
      `SELECT workspace_id, proto FROM workspace_domains WHERE domain = ? AND verified = 1`,
    )
      .bind(key)
      .first<{ workspace_id: string; proto: string }>();
    if (row) value = { workspaceId: row.workspace_id, proto: row.proto };
  } catch {
    value = null; // table may not exist yet (pre-migration)
  }
  byHostCache.set(key, { value, exp: t + TTL_MS });
  return value;
}

/**
 * Forward lookup: the workspace's primary brand domain (lowest rowid =
 * first added), or null. Cached per isolate.
 */
export async function primaryDomainForWorkspace(
  env: Env_,
  workspaceId: string,
): Promise<BrandDomain | null> {
  const t = now();
  const hit = primaryCache.get(workspaceId);
  if (hit && hit.exp > t) return hit.value;

  let value: BrandDomain | null = null;
  try {
    const row = await env.DB.prepare(
      `SELECT domain, proto FROM workspace_domains
        WHERE workspace_id = ? AND verified = 1
        ORDER BY created_at ASC, domain ASC LIMIT 1`,
    )
      .bind(workspaceId)
      .first<{ domain: string; proto: string }>();
    if (row) value = { domain: row.domain, proto: row.proto };
  } catch {
    value = null;
  }
  primaryCache.set(workspaceId, { value, exp: t + TTL_MS });
  return value;
}

/** Invalidate caches for a workspace after a domains write. */
export function invalidateDomainCache(workspaceId: string, domain?: string): void {
  primaryCache.delete(workspaceId);
  if (domain) byHostCache.delete(normalizeHost(domain));
  else byHostCache.clear();
}

/**
 * The origin (`proto://host`) that fully-qualified URLs for this request
 * should use: the brand domain when the tenant has one, else the request
 * host. Reads the `brandDomain` already placed on context by the resolver.
 */
export function originForRequest(c: Ctx): string {
  const brand = c.get('brandDomain');
  if (brand?.domain) return `${brand.proto}://${brand.domain}`;
  const url = new URL(c.req.url);
  return `${url.protocol}//${url.host}`;
}

/** Fully-qualify a root-relative path against the brand domain / host. */
export function absoluteUrl(c: Ctx, path: string): string {
  return `${originForRequest(c)}${path}`;
}

/**
 * Validate a brand-domain hostname on write. Returns an error string, or
 * null if valid. Host only: no protocol, no path, no trailing slash, no
 * port. A permissive FQDN check — real-world hostnames, not a full RFC.
 */
export function validateBrandDomain(value: string): string | null {
  const v = value.trim();
  if (!v) return 'Domain is required';
  if (/^https?:\/\//i.test(v)) return 'Enter the host only — no http(s):// prefix';
  if (v.includes('/')) return 'Enter the host only — no path or trailing slash';
  if (v.includes(':')) return 'Enter the host only — no port';
  if (v !== v.toLowerCase()) return 'Use lowercase';
  // labels: a-z 0-9 hyphen, 1-63 chars, dot-separated, 2+ labels, TLD alpha.
  if (!/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(v)) {
    return 'Not a valid domain (e.g. curalisto.com)';
  }
  return null;
}
