/**
 * Workspace credentials service.
 *
 * Reads and writes workspace-scoped key/value pairs from the
 * workspace_credentials table (migration 006). Secrets are AES-GCM
 * encrypted at rest using a key derived from env.JWT_SECRET via HKDF
 * (see utils/derive-key.ts).
 *
 * Naming convention: keys are snake_case with a category prefix in
 * their meaning (not their string). The category is stored as a
 * column so the UI can render per-category sections.
 *
 * The functions here NEVER return secret values to anonymous callers.
 * Route handlers gate decryption behind admin-role checks.
 */
export type CredentialCategory = 'connection' | 'notifications' | 'ai' | 'other';
export interface CredentialSummary {
    key: string;
    category: CredentialCategory;
    is_secret: boolean;
    set: boolean;
    /** For non-secrets only — the actual value. Null for secrets. */
    value: string | null;
    updated_at: string;
    updated_by: string | null;
}
interface Env {
    DB: D1Database;
    JWT_SECRET: string;
}
/**
 * Fetch a credential's decrypted value. For secrets, this performs
 * decryption — only call from admin-authorized code paths or from
 * server-side subsystems that need the value (email sender, AI proxy).
 *
 * Returns null if the key isn't set.
 */
export declare function getCredential(env: Env, workspaceId: string, key: string): Promise<string | null>;
/**
 * Upsert a credential. Encrypts if `isSecret` is true.
 * Set `value` to null to clear (use deleteCredential() to remove the row entirely).
 */
export declare function setCredential(env: Env, workspaceId: string, key: string, category: CredentialCategory, value: string, opts: {
    isSecret: boolean;
    updatedBy?: string;
}): Promise<void>;
/**
 * Remove a credential row entirely.
 */
export declare function deleteCredential(env: Env, workspaceId: string, key: string): Promise<void>;
/**
 * List credentials as summaries (no secret values revealed).
 * Filter by category if provided.
 */
export declare function listCredentials(env: Env, workspaceId: string, category?: CredentialCategory): Promise<CredentialSummary[]>;
/**
 * Workspace-public-URL helper. Returns the stored canonical URL
 * (e.g. https://workspace.curalisto.com) used for magic-link emails,
 * password-reset links, OAuth redirects, etc. Falls back to the
 * incoming request's origin and warns if unset.
 *
 * Subsystems that send emails or generate external-facing URLs MUST
 * use this rather than reading request.url directly.
 */
export declare function getWorkspacePublicUrl(env: Env, workspaceId: string, fallbackRequest?: Request): Promise<string>;
export {};
//# sourceMappingURL=credentials.d.ts.map