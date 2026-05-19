/**
 * React hooks for the workspace context surface.
 *
 * `useWorkspaceContext()` is the primary API — returns the full
 * versioned context bag. The selector hooks (`useLocale`, `useUser`,
 * `useTheme`, `useBrand`, `useWorkspace`) are typed wrappers that
 * return one domain. Both styles share the same singleton client
 * underneath; calling either is free after the first fetch.
 *
 * Re-renders happen automatically when the user changes their
 * preferred locale (or any other field) via `setUserLocale()` or
 * future setters — the client notifies all subscribers.
 */
import { useEffect, useState, useCallback } from 'react';
import { workspaceContextClient } from '../context';
/**
 * The primary workspace-context hook. Returns:
 *   - `ctx`        : full WorkspaceContext (or null while loading)
 *   - `refresh()`  : force-refetch (rarely needed; setters auto-refresh)
 *   - `setUserLocale(locale)` : update the current user's preferred
 *                               locale + auto-refresh
 *
 * Example:
 *   const { ctx, setUserLocale } = useWorkspaceContext();
 *   if (!ctx) return <Loading />;
 *   const lang = ctx.locale.userPreferred ?? ctx.locale.default;
 */
export function useWorkspaceContext() {
    const [ctx, setCtx] = useState(() => workspaceContextClient.peek());
    useEffect(() => {
        // Subscribe — fires immediately with current value.
        const unsub = workspaceContextClient.subscribe(setCtx);
        // Kick off first load if not yet fetched.
        if (!workspaceContextClient.peek()) {
            void workspaceContextClient.get();
        }
        return unsub;
    }, []);
    const refresh = useCallback(async () => {
        await workspaceContextClient.get({ refresh: true });
    }, []);
    const setUserLocale = useCallback(async (locale) => {
        await workspaceContextClient.setUserLocale(locale);
    }, []);
    return { ctx, refresh, setUserLocale };
}
/* ──────────────────────────────────────────────────────────────
 * Selector hooks — typed wrappers around useWorkspaceContext().
 * Same data, more ergonomic for single-domain consumers.
 * ──────────────────────────────────────────────────────────── */
/**
 * Just the locale slice. Most guest apps wanting i18n use this.
 *
 * Example:
 *   const { default: def, supported, userPreferred } = useLocale();
 *   const activeLang = userPreferred ?? def;
 */
export function useLocale() {
    const { ctx } = useWorkspaceContext();
    return ctx?.locale ?? null;
}
/** Just the current user. null when unauthenticated. */
export function useUser() {
    const { ctx } = useWorkspaceContext();
    return ctx?.user ?? null;
}
/** Just the brand slice (name, tagline, logo URLs). */
export function useBrand() {
    const { ctx } = useWorkspaceContext();
    return ctx?.brand ?? null;
}
/** Just the theme slice. */
export function useTheme() {
    const { ctx } = useWorkspaceContext();
    return ctx?.theme ?? null;
}
/**
 * Just the workspace identity (id, slug, name, displayName).
 *
 * Note: replaces the old useWorkspace() stub that returned a hardcoded
 * `{ name: '', slug: '' }`. Guest apps that were calling that get real
 * data now without code changes.
 */
export function useWorkspace() {
    const { ctx } = useWorkspaceContext();
    return ctx?.workspace ?? null;
}
//# sourceMappingURL=use-workspace.js.map