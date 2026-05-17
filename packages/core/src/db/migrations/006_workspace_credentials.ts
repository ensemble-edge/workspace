/**
 * Migration 006: Workspace Credentials
 *
 * Generic key/value store for workspace-managed credentials and config.
 *
 *   Secrets   (is_secret=1): AES-GCM encrypted at rest with a key
 *               derived from env.JWT_SECRET via HKDF-SHA256 with
 *               info 'ensemble:credentials:v1'.
 *   Config    (is_secret=0): plain text. Sending domains, account IDs,
 *               provider names, verification status, etc.
 *
 * Categories partition the namespace so the UI can render sections
 * independently and so future settings tabs can have their own buckets.
 */

import type { Migration } from '../migrate';

export const migration: Migration = {
  name: '006_workspace_credentials',
  sql: `
CREATE TABLE IF NOT EXISTS workspace_credentials (
  workspace_id     TEXT NOT NULL,
  key              TEXT NOT NULL,
  category         TEXT NOT NULL CHECK (category IN ('connection','notifications','ai','other')),
  is_secret        INTEGER NOT NULL DEFAULT 0,
  -- For secrets: base64(iv || ciphertext) of an AES-GCM encryption
  value_encrypted  TEXT,
  -- For plain config: the raw value
  value_plain      TEXT,
  updated_at       TEXT DEFAULT (datetime('now')),
  updated_by       TEXT,
  PRIMARY KEY (workspace_id, key),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_credentials_category
  ON workspace_credentials(workspace_id, category);
  `,
};
