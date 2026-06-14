/**
 * Public brand guide renderer.
 *
 * Server-rendered HTML at /brand that surfaces the workspace's brand
 * identity for external sharing: wordmark, color palette with copyable
 * hex codes, typography stack, logo variants, and contact info.
 *
 * Headers + meta tags enforce noindex/nofollow so the page doesn't
 * appear in search. The page works without shell JS so it loads
 * instantly and renders even for visitors with JS disabled.
 */
interface Env {
    DB: D1Database;
}
export declare function renderBrandGuide(env: Env, workspaceId: string): Promise<string>;
export {};
//# sourceMappingURL=brand-guide.d.ts.map