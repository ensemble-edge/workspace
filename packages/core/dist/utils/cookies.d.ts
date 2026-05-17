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
    maxAge?: number;
    expires?: Date;
}
/**
 * Cookie names used by the auth system.
 */
export declare const COOKIE_NAMES: {
    readonly ACCESS_TOKEN: "ensemble_access";
    readonly REFRESH_TOKEN: "ensemble_refresh";
    readonly WORKSPACE: "ensemble_workspace";
};
/**
 * Token expiry times in seconds.
 */
export declare const TOKEN_EXPIRY: {
    readonly ACCESS: number;
    readonly REFRESH: number;
};
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
export declare function setCookie(name: string, value: string, options?: CookieOptions): string;
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
export declare function parseCookies(cookieHeader: string | undefined): Record<string, string>;
/**
 * Get a specific cookie value from a request.
 *
 * @param cookieHeader - The Cookie header value
 * @param name - Cookie name to retrieve
 * @returns Cookie value or undefined
 */
export declare function getCookie(cookieHeader: string | undefined, name: string): string | undefined;
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
export declare function clearCookie(name: string, options?: CookieOptions): string;
/**
 * Set the access token cookie.
 *
 * @param token - JWT access token
 * @param options - Additional cookie options
 * @returns Cookie header string
 */
export declare function setAccessTokenCookie(token: string, options?: CookieOptions): string;
/**
 * Set the refresh token cookie.
 *
 * @param token - JWT refresh token
 * @param options - Additional cookie options
 * @returns Cookie header string
 */
export declare function setRefreshTokenCookie(token: string, options?: CookieOptions): string;
/**
 * Set the workspace preference cookie.
 * This is NOT httpOnly so client JS can read it.
 *
 * @param workspaceSlug - Workspace slug to remember
 * @param options - Additional cookie options
 * @returns Cookie header string
 */
export declare function setWorkspaceCookie(workspaceSlug: string, options?: CookieOptions): string;
/**
 * Get all auth-related cookies from a request.
 *
 * @param cookieHeader - The Cookie header value
 * @returns Object with access token, refresh token, and workspace slug
 */
export declare function getAuthCookies(cookieHeader: string | undefined): {
    accessToken: string | undefined;
    refreshToken: string | undefined;
    workspace: string | undefined;
};
/**
 * Create headers to clear all auth cookies (for logout).
 *
 * @param options - Cookie options (domain and path should match original)
 * @returns Array of Set-Cookie header values
 */
export declare function clearAuthCookies(options?: CookieOptions): string[];
/**
 * Check if we're in a secure context (should use Secure cookies).
 *
 * @param url - Request URL
 * @returns true if HTTPS or localhost
 */
export declare function isSecureContext(url: string): boolean;
/**
 * Get cookie options based on environment.
 *
 * @param env - Environment ('development' | 'staging' | 'production')
 * @param requestUrl - Current request URL
 * @returns Cookie options appropriate for the environment
 */
export declare function getCookieOptionsForEnv(env: 'development' | 'staging' | 'production' | undefined, requestUrl: string): CookieOptions;
//# sourceMappingURL=cookies.d.ts.map