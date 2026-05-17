/**
 * Migration 009: Workspace locales
 *
 * Operator-declared content locales for the workspace. English is
 * always present (seeded lazily on first read). Other locales are
 * opt-in. Exactly one is the default at any time.
 *
 * Stored as BCP-47 tags (case-preserving) so we can negotiate against
 * Accept-Language correctly: 'en', 'es', 'fr-CA', 'zh-Hans-CN'.
 *
 * Per-locale settings (RTL, date format, currency) are deliberately
 * absent for v0.1.15 — fields can be added later without migration
 * since SQLite ALTER TABLE ADD COLUMN is free.
 */

import type { Migration } from '../migrate';

export const migration: Migration = {
  name: '009_workspace_locales',
  sql: `
CREATE TABLE IF NOT EXISTS workspace_locales (
  workspace_id  TEXT NOT NULL,
  code          TEXT NOT NULL,                 -- BCP-47, case-preserved
  display_name  TEXT NOT NULL,                 -- 'English', 'Español', etc.
  is_default    INTEGER NOT NULL DEFAULT 0,
  enabled       INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (workspace_id, code),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workspace_locales_default
  ON workspace_locales(workspace_id, is_default);
  `,
};
