/**
 * Authentication hook.
 *
 * Reads from the unified workspace context. The previous v0-stub
 * returned hardcoded `{ user: null, isAuthenticated: false }` — this
 * version returns real data: the current user (from
 * `useWorkspaceContext().user`) plus a `logout()` action that hits
 * the auth endpoint.
 */
import { useCallback } from 'react';
import { useWorkspaceContext } from './use-workspace.js';
export function useAuth() {
    const { ctx, refresh } = useWorkspaceContext();
    const user = ctx?.user
        ? {
            id: ctx.user.id,
            email: ctx.user.email,
            displayName: ctx.user.displayName,
            role: ctx.user.role,
        }
        : null;
    const logout = useCallback(async () => {
        await fetch('/_ensemble/auth/logout', {
            method: 'POST',
            credentials: 'include',
        });
        // Refresh the context — user slice goes back to null.
        await refresh();
    }, [refresh]);
    return {
        user,
        isAuthenticated: !!user,
        logout,
    };
}
//# sourceMappingURL=use-auth.js.map