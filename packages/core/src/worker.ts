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

import { createWorkspace } from './create-workspace';

/**
 * Create the workspace instance.
 *
 * This configuration can be customized per-deployment. For multi-tenant
 * setups, you might load this from environment variables or a config file.
 */
const workspace = createWorkspace({
  workspace: {
    name: 'Ensemble Workspace',
    slug: 'ensemble',
    type: 'organization',
  },
  brand: {
    accent: '#3B82F6', // Blue
    baseTheme: 'neutral',
  },
  locale: {
    baseLanguage: 'en',
    timezone: 'UTC',
    dateFormat: 'us',
  },
  auth: {
    providers: ['email'],
  },
});

/**
 * Export the workspace as the default export.
 *
 * Cloudflare Workers expects a default export with a `fetch` handler.
 */
export default workspace;
