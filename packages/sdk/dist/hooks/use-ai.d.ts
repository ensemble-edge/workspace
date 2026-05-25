/**
 * useAI() — React hook for calling the workspace's AI tier proxy.
 *
 * Two usage patterns:
 *
 *   // 1. Bind to a specific tier (most common)
 *   const ai = useAI('smart');
 *   const result = await ai.run({ messages: [...] });
 *
 *   // 2. Pick the tier per-call (when the choice is dynamic)
 *   const ai = useAI();
 *   const result = await ai.run('simple', { messages: [...] });
 *
 * The hook returns a STABLE object across renders — safe to put in
 * effect deps without retriggering. It's just a thin React wrapper
 * around the framework-agnostic aiClient; non-React guest apps can
 * import { aiClient } directly from @ensemble-edge/sdk.
 */
import { type AiTierName, type AiCallOptions, type AiResult } from '../ai';
export interface UseAIReturn {
    /**
     * Run a chat completion against the bound tier (if useAI(tier)) or
     * the provided tier (if useAI() with no arg).
     */
    run: (tierOrOptions: AiTierName | AiCallOptions, options?: AiCallOptions) => Promise<AiResult>;
    /** The tier this hook was bound to, or null if unbound. */
    tier: AiTierName | null;
}
export declare function useAI(tier?: AiTierName): UseAIReturn;
//# sourceMappingURL=use-ai.d.ts.map