/**
 * Cloud Auth Middleware
 *
 * Extracts user authentication from Ensemble proxy headers.
 * In cloud mode, the Ensemble proxy handles authentication and
 * passes verified user info via HTTP headers.
 *
 * Headers:
 * - X-Ensemble-User-Id: User's unique ID
 * - X-Ensemble-User-Email: User's email address
 * - X-Ensemble-User-Role: User's role in the workspace
 * - X-Ensemble-Workspace-Id: Workspace ID
 * - X-Ensemble-Signature: HMAC signature for request verification
 */

import type { Context, Next, MiddlewareHandler } from 'hono';
import type { Env, ContextVariables, User, Membership, Role } from '../types';
import type { CloudAuthHeaders, ResolvedCloudConfig } from '../mode/define-config';

/**
 * Cloud auth middleware options.
 */
export interface CloudAuthMiddlewareOptions {
  /**
   * Header names for auth info.
   */
  headers: CloudAuthHeaders;

  /**
   * Shared secret for verifying proxy signatures.
   * If not provided, signature verification is skipped.
   */
  proxySecret?: string;

  /**
   * Allowed proxy IP addresses/ranges.
   * If not provided, IP verification is skipped.
   */
  allowedProxyIps?: string[];

  /**
   * If true, requests without valid headers will be rejected with 401.
   * If false, requests proceed but user will be undefined.
   * @default true
   */
  required?: boolean;
}

/**
 * Create cloud auth middleware that reads user from Ensemble proxy headers.
 *
 * @param options - Middleware options
 * @returns Hono middleware handler
 *
 * @example
 * ```ts
 * import { cloudAuth, DEFAULT_CLOUD_AUTH_HEADERS } from '@ensemble-edge/core';
 *
 * // With signature verification
 * app.use('/_ensemble/*', cloudAuth({
 *   headers: DEFAULT_CLOUD_AUTH_HEADERS,
 *   proxySecret: env.ENSEMBLE_PROXY_SECRET,
 * }));
 *
 * // With IP allowlist
 * app.use('/_ensemble/*', cloudAuth({
 *   headers: DEFAULT_CLOUD_AUTH_HEADERS,
 *   allowedProxyIps: ['10.0.0.0/8'],
 * }));
 * ```
 */
export function cloudAuth(options: CloudAuthMiddlewareOptions): MiddlewareHandler<{
  Bindings: Env;
  Variables: ContextVariables;
}> {
  const { headers, proxySecret, allowedProxyIps, required = true } = options;

  return async (c: Context<{ Bindings: Env; Variables: ContextVariables }>, next: Next) => {
    // 1. Get user info from headers
    const userId = c.req.header(headers.userId);
    const userEmail = c.req.header(headers.userEmail);
    const userRole = c.req.header(headers.userRole) as Role | undefined;
    const workspaceId = c.req.header(headers.workspaceId);
    const signature = c.req.header(headers.signature);

    // 2. Check if user info is present
    if (!userId || !userEmail || !userRole || !workspaceId) {
      if (required) {
        return c.json(
          {
            error: 'Authentication required',
            message: 'Missing Ensemble proxy headers',
          },
          401
        );
      }
      // Continue without user
      await next();
      return;
    }

    // 3. Verify signature (if proxySecret is configured)
    if (proxySecret) {
      const isValid = await verifyProxySignature(c, proxySecret, signature, headers);
      if (!isValid) {
        return c.json(
          {
            error: 'Invalid signature',
            message: 'Request signature verification failed',
          },
          401
        );
      }
    }

    // 4. Verify IP (if allowedProxyIps is configured)
    if (allowedProxyIps?.length) {
      const clientIp = getClientIp(c);
      if (!isIpAllowed(clientIp, allowedProxyIps)) {
        return c.json(
          {
            error: 'Forbidden',
            message: 'Request not from allowed proxy',
          },
          403
        );
      }
    }

    // 5. Validate role
    if (!isValidRole(userRole)) {
      return c.json(
        {
          error: 'Invalid role',
          message: `Role '${userRole}' is not valid`,
        },
        400
      );
    }

    // 6. Attach user info to context
    const user: User = {
      id: userId,
      email: userEmail,
      handle: c.req.header('X-Ensemble-User-Handle') || null,
      displayName: c.req.header('X-Ensemble-User-Name') || null,
      avatarUrl: c.req.header('X-Ensemble-User-Avatar') || null,
      locale: c.req.header('X-Ensemble-User-Locale') || 'en',
      createdAt: '', // Not provided by proxy
    };

    const membership: Membership = {
      userId,
      workspaceId,
      role: userRole,
      createdAt: '',
    };

    c.set('user', user);
    c.set('membership', membership);
    c.set('jwtPayload', null); // No JWT in cloud mode

    await next();
  };
}

/**
 * Create cloud auth middleware from resolved config.
 *
 * @param config - Resolved cloud config
 * @returns Hono middleware handler
 */
export function createCloudAuthMiddleware(
  config: ResolvedCloudConfig
): MiddlewareHandler<{ Bindings: Env; Variables: ContextVariables }> {
  return cloudAuth({
    headers: config.authHeaders,
    proxySecret: config.proxySecret,
    allowedProxyIps: config.allowedProxyIps,
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Verify the HMAC signature from the proxy.
 *
 * The signature is computed as:
 * HMAC-SHA256(secret, userId + userEmail + userRole + workspaceId + timestamp)
 */
async function verifyProxySignature(
  c: Context,
  secret: string,
  signature: string | undefined,
  headers: CloudAuthHeaders
): Promise<boolean> {
  if (!signature) {
    return false;
  }

  try {
    // Get timestamp from header (for replay protection)
    const timestamp = c.req.header('X-Ensemble-Timestamp');
    if (!timestamp) {
      return false;
    }

    // Check timestamp is within 5 minutes
    const now = Date.now();
    const requestTime = parseInt(timestamp, 10);
    if (isNaN(requestTime) || Math.abs(now - requestTime) > 5 * 60 * 1000) {
      return false;
    }

    // Build message to verify
    const message = [
      c.req.header(headers.userId),
      c.req.header(headers.userEmail),
      c.req.header(headers.userRole),
      c.req.header(headers.workspaceId),
      timestamp,
    ].join(':');

    // Compute expected signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBytes = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(message)
    );

    const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));

    // Constant-time comparison
    return timingSafeEqual(signature, expectedSignature);
  } catch {
    return false;
  }
}

/**
 * Get client IP from request (handles CF-Connecting-IP header).
 */
function getClientIp(c: Context): string {
  // Cloudflare sets CF-Connecting-IP
  return (
    c.req.header('CF-Connecting-IP') ||
    c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ||
    c.req.header('X-Real-IP') ||
    '0.0.0.0'
  );
}

/**
 * Check if IP is in allowed list.
 *
 * Supports:
 * - Exact IP: "10.0.0.1"
 * - CIDR notation: "10.0.0.0/8"
 */
function isIpAllowed(ip: string, allowedIps: string[]): boolean {
  for (const allowed of allowedIps) {
    if (allowed.includes('/')) {
      // CIDR notation
      if (isIpInCidr(ip, allowed)) {
        return true;
      }
    } else {
      // Exact match
      if (ip === allowed) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Check if IP is in CIDR range.
 */
function isIpInCidr(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split('/');
  const mask = ~(2 ** (32 - parseInt(bits, 10)) - 1);

  const ipInt = ipToInt(ip);
  const rangeInt = ipToInt(range);

  return (ipInt & mask) === (rangeInt & mask);
}

/**
 * Convert IP string to integer.
 */
function ipToInt(ip: string): number {
  const parts = ip.split('.').map(Number);
  return (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
}

/**
 * Constant-time string comparison.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Check if a role is valid.
 */
function isValidRole(role: string): role is Role {
  return ['owner', 'admin', 'member', 'viewer', 'guest'].includes(role);
}
