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

import { createMiddleware } from 'hono/factory';
import type { Env, ContextVariables } from '../types';

/**
 * Default allowed origins (always permitted).
 */
const DEFAULT_ORIGINS = [
  'https://app.ensemble.ai', // Ensemble web app
];

/**
 * CORS middleware factory.
 *
 * @param options - Optional configuration
 * @returns Hono middleware
 */
export function cors(options?: { additionalOrigins?: string[] }) {
  const additionalOrigins = options?.additionalOrigins ?? [];

  return createMiddleware<{
    Bindings: Env;
    Variables: ContextVariables;
  }>(async (c, next) => {
    const origin = c.req.header('Origin');

    // Build allowed origins list
    const allowedOrigins = [
      ...DEFAULT_ORIGINS,
      ...additionalOrigins,
    ];

    // Add workspace's own domains if workspace is resolved
    const workspace = c.get('workspace');
    if (workspace) {
      // The workspace's own domain is always allowed (same-origin)
      const host = c.req.header('Host');
      if (host) {
        allowedOrigins.push(`https://${host}`);
        allowedOrigins.push(`http://${host}`); // For local dev
      }
    }

    // Check if origin is allowed
    const isAllowed = origin && (
      allowedOrigins.includes(origin) ||
      origin.startsWith('http://localhost:') || // Local development
      origin.startsWith('http://127.0.0.1:')
    );

    // Handle preflight requests
    if (c.req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': isAllowed ? origin! : '',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Max-Age': '86400', // 24 hours
        },
      });
    }

    // Continue to next middleware
    await next();

    // Add CORS headers to response
    if (isAllowed && origin) {
      c.header('Access-Control-Allow-Origin', origin);
      c.header('Access-Control-Allow-Credentials', 'true');
      c.header('Vary', 'Origin');
    }
  });
}

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
export function publicCors() {
  return createMiddleware<{
    Bindings: Env;
    Variables: ContextVariables;
  }>(async (c, next) => {
    // OPTIONS preflight handling — return 204 with CORS headers so
    // browsers proceed to the actual request. The actual GET / HEAD
    // handler below adds the same headers to its response.
    if (c.req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Accept, Range',
          'Access-Control-Max-Age': '86400',
          'Vary': 'Origin',
          // v0.1.95: Cross-Origin-Resource-Policy must be explicitly
          // 'cross-origin' for these assets to embed via <img>, <link>,
          // <script> from third-party origins. CORS Access-Control-*
          // headers govern fetch(); CORP governs no-cors embeds. The
          // browser default is 'same-origin' which silently blocks
          // <img src> in a page on any other origin even when CORS
          // would permit fetch. Spec advertises these assets as public
          // for partner sites / READMEs / AI demos — CORP must match.
          'Cross-Origin-Resource-Policy': 'cross-origin',
        },
      });
    }

    await next();

    // Decorate the downstream response with CORS headers.
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    c.header('Access-Control-Max-Age', '86400');
    // Vary: Origin is technically optional for Origin:* responses,
    // but recommended so any intermediary that ever swaps the origin
    // header (e.g. caching layers that respect non-* policies later)
    // produces correct cache keys.
    c.header('Vary', 'Origin');
    // v0.1.95: opt these assets out of the Worker default
    // Cross-Origin-Resource-Policy: same-origin so cross-origin <img>,
    // <link rel="stylesheet">, and <script> embeds resolve. Without
    // this header set explicitly, browsers block third-party embeds
    // of /brand/render/* PNGs, /brand/css stylesheets, and similar
    // resources even though CORS would allow them — the Allow-Origin
    // header governs fetch(); CORP governs no-cors loads (which is
    // what <img> and <link> do).
    c.header('Cross-Origin-Resource-Policy', 'cross-origin');

    // v0.1.81: default cache policy for public brand assets.
    // 5 min fresh + 24h stale-while-revalidate. Short freshness so
    // operator edits propagate quickly; long SWR keeps cross-origin
    // consumers (curalisto.com, marketing pages, future patient
    // portals) painting brand colors at first paint from cache while
    // a fresh fetch happens in the background.
    //
    // Only set if the downstream handler didn't already pick a more
    // specific policy. render.ts sets its own no-store for editorial
    // overrides + max-age=300 must-revalidate for saved renders; we
    // don't want to clobber those.
    if (!c.res.headers.get('Cache-Control')) {
      c.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400');
    }
  });
}
