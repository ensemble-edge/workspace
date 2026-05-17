/**
 * AI Domain
 *
 * AI panel, agent orchestration, and LLM integration.
 */
export interface AIContext {
    workspaceId: string;
    userId: string;
    conversationId?: string;
}
export interface AIMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
}
export declare function createAIService(_context: AIContext): {
    chat: (_message: string) => Promise<AIMessage>;
    getHistory: () => Promise<AIMessage[]>;
};
//# sourceMappingURL=index.d.ts.map