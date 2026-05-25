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
import { useCallback, useMemo } from 'react';
import { aiClient, } from '../ai.js';
export function useAI(tier) {
    const run = useCallback(async (tierOrOptions, options) => {
        // Disambiguate the two call signatures.
        let resolvedTier;
        let resolvedOptions;
        if (typeof tierOrOptions === 'string') {
            resolvedTier = tierOrOptions;
            if (!options) {
                throw new Error('useAI: run(tier, options) requires options');
            }
            resolvedOptions = options;
        }
        else {
            if (!tier) {
                throw new Error('useAI: bound-tier form requires useAI(tier). ' +
                    'For unbound use, call run(tier, options) instead.');
            }
            resolvedTier = tier;
            resolvedOptions = tierOrOptions;
        }
        return aiClient.run(resolvedTier, resolvedOptions);
    }, [tier]);
    return useMemo(() => ({ run, tier: tier ?? null }), [run, tier]);
}
//# sourceMappingURL=use-ai.js.map