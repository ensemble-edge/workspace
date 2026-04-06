/**
 * Auth Middleware
 *
 * JWT validation middleware for protected routes.
 * Extracts and validates the access token from cookies,
 * then attaches the user to the context.
 */

import type { Context, Next, MiddlewareHandler } from 'hono';
import type { Env, ContextVariables, JWTPayload, User, Membership, Role } from '../types';
import { getAuthCookies } from '../utils/cookies';
import { verifyAccessToken, getJwtSecret } from '../utils/jwt';

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
export function auth(options: AuthMiddlewareOptions = {}): MiddlewareHandler<{
  Bindings: Env;
  Variables: ContextVariables;
}> {
  const { required = true } = options;

  return async (c: Context<{ Bindings: Env; Variables: ContextVariables }>, next: Next) => {
    // Get token from cookie
    const { accessToken } = getAuthCookies(c.req.header('Cookie'));

    if (!accessToken) {
      if (required) {
        return c.json({ error: 'Authentication required' }, 401);
      }
      // Continue without user
      await next();
      return;
    }

    // Verify token (use dev fallback if JWT_SECRET not set)
    const jwtSecret = getJwtSecret(c.env.JWT_SECRET, c.env.ENVIRONMENT);
    const payload = await verifyAccessToken(accessToken, jwtSecret);

    if (!payload) {
      if (required) {
        return c.json({ error: 'Invalid or expired token' }, 401);
      }
      // Continue without user
      await next();
      return;
    }

    // Attach user info to context
    const user: User = {
      id: payload.sub,
      email: payload.email,
      handle: payload.handle,
      displayName: null, // Not in JWT, fetch from DB if needed
      avatarUrl: null,
      locale: 'en',
      createdAt: '', // Not in JWT
    };

    const membership: Membership = {
      userId: payload.sub,
      workspaceId: payload.wid,
      role: payload.role,
      createdAt: '',
    };

    c.set('user', user);
    c.set('membership', membership);
    c.set('jwtPayload', payload);

    await next();
  };
}

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
export function requireRole(minimumRole: Role): MiddlewareHandler<{
  Bindings: Env;
  Variables: ContextVariables;
}> {
  const roleHierarchy: Record<Role, number> = {
    owner: 5,
    admin: 4,
    member: 3,
    viewer: 2,
    guest: 1,
  };

  return async (c: Context<{ Bindings: Env; Variables: ContextVariables }>, next: Next) => {
    const membership = c.get('membership');

    if (!membership) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    const userLevel = roleHierarchy[membership.role] || 0;
    const requiredLevel = roleHierarchy[minimumRole] || 0;

    if (userLevel < requiredLevel) {
      return c.json(
        {
          error: 'Insufficient permissions',
          required: minimumRole,
          current: membership.role,
        },
        403
      );
    }

    await next();
  };
}

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
export function requireOwnership(
  getUserId: (c: Context<{ Bindings: Env; Variables: ContextVariables }>) => string | Promise<string>
): MiddlewareHandler<{
  Bindings: Env;
  Variables: ContextVariables;
}> {
  return async (c: Context<{ Bindings: Env; Variables: ContextVariables }>, next: Next) => {
    const user = c.get('user');
    const membership = c.get('membership');

    if (!user || !membership) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    // Owners and admins can access any resource
    if (membership.role === 'owner' || membership.role === 'admin') {
      await next();
      return;
    }

    // Check ownership
    const resourceOwnerId = await getUserId(c);

    if (user.id !== resourceOwnerId) {
      return c.json({ error: 'Access denied' }, 403);
    }

    await next();
  };
}

/**
 * Check if the current user has a specific permission.
 *
 * This is a placeholder for more granular permission checking.
 * The full implementation would check against the permissions table.
 *
 * @param permission - Permission to check (e.g., 'users:write', 'brand:edit')
 * @returns Hono middleware handler
 */
export function requirePermission(permission: string): MiddlewareHandler<{
  Bindings: Env;
  Variables: ContextVariables;
}> {
  return async (c: Context<{ Bindings: Env; Variables: ContextVariables }>, next: Next) => {
    const membership = c.get('membership');

    if (!membership) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    // For now, use role-based defaults
    // TODO: Check against permissions table for custom role permissions
    const rolePermissions: Record<Role, string[]> = {
      owner: ['*'], // All permissions
      admin: ['users:*', 'brand:*', 'settings:*', 'data:*'],
      member: ['data:read', 'data:write', 'brand:read'],
      viewer: ['data:read', 'brand:read'],
      guest: ['brand:read'],
    };

    const userPermissions = rolePermissions[membership.role] || [];

    // Check for wildcard or exact match
    const hasPermission =
      userPermissions.includes('*') ||
      userPermissions.includes(permission) ||
      userPermissions.some((p) => {
        const [resource] = permission.split(':');
        return p === `${resource}:*`;
      });

    if (!hasPermission) {
      return c.json(
        {
          error: 'Permission denied',
          required: permission,
        },
        403
      );
    }

    await next();
  };
}
