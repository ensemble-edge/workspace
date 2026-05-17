/**
 * AI tier service.
 *
 * Tiers are operator-named capability buckets (smart/good/simple by
 * default; unlimited custom). Each tier maps 1:1 to a dynamic route
 * (`ws/<name>`) in the configured Cloudflare AI Gateway.
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
export interface AiTier {
    name: string;
    display_name: string;
    description: string | null;
    icon: string;
    is_default: boolean;
    gateway_route: string;
    route_provisioned: boolean;
    last_error: string | null;
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
export declare function seedDefaultTiers(env: Env, workspaceId: string): Promise<void>;
export declare function listTiers(env: Env, workspaceId: string): Promise<AiTier[]>;
export declare function getTier(env: Env, workspaceId: string, name: string): Promise<AiTier | null>;
export declare function createTier(env: Env, workspaceId: string, input: {
    name: string;
    display_name?: string;
    description?: string;
    icon?: string;
}): Promise<AiTier>;
export declare function patchTier(env: Env, workspaceId: string, name: string, patch: {
    display_name?: string;
    description?: string;
    icon?: string;
}): Promise<void>;
/**
 * Delete a custom tier. Default tiers cannot be deleted.
 * The gateway route is preserved (operator may delete manually in CF).
 */
export declare function deleteTier(env: Env, workspaceId: string, name: string): Promise<void>;
/**
 * Auto-create the dynamic route for this tier in the configured AI Gateway.
 * Idempotent — calling on an already-provisioned route returns success.
 *
 * Failure modes (each surfaces a useful message):
 *   - 401/403: token doesn't have AI Gateway: Edit permission
 *   - 404: gateway doesn't exist (operator typo'd the gateway name)
 *   - 409: route already exists (we treat as success and mark provisioned)
 *   - 5xx / network: transient — operator can hit Retry
 */
export declare function provisionTierRoute(env: Env, workspaceId: string, tierName: string): Promise<{
    ok: true;
} | {
    ok: false;
    status: number;
    message: string;
    manual_url?: string;
}>;
export {};
//# sourceMappingURL=ai-tiers.d.ts.map