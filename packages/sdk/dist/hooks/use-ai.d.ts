/**
 * useAI({ tier }) — React hook for calling the workspace's AI tier
 * proxy from a guest app.
 *
 * Canonical shape (matches @ensemble-edge/guest-runtime and the
 * shell's in-tree runtime; identical contract across all three
 * runtimes so guest-app code lifts cleanly between contexts):
 *
 *   const ai = useAI({ tier: 'smart' });
 *
 *   const result = await ai.call({
 *     messages: [{ role: 'user', content: 'Hello' }],
 *     max_tokens: 64,
 *   });
 *
 *   // The full provider response:
 *   result.data           // unknown — provider-shaped (OpenAI-style by default)
 *
 *   // Convenience accessor for the most common case (a single chat-
 *   // completion-style reply):
 *   result.text           // string — pre-extracted from data.choices[0].message.content
 *                         //          or data.content[0].text (Anthropic) etc.
 *
 *   // Fallback signal — set when the workspace dispatched the call
 *   // through a different tier than requested (e.g. requested tier
 *   // didn't exist; workspace fell back to 'good').
 *   result.fallback       // string | null
 *
 *   // Raw Response for advanced cases (streaming, headers, etc).
 *   result.response       // Response
 *
 * Hook returns:
 *
 *   ai.call(body) → Promise<{ response, data, text, fallback }>
 *   ai.loading    // boolean — true while a call is in flight
 *   ai.error      // string | null — set on the most recent failure
 *   ai.fallback   // string | null — fallback name from the latest call
 */
export interface UseAIOptions {
    /** Tier name — 'simple' / 'good' / 'smart' or a custom operator-defined tier. */
    tier: string;
}
export interface AiCallResult {
    /** Raw fetch Response — for streaming, headers, status, etc. */
    response: Response;
    /** Parsed provider response body. Provider-shaped (no normalization). */
    data: unknown;
    /** Convenience: the assistant's reply text, extracted from common shapes. */
    text: string;
    /** Set when the workspace fell back to a different tier than requested. */
    fallback: string | null;
}
export interface UseAIReturn {
    /** Call the bound tier with a chat-completion-shaped body. */
    call: (body: unknown) => Promise<AiCallResult>;
    /** True while a call is in flight. */
    loading: boolean;
    /** Set on the most recent call's failure; cleared on next call start. */
    error: string | null;
    /** Set if the most recent call was served from a fallback tier. */
    fallback: string | null;
}
export declare function useAI({ tier }: UseAIOptions): UseAIReturn;
//# sourceMappingURL=use-ai.d.ts.map