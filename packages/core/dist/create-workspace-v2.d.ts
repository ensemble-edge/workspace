/**
 * createWorkspace v2 — Mode-Aware Factory Function
 *
 * Creates an Ensemble Workspace instance that supports both deployment modes:
 *
 * **Standalone Mode**: Worker handles everything
 * - Shell serving from bundled assets
 * - JWT-based auth with cookies
 * - Session management
 * - Bootstrap flow for first user
 *
 * **Cloud Mode**: Ensemble proxy handles shell + auth
 * - No shell serving (proxy handles it)
 * - User info from X-Ensemble-* headers
 * - No local auth routes
 * - Pure JSON API
 *
 * @example
 * ```ts
 * import { createWorkspace, defineConfig } from '@ensemble-edge/core';
 *
 * // Standalone mode
 * export default createWorkspace(defineConfig({
 *   mode: 'standalone',
 *   workspace: { name: 'Acme', slug: 'acme' },
 *   auth: {
 *     providers: ['email'],
 *     session: { secret: env.JWT_SECRET },
 *   },
 * }));
 *
 * // Cloud mode
 * export default createWorkspace(defineConfig({
 *   mode: 'cloud',
 *   workspace: { name: 'Acme', slug: 'acme' },
 *   proxySecret: env.ENSEMBLE_PROXY_SECRET,
 * }));
 * ```
 */
import type { Env } from './types';
import type { ResolvedModeConfig } from './mode/define-config';
/**
 * Cloudflare Worker instance returned by createWorkspace.
 */
export interface WorkspaceInstance {
    fetch: (request: Request, env: Env, ctx: ExecutionContext) => Response | Promise<Response>;
}
/**
 * Create a new Ensemble Workspace instance.
 *
 * @param config - Resolved workspace configuration (use defineConfig to create)
 * @returns Cloudflare Worker instance
 */
export declare function createWorkspaceV2(config: ResolvedModeConfig): WorkspaceInstance;
//# sourceMappingURL=create-workspace-v2.d.ts.map