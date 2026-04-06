/**
 * Bootstrap Middleware
 *
 * Detects when a workspace has zero users and redirects to the
 * bootstrap setup screen. This runs BEFORE auth middleware.
 *
 * After the first user is created, this middleware short-circuits
 * via KV cache and adds zero overhead to normal requests.
 */

import type { Context, Next, MiddlewareHandler } from 'hono';
import type { Env, ContextVariables } from '../types';

/**
 * KV key for bootstrap completion flag.
 */
const BOOTSTRAP_COMPLETE_KEY = 'ensemble:bootstrap_complete';

/**
 * Paths that are allowed during bootstrap (before any users exist).
 */
const BOOTSTRAP_ALLOWED_PATHS = [
  '/_ensemble/bootstrap',
  '/_ensemble/brand/css',
  '/_ensemble/brand/theme',
  '/_ensemble/shell/',  // Shell assets must be served for the bootstrap UI
  '/health',
];

/**
 * Create bootstrap check middleware.
 *
 * This middleware checks if the workspace has been bootstrapped (has at least
 * one user). If not, it redirects all requests to the bootstrap setup screen.
 *
 * The check result is cached in KV after first successful bootstrap to avoid
 * hitting the database on every request.
 *
 * @returns Hono middleware handler
 *
 * @example
 * ```ts
 * // In createWorkspace, add BEFORE auth middleware
 * app.use('*', bootstrapCheck());
 * app.use('*', workspaceResolver(config));
 * // ... auth middleware comes later
 * ```
 */
export function bootstrapCheck(): MiddlewareHandler<{
  Bindings: Env;
  Variables: ContextVariables;
}> {
  return async (c: Context<{ Bindings: Env; Variables: ContextVariables }>, next: Next) => {
    const path = new URL(c.req.url).pathname;

    // Allow bootstrap-related paths through without checking
    if (BOOTSTRAP_ALLOWED_PATHS.some((allowed) => path.startsWith(allowed))) {
      return next();
    }

    // Check KV cache first (fast path after bootstrap)
    try {
      const cached = await c.env.KV.get(BOOTSTRAP_COMPLETE_KEY);
      if (cached === 'true') {
        // Workspace is bootstrapped, proceed normally
        return next();
      }
    } catch {
      // KV error - fall through to DB check
    }

    // Check database for user count
    try {
      const result = await c.env.DB
        .prepare('SELECT COUNT(*) as count FROM users')
        .first<{ count: number }>();

      const userCount = result?.count ?? 0;

      if (userCount === 0) {
        // No users exist - redirect to bootstrap
        // For API requests, return JSON error instead of redirect
        if (path.startsWith('/_ensemble/') && !path.startsWith('/_ensemble/bootstrap')) {
          return c.json(
            {
              error: 'Workspace not bootstrapped',
              redirect: '/_ensemble/bootstrap',
            },
            503
          );
        }

        // For HTML requests, redirect
        return c.redirect('/_ensemble/bootstrap');
      }

      // Users exist - cache the result and proceed
      try {
        await c.env.KV.put(BOOTSTRAP_COMPLETE_KEY, 'true');
      } catch {
        // KV write failed - continue anyway, we'll cache on next request
      }

      return next();
    } catch (error) {
      // Database error - this might mean tables don't exist yet
      // Let the request through so migrations can run
      console.error('Bootstrap check failed:', error);
      return next();
    }
  };
}

/**
 * Clear the bootstrap cache (used after bootstrap completes).
 *
 * @param kv - KV namespace
 */
export async function clearBootstrapCache(kv: KVNamespace): Promise<void> {
  try {
    await kv.delete(BOOTSTRAP_COMPLETE_KEY);
  } catch {
    // Ignore errors
  }
}

/**
 * Mark bootstrap as complete in KV.
 *
 * @param kv - KV namespace
 */
export async function markBootstrapComplete(kv: KVNamespace): Promise<void> {
  try {
    await kv.put(BOOTSTRAP_COMPLETE_KEY, 'true');
  } catch {
    // Ignore errors - the DB check will still work
  }
}
