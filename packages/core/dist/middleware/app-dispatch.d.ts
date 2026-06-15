/**
 * App dispatch middleware (Track B).
 *
 * When the workspace worker is routed a tenant brand host (`<brand>.com/*`
 * via a CF zone route), this middleware lets a guest app — mounted at an
 * operator-chosen public path in the App Manager — actually serve there,
 * by forwarding the request to that guest worker. Core-app mounts and
 * unclaimed paths fall through to the normal route table untouched.
 *
 * Registered AFTER the workspace resolver (so workspace + brandDomain are
 * set) and BEFORE the core-app routes / SPA catch-all.
 *
 * Reuses the gateway's forward shape (service binding or HTTP + injected
 * context headers). The ROUTING DECISION (services/app-dispatch.ts) is
 * unit-tested; the live Worker→Worker hop is verified on deploy (service
 * bindings + zone routes aren't exercisable in the dev container).
 *
 * Error isolation: a guest worker being down or unbound returns a 502 for
 * THAT path only — it never 500s the whole zone. Adds an
 * `X-Ensemble-Dispatch` debug header so "which worker served this" is
 * answerable.
 */
import type { MiddlewareHandler } from 'hono';
import type { Env, ContextVariables } from '../types';
export declare function appDispatch(): MiddlewareHandler<{
    Bindings: Env;
    Variables: ContextVariables;
}>;
//# sourceMappingURL=app-dispatch.d.ts.map