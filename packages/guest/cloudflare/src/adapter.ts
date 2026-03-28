import type { GuestAppConfig } from '@ensemble-edge/guest';

/**
 * Create a Cloudflare Worker handler for a guest app.
 *
 * @example
 * ```ts
 * import { defineGuestApp } from '@ensemble-edge/guest';
 * import { createGuestWorker } from '@ensemble-edge/guest-cloudflare';
 *
 * const app = defineGuestApp({
 *   manifest: { id: 'my-app', name: 'My App', version: '1.0.0', permissions: [], entry: '/' },
 * });
 *
 * export default createGuestWorker(app);
 * ```
 */
export function createGuestWorker(app: ReturnType<typeof import('@ensemble-edge/guest').defineGuestApp>) {
  return {
    async fetch(request: Request, env: unknown, ctx: ExecutionContext): Promise<Response> {
      const url = new URL(request.url);

      // Serve manifest at /.well-known/ensemble-manifest.json
      if (url.pathname === '/.well-known/ensemble-manifest.json') {
        return new Response(JSON.stringify(app.manifest), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // TODO: Implement actual app serving
      return new Response('Guest app placeholder', {
        headers: { 'Content-Type': 'text/html' },
      });
    },
  };
}
