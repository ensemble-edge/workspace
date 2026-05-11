/**
 * core:audit — Server-side API routes
 *
 * Read-only audit event log viewer.
 */
import type { Hono } from 'hono';
import type { Env, ContextVariables } from '../../../types';
export declare function registerAuditRoutes(app: Hono<{
    Bindings: Env;
    Variables: ContextVariables;
}>): void;
//# sourceMappingURL=routes.d.ts.map