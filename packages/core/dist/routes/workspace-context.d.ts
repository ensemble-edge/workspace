/**
 * Workspace context routes — the SDK's window into per-workspace +
 * per-user state.
 *
 * Exposes:
 *   GET  /_ensemble/workspace/context            — full workspace context
 *   PUT  /_ensemble/workspace/preferences/locale — set user-preferred locale
 *   GET  /_ensemble/workspace/preferences/locale — read user-preferred locale
 *
 * Contract: see services/workspace-context.ts for the resolver + type
 * definition. The endpoint is intentionally thin — all the real work
 * lives in the resolver so guest-app authors can reason about it
 * cleanly.
 */
import { Hono } from 'hono';
import type { Env, ContextVariables } from '../types';
type AppEnv = {
    Bindings: Env;
    Variables: ContextVariables;
};
type App = Hono<AppEnv>;
export declare function createWorkspaceContextRoutes(): App;
export {};
//# sourceMappingURL=workspace-context.d.ts.map