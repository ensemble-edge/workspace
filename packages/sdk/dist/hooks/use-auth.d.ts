/**
 * Authentication hook.
 *
 * Reads from the unified workspace context. The previous v0-stub
 * returned hardcoded `{ user: null, isAuthenticated: false }` — this
 * version returns real data: the current user (from
 * `useWorkspaceContext().user`) plus a `logout()` action that hits
 * the auth endpoint.
 */
export interface UseAuthReturn {
    user: {
        id: string;
        email: string;
        displayName: string | null;
        role: string;
    } | null;
    isAuthenticated: boolean;
    logout: () => Promise<void>;
}
export declare function useAuth(): UseAuthReturn;
//# sourceMappingURL=use-auth.d.ts.map