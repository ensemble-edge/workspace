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
import type { WorkspaceContext, ThemeMode } from '../types';
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
export declare function useWorkspaceContext(): {
    ctx: WorkspaceContext | null;
    refresh: () => Promise<void>;
    setUserLocale: (locale: string | null) => Promise<void>;
};
/**
 * Just the locale slice. Most guest apps wanting i18n use this.
 *
 * Example:
 *   const { default: def, supported, userPreferred } = useLocale();
 *   const activeLang = userPreferred ?? def;
 */
export declare function useLocale(): WorkspaceContext['locale'] | null;
/** Just the current user. null when unauthenticated. */
export declare function useUser(): WorkspaceContext['user'];
/** Just the brand slice (name, tagline, logo URLs). */
export declare function useBrand(): WorkspaceContext['brand'] | null;
/** Just the theme slice. */
export declare function useTheme(): WorkspaceContext['theme'] | null;
/**
 * Just the workspace identity (id, slug, name, displayName).
 *
 * Note: replaces the old useWorkspace() stub that returned a hardcoded
 * `{ name: '', slug: '' }`. Guest apps that were calling that get real
 * data now without code changes.
 */
export declare function useWorkspace(): WorkspaceContext['workspace'] | null;
export type { WorkspaceContext, ThemeMode };
//# sourceMappingURL=use-workspace.d.ts.map