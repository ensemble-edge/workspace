/**
 * Cloudflare Workers adapter for Ensemble guest apps.
 *
 * Creates a Cloudflare Worker handler from a DefinedGuestApp.
 * Handles context extraction, manifest serving, and request routing.
 */
import { getContext } from '../../core/dist/index.js';
/**
 * Create a Cloudflare Worker handler for a guest app.
 *
 * @example
 * ```ts
 * import { defineGuestApp } from '../../core/dist/index.js';
 * import { createGuestWorker } from './index.js';
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
export function createGuestWorker(app, options = {}) {
    return {
        async fetch(request, env, executionCtx) {
            const url = new URL(request.url);
            // Serve manifest at /.well-known/ensemble-manifest.json
            if (url.pathname === '/.well-known/ensemble-manifest.json') {
                return new Response(JSON.stringify(app.manifest, null, 2), {
                    headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'public, max-age=60',
                    },
                });
            }
            // Health check endpoint
            if (url.pathname === '/health' || url.pathname === (app.manifest.health_endpoint ?? '/health')) {
                return new Response(JSON.stringify({
                    status: 'ok',
                    app: app.manifest.id,
                    version: app.manifest.version,
                    timestamp: new Date().toISOString(),
                }), {
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            // Extract context from headers
            const ctx = getContext(request);
            // Require context unless explicitly allowed
            if (!ctx && !options.allowNoContext) {
                return new Response(JSON.stringify({
                    error: {
                        code: 'MISSING_CONTEXT',
                        message: 'This app must be accessed through the Ensemble Gateway',
                    },
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            // Create a fallback context for testing
            const effectiveCtx = ctx ?? {
                workspace: { workspaceId: 'test' },
                user: null,
                appId: app.manifest.id,
                requestId: crypto.randomUUID(),
                capabilityToken: 'test-token',
            };
            // Check custom routes
            if (options.routes) {
                const routeHandler = options.routes.get(url.pathname);
                if (routeHandler) {
                    try {
                        return await routeHandler(request, effectiveCtx, env);
                    }
                    catch (error) {
                        return handleError(error, effectiveCtx.requestId);
                    }
                }
            }
            // Call the app's fetch handler if defined
            if (app.fetch) {
                try {
                    return await app.fetch(request, effectiveCtx, env);
                }
                catch (error) {
                    return handleError(error, effectiveCtx.requestId);
                }
            }
            // Default response if no fetch handler
            return new Response(JSON.stringify({
                data: {
                    app: app.manifest.id,
                    name: app.manifest.name,
                    version: app.manifest.version,
                    description: app.manifest.description,
                },
                meta: {
                    request_id: effectiveCtx.requestId,
                },
            }), {
                headers: { 'Content-Type': 'application/json' },
            });
        },
    };
}
/**
 * Handle errors and return a standard error response.
 */
function handleError(error, requestId) {
    console.error('Guest app error:', error);
    const message = error instanceof Error ? error.message : 'Internal error';
    const code = error instanceof Error && 'code' in error
        ? error.code
        : 'INTERNAL_ERROR';
    return new Response(JSON.stringify({
        error: {
            code,
            message,
        },
        meta: {
            request_id: requestId,
        },
    }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
    });
}
//# sourceMappingURL=adapter.js.map