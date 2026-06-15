/**
 * Migration 005: Guest Apps tier rename + value remap.
 *
 * Renames guest_apps.isolation (v0.1.6) to guest_apps.tier (v0.1.9).
 *
 * Tier values:
 *   'component'  — runs in host's React tree, no iframe (primary, new default)
 *   'iframe'     — runs in same-origin iframe with workspace runtime
 *   'sandboxed'  — runs in strict-sandbox iframe (untrusted code)
 *
 * Value remap from v0.1.6's isolation column:
 *   isolation='trusted'   → tier='iframe'   (current trusted-runtime path)
 *   isolation='sandboxed' → tier='sandboxed'
 *
 * Existing v0.1.x apps don't auto-promote to 'component' — that requires
 * a code rewrite. The operator opts in by updating the row after they
 * rebuild the guest as a component.
 *
 * SQLite doesn't support ALTER COLUMN RENAME directly via SQL in older
 * versions, so we do the rebuild dance: new column, copy, drop, rename.
 */
export const migration = {
    name: '005_guest_apps_tier',
    sql: `
-- Add the new tier column, default 'iframe' (preserves current behavior for any unset row).
ALTER TABLE guest_apps
  ADD COLUMN tier TEXT NOT NULL DEFAULT 'iframe'
  CHECK (tier IN ('component', 'iframe', 'sandboxed'));

-- Map isolation values to tier values. The CHECK above ensures we never
-- write a stale value here.
UPDATE guest_apps SET tier = 'iframe'    WHERE isolation = 'trusted';
UPDATE guest_apps SET tier = 'sandboxed' WHERE isolation = 'sandboxed';

-- v0.1.100 BUGFIX: drop idx_guest_apps_isolation BEFORE dropping the
-- isolation column. SQLite implements DROP COLUMN by rebuilding the
-- whole table; during the rebuild it re-creates every surviving index.
-- If idx_guest_apps_isolation still exists at DROP COLUMN time, SQLite
-- tries to re-create an index over a column that's being dropped in
-- the same statement and fails with:
--   "error in index idx_guest_apps_isolation after drop column:
--    no such column: isolation: SQLITE_ERROR"
-- ...which meant migration 005 never succeeded on fresh D1 deploys
-- (every first request 500'd, every subsequent request 500'd). The
-- fix is statement order: drop the index first, then the column.
DROP INDEX IF EXISTS idx_guest_apps_isolation;

-- The isolation column is now unused. Drop it.
-- SQLite supports DROP COLUMN since 3.35 (March 2021); D1 is on a newer
-- engine, so the direct DROP is safe.
ALTER TABLE guest_apps DROP COLUMN isolation;

-- Create the replacement tier index.
CREATE INDEX IF NOT EXISTS idx_guest_apps_tier ON guest_apps(workspace_id, tier);
  `,
};
//# sourceMappingURL=005_guest_apps_tier.js.map