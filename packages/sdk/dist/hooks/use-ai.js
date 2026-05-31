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
import * as React from 'react';
/**
 * Extract the assistant's reply text from a provider-shaped response
 * body. Knows OpenAI chat-completion shape (most common), Anthropic
 * messages shape, and Workers AI's bare {response} shape. Returns
 * empty string if no recognizable text field is present.
 */
function extractText(data) {
    if (!data || typeof data !== 'object')
        return '';
    const d = data;
    // OpenAI / gateway compat: { choices: [{ message: { content } }] }
    const choices = d.choices;
    if (Array.isArray(choices) && choices[0]?.message?.content) {
        return String(choices[0].message.content);
    }
    // Anthropic messages: { content: [{ text }] }
    const content = d.content;
    if (Array.isArray(content) && content[0]?.text) {
        return String(content[0].text);
    }
    // Workers AI bare generate: { result: { response } } or { response }
    const result = d.result;
    if (result?.response)
        return String(result.response);
    if (result?.translated_text)
        return String(result.translated_text);
    if (typeof d.response === 'string')
        return d.response;
    return '';
}
export function useAI({ tier }) {
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState(null);
    const [fallback, setFallback] = React.useState(null);
    const call = React.useCallback(async (body) => {
        setLoading(true);
        setError(null);
        setFallback(null);
        try {
            const response = await fetch(`/_ensemble/ai/call/${encodeURIComponent(tier)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body),
            });
            const fb = response.headers.get('X-Ensemble-Tier-Fallback');
            if (fb)
                setFallback(fb);
            let data = null;
            try {
                data = await response.clone().json();
            }
            catch {
                data = await response.clone().text();
            }
            if (!response.ok) {
                const msg = typeof data === 'object' && data && 'error' in data
                    ? String(data.error)
                    : `AI call failed: ${response.status}`;
                setError(msg);
            }
            return { response, data, text: extractText(data), fallback: fb };
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : 'AI call failed';
            setError(msg);
            throw e;
        }
        finally {
            setLoading(false);
        }
    }, [tier]);
    return { call, loading, error, fallback };
}
//# sourceMappingURL=use-ai.js.map