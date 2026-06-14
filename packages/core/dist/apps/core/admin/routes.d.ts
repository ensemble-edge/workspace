/**
 * core:admin — API key CRUD routes.
 *
 * Routes (all require admin role on the workspace):
 *   POST   /_ensemble/api-keys              — create + return plaintext ONCE
 *   GET    /_ensemble/api-keys              — list (no plaintext, hashes only)
 *   POST   /_ensemble/api-keys/:id/revoke   — revoke
 *   POST   /_ensemble/api-keys/:id/regenerate — revoke old, create new with
 *                                              same name+scopes, return new plaintext
 */
import type { Hono } from 'hono';
import type { Env, ContextVariables } from '../../../types';
export declare function registerAdminRoutes(app: Hono<{
    Bindings: Env;
    Variables: ContextVariables;
}>): void;
//# sourceMappingURL=routes.d.ts.map