/**
 * Bootstrap Middleware
 *
 * Detects when a workspace has zero users and redirects to the
 * bootstrap setup screen. This runs BEFORE auth middleware.
 *
 * After the first user is created, this middleware short-circuits
 * via KV cache and adds zero overhead to normal requests.
 */
import type { MiddlewareHandler } from 'hono';
import type { Env, ContextVariables } from '../types';
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
export declare function bootstrapCheck(): MiddlewareHandler<{
    Bindings: Env;
    Variables: ContextVariables;
}>;
/**
 * Clear the bootstrap cache (used after bootstrap completes).
 *
 * @param kv - KV namespace
 */
export declare function clearBootstrapCache(kv: KVNamespace): Promise<void>;
/**
 * Mark bootstrap as complete in KV.
 *
 * @param kv - KV namespace
 */
export declare function markBootstrapComplete(kv: KVNamespace): Promise<void>;
//# sourceMappingURL=bootstrap.d.ts.map