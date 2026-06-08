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
export declare const migration: Migration;
//# sourceMappingURL=015_legal_docs.d.ts.map