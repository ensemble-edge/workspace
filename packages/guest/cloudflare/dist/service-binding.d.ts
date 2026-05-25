/**
 * Use a Cloudflare Service Binding to communicate with the workspace.
 *
 * @example
 * ```ts
 * import { useServiceBinding } from './index';
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
export declare function useServiceBinding(binding: Fetcher): {
    /**
     * Get the current user from the workspace.
     */
    getUser(): Promise<unknown>;
    /**
     * Call a workspace API endpoint.
     */
    call(path: string, options?: RequestInit): Promise<unknown>;
};
//# sourceMappingURL=service-binding.d.ts.map