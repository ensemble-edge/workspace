/**
 * Migration 015: Legal Center — docs, slug junction, version audit.
 *
 * Backs the `core:legal` built-in app (sibling of `core:brand`). Re-cut
 * for the Ensemble workspace tier from the Curalisto quiz-cms legal
 * prototype, per docs/plan/legal-builtin-app.md.
 *
 * MULTI-TENANCY: the prototype was single-tenant, so its tables had no
 * workspace_id. Every workspace-scoped table in this codebase
 * (brand_tokens, workspace_settings, workspace_locales, …) carries a
 * workspace_id with a FK to workspaces(id). These three tables follow
 * that convention — without it, tenants would share one global set of
 * legal docs and slug lookups would collide across tenants.
 *
 *   legal_docs           One row per (workspace, canonical doc id).
 *                        Localized fields are `*_json` LocalizedString
 *                        columns ({"es":…,"en":…}), matching the
 *                        brand_tokens / product_families convention.
 *   legal_doc_slugs      (workspace_id, slug, locale) → doc_id junction.
 *                        Resolves a localized URL slug with a single
 *                        indexed lookup. Rebuilt on every save.
 *   legal_docs_versions  Append-only audit. Each save snapshots the
 *                        PRIOR row before mutating. MAX(version_id) per
 *                        (workspace, doc) is what a consent flow captures.
 *
 * FK note: D1 does not reliably enforce PRAGMA foreign_keys=ON, so the
 * ON DELETE CASCADE clauses are documentation, not a guarantee — the
 * route handlers rebuild the junction and snapshot versions explicitly.
 *
 * No doc seed here. The workspace id is minted at bootstrap
 * (generateId('ws')), so per-workspace seed content — like brand accent
 * and locales — is seeded in routes/bootstrap.ts against the real
 * workspaceId, not in this migration. This migration owns the schema
 * only. The five `legal.*` placeholder settings live in
 * services/workspace-settings.ts DEFAULT_SETTINGS.
 */

import type { Migration } from '../migrate';

export const migration: Migration = {
  name: '015_legal_docs',
  sql: `
    CREATE TABLE IF NOT EXISTS legal_docs (
      workspace_id      TEXT NOT NULL,
      id                TEXT NOT NULL,
      slugs_json        TEXT NOT NULL,
      title_json        TEXT NOT NULL,
      description_json  TEXT,
      body_md_json      TEXT NOT NULL,
      last_updated      TEXT NOT NULL,
      status            TEXT NOT NULL DEFAULT 'active',
      sort_order        INTEGER NOT NULL DEFAULT 100,
      created_by        TEXT,
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by        TEXT,
      updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (workspace_id, id),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_legal_docs_status_sort ON legal_docs(workspace_id, status, sort_order);

    CREATE TABLE IF NOT EXISTS legal_doc_slugs (
      workspace_id  TEXT NOT NULL,
      slug          TEXT NOT NULL,
      locale        TEXT NOT NULL,
      doc_id        TEXT NOT NULL,
      PRIMARY KEY (workspace_id, slug, locale),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_legal_doc_slugs_doc ON legal_doc_slugs(workspace_id, doc_id);

    CREATE TABLE IF NOT EXISTS legal_docs_versions (
      version_id        INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id      TEXT NOT NULL,
      doc_id            TEXT NOT NULL,
      slugs_json        TEXT NOT NULL,
      title_json        TEXT NOT NULL,
      description_json  TEXT,
      body_md_json      TEXT NOT NULL,
      last_updated      TEXT NOT NULL,
      status            TEXT NOT NULL,
      saved_by          TEXT,
      saved_at          TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_legal_docs_versions_doc ON legal_docs_versions(workspace_id, doc_id);
  `,
};
