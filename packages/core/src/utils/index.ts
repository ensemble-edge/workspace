/**
 * Utility Exports
 *
 * Auth and helper utilities for the Ensemble Workspace engine.
 */

// JWT utilities
export {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
} from './jwt';

// Password utilities
export { hashPassword, verifyPassword, validatePassword } from './password';

// Cookie utilities
export {
  setCookie,
  parseCookies,
  getCookie,
  clearCookie,
  setAccessTokenCookie,
  setRefreshTokenCookie,
  setWorkspaceCookie,
  getAuthCookies,
  clearAuthCookies,
  isSecureContext,
  getCookieOptionsForEnv,
  COOKIE_NAMES,
  TOKEN_EXPIRY,
} from './cookies';
export type { CookieOptions } from './cookies';
