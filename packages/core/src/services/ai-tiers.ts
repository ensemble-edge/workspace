/**
 * AI tier service.
 *
 * Tiers are operator-named capability buckets (smart/good/simple by
 * default; unlimited custom). Each tier maps 1:1 to a dynamic route
 * (`ws/<name>`) in the configured Cloudflare AI Gateway.
 *
 * - Default tiers (smart/good/simple) are seeded on the first AI
 *   Gateway save. Cannot be deleted; their `display_name` is renamable.
 * - Custom tiers are operator-created; freely renamable and deletable.
 *   Deleting a tier in workspace does NOT delete the gateway route.
 * - Each tier's gateway route is auto-created via CF API on tier
 *   creation. Failures surface as a "create manually + Retry" UX state.
 *
 * The `useAI({ tier })` hook in the guest runtime references tiers by
 * `name`. Unknown tier → falls back to `good` and logs the fallback.
 */

import { getCredential } from './credentials';

export type TierStatus = 'provisioned' | 'pending' | 'failed';

export interface AiTier {
  name: string;
  display_name: string;
  description: string | null;
  icon: string;
  is_default: boolean;
  gateway_route: string;
  route_provisioned: boolean;
  created_at: string;
}

interface DbTierRow {
  name: string;
  display_name: string | null;
  description: string | null;
  icon: string;
  is_default: number;
  gateway_route: string;
  route_provisioned: number;
  created_at: string;
}

interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

export const DEFAULT_TIERS: Array<{ name: string; display_name: string; description: string; icon: string }> = [
  { name: 'smart',  display_name: 'Smart',  description: 'Maximum capability — slower and more expensive. For complex reasoning, planning, long-form generation.', icon: 'sparkles' },
  { name: 'good',   display_name: 'Good',   description: 'Production default — balanced quality and cost. The workhorse.', icon: 'circle-check' },
  { name: 'simple', display_name: 'Simple', description: 'Fast and cheap — for classification, autocomplete, short responses.', icon: 'zap' },
];

/**
 * Seed the three default tiers for a workspace. Idempotent — does
 * nothing if a tier with that name already exists.
 *
 * Called when the operator first saves AI Gateway credentials.
 */
export async function seedDefaultTiers(
  env: Env,
  workspaceId: string,
): Promise<void> {
  for (const t of DEFAULT_TIERS) {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO workspace_ai_tiers
         (workspace_id, name, display_name, description, icon, is_default, gateway_route, route_provisioned)
       VALUES (?, ?, ?, ?, ?, 1, ?, 0)`,
    ).bind(workspaceId, t.name, t.display_name, t.description, t.icon, `ws/${t.name}`).run();
  }
}

export async function listTiers(env: Env, workspaceId: string): Promise<AiTier[]> {
  const result = await env.DB.prepare(
    `SELECT name, display_name, description, icon, is_default,
            gateway_route, route_provisioned, created_at
       FROM workspace_ai_tiers
      WHERE workspace_id = ?
      ORDER BY is_default DESC, created_at ASC`,
  ).bind(workspaceId).all<DbTierRow>();
  return (result.results ?? []).map(rowToTier);
}

export async function getTier(env: Env, workspaceId: string, name: string): Promise<AiTier | null> {
  const row = await env.DB.prepare(
    `SELECT name, display_name, description, icon, is_default,
            gateway_route, route_provisioned, created_at
       FROM workspace_ai_tiers
      WHERE workspace_id = ? AND name = ?`,
  ).bind(workspaceId, name).first<DbTierRow>();
  return row ? rowToTier(row) : null;
}

export async function createTier(
  env: Env,
  workspaceId: string,
  input: { name: string; display_name?: string; description?: string; icon?: string },
): Promise<AiTier> {
  if (!/^[a-z][a-z0-9-]*$/.test(input.name)) {
    throw new Error('Tier name must be kebab-case (lowercase letters, digits, hyphens; must start with a letter)');
  }
  await env.DB.prepare(
    `INSERT INTO workspace_ai_tiers
       (workspace_id, name, display_name, description, icon, is_default, gateway_route, route_provisioned)
     VALUES (?, ?, ?, ?, ?, 0, ?, 0)`,
  ).bind(
    workspaceId,
    input.name,
    input.display_name ?? input.name,
    input.description ?? null,
    input.icon ?? 'sparkles',
    `ws/${input.name}`,
  ).run();
  const created = await getTier(env, workspaceId, input.name);
  if (!created) throw new Error('Failed to read back created tier');
  return created;
}

export async function patchTier(
  env: Env,
  workspaceId: string,
  name: string,
  patch: { display_name?: string; description?: string; icon?: string },
): Promise<void> {
  // Only display_name/description/icon are mutable; name is the contract.
  const fields: string[] = [];
  const values: unknown[] = [];
  if (patch.display_name !== undefined) { fields.push('display_name = ?'); values.push(patch.display_name); }
  if (patch.description !== undefined) { fields.push('description = ?'); values.push(patch.description); }
  if (patch.icon !== undefined) { fields.push('icon = ?'); values.push(patch.icon); }
  if (fields.length === 0) return;
  values.push(workspaceId, name);
  await env.DB.prepare(
    `UPDATE workspace_ai_tiers SET ${fields.join(', ')} WHERE workspace_id = ? AND name = ?`,
  ).bind(...values).run();
}

/**
 * Delete a custom tier. Default tiers cannot be deleted.
 * The gateway route is preserved (operator may delete manually in CF).
 */
export async function deleteTier(
  env: Env,
  workspaceId: string,
  name: string,
): Promise<void> {
  const tier = await getTier(env, workspaceId, name);
  if (!tier) return;
  if (tier.is_default) {
    throw new Error(`Cannot delete the default tier "${name}". Rename it instead.`);
  }
  await env.DB.prepare(
    `DELETE FROM workspace_ai_tiers WHERE workspace_id = ? AND name = ?`,
  ).bind(workspaceId, name).run();
}

/**
 * Auto-create the dynamic route for this tier in the configured AI Gateway.
 * Idempotent — calling on an already-provisioned route returns success.
 *
 * Failure modes (each surfaces a useful message):
 *   - 401/403: token doesn't have AI Gateway: Edit permission
 *   - 404: gateway doesn't exist (operator typo'd the gateway name)
 *   - 409: route already exists (we treat as success and mark provisioned)
 *   - 5xx / network: transient — operator can hit Retry
 */
export async function provisionTierRoute(
  env: Env,
  workspaceId: string,
  tierName: string,
): Promise<{ ok: true } | { ok: false; status: number; message: string; manual_url?: string }> {
  const tier = await getTier(env, workspaceId, tierName);
  if (!tier) return { ok: false, status: 404, message: `Tier "${tierName}" not found in workspace` };

  const accountId = await getCredential(env, workspaceId, 'ai_gateway_account_id')
    ?? await getCredential(env, workspaceId, 'cloudflare_account_id');
  const gatewayName = await getCredential(env, workspaceId, 'ai_gateway_name');
  const cfToken = await getCredential(env, workspaceId, 'cloudflare_api_token');

  if (!accountId || !gatewayName || !cfToken) {
    return {
      ok: false,
      status: 412,
      message: 'AI Gateway not configured. Set account ID, gateway name, and Cloudflare API token first.',
    };
  }

  const manualUrl = `https://dash.cloudflare.com/${accountId}/ai/ai-gateway/configuration/${gatewayName}`;

  // CF AI Gateway dynamic routes API — POST creates a route.
  // (Route name must match what we'll send at request time: 'ws/<name>'.
  // CF stores routes inside the gateway under their dynamic-routing config.)
  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai-gateway/gateways/${gatewayName}/routes`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: tier.gateway_route,
        // Initial config is minimal; operator configures the model
        // mapping in the Cloudflare dashboard.
        enabled: true,
      }),
    },
  );

  if (r.ok || r.status === 409) {
    // Mark provisioned. 409 means it already existed — same outcome.
    await env.DB.prepare(
      `UPDATE workspace_ai_tiers SET route_provisioned = 1
        WHERE workspace_id = ? AND name = ?`,
    ).bind(workspaceId, tierName).run();
    return { ok: true };
  }

  let body = '';
  try { body = await r.text(); } catch { /* ignore */ }

  const message =
    r.status === 401 || r.status === 403
      ? 'Cloudflare API token does not have "AI Gateway: Edit" permission.'
      : r.status === 404
        ? `AI Gateway "${gatewayName}" not found in account ${accountId}.`
        : `Cloudflare API error ${r.status}: ${body.slice(0, 200)}`;

  return { ok: false, status: r.status, message, manual_url: manualUrl };
}

function rowToTier(row: DbTierRow): AiTier {
  return {
    name: row.name,
    display_name: row.display_name ?? row.name,
    description: row.description,
    icon: row.icon,
    is_default: row.is_default === 1,
    gateway_route: row.gateway_route,
    route_provisioned: row.route_provisioned === 1,
    created_at: row.created_at,
  };
}
