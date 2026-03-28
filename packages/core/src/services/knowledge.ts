// Knowledge service for AI context

export interface KnowledgeEntry {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
}

export function createKnowledgeService() {
  return {
    search: async (query: string): Promise<KnowledgeEntry[]> => {
      // TODO: Implement vector search
      return [];
    },
    add: async (entry: Omit<KnowledgeEntry, 'id'>) => {
      // TODO: Add to knowledge base
    },
  };
}
