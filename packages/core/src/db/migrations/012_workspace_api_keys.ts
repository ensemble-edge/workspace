/**
 * Migration 012: workspace_api_keys
 *
 * Operator-issued API keys for programmatic access to the workspace's
 * existing HTTP surface (the same /_ensemble/* routes the UI uses).
 *
 * Auth model:
 *   • Plaintext token is shown ONCE at creation time (key_prefix +
 *     random suffix, format `wks_<base62>`). We store SHA-256(plaintext)
 *     in key_hash and the first 8 chars of the plaintext in key_prefix
 *     for human-recognition in the keys list ("wks_abc1...").
 *   • Caller sends `Authorization: Bearer <plaintext>`; middleware
 *     hashes it, looks up by hash, sets the user/workspace context.
 *   • Revocation is immediate (revoked_at IS NOT NULL).
 *   • Optional expiry (expires_at IS NOT NULL AND past = treat as expired).
 *
 * Scopes are stored as a JSON array of strings. For v0.1.76 we ship a
 * coarse-grained model (just 'admin' or 'read'); finer scopes
 * (read:brand, write:credentials, ...) come later without a schema
 * change since it's a free-form JSON column.
 *
 * created_by_user_id ties the key to its issuer — useful for audit
 * trails ("who created this key?") and for revoke-on-member-removal
 * logic (revoke a member's keys when their workspace access ends).
 */

import type { Migration } from '../migrate';

export const migration: Migration = {
  name: '012_workspace_api_keys',
  sql: `
    CREATE TABLE workspace_api_keys (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      created_by_user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      key_prefix TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      scopes TEXT NOT NULL DEFAULT '["admin"]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_used_at TEXT,
      expires_at TEXT,
      revoked_at TEXT
    );
    CREATE INDEX idx_api_keys_workspace ON workspace_api_keys(workspace_id);
    CREATE UNIQUE INDEX idx_api_keys_hash ON workspace_api_keys(key_hash);
  `,
};
