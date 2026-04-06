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

export function createAIService(_context: AIContext) {
  return {
    chat: async (_message: string): Promise<AIMessage> => {
      // TODO: Implement AI chat
      return {
        role: 'assistant',
        content: 'AI service not yet implemented',
        timestamp: Date.now(),
      };
    },
    getHistory: async (): Promise<AIMessage[]> => {
      // TODO: Get conversation history
      return [];
    },
  };
}
