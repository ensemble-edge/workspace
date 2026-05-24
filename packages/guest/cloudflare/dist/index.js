/**
 * @ensemble-edge/guest-cloudflare — Cloudflare Workers adapter
 *
 * Deploy guest apps as Cloudflare Workers with zero-latency
 * service binding support.
 *
 * @example
 * ```ts
 * import { defineGuestApp } from '../../core/dist/index.js';
 * import { createGuestWorker } from './index.js';
 *
 * const app = defineGuestApp({
 *   manifest: {
 *     id: 'echo',
 *     name: 'Echo',
 *     version: '1.0.0',
 *     category: 'tool',
 *     permissions: [],
 *     entry: '/',
 *   },
 *   async fetch(request, ctx) {
 *     return new Response(`Echo: ${ctx.workspace.workspaceId}`);
 *   },
 * });
 *
 * export default createGuestWorker(app);
 * ```
 */
export { createGuestWorker } from './adapter.js';
export { useServiceBinding } from './service-binding.js';
//# sourceMappingURL=index.js.map