/**
 * core:apps — App Manager server routes.
 *
 * The single surface that governs every app (core + guest): list them,
 * enable/disable, edit mounts, and emit the recommended CF routes block.
 * Reads/writes installed_apps via the app-registry service.
 *
 *   GET   /_ensemble/core/apps              list all apps + governance state
 *   PATCH /_ensemble/core/apps/:id          set status / mounts / settings
 *   GET   /_ensemble/core/apps/routes-hint  recommended wrangler [[routes]]
 *
 * Mutations are admin-gated. See docs/plan/app-manager-implementation.md.
 */
import type { Hono } from 'hono';
import type { Env, ContextVariables } from '../../../types';
export declare function registerAppsRoutes(app: Hono<{
    Bindings: Env;
    Variables: ContextVariables;
}>): void;
//# sourceMappingURL=routes.d.ts.map