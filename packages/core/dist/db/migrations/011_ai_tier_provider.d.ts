/**
 * Migration 011: AI tier provider hint
 *
 * A tier's `provider` describes the *shape* of requests/responses
 * Cloudflare AI Gateway forwards under the hood. Used by:
 *   1. The "Test tier" button in Connections, which sends a canary call
 *      shaped for the provider (workers-ai translation vs OpenAI chat).
 *   2. Future helpers in the guest runtime that can validate request
 *      bodies before they leave the iframe.
 *
 * Values are advisory hints, not enforcement — guest apps can POST any
 * body they want; the workspace doesn't reshape it. The provider field
 * just lets us produce sensible diagnostics.
 *
 * Allowed (informal enum, validated by service): 'workers-ai' |
 * 'openai-chat' | 'anthropic-messages' | 'custom'. Default 'custom'.
 */
import type { Migration } from '../migrate';
export declare const migration: Migration;
//# sourceMappingURL=011_ai_tier_provider.d.ts.map