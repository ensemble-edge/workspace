/**
 * Guest-app secret store — encrypted per-(app, optionally-user) values
 * in D1. The guest app calls workspace-side proxy routes; the workspace
 * encrypts/decrypts with a key the guest never sees.
 *
 * Same encryption mechanics as workspace_credentials but a DIFFERENT
 * HKDF info string ('ensemble:guest-secrets:v1') so the derived key
 * is independent — a compromise of one doesn't compromise the other.
 *
 * Scoping:
 *   • app_id     — gateway-injected; identifies which guest app
 *   • user_id    — null for app-global, set for per-user secrets
 *   • key        — operator/dev-chosen name within the scope
 *
 * Trust model enforced by callers (routes):
 *   • App-global writes: any authenticated request via the guest's
 *     gateway path. The guest itself decides who can write (its own
 *     business logic) but the workspace gates on app_id boundary.
 *   • Per-user writes: only when the request actor's user_id matches.
 *     Admins do NOT have an override.
 *   • Reads: same rules as writes (per-user only by that user;
 *     app-global by anyone authenticated to that app).
 */
import type { Env } from '../types';
export interface SecretRow {
    workspace_id: string;
    app_id: string;
    user_id: string | null;
    key: string;
    /** Always null on the public surface; we never return plaintext via list. */
    created_at: string;
    updated_at: string;
    updated_by_user_id: string | null;
}
/**
 * Get one decrypted secret. Returns null if not found.
 *
 * Caller is responsible for enforcing the trust model — for per-user
 * secrets, only call this when the request actor's user_id matches
 * the user_id argument. For app-global, pass user_id: null.
 */
export declare function getSecret(env: Env, scope: {
    workspaceId: string;
    appId: string;
    userId: string | null;
}, key: string): Promise<string | null>;
/**
 * Set a secret. Plaintext is encrypted before writing; the caller's
 * raw value never touches D1. Upsert by (workspace_id, app_id,
 * user_id, key) — overwrites any existing value.
 */
export declare function setSecret(env: Env, scope: {
    workspaceId: string;
    appId: string;
    userId: string | null;
}, key: string, value: string, opts?: {
    updatedByUserId?: string | null;
}): Promise<void>;
/**
 * Delete a secret. Idempotent — returns true if a row was removed,
 * false if no matching row existed.
 */
export declare function deleteSecret(env: Env, scope: {
    workspaceId: string;
    appId: string;
    userId: string | null;
}, key: string): Promise<boolean>;
/**
 * List secrets for a scope. Returns metadata only — never plaintext.
 * Caller can use this to render a "configured secrets" UI without
 * exposing values.
 */
export declare function listSecrets(env: Env, scope: {
    workspaceId: string;
    appId: string;
    userId: string | null | 'any';
}): Promise<SecretRow[]>;
//# sourceMappingURL=guest-secrets.d.ts.map