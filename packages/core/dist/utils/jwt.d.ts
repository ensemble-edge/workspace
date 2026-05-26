/**
 * JWT Utilities
 *
 * Sign and verify JWTs using the jose library (pure JS, Workers-compatible).
 * Uses HS256 (HMAC-SHA256) with a secret key from environment.
 */
import type { JWTPayload, Role } from '../types';
/**
 * Access token expiry time.
 */
export declare const ACCESS_TOKEN_EXPIRY = "15m";
/**
 * Refresh token expiry time.
 */
export declare const REFRESH_TOKEN_EXPIRY = "7d";
/**
 * Get the JWT secret, with development fallback.
 *
 * @param secret - JWT_SECRET from environment (may be undefined/empty)
 * @param environment - Current environment (development/production)
 * @returns Secret string to use for JWT signing
 * @throws Error if secret is missing in production
 */
export declare function getJwtSecret(secret: string | undefined, environment?: string): string;
/**
 * Sign an access token JWT.
 *
 * @param payload - Token payload (user ID, workspace ID, role, etc.)
 * @param secret - JWT signing secret from environment
 * @returns Signed JWT string
 */
export declare function signAccessToken(payload: {
    userId: string;
    workspaceId: string;
    email: string;
    handle: string | null;
    role: Role;
}, secret: string): Promise<string>;
/**
 * Sign a refresh token JWT.
 *
 * Refresh tokens have a longer expiry and only contain the session ID.
 *
 * @param sessionId - Session ID to encode
 * @param secret - JWT signing secret from environment
 * @param ttlSeconds - Optional override for the refresh token lifetime.
 *   When provided, used in place of REFRESH_TOKEN_EXPIRY. Lets
 *   per-workspace session lifetime (configured in Auth → Sessions)
 *   apply to newly-issued sessions. Existing sessions keep their
 *   original expiry; the setting only affects future sign-ins.
 */
export declare function signRefreshToken(sessionId: string, secret: string, ttlSeconds?: number): Promise<string>;
/**
 * Verify and decode an access token.
 *
 * @param token - JWT string to verify
 * @param secret - JWT signing secret from environment
 * @returns Decoded payload or null if invalid/expired
 */
export declare function verifyAccessToken(token: string, secret: string): Promise<JWTPayload | null>;
/**
 * Verify and decode a refresh token.
 *
 * @param token - JWT string to verify
 * @param secret - JWT signing secret from environment
 * @returns Session ID or null if invalid/expired
 */
export declare function verifyRefreshToken(token: string, secret: string): Promise<string | null>;
/**
 * Decode a JWT without verifying (for debugging).
 * WARNING: Do not trust the contents - always verify first!
 */
export declare function decodeToken(token: string): Record<string, unknown> | null;
//# sourceMappingURL=jwt.d.ts.map