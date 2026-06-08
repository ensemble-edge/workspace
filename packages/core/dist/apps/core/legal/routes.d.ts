/**
 * core:legal — Server-side API routes.
 *
 * Three route families, all mounted by registerLegalRoutes:
 *
 *   1. CMS CRUD        /_ensemble/core/legal/*   (auth required)
 *   2. Public JSON     /api/legal/*              (public-read, cached)
 *   3. Public HTML     /legal, /legal/:slug      (public-read, cached)
 *
 * Families 2 + 3 live in public-routes.ts; this file owns the
 * authenticated CMS surface + settings.
 *
 * Every query is scoped by workspace.id — legal docs are per-tenant.
 */
import type { Hono } from 'hono';
import type { Env, ContextVariables } from '../../../types';
export declare function registerLegalRoutes(app: Hono<{
    Bindings: Env;
    Variables: ContextVariables;
}>): void;
//# sourceMappingURL=routes.d.ts.map