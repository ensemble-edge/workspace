/**
 * Migration 010: Workspace settings
 *
 * Operator-tunable workspace policy that's neither brand identity nor
 * an integration credential. First use: session lifetime (how long a
 * signed JWT cookie remains valid).
 *
 * Future keys: idle_timeout_seconds, mfa_required, ip_allowlist,
 * default_locale_negotiation, etc.
 *
 * One row per (workspace, key). Values stored as text so any shape can
 * be persisted; callers parse as needed (with a default fallback).
 */

import type { Migration } from '../migrate';

export const migration: Migration = {
  name: '010_workspace_settings',
  sql: `
CREATE TABLE IF NOT EXISTS workspace_settings (
  workspace_id  TEXT NOT NULL,
  key           TEXT NOT NULL,
  value         TEXT NOT NULL,
  updated_at    TEXT DEFAULT (datetime('now')),
  updated_by    TEXT,                          -- user_id of admin who set it
  PRIMARY KEY (workspace_id, key),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
  `,
};
