/**
 * Knowledge Domain
 *
 * Knowledge base and RAG functionality for AI context.
 */
export interface KnowledgeEntry {
    id: string;
    content: string;
    metadata: Record<string, unknown>;
}
export declare function createKnowledgeService(): {
    search: (_query: string) => Promise<KnowledgeEntry[]>;
    add: (_entry: Omit<KnowledgeEntry, "id">) => Promise<void>;
};
//# sourceMappingURL=index.d.ts.map