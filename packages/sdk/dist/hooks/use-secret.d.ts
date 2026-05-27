/**
 * useSecret() — React hook for reading/writing encrypted per-guest-app
 * secrets stored by the workspace.
 *
 * The workspace owns the encryption key; the guest app never sees it.
 * Each call goes through /_ensemble/apps/<your-app-id>/_secrets/<key>
 * which the workspace handles directly (not forwarded to the guest
 * worker). Plaintext only crosses the wire — never sits in any
 * client-side storage by default.
 *
 * Scopes:
 *   • 'app'  (default) — app-global secret, shared across all users
 *                        of this app. Admin-only write; member-read.
 *   • 'user' — per-user secret, scoped to the authenticated user.
 *                        User reads + writes their own; nobody else
 *                        (not even admins) can read or write it.
 *
 * Caller passes the guest app's appId (from the manifest). For
 * iframe-tier guests the gateway has already routed by appId, but
 * the hook still needs it explicitly for non-iframe contexts
 * (component-tier, standalone public pages with API key auth).
 */
export type SecretScope = 'app' | 'user';
export interface UseSecretOptions {
    /** Guest app id from your manifest (e.g. 'quiz-cms'). */
    appId: string;
    /** Secret name within the (app, scope) namespace. */
    key: string;
    /** 'app' (default) for shared, 'user' for per-user. */
    scope?: SecretScope;
}
export interface UseSecretReturn {
    /** Fetch and decrypt the current value. Null if unset. */
    get: () => Promise<string | null>;
    /** Encrypt + store. Throws on auth/permission failure. */
    set: (value: string) => Promise<void>;
    /** Remove. Returns true if a row was deleted, false if none existed. */
    remove: () => Promise<boolean>;
    /** True while the most recent call is in flight. */
    loading: boolean;
    /** Set on the most recent failure; cleared on next call start. */
    error: string | null;
}
export declare function useSecret(options: UseSecretOptions): UseSecretReturn;
/**
 * Framework-agnostic secrets client for non-React guest apps (Vue,
 * Solid, vanilla). Same semantics as the hook, no React dependency.
 */
export declare function createSecretsClient(appId: string): {
    get(key: string, scope?: SecretScope): Promise<string | null>;
    set(key: string, value: string, scope?: SecretScope): Promise<void>;
    remove(key: string, scope?: SecretScope): Promise<boolean>;
    list(scope?: SecretScope): Promise<Array<{
        key: string;
        updated_at: string;
    }>>;
};
//# sourceMappingURL=use-secret.d.ts.map