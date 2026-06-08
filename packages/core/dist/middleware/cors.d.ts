/**
 * CORS Middleware
 *
 * Two flavors:
 *
 *   • cors() — credentialed CORS for the authenticated /_ensemble/*
 *     API surface. Whitelisted origins + Access-Control-Allow-
 *     Credentials: true so the shell's session cookies traverse.
 *
 *   • publicCors() — public, credential-free CORS for brand assets
 *     and other workspace-served public resources (favicon, manifest,
 *     css endpoint, render URLs, version endpoint). Origin "*",
 *     no credentials, no Authorization-via-cookies. These resources
 *     are CDN-style public and consumed cross-origin by other sites
 *     embedding the workspace's brand (consumer apps, marketing
 *     pages, future patient portals). v0.1.80.
 */
import type { Env, ContextVariables } from '../types';
/**
 * CORS middleware factory.
 *
 * @param options - Optional configuration
 * @returns Hono middleware
 */
export declare function cors(options?: {
    additionalOrigins?: string[];
}): import("hono").MiddlewareHandler<{
    Bindings: Env;
    Variables: ContextVariables;
}, string, {}, Response>;
/**
 * Public CORS middleware — opens a route to ANY origin without
 * credentials. Use for public brand assets, public CSS, public
 * manifest, favicon variants, render endpoints. Equivalent to a
 * CDN-style asset endpoint.
 *
 * Key differences from cors():
 *   • Origin: *  (anyone can fetch())
 *   • No credentials (cookies / Authorization header NOT sent by browser)
 *   • Allowed methods: GET, HEAD, OPTIONS (these are read-only public
 *     resources; no writes from cross-origin)
 *   • Handles OPTIONS preflight inline so callers get 204 instead
 *     of route-not-found
 *   • Vary: Origin set so caches don't poison responses across origins
 *
 * v0.1.80: introduced to fix the CORS gap on /_ensemble/brand/* and
 * its /assets/brand/* alias. Operator reported curalisto.com couldn't
 * fetch the workspace's manifest.webmanifest cross-origin.
 */
export declare function publicCors(): import("hono").MiddlewareHandler<{
    Bindings: Env;
    Variables: ContextVariables;
}, string, {}, Response>;
//# sourceMappingURL=cors.d.ts.map