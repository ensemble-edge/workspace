/**
 * Auth Routes
 *
 * Authentication endpoints for login, logout, registration, and token refresh.
 *
 * Routes:
 * - POST /_ensemble/auth/login     - Authenticate with email/password
 * - POST /_ensemble/auth/logout    - Invalidate session
 * - POST /_ensemble/auth/register  - Create new account
 * - POST /_ensemble/auth/refresh   - Refresh access token
 * - GET  /_ensemble/auth/me        - Get current user
 */
import { Hono } from 'hono';
import type { Env, ContextVariables } from '../types';
/**
 * Create auth router.
 *
 * @returns Hono router for auth routes
 */
export declare function createAuthRoutes(): Hono<{
    Bindings: Env;
    Variables: ContextVariables;
}, import("hono/types").BlankSchema, "/">;
//# sourceMappingURL=auth.d.ts.map