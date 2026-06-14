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
type Ctx = Context<{
    Bindings: Env;
    Variables: ContextVariables;
}>;
export interface BrandDomain {
    domain: string;
    proto: string;
}
interface Env_ {
    DB: D1Database;
}
/**
 * Reverse lookup: which workspace owns this host? PK hit on
 * workspace_domains. Returns null if the host isn't a registered (and
 * verified) brand domain. Cached per isolate.
 */
export declare function workspaceIdForDomain(env: Env_, host: string): Promise<{
    workspaceId: string;
    proto: string;
} | null>;
/**
 * Forward lookup: the workspace's primary brand domain (lowest rowid =
 * first added), or null. Cached per isolate.
 */
export declare function primaryDomainForWorkspace(env: Env_, workspaceId: string): Promise<BrandDomain | null>;
/** Invalidate caches for a workspace after a domains write. */
export declare function invalidateDomainCache(workspaceId: string, domain?: string): void;
/**
 * The origin (`proto://host`) that fully-qualified URLs for this request
 * should use: the brand domain when the tenant has one, else the request
 * host. Reads the `brandDomain` already placed on context by the resolver.
 */
export declare function originForRequest(c: Ctx): string;
/** Fully-qualify a root-relative path against the brand domain / host. */
export declare function absoluteUrl(c: Ctx, path: string): string;
/**
 * Validate a brand-domain hostname on write. Returns an error string, or
 * null if valid. Host only: no protocol, no path, no trailing slash, no
 * port. A permissive FQDN check — real-world hostnames, not a full RFC.
 */
export declare function validateBrandDomain(value: string): string | null;
export {};
//# sourceMappingURL=brand-domain.d.ts.map