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
import {
  aiClient,
  type AiTierName,
  type AiCallOptions,
  type AiResult,
} from '../ai';

export interface UseAIReturn {
  /**
   * Run a chat completion against the bound tier (if useAI(tier)) or
   * the provided tier (if useAI() with no arg).
   */
  run: (
    tierOrOptions: AiTierName | AiCallOptions,
    options?: AiCallOptions,
  ) => Promise<AiResult>;
  /** The tier this hook was bound to, or null if unbound. */
  tier: AiTierName | null;
}

export function useAI(tier?: AiTierName): UseAIReturn {
  const run = useCallback(
    async (
      tierOrOptions: AiTierName | AiCallOptions,
      options?: AiCallOptions,
    ): Promise<AiResult> => {
      // Disambiguate the two call signatures.
      let resolvedTier: AiTierName;
      let resolvedOptions: AiCallOptions;
      if (typeof tierOrOptions === 'string') {
        resolvedTier = tierOrOptions;
        if (!options) {
          throw new Error('useAI: run(tier, options) requires options');
        }
        resolvedOptions = options;
      } else {
        if (!tier) {
          throw new Error(
            'useAI: bound-tier form requires useAI(tier). ' +
            'For unbound use, call run(tier, options) instead.',
          );
        }
        resolvedTier = tier;
        resolvedOptions = tierOrOptions;
      }
      return aiClient.run(resolvedTier, resolvedOptions);
    },
    [tier],
  );

  return useMemo(() => ({ run, tier: tier ?? null }), [run, tier]);
}
