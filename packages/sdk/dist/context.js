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
class WorkspaceContextClient {
    ctx = null;
    subscribers = new Set();
    pendingFetch = null;
    /**
     * Get the current context. Triggers a fetch if not yet loaded.
     * Subsequent calls return the cached value; pass `{ refresh: true }`
     * to force a re-fetch (e.g. after the user changes their preferred
     * locale).
     */
    async get(options = {}) {
        if (this.ctx && !options.refresh)
            return this.ctx;
        if (this.pendingFetch && !options.refresh)
            return this.pendingFetch;
        this.pendingFetch = this.fetch();
        try {
            this.ctx = await this.pendingFetch;
            this.notifyAll();
            return this.ctx;
        }
        finally {
            this.pendingFetch = null;
        }
    }
    /**
     * Synchronous accessor. Returns null until the first fetch resolves;
     * useful for hooks that want to render-then-update once context loads.
     */
    peek() {
        return this.ctx;
    }
    /**
     * Subscribe to context changes. Returns an unsubscribe function.
     * Called immediately with the current value (or null if not yet
     * loaded), and on every subsequent change.
     */
    subscribe(fn) {
        this.subscribers.add(fn);
        fn(this.ctx);
        return () => { this.subscribers.delete(fn); };
    }
    /**
     * Update the user's preferred locale. Persists server-side and
     * re-fetches the context so all subscribers see the new value.
     */
    async setUserLocale(locale) {
        const res = await fetch('/_ensemble/workspace/preferences/locale', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ locale: locale ?? '' }),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.detail || body.error || `HTTP ${res.status}`);
        }
        await this.get({ refresh: true });
    }
    async fetch() {
        try {
            const res = await fetch('/_ensemble/workspace/context', {
                credentials: 'include',
            });
            if (!res.ok)
                return null;
            return (await res.json());
        }
        catch {
            return null;
        }
    }
    notifyAll() {
        for (const sub of this.subscribers)
            sub(this.ctx);
    }
}
/** Singleton instance — shared across all hook invocations on the page. */
export const workspaceContextClient = new WorkspaceContextClient();
//# sourceMappingURL=context.js.map