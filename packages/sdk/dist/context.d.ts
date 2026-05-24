/**
 * Framework-agnostic workspace context client.
 *
 * Fetches `/_ensemble/workspace/context` once on mount, caches the
 * result in-memory, exposes a subscription API for reactive
 * frameworks. The React `useWorkspaceContext()` hook is a thin
 * binding over this; guest apps using Vue/Solid/Svelte/vanilla can
 * use this client directly.
 *
 * Single instance per page — the client is exported as a singleton
 * so React hooks don't each spawn their own fetch.
 */
import type { WorkspaceContext } from './types';
type Subscriber = (ctx: WorkspaceContext | null) => void;
declare class WorkspaceContextClient {
    private ctx;
    private subscribers;
    private pendingFetch;
    /**
     * Get the current context. Triggers a fetch if not yet loaded.
     * Subsequent calls return the cached value; pass `{ refresh: true }`
     * to force a re-fetch (e.g. after the user changes their preferred
     * locale).
     */
    get(options?: {
        refresh?: boolean;
    }): Promise<WorkspaceContext | null>;
    /**
     * Synchronous accessor. Returns null until the first fetch resolves;
     * useful for hooks that want to render-then-update once context loads.
     */
    peek(): WorkspaceContext | null;
    /**
     * Subscribe to context changes. Returns an unsubscribe function.
     * Called immediately with the current value (or null if not yet
     * loaded), and on every subsequent change.
     */
    subscribe(fn: Subscriber): () => void;
    /**
     * Update the user's preferred locale. Persists server-side and
     * re-fetches the context so all subscribers see the new value.
     */
    setUserLocale(locale: string | null): Promise<void>;
    private fetch;
    private notifyAll;
}
/** Singleton instance — shared across all hook invocations on the page. */
export declare const workspaceContextClient: WorkspaceContextClient;
export {};
//# sourceMappingURL=context.d.ts.map