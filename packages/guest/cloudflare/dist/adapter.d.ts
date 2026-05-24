/**
 * Cloudflare Workers adapter for Ensemble guest apps.
 *
 * Creates a Cloudflare Worker handler from a DefinedGuestApp.
 * Handles context extraction, manifest serving, and request routing.
 */
import type { DefinedGuestApp, GuestAppContext } from '../../core/dist/index';
/**
 * Cloudflare Worker environment bindings.
 * Guest apps typically have access to D1 (scoped), KV, and R2.
 */
export interface GuestWorkerEnv {
    /** D1 database (scoped to this app) */
    DB?: D1Database;
    /** KV namespace (scoped to this app) */
    KV?: KVNamespace;
    /** R2 bucket (scoped to this app) */
    R2?: R2Bucket;
    /** Additional environment variables */
    [key: string]: unknown;
}
/**
 * Cloudflare Worker fetch handler type.
 */
export type WorkerFetchHandler = (request: Request, env: GuestWorkerEnv, ctx: ExecutionContext) => Response | Promise<Response>;
/**
 * Options for createGuestWorker.
 */
export interface CreateGuestWorkerOptions {
    /**
     * Custom routes to handle before the default handler.
     * Use Hono or custom routing if needed.
     */
    routes?: Map<string, (request: Request, ctx: GuestAppContext, env: GuestWorkerEnv) => Response | Promise<Response>>;
    /**
     * Whether to allow requests without Ensemble context headers.
     * Useful for testing but should be false in production.
     */
    allowNoContext?: boolean;
}
/**
 * Create a Cloudflare Worker handler for a guest app.
 *
 * @example
 * ```ts
 * import { defineGuestApp } from '../../core/dist/index';
 * import { createGuestWorker } from './index';
 *
 * const app = defineGuestApp({
 *   manifest: {
 *     id: 'my-app',
 *     name: 'My App',
 *     version: '1.0.0',
 *     category: 'tool',
 *     permissions: ['read:user'],
 *     entry: '/',
 *   },
 *   async fetch(request, ctx) {
 *     return new Response(`Hello ${ctx.user?.userEmail ?? 'anonymous'}!`);
 *   },
 * });
 *
 * export default createGuestWorker(app);
 * ```
 */
export declare function createGuestWorker(app: DefinedGuestApp, options?: CreateGuestWorkerOptions): {
    fetch: WorkerFetchHandler;
};
//# sourceMappingURL=adapter.d.ts.map