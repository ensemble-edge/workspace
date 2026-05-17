/**
 * Migration 007: Workspace AI Tiers
 *
 * Operator-named capability buckets (smart/good/simple by default;
 * unlimited custom tiers) that map 1:1 to dynamic routes in the
 * configured Cloudflare AI Gateway. Workspace's own AI features and
 * every guest app reference tiers by `name`; the gateway maps each
 * route to whichever model the operator chose (managed in the CF
 * dashboard, not here).
 *
 * `display_name` is operator-friendly label, freely renamable.
 * `name` is the stable contract — once set, never changes; both
 * workspace internals and guest apps reference by `name`.
 *
 * `gateway_route` is computed once: 'ws/<name>'. Stored explicitly so
 * any future change to the routing scheme doesn't break existing rows.
 *
 * Default tiers are seeded per-workspace on the first AI Gateway save,
 * not in this migration — the migration only creates the table. (We
 * can't seed at migration time because workspace_id is per-workspace,
 * and there may be no workspaces yet.)
 */

import type { Migration } from '../migrate';

export const migration: Migration = {
  name: '007_workspace_ai_tiers',
  sql: `
CREATE TABLE IF NOT EXISTS workspace_ai_tiers (
  workspace_id     TEXT NOT NULL,
  name             TEXT NOT NULL,        -- 'smart' | 'good' | 'simple' | custom
  display_name     TEXT,                  -- operator label; defaults to name
  description      TEXT,
  icon             TEXT DEFAULT 'sparkles',
  is_default       INTEGER NOT NULL DEFAULT 0,
  gateway_route    TEXT NOT NULL,         -- 'ws/<name>' — what we send to the gateway
  route_provisioned INTEGER NOT NULL DEFAULT 0,  -- 1 once auto-create has succeeded
  created_at       TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (workspace_id, name),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_tiers_default
  ON workspace_ai_tiers(workspace_id, is_default);
  `,
};
