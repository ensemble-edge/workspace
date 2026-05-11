/**
 * Use a Cloudflare Service Binding to communicate with the workspace.
 *
 * @example
 * ```ts
 * import { useServiceBinding } from './index.js';
 *
 * export default {
 *   async fetch(request, env) {
 *     const workspace = useServiceBinding(env.WORKSPACE);
 *     const user = await workspace.getUser();
 *     return new Response(`Hello, ${user.name}`);
 *   },
 * };
 * ```
 */
export function useServiceBinding(binding) {
    return {
        /**
         * Get the current user from the workspace.
         */
        async getUser() {
            const response = await binding.fetch('http://workspace/api/user');
            return response.json();
        },
        /**
         * Call a workspace API endpoint.
         */
        async call(path, options) {
            const response = await binding.fetch(`http://workspace${path}`, options);
            return response.json();
        },
    };
}
//# sourceMappingURL=service-binding.js.map