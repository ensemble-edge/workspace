/**
 * Migration 003: Brand Token Groups
 *
 * Adds brand_token_groups table for user-defined color groups
 * (e.g., "Slate", "Gold", "Vermillion") and custom token groups.
 *
 * Also relaxes the type CHECK on brand_tokens to support 'rich_text' and 'gradient'.
 */

import type { Migration } from '../migrate';

export const migration: Migration = {
  name: '003_brand_groups',
  sql: `
-- ============================================================================
-- Brand Token Groups
-- ============================================================================

CREATE TABLE IF NOT EXISTS brand_token_groups (
  workspace_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  label TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'colors',
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (workspace_id, slug),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Recreate brand_tokens without restrictive CHECK constraints.
-- SQLite doesn't support ALTER TABLE DROP CONSTRAINT, so we recreate.
CREATE TABLE IF NOT EXISTS brand_tokens_v2 (
  workspace_id TEXT NOT NULL,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text',
  label TEXT,
  description TEXT,
  group_slug TEXT,
  locale TEXT NOT NULL DEFAULT '',
  is_stale INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  updated_by TEXT,
  PRIMARY KEY (workspace_id, category, key, locale),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Copy existing data
INSERT OR IGNORE INTO brand_tokens_v2
  (workspace_id, category, key, value, type, label, description, locale, is_stale, sort_order, updated_at, updated_by)
SELECT
  workspace_id, category, key, value, type, label, description, locale, is_stale, sort_order, updated_at, updated_by
FROM brand_tokens;

-- Swap tables
DROP TABLE IF EXISTS brand_tokens;
ALTER TABLE brand_tokens_v2 RENAME TO brand_tokens;
  `,
};
