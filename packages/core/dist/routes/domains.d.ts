/**
 * Workspace brand-domain management API.
 *
 * Operators register the hostnames a tenant's public surfaces serve under
 * (e.g. curalisto.com). Backed by the workspace_domains table (migration
 * 017); the resolver reads it to map host → tenant. See
 * services/brand-domain.ts and docs/plan/brand-domain.md.
 *
 *   GET    /_ensemble/domains          list this workspace's domains
 *   POST   /_ensemble/domains          add one  { domain, proto? }
 *   DELETE /_ensemble/domains/:domain  remove one
 *
 * Admin-only (mutations). Mounted under auth in create-workspace.
 */
import { Hono } from 'hono';
import type { Env, ContextVariables } from '../types';
type AppEnv = {
    Bindings: Env;
    Variables: ContextVariables;
};
export declare function createDomainsRoutes(): Hono<AppEnv>;
export {};
//# sourceMappingURL=domains.d.ts.map