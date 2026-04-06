/**
 * JWT Utilities
 *
 * Sign and verify JWTs using the jose library (pure JS, Workers-compatible).
 * Uses HS256 (HMAC-SHA256) with a secret key from environment.
 */

import { SignJWT, jwtVerify, errors } from 'jose';
import type { JWTPayload, Role } from '../types';

/**
 * JWT configuration.
 */
const JWT_ALGORITHM = 'HS256';

/**
 * Access token expiry time.
 */
export const ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes

/**
 * Refresh token expiry time.
 */
export const REFRESH_TOKEN_EXPIRY = '7d'; // 7 days

/**
 * Development fallback secret.
 * ONLY used when JWT_SECRET is not set AND environment is development.
 * This is NOT secure for production - always set JWT_SECRET in production!
 */
const DEV_SECRET = 'ensemble-dev-secret-do-not-use-in-production';

/**
 * Get the JWT secret, with development fallback.
 *
 * @param secret - JWT_SECRET from environment (may be undefined/empty)
 * @param environment - Current environment (development/production)
 * @returns Secret string to use for JWT signing
 * @throws Error if secret is missing in production
 */
export function getJwtSecret(
  secret: string | undefined,
  environment?: string
): string {
  if (secret && secret.length > 0) {
    return secret;
  }

  // In development, use fallback
  if (!environment || environment === 'development') {
    console.warn(
      '[JWT] Using development fallback secret. Set JWT_SECRET for production!'
    );
    return DEV_SECRET;
  }

  // In production, require the secret
  throw new Error(
    'JWT_SECRET environment variable is required in production. ' +
      'Set it with: wrangler secret put JWT_SECRET'
  );
}

/**
 * Create a secret key from the JWT_SECRET environment variable.
 */
function createSecretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

/**
 * Sign an access token JWT.
 *
 * @param payload - Token payload (user ID, workspace ID, role, etc.)
 * @param secret - JWT signing secret from environment
 * @returns Signed JWT string
 */
export async function signAccessToken(
  payload: {
    userId: string;
    workspaceId: string;
    email: string;
    handle: string | null;
    role: Role;
  },
  secret: string
): Promise<string> {
  const key = createSecretKey(secret);

  const token = await new SignJWT({
    sub: payload.userId,
    wid: payload.workspaceId,
    email: payload.email,
    handle: payload.handle,
    role: payload.role,
  })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(key);

  return token;
}

/**
 * Sign a refresh token JWT.
 *
 * Refresh tokens have a longer expiry and only contain the session ID.
 *
 * @param sessionId - Session ID to encode
 * @param secret - JWT signing secret from environment
 * @returns Signed JWT string
 */
export async function signRefreshToken(
  sessionId: string,
  secret: string
): Promise<string> {
  const key = createSecretKey(secret);

  const token = await new SignJWT({
    sid: sessionId,
    type: 'refresh',
  })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(key);

  return token;
}

/**
 * Verify and decode an access token.
 *
 * @param token - JWT string to verify
 * @param secret - JWT signing secret from environment
 * @returns Decoded payload or null if invalid/expired
 */
export async function verifyAccessToken(
  token: string,
  secret: string
): Promise<JWTPayload | null> {
  try {
    const key = createSecretKey(secret);
    const { payload } = await jwtVerify(token, key);

    // Validate required fields
    if (!payload.sub || !payload.wid || !payload.email || !payload.role) {
      return null;
    }

    return {
      sub: payload.sub as string,
      wid: payload.wid as string,
      email: payload.email as string,
      handle: (payload.handle as string) ?? null,
      role: payload.role as Role,
      iat: payload.iat as number,
      exp: payload.exp as number,
    };
  } catch (error) {
    if (error instanceof errors.JWTExpired) {
      console.log('JWT expired');
    } else if (error instanceof errors.JWTInvalid) {
      console.log('JWT invalid');
    }
    return null;
  }
}

/**
 * Verify and decode a refresh token.
 *
 * @param token - JWT string to verify
 * @param secret - JWT signing secret from environment
 * @returns Session ID or null if invalid/expired
 */
export async function verifyRefreshToken(
  token: string,
  secret: string
): Promise<string | null> {
  try {
    const key = createSecretKey(secret);
    const { payload } = await jwtVerify(token, key);

    // Validate this is a refresh token
    if (payload.type !== 'refresh' || !payload.sid) {
      return null;
    }

    return payload.sid as string;
  } catch {
    return null;
  }
}

/**
 * Decode a JWT without verifying (for debugging).
 * WARNING: Do not trust the contents - always verify first!
 */
export function decodeToken(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
}
