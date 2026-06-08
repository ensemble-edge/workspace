/**
 * Workspace API keys — operator-issued long-lived tokens for
 * programmatic access to the same /_ensemble/* routes the UI uses.
 *
 * Token format: `wks_<base62>` (33 chars total). The prefix `wks_` makes
 * the token visually identifiable in logs / commit grep / GitHub secret
 * scanners. The body is 29 chars of base62 randomness drawn from
 * crypto.getRandomValues — ~172 bits of entropy, comparable to a
 * GitHub fine-grained PAT.
 *
 * Storage: SHA-256(plaintext) hex, never the raw token. Plaintext is
 * returned ONCE at creation time. On revoke we keep the row (audit
 * trail) and set revoked_at.
 */
import type { Env } from '../types';
export interface ApiKey {
    id: string;
    workspace_id: string;
    created_by_user_id: string;
    name: string;
    key_prefix: string;
    scopes: string[];
    created_at: string;
    last_used_at: string | null;
    expires_at: string | null;
    revoked_at: string | null;
}
/**
 * Create a new API key. Returns the full plaintext token ONCE; caller
 * must store/display it immediately because the plaintext can never
 * be recovered after this call.
 */
export declare function createApiKey(env: Env, input: {
    workspaceId: string;
    userId: string;
    name: string;
    scopes?: string[];
    expiresAt?: string | null;
}): Promise<{
    key: ApiKey;
    plaintext: string;
}>;
/** List all keys for a workspace (revoked + active). */
export declare function listApiKeys(env: Env, workspaceId: string): Promise<ApiKey[]>;
/** Mark a key as revoked. Returns true if a row was updated. */
export declare function revokeApiKey(env: Env, workspaceId: string, keyId: string): Promise<boolean>;
/**
 * Regenerate: create a new key with the same name+scopes, revoke the
 * old one. Returns the new plaintext.
 */
export declare function regenerateApiKey(env: Env, workspaceId: string, keyId: string, userId: string): Promise<{
    key: ApiKey;
    plaintext: string;
} | null>;
/**
 * Look up an API key by its plaintext token. Returns null if the
 * token doesn't exist, is revoked, or has expired. Updates
 * last_used_at on a successful match.
 */
export declare function findApiKeyByPlaintext(env: Env, plaintext: string): Promise<ApiKey | null>;
//# sourceMappingURL=api-keys.d.ts.map