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
export declare const migration: Migration;
//# sourceMappingURL=007_workspace_ai_tiers.d.ts.map