/**
 * Cookie Utilities
 *
 * Helpers for managing httpOnly cookies for JWT and refresh tokens.
 * Designed for Cloudflare Workers (no Node.js cookie libraries).
 */

/**
 * Cookie options for different environments.
 */
export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  path?: string;
  domain?: string;
  maxAge?: number; // seconds
  expires?: Date;
}

/**
 * Default cookie options for production.
 */
const DEFAULT_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'Lax',
  path: '/',
};

/**
 * Cookie names used by the auth system.
 */
export const COOKIE_NAMES = {
  ACCESS_TOKEN: 'ensemble_access',
  REFRESH_TOKEN: 'ensemble_refresh',
  WORKSPACE: 'ensemble_workspace',
} as const;

/**
 * Token expiry times in seconds.
 */
export const TOKEN_EXPIRY = {
  ACCESS: 15 * 60, // 15 minutes
  REFRESH: 7 * 24 * 60 * 60, // 7 days
} as const;

/**
 * Set a cookie header value.
 *
 * @param name - Cookie name
 * @param value - Cookie value
 * @param options - Cookie options
 * @returns Cookie header string
 *
 * @example
 * ```ts
 * const cookie = setCookie('ensemble_access', token, { maxAge: 900 });
 * c.header('Set-Cookie', cookie);
 * ```
 */
export function setCookie(
  name: string,
  value: string,
  options: CookieOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const parts: string[] = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];

  if (opts.maxAge !== undefined) {
    parts.push(`Max-Age=${opts.maxAge}`);
  }

  if (opts.expires) {
    parts.push(`Expires=${opts.expires.toUTCString()}`);
  }

  if (opts.domain) {
    parts.push(`Domain=${opts.domain}`);
  }

  if (opts.path) {
    parts.push(`Path=${opts.path}`);
  }

  if (opts.secure) {
    parts.push('Secure');
  }

  if (opts.httpOnly) {
    parts.push('HttpOnly');
  }

  if (opts.sameSite) {
    parts.push(`SameSite=${opts.sameSite}`);
  }

  return parts.join('; ');
}

/**
 * Parse cookies from a request header.
 *
 * @param cookieHeader - The Cookie header value
 * @returns Object mapping cookie names to values
 *
 * @example
 * ```ts
 * const cookies = parseCookies(c.req.header('Cookie'));
 * const token = cookies['ensemble_access'];
 * ```
 */
export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  const cookies: Record<string, string> = {};

  for (const part of cookieHeader.split(';')) {
    const [name, ...valueParts] = part.trim().split('=');
    if (name) {
      const decodedName = decodeURIComponent(name.trim());
      const value = valueParts.join('='); // Handle values with = in them
      cookies[decodedName] = decodeURIComponent(value.trim());
    }
  }

  return cookies;
}

/**
 * Get a specific cookie value from a request.
 *
 * @param cookieHeader - The Cookie header value
 * @param name - Cookie name to retrieve
 * @returns Cookie value or undefined
 */
export function getCookie(cookieHeader: string | undefined, name: string): string | undefined {
  return parseCookies(cookieHeader)[name];
}

/**
 * Create a cookie that clears/deletes an existing cookie.
 *
 * @param name - Cookie name to clear
 * @param options - Cookie options (domain and path should match original)
 * @returns Cookie header string that clears the cookie
 *
 * @example
 * ```ts
 * c.header('Set-Cookie', clearCookie('ensemble_access'));
 * ```
 */
export function clearCookie(name: string, options: CookieOptions = {}): string {
  return setCookie(name, '', {
    ...options,
    maxAge: 0,
    expires: new Date(0),
  });
}

/**
 * Set the access token cookie.
 *
 * @param token - JWT access token
 * @param options - Additional cookie options
 * @returns Cookie header string
 */
export function setAccessTokenCookie(token: string, options: CookieOptions = {}): string {
  return setCookie(COOKIE_NAMES.ACCESS_TOKEN, token, {
    ...options,
    maxAge: TOKEN_EXPIRY.ACCESS,
    httpOnly: true,
  });
}

/**
 * Set the refresh token cookie.
 *
 * @param token - JWT refresh token
 * @param options - Additional cookie options
 * @returns Cookie header string
 */
export function setRefreshTokenCookie(token: string, options: CookieOptions = {}): string {
  return setCookie(COOKIE_NAMES.REFRESH_TOKEN, token, {
    ...options,
    maxAge: TOKEN_EXPIRY.REFRESH,
    httpOnly: true,
    path: '/_ensemble/auth', // Only sent to auth endpoints
  });
}

/**
 * Set the workspace preference cookie.
 * This is NOT httpOnly so client JS can read it.
 *
 * @param workspaceSlug - Workspace slug to remember
 * @param options - Additional cookie options
 * @returns Cookie header string
 */
export function setWorkspaceCookie(workspaceSlug: string, options: CookieOptions = {}): string {
  return setCookie(COOKIE_NAMES.WORKSPACE, workspaceSlug, {
    ...options,
    maxAge: 30 * 24 * 60 * 60, // 30 days
    httpOnly: false, // Accessible from JS for workspace switching
  });
}

/**
 * Get all auth-related cookies from a request.
 *
 * @param cookieHeader - The Cookie header value
 * @returns Object with access token, refresh token, and workspace slug
 */
export function getAuthCookies(cookieHeader: string | undefined): {
  accessToken: string | undefined;
  refreshToken: string | undefined;
  workspace: string | undefined;
} {
  const cookies = parseCookies(cookieHeader);
  return {
    accessToken: cookies[COOKIE_NAMES.ACCESS_TOKEN],
    refreshToken: cookies[COOKIE_NAMES.REFRESH_TOKEN],
    workspace: cookies[COOKIE_NAMES.WORKSPACE],
  };
}

/**
 * Create headers to clear all auth cookies (for logout).
 *
 * @param options - Cookie options (domain and path should match original)
 * @returns Array of Set-Cookie header values
 */
export function clearAuthCookies(options: CookieOptions = {}): string[] {
  return [
    clearCookie(COOKIE_NAMES.ACCESS_TOKEN, options),
    clearCookie(COOKIE_NAMES.REFRESH_TOKEN, { ...options, path: '/_ensemble/auth' }),
    clearCookie(COOKIE_NAMES.WORKSPACE, { ...options, httpOnly: false }),
  ];
}

/**
 * Check if we're in a secure context (should use Secure cookies).
 *
 * @param url - Request URL
 * @returns true if HTTPS or localhost
 */
export function isSecureContext(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.hostname === 'localhost';
  } catch {
    return false;
  }
}

/**
 * Get cookie options based on environment.
 *
 * @param env - Environment ('development' | 'staging' | 'production')
 * @param requestUrl - Current request URL
 * @returns Cookie options appropriate for the environment
 */
export function getCookieOptionsForEnv(
  env: 'development' | 'staging' | 'production' | undefined,
  requestUrl: string
): CookieOptions {
  const secure = isSecureContext(requestUrl);

  if (env === 'development') {
    return {
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
      path: '/',
    };
  }

  return {
    httpOnly: true,
    secure,
    sameSite: secure ? 'Lax' : 'Lax',
    path: '/',
  };
}
