/**
 * Migration 018: seed installed_apps rows for core apps.
 *
 * The App Manager reads each app's governance state (status, mounts,
 * settings) from installed_apps. Core apps are compiled in, so they have
 * no install step — this migration backfills an `active` row per core app
 * for every EXISTING workspace (new workspaces get theirs at bootstrap).
 *
 * Per-workspace backfill via INSERT … SELECT id FROM workspaces, mirroring
 * migration 003's pattern (derive workspace_id from existing rows, no
 * need to know ids). Idempotent: ON CONFLICT DO NOTHING, so re-running
 * never duplicates and never clobbers an operator's later edits (e.g. a
 * disabled app stays disabled).
 *
 * manifest_json is seeded minimal ('{}'): the registry reads the live
 * compiled manifest for core apps and only uses installed_apps for
 * status/settings, so the stored manifest is just bookkeeping.
 *
 * NOTE: keep this list in sync with the core apps registered in
 * apps/core/index.ts. A core app missing a row simply defaults to active
 * in the registry (the overlay is optional), so drift is non-fatal — but
 * an explicit row lets the operator govern it.
 */
import type { Migration } from '../migrate';
export declare const migration: Migration;
//# sourceMappingURL=018_seed_installed_apps.d.ts.map