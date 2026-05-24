/**
 * createWorkspace — Main Factory Function
 *
 * Creates an Ensemble Workspace instance that can be deployed as a
 * Cloudflare Worker. Wires up middleware, routes, and the shell.
 *
 * @example
 * ```ts
 * // worker.ts
 * import { createWorkspace } from './index';
 *
 * export default createWorkspace({
 *   workspace: { name: 'Acme', slug: 'acme' },
 *   brand: { accent: '#3B82F6' },
 * });
 * ```
 */
import type { Env, WorkspaceConfig } from './types';
/**
 * Cloudflare Worker instance returned by createWorkspace.
 */
export interface WorkspaceInstance {
    fetch: (request: Request, env: Env, ctx: ExecutionContext) => Response | Promise<Response>;
}
/**
 * Create a new Ensemble Workspace instance.
 */
export declare function createWorkspace(config: WorkspaceConfig): WorkspaceInstance;
export type { WorkspaceConfig } from './types';
//# sourceMappingURL=create-workspace.d.ts.map