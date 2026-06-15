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
export declare const migration: Migration;
//# sourceMappingURL=009_workspace_locales.d.ts.map