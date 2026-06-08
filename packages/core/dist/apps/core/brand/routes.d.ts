/**
 * core:brand — Server-side API routes
 *
 * Brand token CRUD + color group management.
 * Routes mounted under /_ensemble/core/brand/*
 */
import type { Hono } from 'hono';
import type { Env, ContextVariables } from '../../../types';
export declare function registerBrandRoutes(app: Hono<{
    Bindings: Env;
    Variables: ContextVariables;
}>): void;
//# sourceMappingURL=routes.d.ts.map