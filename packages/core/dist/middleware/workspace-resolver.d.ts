/**
 * Workspace Resolver Middleware
 *
 * Resolves the current workspace from the request hostname or path.
 * Supports multiple resolution strategies:
 * 1. Subdomain: acme.ensemble.ai → workspace "acme"
 * 2. Custom domain: hub.acme.com → lookup in workspaces table
 * 3. Path prefix: /w/acme/... → workspace "acme"
 * 4. Config-based: Single workspace from ensemble.config.ts
 */
import type { Env, ContextVariables, ResolvedConfig } from '../types';
/**
 * Create workspace resolver middleware.
 *
 * @param config - Resolved workspace config (from ensemble.config.ts)
 * @returns Hono middleware
 */
export declare function workspaceResolver(config: ResolvedConfig): import("hono").MiddlewareHandler<{
    Bindings: Env;
    Variables: ContextVariables;
}, string, {}, Response>;
//# sourceMappingURL=workspace-resolver.d.ts.map