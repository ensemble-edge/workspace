/**
 * Guest-app secret routes.
 *
 * Mounted under /_ensemble/apps/:appId/_secrets/ — the `_secrets`
 * prefix means the workspace serves these directly rather than
 * forwarding to the guest worker (the guest gateway only forwards
 * non-underscore-prefixed paths). The guest app calls these to
 * read/write its own encrypted secrets.
 *
 * Routes:
 *   GET    /_ensemble/apps/:appId/_secrets             — list (metadata only)
 *   GET    /_ensemble/apps/:appId/_secrets/:key        — read decrypted value
 *   PUT    /_ensemble/apps/:appId/_secrets/:key        — set encrypted value
 *   DELETE /_ensemble/apps/:appId/_secrets/:key        — remove
 *
 * All accept ?scope=app (default) or ?scope=user. App-global secrets
 * are usable by any authenticated caller of that app; per-user
 * secrets are scoped to the request's authenticated user.
 *
 * Trust model:
 *   • App-global: any authenticated workspace member can read; only
 *     workspace admins can write (the app's "saved API key" pattern).
 *   • Per-user: the authenticated user reads + writes their own.
 *     Admins cannot read or write another user's secrets — the
 *     workspace's privileged-proxy model intentionally stops here
 *     so users have a "private" surface even from operators.
 */
import { Hono } from 'hono';
import type { Env, ContextVariables } from '../types';
export declare function createGuestSecretsRoutes(): Hono<{
    Bindings: Env;
    Variables: ContextVariables;
}>;
//# sourceMappingURL=guest-secrets.d.ts.map