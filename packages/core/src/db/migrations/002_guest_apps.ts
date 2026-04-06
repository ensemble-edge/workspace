/**
 * Migration 002: Guest Apps Registry
 *
 * Creates the guest_apps table for the Guest App Gateway.
 * This tracks registered guest apps (connectors, tools, agents)
 * and their connection configuration.
 */

import type { Migration } from '../migrate';

export const migration: Migration = {
  name: '002_guest_apps',
  sql: `
-- ============================================================================
-- Guest Apps Registry
-- ============================================================================
-- Tracks registered guest apps and their connection configuration.
-- Apps can connect via service binding (0ms, same-zone) or HTTP (remote).

CREATE TABLE IF NOT EXISTS guest_apps (
  id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  description TEXT,
  icon TEXT,
  category TEXT NOT NULL DEFAULT 'tool' CHECK (category IN ('tool', 'connector', 'agent', 'panel')),

  -- Connection type
  connection_type TEXT NOT NULL DEFAULT 'http' CHECK (connection_type IN ('service_binding', 'http')),

  -- For service binding connections (same-zone CF Workers)
  binding_name TEXT,

  -- For HTTP connections (remote services)
  endpoint_url TEXT,

  -- App state
  enabled INTEGER DEFAULT 1,

  -- Access control
  required_role TEXT DEFAULT 'member' CHECK (required_role IN ('guest', 'member', 'admin', 'owner')),

  -- Manifest cache (JSON)
  manifest_json TEXT,
  manifest_fetched_at TEXT,

  -- Settings for this app in this workspace
  settings_json TEXT DEFAULT '{}',

  -- Timestamps
  installed_at TEXT DEFAULT (datetime('now')),
  installed_by TEXT,
  updated_at TEXT DEFAULT (datetime('now')),

  PRIMARY KEY (workspace_id, id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_guest_apps_workspace ON guest_apps(workspace_id);
CREATE INDEX IF NOT EXISTS idx_guest_apps_category ON guest_apps(workspace_id, category);
CREATE INDEX IF NOT EXISTS idx_guest_apps_enabled ON guest_apps(workspace_id, enabled);

-- ============================================================================
-- Guest App Scoped Storage (D1 tables per app)
-- ============================================================================
-- This is a registry of tables created by guest apps.
-- Each guest app gets a namespace prefix: guestapp_{app_id}_{table_name}

CREATE TABLE IF NOT EXISTS guest_app_tables (
  workspace_id TEXT NOT NULL,
  app_id TEXT NOT NULL,
  table_name TEXT NOT NULL,
  schema_json TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (workspace_id, app_id, table_name),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- ============================================================================
-- Guest App API Keys
-- ============================================================================
-- API keys for guest apps to authenticate with the gateway.

CREATE TABLE IF NOT EXISTS guest_app_api_keys (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  app_id TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  scopes TEXT NOT NULL DEFAULT '[]', -- JSON array of scopes
  last_used_at TEXT,
  expires_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  created_by TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_guest_app_keys_workspace ON guest_app_api_keys(workspace_id, app_id);
CREATE INDEX IF NOT EXISTS idx_guest_app_keys_hash ON guest_app_api_keys(key_hash);
  `,
};
