/**
 * @ensemble-edge/core — Deployment Mode Detection
 *
 * Ensemble workspaces can run in two modes:
 *
 * 1. **Standalone Mode**: The Worker handles everything — shell serving, auth,
 *    sessions, and API. Zero dependency on Ensemble infrastructure. Perfect for:
 *    - Self-hosted deployments
 *    - Development and testing
 *    - Organizations that want full control
 *
 * 2. **Cloud Mode**: The Ensemble proxy handles shell serving and auth. The
 *    Worker receives pre-authenticated requests with user info in headers.
 *    Benefits:
 *    - Shell updates without Worker deploys
 *    - Centralized SSO across workspaces
 *    - Managed infrastructure
 *
 * @example
 * ```ts
 * import { defineConfig } from '@ensemble-edge/core';
 *
 * // Standalone mode (default)
 * export default createWorkspace(defineConfig({
 *   mode: 'standalone',
 *   workspace: { name: 'Acme', slug: 'acme' },
 *   auth: {
 *     providers: ['email'],
 *     sessionSecret: env.SESSION_SECRET,
 *   },
 * }));
 *
 * // Cloud mode
 * export default createWorkspace(defineConfig({
 *   mode: 'cloud',
 *   workspace: { name: 'Acme', slug: 'acme' },
 *   // Auth handled by Ensemble proxy
 * }));
 * ```
 */
// ============================================================================
// Helper Functions
// ============================================================================
/**
 * Default auth headers used by Ensemble proxy.
 */
export const DEFAULT_CLOUD_AUTH_HEADERS = {
    userId: 'X-Ensemble-User-Id',
    userEmail: 'X-Ensemble-User-Email',
    userRole: 'X-Ensemble-User-Role',
    workspaceId: 'X-Ensemble-Workspace-Id',
    signature: 'X-Ensemble-Signature',
};
/**
 * Check if config is standalone mode.
 */
export function isStandaloneMode(config) {
    return config.mode === 'standalone';
}
/**
 * Check if config is cloud mode.
 */
export function isCloudMode(config) {
    return config.mode === 'cloud';
}
/**
 * Get resolved auth headers for cloud mode.
 */
export function getCloudAuthHeaders(config) {
    return {
        ...DEFAULT_CLOUD_AUTH_HEADERS,
        ...config.authHeaders,
    };
}
/**
 * Detect mode from environment (useful for auto-configuration).
 *
 * Returns 'cloud' if ENSEMBLE_PROXY_SECRET is set, otherwise 'standalone'.
 */
export function detectModeFromEnv(env) {
    if (env.ENSEMBLE_PROXY_SECRET) {
        return 'cloud';
    }
    return 'standalone';
}
/**
 * Type guard to check if a value is a valid deployment mode.
 */
export function isValidDeploymentMode(value) {
    return value === 'standalone' || value === 'cloud';
}
//# sourceMappingURL=index.js.map