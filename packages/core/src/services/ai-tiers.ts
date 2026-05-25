/**
 * AI tier service.
 *
 * Tiers are operator-named capability buckets (smart/good/simple by
 * default; unlimited custom). Each tier maps 1:1 to a dynamic route
 * (`ws-<name>`) in the configured Cloudflare AI Gateway.
 *
 * v0.1.75: route names use HYPHENS not slashes. CF's compat endpoint
 * (`/compat/chat/completions`) parses `dynamic/<route-name>` as the
 * model field; multi-segment names like `ws/simple` confuse the
 * dispatcher and produce a generic "code 2005 Failed to get response
 * from provider" error even when the route is otherwise valid. Single-
 * segment names like `ws-simple` dispatch correctly.
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

/**
 * Provider hint — describes the request/response shape that flows
 * through this tier's gateway route. Used by the "Test tier" button to
 * pick a canary payload that's actually meaningful for the underlying
 * model. Guest apps still POST whatever they want; the workspace
 * doesn't reshape requests.
 */
export type TierProvider =
  | 'workers-ai'         // Cloudflare Workers AI (inputs vary per model — see canary builder)
  | 'openai-chat'        // OpenAI chat.completions or compatible
  | 'anthropic-messages' // Anthropic /v1/messages
  | 'custom';            // Unknown shape — no canary available

export const TIER_PROVIDERS: TierProvider[] = [
  'workers-ai',
  'openai-chat',
  'anthropic-messages',
  'custom',
];

export interface AiTier {
  name: string;
  display_name: string;
  description: string | null;
  icon: string;
  is_default: boolean;
  gateway_route: string;
  route_provisioned: boolean;
  last_error: string | null;
  provider: TierProvider;
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
  last_error: string | null;
  provider: string | null;
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
/**
 * v0.1.75: backfill any existing tier rows that have legacy
 * gateway_route values like `ws/<name>` (with slash) to the new
 * hyphenated form `ws-<name>`. Idempotent — does nothing on
 * already-migrated rows. Runs once on every loadTiers() call so
 * existing workspaces get migrated without needing a separate
 * migration script.
 */
export async function migrateLegacyGatewayRoutes(
  env: Env,
  workspaceId: string,
): Promise<void> {
  await env.DB.prepare(
    `UPDATE workspace_ai_tiers
        SET gateway_route = REPLACE(gateway_route, 'ws/', 'ws-')
      WHERE workspace_id = ? AND gateway_route LIKE 'ws/%'`
  ).bind(workspaceId).run();
}

export async function seedDefaultTiers(
  env: Env,
  workspaceId: string,
): Promise<void> {
  for (const t of DEFAULT_TIERS) {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO workspace_ai_tiers
         (workspace_id, name, display_name, description, icon, is_default, gateway_route, route_provisioned)
       VALUES (?, ?, ?, ?, ?, 1, ?, 0)`,
    ).bind(workspaceId, t.name, t.display_name, t.description, t.icon, `ws-${t.name}`).run();
  }
}

export async function listTiers(env: Env, workspaceId: string): Promise<AiTier[]> {
  await migrateLegacyGatewayRoutes(env, workspaceId);
  const result = await env.DB.prepare(
    `SELECT name, display_name, description, icon, is_default,
            gateway_route, route_provisioned, last_error, provider, created_at
       FROM workspace_ai_tiers
      WHERE workspace_id = ?
      ORDER BY is_default DESC, created_at ASC`,
  ).bind(workspaceId).all<DbTierRow>();
  return (result.results ?? []).map(rowToTier);
}

export async function getTier(env: Env, workspaceId: string, name: string): Promise<AiTier | null> {
  await migrateLegacyGatewayRoutes(env, workspaceId);
  const row = await env.DB.prepare(
    `SELECT name, display_name, description, icon, is_default,
            gateway_route, route_provisioned, last_error, provider, created_at
       FROM workspace_ai_tiers
      WHERE workspace_id = ? AND name = ?`,
  ).bind(workspaceId, name).first<DbTierRow>();
  return row ? rowToTier(row) : null;
}

export async function createTier(
  env: Env,
  workspaceId: string,
  input: {
    name: string;
    display_name?: string;
    description?: string;
    icon?: string;
    provider?: TierProvider;
  },
): Promise<AiTier> {
  if (!/^[a-z][a-z0-9-]*$/.test(input.name)) {
    throw new Error('Tier name must be kebab-case (lowercase letters, digits, hyphens; must start with a letter)');
  }
  const provider: TierProvider =
    input.provider && TIER_PROVIDERS.includes(input.provider) ? input.provider : 'custom';
  await env.DB.prepare(
    `INSERT INTO workspace_ai_tiers
       (workspace_id, name, display_name, description, icon, is_default, gateway_route, route_provisioned, provider)
     VALUES (?, ?, ?, ?, ?, 0, ?, 0, ?)`,
  ).bind(
    workspaceId,
    input.name,
    input.display_name ?? input.name,
    input.description ?? null,
    input.icon ?? 'sparkles',
    `ws-${input.name}`,
    provider,
  ).run();
  const created = await getTier(env, workspaceId, input.name);
  if (!created) throw new Error('Failed to read back created tier');
  return created;
}

export async function patchTier(
  env: Env,
  workspaceId: string,
  name: string,
  patch: {
    display_name?: string;
    description?: string;
    icon?: string;
    provider?: TierProvider;
  },
): Promise<void> {
  // Only display_name/description/icon/provider are mutable; `name` is
  // the stable contract referenced by guest apps.
  const fields: string[] = [];
  const values: unknown[] = [];
  if (patch.display_name !== undefined) { fields.push('display_name = ?'); values.push(patch.display_name); }
  if (patch.description !== undefined) { fields.push('description = ?'); values.push(patch.description); }
  if (patch.icon !== undefined) { fields.push('icon = ?'); values.push(patch.icon); }
  if (patch.provider !== undefined && TIER_PROVIDERS.includes(patch.provider)) {
    fields.push('provider = ?');
    values.push(patch.provider);
  }
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
/**
 * v0.1.72: build the elements array for a CF AI Gateway dynamic route
 * given a provider. Returns a minimum-viable start → model → end flow
 * so the route can dispatch the moment it's provisioned.
 *
 * Schema (reverse-engineered from CF's API since they don't publish it):
 *   - Each element has { id, type, outputs, properties }
 *   - start.outputs:    { next:    { elementId: "<id>" } }
 *   - model.outputs:    { success: { elementId: "<id>" },
 *                         fallback: { elementId: "<id>" } }
 *   - end.outputs:      {}
 *   - model.properties: { provider, model, timeout, retries }
 *
 * For provider='custom' we return empty elements — the operator will
 * configure the route themselves in the CF dashboard, since we don't
 * know what they're targeting.
 */
function defaultElementsForProvider(provider: TierProvider): unknown[] {
  const modelPropsByProvider: Record<TierProvider, { provider: string; model: string } | null> = {
    'workers-ai':         { provider: 'workers-ai', model: '@cf/meta/llama-3.1-8b-instruct' },
    'openai-chat':        { provider: 'openai',     model: 'gpt-4o-mini' },
    // v0.1.75: claude-3-haiku-20240307 was deprecated by Anthropic.
    // claude-haiku-4-5 is the current entry-level instruct model.
    // Operators can swap to claude-sonnet-4-5 (or any other current
    // model) in the CF gateway dashboard.
    'anthropic-messages': { provider: 'anthropic',  model: 'claude-haiku-4-5' },
    'custom':             null,
  };
  const modelProps = modelPropsByProvider[provider];
  if (!modelProps) return [];
  return [
    { id: 's1', type: 'start', outputs: { next:    { elementId: 'm1' } }, properties: {} },
    { id: 'm1', type: 'model', outputs: { success: { elementId: 'e1' },
                                          fallback:{ elementId: 'e1' } },
      properties: { ...modelProps, timeout: 30000, retries: 1 } },
    { id: 'e1', type: 'end',   outputs: {},                              properties: {} },
  ];
}

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
  // (Route name must match what we'll send at request time: 'ws-<name>'.
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
        enabled: true,
        // v0.1.72: provide a working default route flow (start → model
        // → end) so the route can actually dispatch the moment it's
        // provisioned. v0.1.67 shipped with elements:[] to satisfy
        // CF's "required" check, but that left the route with no
        // model target — every test/call returned 400 because CF
        // had nothing to dispatch to. Operators had to manually
        // configure the route in the CF dashboard before anything
        // worked.
        //
        // Default model picks per provider are sensible / inexpensive
        // baselines. Operators can edit them in the CF dashboard
        // (Configuration → Dynamic Routing → <route>) to upgrade
        // to a smarter / different model whenever they want.
        elements: defaultElementsForProvider(tier.provider),
      }),
    },
  );

  if (r.ok || r.status === 409) {
    // Mark provisioned and clear any prior error. 409 means it already
    // existed — same outcome.
    await env.DB.prepare(
      `UPDATE workspace_ai_tiers
          SET route_provisioned = 1, last_error = NULL
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

  // Persist the error so the UI's info tooltip can show what went wrong
  // without the operator having to retry just to see the failure mode.
  await env.DB.prepare(
    `UPDATE workspace_ai_tiers
        SET route_provisioned = 0, last_error = ?
      WHERE workspace_id = ? AND name = ?`,
  ).bind(message, workspaceId, tierName).run();

  return { ok: false, status: r.status, message, manual_url: manualUrl };
}

function rowToTier(row: DbTierRow): AiTier {
  const provider = (row.provider ?? 'custom') as TierProvider;
  return {
    name: row.name,
    display_name: row.display_name ?? row.name,
    description: row.description,
    icon: row.icon,
    is_default: row.is_default === 1,
    gateway_route: row.gateway_route,
    route_provisioned: row.route_provisioned === 1,
    last_error: row.last_error ?? null,
    provider: TIER_PROVIDERS.includes(provider) ? provider : 'custom',
    created_at: row.created_at,
  };
}

/**
 * Build a tiny canary payload appropriate for the tier's declared
 * provider. Returns null for 'custom' — the operator must wire it up
 * themselves in their guest app. The shapes here come straight from
 * each provider's published API.
 */
export function canaryForProvider(provider: TierProvider): unknown | null {
  // v0.1.73: every chat-capable provider uses the chat-completion
  // shape. Pre-v0.1.73 the workers-ai canary used {prompt} which is
  // the legacy text-generation shape — modern chat/instruct models
  // (the kind the default-provisioned llama-3.1-8b-instruct is)
  // expect {messages: [{role, content}]} and 400 on {prompt} when
  // routed via AI Gateway dynamic routes.
  const userMessage = { role: 'user', content: 'Say hello in one short sentence.' };
  switch (provider) {
    case 'workers-ai':
    case 'openai-chat':
      return {
        messages: [userMessage],
        max_tokens: 32,
      };
    case 'anthropic-messages':
      return {
        model: 'claude-3-haiku-20240307',
        max_tokens: 32,
        messages: [userMessage],
      };
    case 'custom':
    default:
      return null;
  }
}

/**
 * Build the Cloudflare dashboard URL the AI Access card uses for its
 * "Configure model in Cloudflare" deep link. Lands the operator on the
 * gateway namespace's route page where they pick the underlying model.
 */
export function gatewayDashboardUrl(accountId: string, gatewayName: string): string {
  return `https://dash.cloudflare.com/${accountId}/ai/ai-gateway/configuration/${gatewayName}`;
}
