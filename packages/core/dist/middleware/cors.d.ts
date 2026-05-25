/**
 * CORS Middleware
 *
 * Handles Cross-Origin Resource Sharing for the /_ensemble/* API routes.
 * Allows the web app (app.ensemble.ai) and configured brand origins.
 */
import type { Env, ContextVariables } from '../types';
/**
 * CORS middleware factory.
 *
 * @param options - Optional configuration
 * @returns Hono middleware
 */
export declare function cors(options?: {
    additionalOrigins?: string[];
}): import("hono").MiddlewareHandler<{
    Bindings: Env;
    Variables: ContextVariables;
}, string, {}, Response>;
//# sourceMappingURL=cors.d.ts.map