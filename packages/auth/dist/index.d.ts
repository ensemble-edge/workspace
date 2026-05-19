/**
 * @ensemble-edge/auth
 *
 * Thin re-export of auth functionality from @ensemble-edge/core.
 *
 * At build time, packages/auth/scripts/rewrite-imports.mjs rewrites the
 * '@ensemble-edge/core/*' specifiers in dist/index.js into relative paths
 * like '../../core/dist/*.js'. This is required because consumers install
 * @ensemble-edge/workspace as a single tarball — @ensemble-edge/core is a
 * directory inside the tarball, not a resolvable npm specifier.
 *
 * If you need to add an export, just add it here using the @ensemble-edge/core
 * specifier. The rewriter handles the rest.
 */
export { AuthService, createAuthService } from '@ensemble-edge/core/services/auth';
export { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken, ACCESS_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY, } from '@ensemble-edge/core/utils/jwt';
export { hashPassword, verifyPassword, validatePassword, } from '@ensemble-edge/core/utils/password';
export { setAccessTokenCookie, setRefreshTokenCookie, clearAuthCookies, getAuthCookies, getCookieOptionsForEnv, } from '@ensemble-edge/core/utils/cookies';
export { auth, requireRole, requireOwnership, requirePermission } from '@ensemble-edge/core/middleware/auth';
export { auth as authMiddleware } from '@ensemble-edge/core/middleware/auth';
export { createAuthRoutes } from '@ensemble-edge/core/routes/auth';
export type { User, Membership, Session, Role, JWTPayload, } from '@ensemble-edge/core/types';
//# sourceMappingURL=index.d.ts.map