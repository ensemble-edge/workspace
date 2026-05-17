/**
 * Credentials, AI tiers, setup-status, auth-methods, and user-invite
 * routes (v0.1.12).
 *
 * All endpoints under `/_ensemble/`. Admin-only routes verify
 * membership.role === 'admin' or 'owner' before reading/writing
 * secrets. The list endpoint never returns secret values; only an
 * "is set" flag.
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env, ContextVariables } from '../types';
import {
  listCredentials, getCredential, setCredential, deleteCredential,
  getWorkspacePublicUrl,
  type CredentialCategory,
} from '../services/credentials';
import { verifyEmailDomain, sendEmail } from '../services/email';
import {
  listTiers, getTier, createTier, patchTier, deleteTier,
  provisionTierRoute, seedDefaultTiers,
} from '../services/ai-tiers';

type AppEnv = { Bindings: Env; Variables: ContextVariables };
type AppContext = Context<AppEnv>;
type App = Hono<AppEnv>;

function requireAdmin(c: AppContext): { ok: true } | Response {
  const membership = c.get('membership');
  if (!membership || (membership.role !== 'admin' && membership.role !== 'owner')) {
    return c.json({ error: 'admin role required' }, 403);
  }
  return { ok: true };
}

export function createCredentialsRoutes(): App {
  const app = new Hono<{ Bindings: Env; Variables: ContextVariables }>();

  // ─── Credentials CRUD ─────────────────────────────────────────────

  app.get('/_ensemble/credentials', async (c) => {
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);
    const category = c.req.query('category') as CredentialCategory | undefined;
    const items = await listCredentials(c.env, workspace.id, category);
    return c.json({ items });
  });

  app.get('/_ensemble/credentials/:key', async (c) => {
    const check = requireAdmin(c);
    if (check instanceof Response) return check;
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);
    const value = await getCredential(c.env, workspace.id, c.req.param('key'));
    if (value === null) return c.json({ error: 'not set' }, 404);
    return c.json({ key: c.req.param('key'), value });
  });

  app.put('/_ensemble/credentials/:key', async (c) => {
    const check = requireAdmin(c);
    if (check instanceof Response) return check;
    const workspace = c.get('workspace');
    const user = c.get('user');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);

    const body = await c.req.json<{ value: string; category: CredentialCategory; is_secret: boolean }>();
    if (typeof body.value !== 'string' || !body.category || typeof body.is_secret !== 'boolean') {
      return c.json({ error: 'body must include {value, category, is_secret}' }, 400);
    }

    await setCredential(c.env, workspace.id, c.req.param('key'), body.category, body.value, {
      isSecret: body.is_secret,
      updatedBy: user?.id,
    });

    // Side-effect: saving AI Gateway creds seeds default tiers.
    const key = c.req.param('key');
    if (key === 'ai_gateway_name' || key === 'ai_gateway_token') {
      await seedDefaultTiers(c.env, workspace.id);
    }

    return c.json({ ok: true });
  });

  app.delete('/_ensemble/credentials/:key', async (c) => {
    const check = requireAdmin(c);
    if (check instanceof Response) return check;
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);
    await deleteCredential(c.env, workspace.id, c.req.param('key'));
    return c.json({ ok: true });
  });

  // ─── Connection-test endpoints ─────────────────────────────────────

  app.post('/_ensemble/credentials/test/connection', async (c) => {
    const check = requireAdmin(c);
    if (check instanceof Response) return check;
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);
    const token = await getCredential(c.env, workspace.id, 'cloudflare_api_token');
    if (!token) return c.json({ ok: false, message: 'No Cloudflare API token set' });

    const r = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.ok) return c.json({ ok: true });
    return c.json({ ok: false, status: r.status, message: `Cloudflare API ${r.status}` });
  });

  app.post('/_ensemble/credentials/test/email', async (c) => {
    const check = requireAdmin(c);
    if (check instanceof Response) return check;
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);

    const result = await verifyEmailDomain(c.env, workspace.id);
    // Persist the result so the login screen / setup status can read it
    // without re-running verification.
    await setCredential(c.env, workspace.id, 'email_provider_verified', 'notifications', result.status, {
      isSecret: false,
    });
    return c.json(result);
  });

  app.post('/_ensemble/credentials/test/ai', async (c) => {
    const check = requireAdmin(c);
    if (check instanceof Response) return check;
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);
    const accountId = await getCredential(c.env, workspace.id, 'cloudflare_account_id');
    const gatewayName = await getCredential(c.env, workspace.id, 'ai_gateway_name');
    const cfToken = await getCredential(c.env, workspace.id, 'cloudflare_api_token');
    if (!accountId || !gatewayName || !cfToken) {
      return c.json({ ok: false, message: 'AI Gateway not configured' });
    }
    const r = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai-gateway/gateways/${gatewayName}`,
      { headers: { Authorization: `Bearer ${cfToken}` } },
    );
    if (r.ok) return c.json({ ok: true });
    if (r.status === 401 || r.status === 403) {
      return c.json({ ok: false, status: r.status, message: 'Token lacks AI Gateway permissions' });
    }
    if (r.status === 404) {
      return c.json({ ok: false, status: 404, message: `Gateway "${gatewayName}" not found` });
    }
    return c.json({ ok: false, status: r.status, message: `Cloudflare API ${r.status}` });
  });

  // ─── AI tiers CRUD ─────────────────────────────────────────────────

  app.get('/_ensemble/ai/tiers', async (c) => {
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);
    const tiers = await listTiers(c.env, workspace.id);
    return c.json({ tiers });
  });

  app.post('/_ensemble/ai/tiers', async (c) => {
    const check = requireAdmin(c);
    if (check instanceof Response) return check;
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);
    const body = await c.req.json<{ name: string; display_name?: string; description?: string; icon?: string }>();
    try {
      const tier = await createTier(c.env, workspace.id, body);
      const provision = await provisionTierRoute(c.env, workspace.id, tier.name);
      return c.json({ tier, provision });
    } catch (err) {
      return c.json({ error: String(err) }, 400);
    }
  });

  app.patch('/_ensemble/ai/tiers/:name', async (c) => {
    const check = requireAdmin(c);
    if (check instanceof Response) return check;
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);
    const body = await c.req.json<{ display_name?: string; description?: string; icon?: string }>();
    await patchTier(c.env, workspace.id, c.req.param('name'), body);
    const tier = await getTier(c.env, workspace.id, c.req.param('name'));
    return c.json({ tier });
  });

  app.delete('/_ensemble/ai/tiers/:name', async (c) => {
    const check = requireAdmin(c);
    if (check instanceof Response) return check;
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);
    try {
      await deleteTier(c.env, workspace.id, c.req.param('name'));
      return c.json({ ok: true });
    } catch (err) {
      return c.json({ error: String(err) }, 409);
    }
  });

  app.post('/_ensemble/ai/tiers/:name/create-route', async (c) => {
    const check = requireAdmin(c);
    if (check instanceof Response) return check;
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);
    const result = await provisionTierRoute(c.env, workspace.id, c.req.param('name'));
    return c.json(result);
  });

  // ─── AI call proxy ─────────────────────────────────────────────────
  // POST /_ensemble/ai/call/:tier
  // Forwards JSON body to https://gateway.ai.cloudflare.com/v1/<acct>/<gw>/ws/<tier>
  // with the gateway token added. Guest apps never see the token.
  // Falls back to 'good' if requested tier doesn't exist.

  app.post('/_ensemble/ai/call/:tier', async (c) => {
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);

    const requestedTier = c.req.param('tier');
    let tier = await getTier(c.env, workspace.id, requestedTier);
    const fallbackUsed = !tier ? requestedTier : null;
    if (!tier) {
      tier = await getTier(c.env, workspace.id, 'good');
      if (!tier) return c.json({ error: 'No fallback tier "good" configured' }, 412);
    }

    const accountId = await getCredential(c.env, workspace.id, 'ai_gateway_account_id')
      ?? await getCredential(c.env, workspace.id, 'cloudflare_account_id');
    const gatewayName = await getCredential(c.env, workspace.id, 'ai_gateway_name');
    const gatewayToken = await getCredential(c.env, workspace.id, 'ai_gateway_token');
    if (!accountId || !gatewayName || !gatewayToken) {
      return c.json({ error: 'AI Gateway not configured' }, 412);
    }

    const body = await c.req.text();
    const r = await fetch(
      `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayName}/${tier.gateway_route}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${gatewayToken}`,
          'Content-Type': c.req.header('Content-Type') ?? 'application/json',
        },
        body,
      },
    );

    // If we used the fallback, surface that in a response header so the
    // guest's useAI hook can log it. Don't fail the response.
    const headers: Record<string, string> = {
      'Content-Type': r.headers.get('Content-Type') ?? 'application/json',
    };
    if (fallbackUsed) headers['X-Ensemble-Tier-Fallback'] = fallbackUsed;
    return new Response(r.body, { status: r.status, headers });
  });

  // ─── Setup status (for the home-page checklist) ────────────────────

  app.get('/_ensemble/setup/status', async (c) => {
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ items: [] });

    const cfAccount = await getCredential(c.env, workspace.id, 'cloudflare_account_id');
    const cfToken = await getCredential(c.env, workspace.id, 'cloudflare_api_token');
    const emailProvider = await getCredential(c.env, workspace.id, 'email_provider');
    const emailVerified = await getCredential(c.env, workspace.id, 'email_provider_verified');
    const aiGateway = await getCredential(c.env, workspace.id, 'ai_gateway_name');
    const aiToken = await getCredential(c.env, workspace.id, 'ai_gateway_token');

    const connectionDone = !!(cfAccount && cfToken);
    const emailDone = !!(emailProvider && emailVerified === 'verified');
    const aiDone = !!(aiGateway && aiToken);

    return c.json({
      items: [
        {
          id: 'connection',
          title: 'Connection (Cloudflare)',
          description: 'Required for DNS management and Cloudflare-based email.',
          status: connectionDone ? 'done' : 'pending',
          href: '/auth#credentials',
          required: true,
        },
        {
          id: 'email',
          title: 'Email',
          description:
            'Configure Cloudflare or Resend to send invites and enable magic-link login. ' +
            'Without it, admins use one-time invite URLs.',
          status: emailDone ? 'done' : 'pending',
          href: '/auth#credentials',
          required: false,
        },
        {
          id: 'ai',
          title: 'AI Access',
          description: 'Connect a Cloudflare AI Gateway to enable AI features.',
          status: aiDone ? 'done' : 'pending',
          href: '/auth#credentials',
          required: false,
        },
      ],
    });
  });

  // ─── Auth methods (for login screen to render magic-link conditionally) ────

  app.get('/_ensemble/auth/methods', async (c) => {
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ password: true, magic_link: false });
    const verified = await getCredential(c.env, workspace.id, 'email_provider_verified');
    return c.json({
      password: true,
      magic_link: verified === 'verified',
    });
  });

  // ─── User invite + admin reset ─────────────────────────────────────
  // Both endpoints return { url, sent_via_email } so the admin can fall
  // back to manually sharing the URL when email isn't configured.

  app.post('/_ensemble/users/invite', async (c) => {
    const check = requireAdmin(c);
    if (check instanceof Response) return check;
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);

    const body = await c.req.json<{ email: string; role?: string }>();
    if (!body.email) return c.json({ error: 'email required' }, 400);

    // Token: short-lived random string, stored in KV with expiry.
    const token = crypto.randomUUID().replace(/-/g, '');
    const key = `invite:${token}`;
    const payload = JSON.stringify({
      email: body.email,
      role: body.role ?? 'member',
      workspace_id: workspace.id,
      created_at: Date.now(),
    });
    await c.env.KV.put(key, payload, { expirationTtl: 60 * 60 * 24 * 7 }); // 7d

    const base = await getWorkspacePublicUrl(c.env, workspace.id, c.req.raw);
    const url = `${base}/auth/accept-invite?token=${token}`;

    let sent_via_email = false;
    const verified = await getCredential(c.env, workspace.id, 'email_provider_verified');
    if (verified === 'verified') {
      const result = await sendEmail(c.env, workspace.id, {
        to: body.email,
        subject: `You're invited to ${workspace.name ?? 'a workspace'}`,
        text: `Hi,\n\nYou've been invited to join ${workspace.name ?? 'a workspace'}.\n\nAccept here: ${url}\n\nThis link expires in 7 days.`,
      });
      sent_via_email = result.ok;
    }

    return c.json({ url: sent_via_email ? null : url, sent_via_email });
  });

  app.post('/_ensemble/users/:id/reset-password', async (c) => {
    const check = requireAdmin(c);
    if (check instanceof Response) return check;
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'workspace not resolved' }, 400);

    const userId = c.req.param('id');
    const target = await c.env.DB.prepare(
      `SELECT email FROM users WHERE id = ?`,
    ).bind(userId).first<{ email: string }>();
    if (!target) return c.json({ error: 'user not found' }, 404);

    const token = crypto.randomUUID().replace(/-/g, '');
    await c.env.KV.put(`pwreset:${token}`, JSON.stringify({
      user_id: userId,
      workspace_id: workspace.id,
      created_at: Date.now(),
    }), { expirationTtl: 60 * 60 }); // 1h

    const base = await getWorkspacePublicUrl(c.env, workspace.id, c.req.raw);
    const url = `${base}/auth/reset-password?token=${token}`;

    let sent_via_email = false;
    const verified = await getCredential(c.env, workspace.id, 'email_provider_verified');
    if (verified === 'verified') {
      const result = await sendEmail(c.env, workspace.id, {
        to: target.email,
        subject: `Password reset`,
        text: `A password reset was requested for your account.\n\nReset link: ${url}\n\nThis link expires in 1 hour.`,
      });
      sent_via_email = result.ok;
    }

    return c.json({ url: sent_via_email ? null : url, sent_via_email });
  });

  return app;
}
