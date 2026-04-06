/**
 * CORS Middleware
 *
 * Handles Cross-Origin Resource Sharing for the /_ensemble/* API routes.
 * Allows the web app (app.ensemble.ai) and configured brand origins.
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
