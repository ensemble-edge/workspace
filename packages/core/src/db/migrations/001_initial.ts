/**
 * Migration 001: Initial Schema
 *
 * Creates the core tables for Ensemble Workspace:
 * - workspaces
 * - users
 * - memberships
 * - sessions
 * - brand_tokens
 * - nav_config
 */

import type { Migration } from '../migrate';

export const migration: Migration = {
  name: '001_initial',
  sql: `
-- ============================================================================
-- Workspaces
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'organization' CHECK (type IN ('organization', 'personal', 'team')),
  settings_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces(slug);

-- ============================================================================
-- Users (AIUX Identity)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  handle TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  locale TEXT DEFAULT 'en',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_handle ON users(handle);

-- ============================================================================
-- Memberships (User ↔ Workspace)
-- ============================================================================
CREATE TABLE IF NOT EXISTS memberships (
  user_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer', 'guest')),
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, workspace_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_memberships_workspace ON memberships(workspace_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);

-- ============================================================================
-- Sessions (Refresh Tokens)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- ============================================================================
-- Brand Tokens
-- ============================================================================
CREATE TABLE IF NOT EXISTS brand_tokens (
  workspace_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('colors', 'typography', 'identity', 'spatial', 'messaging', 'custom')),
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('color', 'text', 'number', 'url', 'font')),
  label TEXT,
  description TEXT,
  locale TEXT NOT NULL DEFAULT '',
  is_stale INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  updated_by TEXT,
  PRIMARY KEY (workspace_id, category, key, locale),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_brand_tokens_workspace ON brand_tokens(workspace_id);
CREATE INDEX IF NOT EXISTS idx_brand_tokens_category ON brand_tokens(workspace_id, category);

-- ============================================================================
-- Navigation Config
-- ============================================================================
CREATE TABLE IF NOT EXISTS nav_config (
  workspace_id TEXT PRIMARY KEY,
  config_json TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now')),
  updated_by TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- ============================================================================
-- Audit Log
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  actor_id TEXT,
  actor_handle TEXT,
  app_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details_json TEXT,
  ip_address TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audit_workspace ON audit_log(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

-- ============================================================================
-- Installed Apps
-- ============================================================================
CREATE TABLE IF NOT EXISTS installed_apps (
  workspace_id TEXT NOT NULL,
  app_id TEXT NOT NULL,
  manifest_json TEXT NOT NULL,
  settings_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'needs_config')),
  installed_at TEXT DEFAULT (datetime('now')),
  installed_by TEXT,
  PRIMARY KEY (workspace_id, app_id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_installed_apps_workspace ON installed_apps(workspace_id);
CREATE INDEX IF NOT EXISTS idx_installed_apps_status ON installed_apps(workspace_id, status);
  `,
};
