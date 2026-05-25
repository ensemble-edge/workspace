/**
 * Auth Middleware
 *
 * JWT validation middleware for protected routes.
 * Extracts and validates the access token from cookies,
 * then attaches the user to the context.
 */
import { getAuthCookies } from '../utils/cookies.js';
import { verifyAccessToken, getJwtSecret } from '../utils/jwt.js';
import { findApiKeyByPlaintext } from '../services/api-keys.js';
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
export function auth(options = {}) {
    const { required = true } = options;
    return async (c, next) => {
        // v0.1.76: bearer auth check runs BEFORE the cookie check. If the
        // caller sent Authorization: Bearer wks_..., authenticate via the
        // workspace_api_keys table and set the same user/membership context
        // the UI would have from a session cookie. The workspace's existing
        // role/permission checks then apply uniformly to bearer + cookie
        // callers. The bearer's creator is treated as the acting user; the
        // bearer's id is also stashed in c.set('apiKey') for audit logging.
        const authzHeader = c.req.header('Authorization');
        if (authzHeader?.startsWith('Bearer wks_')) {
            const plaintext = authzHeader.slice('Bearer '.length).trim();
            const apiKey = await findApiKeyByPlaintext(c.env, plaintext);
            if (apiKey) {
                // Resolve the key's creator + their workspace membership so we
                // can produce the same User/Membership shape cookie auth uses.
                const memberRow = await c.env.DB.prepare(`SELECT u.id, u.email, u.handle, m.role
             FROM users u
             JOIN memberships m ON m.user_id = u.id
            WHERE u.id = ? AND m.workspace_id = ?`).bind(apiKey.created_by_user_id, apiKey.workspace_id).first();
                // If the creator was removed from the workspace, treat the key
                // as inactive. The key row stays around for audit but auth fails.
                if (memberRow) {
                    const user = {
                        id: memberRow.id,
                        email: memberRow.email,
                        handle: memberRow.handle,
                        displayName: null,
                        avatarUrl: null,
                        locale: 'en',
                        createdAt: '',
                    };
                    const membership = {
                        userId: memberRow.id,
                        workspaceId: apiKey.workspace_id,
                        role: memberRow.role,
                        createdAt: '',
                    };
                    c.set('user', user);
                    c.set('membership', membership);
                    c.set('apiKey', { id: apiKey.id, name: apiKey.name });
                    await next();
                    return;
                }
            }
            // Bearer header was present but token invalid/revoked/expired or
            // creator removed. Fail closed — don't fall through to cookie.
            if (required) {
                return c.json({ error: 'Invalid or revoked API key' }, 401);
            }
            await next();
            return;
        }
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
        const user = {
            id: payload.sub,
            email: payload.email,
            handle: payload.handle,
            displayName: null, // Not in JWT, fetch from DB if needed
            avatarUrl: null,
            locale: 'en',
            createdAt: '', // Not in JWT
        };
        const membership = {
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
export function requireRole(minimumRole) {
    const roleHierarchy = {
        owner: 5,
        admin: 4,
        member: 3,
        viewer: 2,
        guest: 1,
    };
    return async (c, next) => {
        const membership = c.get('membership');
        if (!membership) {
            return c.json({ error: 'Authentication required' }, 401);
        }
        const userLevel = roleHierarchy[membership.role] || 0;
        const requiredLevel = roleHierarchy[minimumRole] || 0;
        if (userLevel < requiredLevel) {
            return c.json({
                error: 'Insufficient permissions',
                required: minimumRole,
                current: membership.role,
            }, 403);
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
export function requireOwnership(getUserId) {
    return async (c, next) => {
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
export function requirePermission(permission) {
    return async (c, next) => {
        const membership = c.get('membership');
        if (!membership) {
            return c.json({ error: 'Authentication required' }, 401);
        }
        // For now, use role-based defaults
        // TODO: Check against permissions table for custom role permissions
        const rolePermissions = {
            owner: ['*'], // All permissions
            admin: ['users:*', 'brand:*', 'settings:*', 'data:*'],
            member: ['data:read', 'data:write', 'brand:read'],
            viewer: ['data:read', 'brand:read'],
            guest: ['brand:read'],
        };
        const userPermissions = rolePermissions[membership.role] || [];
        // Check for wildcard or exact match
        const hasPermission = userPermissions.includes('*') ||
            userPermissions.includes(permission) ||
            userPermissions.some((p) => {
                const [resource] = permission.split(':');
                return p === `${resource}:*`;
            });
        if (!hasPermission) {
            return c.json({
                error: 'Permission denied',
                required: permission,
            }, 403);
        }
        await next();
    };
}
//# sourceMappingURL=auth.js.map