/**
 * Credentials, AI tiers, setup-status, auth-methods, and user-invite
 * routes (v0.1.12).
 *
 * All endpoints under `/_ensemble/`. Admin-only routes verify
 * membership.role === 'admin' or 'owner' before reading/writing
 * secrets. The list endpoint never returns secret values; only an
 * "is set" flag.
 */
import { Hono } from 'hono';
import type { Env, ContextVariables } from '../types';
type AppEnv = {
    Bindings: Env;
    Variables: ContextVariables;
};
type App = Hono<AppEnv>;
export declare function createCredentialsRoutes(): App;
export {};
//# sourceMappingURL=credentials.d.ts.map