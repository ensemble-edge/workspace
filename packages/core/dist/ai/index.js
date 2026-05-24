/**
 * AI Domain
 *
 * AI panel, agent orchestration, and LLM integration.
 */
export function createAIService(_context) {
    return {
        chat: async (_message) => {
            // TODO: Implement AI chat
            return {
                role: 'assistant',
                content: 'AI service not yet implemented',
                timestamp: Date.now(),
            };
        },
        getHistory: async () => {
            // TODO: Get conversation history
            return [];
        },
    };
}
//# sourceMappingURL=index.js.map