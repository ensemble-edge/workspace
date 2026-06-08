/**
 * Auth Middleware
 *
 * JWT validation middleware for protected routes.
 * Extracts and validates the access token from cookies,
 * then attaches the user to the context.
 */
import type { Context, MiddlewareHandler } from 'hono';
import type { Env, ContextVariables, Role } from '../types';
/**
 * Auth middleware options.
 */
export interface AuthMiddlewareOptions {
    /**
     * If true, requests without valid tokens will be rejected with 401.
     * If false, requests proceed but user will be undefined.
     * @default true
     */
    required?: boolean;
}
/**
 * Create auth middleware that validates JWT and attaches user to context.
 *
 * @param options - Middleware options
 * @returns Hono middleware handler
 *
 * @example
 * ```ts
 * // Require authentication
 * app.use('/_ensemble/admin/*', auth());
 *
 * // Optional authentication (user may be undefined)
 * app.use('/_ensemble/public/*', auth({ required: false }));
 * ```
 */
export declare function auth(options?: AuthMiddlewareOptions): MiddlewareHandler<{
    Bindings: Env;
    Variables: ContextVariables;
}>;
/**
 * Require a specific role or higher.
 *
 * Role hierarchy (highest to lowest):
 * - owner: Full workspace control
 * - admin: Manage users and settings
 * - member: Standard access
 * - viewer: Read-only access
 * - guest: Limited access
 *
 * @param minimumRole - Minimum role required
 * @returns Hono middleware handler
 *
 * @example
 * ```ts
 * // Require admin or owner
 * app.use('/_ensemble/admin/*', auth(), requireRole('admin'));
 *
 * // Require member or higher
 * app.use('/_ensemble/data/*', auth(), requireRole('member'));
 * ```
 */
export declare function requireRole(minimumRole: Role): MiddlewareHandler<{
    Bindings: Env;
    Variables: ContextVariables;
}>;
/**
 * Require ownership of a resource.
 *
 * @param getUserId - Function to extract the owner user ID from the request
 * @returns Hono middleware handler
 *
 * @example
 * ```ts
 * // User can only access their own profile
 * app.get('/users/:id', auth(), requireOwnership((c) => c.req.param('id')));
 * ```
 */
export declare function requireOwnership(getUserId: (c: Context<{
    Bindings: Env;
    Variables: ContextVariables;
}>) => string | Promise<string>): MiddlewareHandler<{
    Bindings: Env;
    Variables: ContextVariables;
}>;
/**
 * Check if the current user has a specific permission.
 *
 * This is a placeholder for more granular permission checking.
 * The full implementation would check against the permissions table.
 *
 * @param permission - Permission to check (e.g., 'users:write', 'brand:edit')
 * @returns Hono middleware handler
 */
export declare function requirePermission(permission: string): MiddlewareHandler<{
    Bindings: Env;
    Variables: ContextVariables;
}>;
//# sourceMappingURL=auth.d.ts.map