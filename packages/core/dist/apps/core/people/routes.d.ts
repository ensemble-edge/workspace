/**
 * core:people — Server-side API routes
 *
 * Member directory, invites, and role management.
 * Routes mounted under /_ensemble/core/people/*
 */
import { Hono } from 'hono';
import type { Env, ContextVariables } from '../../../types';
export declare function registerPeopleRoutes(app: Hono<{
    Bindings: Env;
    Variables: ContextVariables;
}>): void;
//# sourceMappingURL=routes.d.ts.map