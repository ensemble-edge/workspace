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
import { encryptString, decryptString } from '../utils/derive-key';

const PURPOSE = 'ensemble:guest-secrets:v1' as const;

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

interface DbSecretRow extends SecretRow {
  value_encrypted: string;
}

/**
 * Get one decrypted secret. Returns null if not found.
 *
 * Caller is responsible for enforcing the trust model — for per-user
 * secrets, only call this when the request actor's user_id matches
 * the user_id argument. For app-global, pass user_id: null.
 */
export async function getSecret(
  env: Env,
  scope: { workspaceId: string; appId: string; userId: string | null },
  key: string,
): Promise<string | null> {
  // SQLite treats NULL specially in equality; need IS NULL for the
  // app-global case. Branch the query accordingly.
  const row = scope.userId === null
    ? await env.DB.prepare(
        `SELECT value_encrypted FROM guest_secrets
          WHERE workspace_id = ? AND app_id = ? AND user_id IS NULL AND key = ?`
      ).bind(scope.workspaceId, scope.appId, key).first<{ value_encrypted: string }>()
    : await env.DB.prepare(
        `SELECT value_encrypted FROM guest_secrets
          WHERE workspace_id = ? AND app_id = ? AND user_id = ? AND key = ?`
      ).bind(scope.workspaceId, scope.appId, scope.userId, key).first<{ value_encrypted: string }>();
  if (!row?.value_encrypted) return null;
  return decryptString(env.JWT_SECRET, PURPOSE, row.value_encrypted);
}

/**
 * Set a secret. Plaintext is encrypted before writing; the caller's
 * raw value never touches D1. Upsert by (workspace_id, app_id,
 * user_id, key) — overwrites any existing value.
 */
export async function setSecret(
  env: Env,
  scope: { workspaceId: string; appId: string; userId: string | null },
  key: string,
  value: string,
  opts: { updatedByUserId?: string | null } = {},
): Promise<void> {
  const encrypted = await encryptString(env.JWT_SECRET, PURPOSE, value);
  // SQLite ON CONFLICT requires the constraint columns to match
  // exactly — we explicitly list all four PK columns.
  await env.DB.prepare(
    `INSERT INTO guest_secrets
       (workspace_id, app_id, user_id, key, value_encrypted, created_at, updated_at, updated_by_user_id)
     VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?)
     ON CONFLICT (workspace_id, app_id, user_id, key)
     DO UPDATE SET
       value_encrypted = excluded.value_encrypted,
       updated_at = excluded.updated_at,
       updated_by_user_id = excluded.updated_by_user_id`
  ).bind(
    scope.workspaceId,
    scope.appId,
    scope.userId,
    key,
    encrypted,
    opts.updatedByUserId ?? null,
  ).run();
}

/**
 * Delete a secret. Idempotent — returns true if a row was removed,
 * false if no matching row existed.
 */
export async function deleteSecret(
  env: Env,
  scope: { workspaceId: string; appId: string; userId: string | null },
  key: string,
): Promise<boolean> {
  const r = scope.userId === null
    ? await env.DB.prepare(
        `DELETE FROM guest_secrets
          WHERE workspace_id = ? AND app_id = ? AND user_id IS NULL AND key = ?`
      ).bind(scope.workspaceId, scope.appId, key).run()
    : await env.DB.prepare(
        `DELETE FROM guest_secrets
          WHERE workspace_id = ? AND app_id = ? AND user_id = ? AND key = ?`
      ).bind(scope.workspaceId, scope.appId, scope.userId, key).run();
  return (r.meta?.changes ?? 0) > 0;
}

/**
 * List secrets for a scope. Returns metadata only — never plaintext.
 * Caller can use this to render a "configured secrets" UI without
 * exposing values.
 */
export async function listSecrets(
  env: Env,
  scope: { workspaceId: string; appId: string; userId: string | null | 'any' },
): Promise<SecretRow[]> {
  let query: string;
  const params: unknown[] = [scope.workspaceId, scope.appId];
  if (scope.userId === 'any') {
    query = `SELECT workspace_id, app_id, user_id, key, created_at, updated_at, updated_by_user_id
               FROM guest_secrets WHERE workspace_id = ? AND app_id = ?`;
  } else if (scope.userId === null) {
    query = `SELECT workspace_id, app_id, user_id, key, created_at, updated_at, updated_by_user_id
               FROM guest_secrets WHERE workspace_id = ? AND app_id = ? AND user_id IS NULL`;
  } else {
    query = `SELECT workspace_id, app_id, user_id, key, created_at, updated_at, updated_by_user_id
               FROM guest_secrets WHERE workspace_id = ? AND app_id = ? AND user_id = ?`;
    params.push(scope.userId);
  }
  query += ` ORDER BY key ASC`;
  const result = await env.DB.prepare(query).bind(...params).all<DbSecretRow>();
  return (result.results ?? []).map((r) => ({
    workspace_id: r.workspace_id,
    app_id: r.app_id,
    user_id: r.user_id,
    key: r.key,
    created_at: r.created_at,
    updated_at: r.updated_at,
    updated_by_user_id: r.updated_by_user_id,
  }));
}
