/**
 * Ensemble Workspace — Cloudflare Worker Entry Point
 *
 * This is the entry point for the Cloudflare Worker. It creates a workspace
 * instance and exports it for the Workers runtime.
 *
 * Usage:
 *   wrangler dev --local    # Local development
 *   wrangler deploy         # Production deployment
 *
 * Configuration is in wrangler.toml (bindings) and here (workspace config).
 */
/**
 * Create the workspace instance.
 *
 * This configuration can be customized per-deployment. For multi-tenant
 * setups, you might load this from environment variables or a config file.
 */
declare const workspace: import("./create-workspace").WorkspaceInstance;
/**
 * Export the workspace as the default export.
 *
 * Cloudflare Workers expects a default export with a `fetch` handler.
 */
export default workspace;
//# sourceMappingURL=worker.d.ts.map