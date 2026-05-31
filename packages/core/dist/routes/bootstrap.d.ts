/**
 * Bootstrap Routes
 *
 * One-time setup flow for creating the first workspace owner.
 * Only accessible when the users table has zero rows.
 *
 * Routes:
 * - GET  /_ensemble/bootstrap - Setup form
 * - POST /_ensemble/bootstrap - Create workspace + owner
 */
import { Hono } from 'hono';
import type { Env, ContextVariables, ResolvedConfig } from '../types';
/**
 * Create bootstrap routes.
 *
 * @param config - Resolved workspace config (for default brand values)
 * @returns Hono router
 */
export declare function createBootstrapRoutes(config: ResolvedConfig): Hono<{
    Bindings: Env;
    Variables: ContextVariables;
}, import("hono/types").BlankSchema, "/">;
//# sourceMappingURL=bootstrap.d.ts.map