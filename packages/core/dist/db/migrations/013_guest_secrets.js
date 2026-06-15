/**
 * Migration 013: guest_secrets
 *
 * Encrypted per-guest-app secret storage. The intended pattern:
 * guest apps with their own provider integrations (OAuth tokens,
 * third-party API keys, per-user secrets) call workspace-side proxy
 * routes to store + retrieve secrets without ever seeing the
 * encryption key.
 *
 * Encryption: AES-256-GCM, key derived from env.JWT_SECRET via HKDF
 * with info string 'ensemble:guest-secrets:v1'. Independent from
 * workspace_credentials encryption (different info label).
 *
 * Scoping:
 *   • workspace_id + app_id identify which guest app owns the secret
 *   • user_id is NULL for app-global secrets (operator-set, shared)
 *   • user_id is set for per-user secrets (e.g. each user's OAuth token)
 *
 * Trust model:
 *   • App-global: writable by workspace admin OR the guest app on
 *     behalf of any caller (the gateway-injected app_id is the scope
 *     boundary)
 *   • Per-user: writable only when the request actor's user_id matches
 *     the secret's user_id. No admin override.
 *   • Workspace admins can list metadata (key names, set/unset,
 *     updated_at, scope) but never see plaintext.
 *
 * The encryption key is invariant across rotations (would need a
 * key_version column + multi-key support to rotate; not yet built).
 */
export const migration = {
    name: '013_guest_secrets',
    sql: `
    CREATE TABLE guest_secrets (
      workspace_id TEXT NOT NULL,
      app_id TEXT NOT NULL,
      user_id TEXT,
      key TEXT NOT NULL,
      value_encrypted TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by_user_id TEXT,
      PRIMARY KEY (workspace_id, app_id, user_id, key)
    );
    CREATE INDEX idx_guest_secrets_app ON guest_secrets(workspace_id, app_id);
    CREATE INDEX idx_guest_secrets_user ON guest_secrets(workspace_id, user_id) WHERE user_id IS NOT NULL;
  `,
};
//# sourceMappingURL=013_guest_secrets.js.map