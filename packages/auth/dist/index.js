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
export { AuthService, createAuthService } from '../../core/dist/services/auth.js';
export { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken, ACCESS_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY, } from '../../core/dist/utils/jwt.js';
export { hashPassword, verifyPassword, validatePassword, } from '../../core/dist/utils/password.js';
export { setAccessTokenCookie, setRefreshTokenCookie, clearAuthCookies, getAuthCookies, getCookieOptionsForEnv, } from '../../core/dist/utils/cookies.js';
export { auth, requireRole, requireOwnership, requirePermission } from '../../core/dist/middleware/auth.js';
export { auth as authMiddleware } from '../../core/dist/middleware/auth.js';
export { createAuthRoutes } from '../../core/dist/routes/auth.js';
//# sourceMappingURL=index.js.map