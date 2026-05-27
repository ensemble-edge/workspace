/**
 * AI tier service.
 *
 * Tiers are operator-named capability buckets (smart/good/simple by
 * default; unlimited custom). Each tier maps 1:1 to a dynamic route
 * (`ws-<name>`) in the configured Cloudflare AI Gateway.
 *
 * v0.1.75: route names use HYPHENS not slashes. CF's compat endpoint
 * (`/compat/chat/completions`) parses `dynamic/<route-name>` as the
 * model field; multi-segment names like `ws/simple` confuse the
 * dispatcher and produce a generic "code 2005 Failed to get response
 * from provider" error even when the route is otherwise valid. Single-
 * segment names like `ws-simple` dispatch correctly.
 *
 * - Default tiers (smart/good/simple) are seeded on the first AI
 *   Gateway save. Cannot be deleted; their `display_name` is renamable.
 * - Custom tiers are operator-created; freely renamable and deletable.
 *   Deleting a tier in workspace does NOT delete the gateway route.
 * - Each tier's gateway route is auto-created via CF API on tier
 *   creation. Failures surface as a "create manually + Retry" UX state.
 *
 * The `useAI({ tier })` hook in the guest runtime references tiers by
 * `name`. Unknown tier → falls back to `good` and logs the fallback.
 */
export type TierStatus = 'provisioned' | 'pending' | 'failed';
/**
 * Provider hint — describes the request/response shape that flows
 * through this tier's gateway route. Used by the "Test tier" button to
 * pick a canary payload that's actually meaningful for the underlying
 * model. Guest apps still POST whatever they want; the workspace
 * doesn't reshape requests.
 */
export type TierProvider = 'workers-ai' | 'openai-chat' | 'anthropic-messages' | 'custom';
export declare const TIER_PROVIDERS: TierProvider[];
export interface AiTier {
    name: string;
    display_name: string;
    description: string | null;
    icon: string;
    is_default: boolean;
    gateway_route: string;
    route_provisioned: boolean;
    last_error: string | null;
    provider: TierProvider;
    created_at: string;
}
interface Env {
    DB: D1Database;
    JWT_SECRET: string;
}
export declare const DEFAULT_TIERS: Array<{
    name: string;
    display_name: string;
    description: string;
    icon: string;
}>;
/**
 * Seed the three default tiers for a workspace. Idempotent — does
 * nothing if a tier with that name already exists.
 *
 * Called when the operator first saves AI Gateway credentials.
 */
/**
 * v0.1.75: backfill any existing tier rows that have legacy
 * gateway_route values like `ws/<name>` (with slash) to the new
 * hyphenated form `ws-<name>`. Idempotent — does nothing on
 * already-migrated rows. Runs once on every loadTiers() call so
 * existing workspaces get migrated without needing a separate
 * migration script.
 */
export declare function migrateLegacyGatewayRoutes(env: Env, workspaceId: string): Promise<void>;
export declare function seedDefaultTiers(env: Env, workspaceId: string): Promise<void>;
export declare function listTiers(env: Env, workspaceId: string): Promise<AiTier[]>;
export declare function getTier(env: Env, workspaceId: string, name: string): Promise<AiTier | null>;
export declare function createTier(env: Env, workspaceId: string, input: {
    name: string;
    display_name?: string;
    description?: string;
    icon?: string;
    provider?: TierProvider;
}): Promise<AiTier>;
export declare function patchTier(env: Env, workspaceId: string, name: string, patch: {
    display_name?: string;
    description?: string;
    icon?: string;
    provider?: TierProvider;
}): Promise<void>;
/**
 * Delete a custom tier. Default tiers cannot be deleted.
 * The gateway route is preserved (operator may delete manually in CF).
 */
export declare function deleteTier(env: Env, workspaceId: string, name: string): Promise<void>;
export declare function provisionTierRoute(env: Env, workspaceId: string, tierName: string): Promise<{
    ok: true;
} | {
    ok: false;
    status: number;
    message: string;
    manual_url?: string;
}>;
/**
 * Build a tiny canary payload appropriate for the tier's declared
 * provider. Returns null for 'custom' — the operator must wire it up
 * themselves in their guest app. The shapes here come straight from
 * each provider's published API.
 */
export declare function canaryForProvider(provider: TierProvider): unknown | null;
/**
 * Build the Cloudflare dashboard URL the AI Access card uses for its
 * "Configure model in Cloudflare" deep link. Lands the operator on the
 * gateway namespace's route page where they pick the underlying model.
 */
export declare function gatewayDashboardUrl(accountId: string, gatewayName: string): string;
export {};
//# sourceMappingURL=ai-tiers.d.ts.map