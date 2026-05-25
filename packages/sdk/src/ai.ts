/**
 * @ensemble-edge/sdk — AI client for guest apps.
 *
 * Calls the workspace's tier proxy at /_ensemble/ai/call/<tier>.
 * The workspace handles:
 *   • Provider auth (operator's OpenAI / Anthropic / Workers AI keys
 *     live in the workspace, NEVER in the guest app)
 *   • Tier routing to the right provider + model
 *   • Fallback to 'good' tier if the requested tier doesn't exist
 *
 * Guest app picks a tier by NAME (`smart` / `good` / `simple` / etc).
 * The operator wires that tier name to a specific model in the
 * workspace's Settings → Connections → AI Access tab. Swapping a
 * tier's underlying model is an operator action — no guest-app
 * code change.
 *
 * Standard tier semantics (operator-configurable, but conventional):
 *   • simple — fast & cheap, for classification / short responses
 *   • good   — production default, balanced quality and cost
 *   • smart  — maximum capability, slower & more expensive
 *
 * Request body is OpenAI chat-completion shape:
 *   { messages: [{role, content}], max_tokens?, temperature?, ... }
 *
 * Response is the underlying provider's chat-completion response
 * (OpenAI-style by convention since dynamic routes dispatch through
 * the gateway's /compat/chat/completions endpoint). For guest apps
 * that just want the text reply, use the `text` field on the returned
 * convenience wrapper or call `.text()` on the response.
 */

/** Conventional tier names. Custom tiers also work — pass any string. */
export type AiTierName = 'simple' | 'good' | 'smart' | (string & {});

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiCallOptions {
  /** Conversation. At minimum one user message. */
  messages: AiMessage[];
  /** Token cap on the response. Defaults left to the provider. */
  max_tokens?: number;
  /** 0.0–2.0; defaults left to the provider. */
  temperature?: number;
  /** Additional provider-shaped fields (top_p, stop, etc) pass through. */
  [key: string]: unknown;
}

/**
 * OpenAI chat-completion response shape (the common output across all
 * supported providers via the gateway's compat endpoint).
 */
export interface AiChatCompletion {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  [key: string]: unknown;
}

/**
 * Result wrapper with both raw response and a convenience .text accessor.
 */
export interface AiResult {
  /** The first choice's message content — what most guest apps want. */
  text: string;
  /** Which underlying model actually served the response. */
  model: string;
  /** Token usage, if reported by the provider. */
  usage: AiChatCompletion['usage'];
  /** The full response body for guest apps needing more detail. */
  raw: AiChatCompletion;
  /** True if the workspace fell back to a different tier (the requested
   *  tier didn't exist in this workspace). Surfaced from the
   *  X-Ensemble-Tier-Fallback response header. */
  fallback_used: string | null;
}

export interface AiClient {
  /**
   * Call the given tier with a chat-completion request. Returns the
   * normalized result on success; throws on HTTP error.
   */
  run(tier: AiTierName, options: AiCallOptions): Promise<AiResult>;
}

export function createAiClient(): AiClient {
  return {
    async run(tier, options) {
      const r = await fetch(`/_ensemble/ai/call/${encodeURIComponent(tier)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(options),
      });
      const fallback_used = r.headers.get('X-Ensemble-Tier-Fallback');
      if (!r.ok) {
        let detail = '';
        try {
          detail = await r.text();
        } catch { /* ignore */ }
        throw new Error(`AI call failed (HTTP ${r.status}): ${detail.slice(0, 300)}`);
      }
      const raw = (await r.json()) as AiChatCompletion;
      const text = raw.choices?.[0]?.message?.content ?? '';
      return {
        text,
        model: raw.model,
        usage: raw.usage,
        raw,
        fallback_used,
      };
    },
  };
}

/** Singleton — guest apps don't usually need more than one client. */
export const aiClient = createAiClient();
