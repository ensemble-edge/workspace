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
import type { Migration } from '../migrate';
export declare const migration: Migration;
//# sourceMappingURL=005_guest_apps_tier.d.ts.map