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
import type { MiddlewareHandler } from 'hono';
import type { Env, ContextVariables } from '../types';
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
 * import { cloudAuth, DEFAULT_CLOUD_AUTH_HEADERS } from '../index';
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
export declare function cloudAuth(options: CloudAuthMiddlewareOptions): MiddlewareHandler<{
    Bindings: Env;
    Variables: ContextVariables;
}>;
/**
 * Create cloud auth middleware from resolved config.
 *
 * @param config - Resolved cloud config
 * @returns Hono middleware handler
 */
export declare function createCloudAuthMiddleware(config: ResolvedCloudConfig): MiddlewareHandler<{
    Bindings: Env;
    Variables: ContextVariables;
}>;
//# sourceMappingURL=cloud-auth.d.ts.map