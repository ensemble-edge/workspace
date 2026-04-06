/**
 * @ensemble-edge/auth
 *
 * Re-export auth functionality from @ensemble-edge/core.
 * This package exists to allow independent versioning and imports.
 *
 * Usage:
 *   import { AuthService, authMiddleware } from '@ensemble-edge/auth';
 *
 * Or directly from core:
 *   import { AuthService, authMiddleware } from '@ensemble-edge/core/auth';
 */

// Re-export auth service and utilities
export { AuthService, createAuthService } from '@ensemble-edge/core/services/auth';

// Re-export JWT utilities
export {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
} from '@ensemble-edge/core/utils/jwt';

// Re-export password utilities
export {
  hashPassword,
  verifyPassword,
  validatePassword,
} from '@ensemble-edge/core/utils/password';

// Re-export cookie utilities
export {
  setAccessTokenCookie,
  setRefreshTokenCookie,
  clearAuthCookies,
  getAuthCookies,
  getCookieOptionsForEnv,
} from '@ensemble-edge/core/utils/cookies';

// Re-export auth middleware
export { auth, requireRole, requireOwnership, requirePermission } from '@ensemble-edge/core/middleware/auth';
// Alias for backwards compatibility
export { auth as authMiddleware } from '@ensemble-edge/core/middleware/auth';

// Re-export auth routes
export { createAuthRoutes } from '@ensemble-edge/core/routes/auth';

// Re-export types
export type {
  User,
  Membership,
  Session,
  Role,
  JWTPayload,
} from '@ensemble-edge/core/types';
