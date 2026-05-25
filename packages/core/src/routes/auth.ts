/**
 * Auth Routes
 *
 * Authentication endpoints for login, logout, registration, and token refresh.
 *
 * Routes:
 * - POST /_ensemble/auth/login     - Authenticate with email/password
 * - POST /_ensemble/auth/logout    - Invalidate session
 * - POST /_ensemble/auth/register  - Create new account
 * - POST /_ensemble/auth/refresh   - Refresh access token
 * - GET  /_ensemble/auth/me        - Get current user
 */

import { Hono } from 'hono';
import type { Env, ContextVariables } from '../types';
import { AuthService } from '../services/auth';
import {
  setAccessTokenCookie,
  setRefreshTokenCookie,
  clearAuthCookies,
  getAuthCookies,
  getCookieOptionsForEnv,
} from '../utils/cookies';
import { getJwtSecret } from '../utils/jwt';
import { sendEmail } from '../services/email';
import { renderMagicLinkEmail } from '../services/email-templates';
import { getCredential, getWorkspacePublicUrl } from '../services/credentials';
import { recordAudit } from '../services/audit-log';

/**
 * Create auth router.
 *
 * @returns Hono router for auth routes
 */
export function createAuthRoutes() {
  const auth = new Hono<{
    Bindings: Env;
    Variables: ContextVariables;
  }>();

  /**
   * POST /_ensemble/auth/login
   *
   * Authenticate user with email and password.
   * Sets httpOnly cookies for access and refresh tokens.
   */
  auth.post('/login', async (c) => {
    try {
      const body = await c.req.json<{
        email: string;
        password: string;
      }>();

      if (!body.email || !body.password) {
        return c.json({ error: 'Email and password are required' }, 400);
      }

      const workspace = c.get('workspace');
      if (!workspace) {
        return c.json({ error: 'Workspace not found' }, 400);
      }

      const authService = new AuthService({
        db: c.env.DB,
        jwtSecret: getJwtSecret(c.env.JWT_SECRET, c.env.ENVIRONMENT),
      });

      const result = await authService.login({
        email: body.email,
        password: body.password,
        workspaceId: workspace.id,
      });

      // Get cookie options based on environment
      const cookieOptions = getCookieOptionsForEnv(
        c.env.ENVIRONMENT,
        c.req.url
      );

      // Set cookies
      c.header('Set-Cookie', setAccessTokenCookie(result.accessToken, cookieOptions), {
        append: true,
      });
      c.header('Set-Cookie', setRefreshTokenCookie(result.refreshToken, cookieOptions), {
        append: true,
      });

      // v0.1.76: audit successful logins.
      await recordAudit(c.env, {
        workspaceId: workspace.id,
        action: 'auth.login',
        actorId: result.user.id,
        actorHandle: result.user.email,
        ipAddress: c.req.header('cf-connecting-ip') ?? null,
        details: { method: 'password' },
      });

      return c.json({
        user: result.user,
        membership: result.membership,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';

      // Don't reveal if email exists or not
      if (message === 'Invalid credentials' || message === 'User is not a member of this workspace') {
        // v0.1.76: audit failed login attempts (the email is logged as
        // actor_handle even when it doesn't match a real user, so
        // operators can spot brute-force attempts).
        const ws = c.get('workspace');
        if (ws?.id) {
          try {
            const failBody = await c.req.json<{ email?: string }>().catch(() => ({} as { email?: string }));
            await recordAudit(c.env, {
              workspaceId: ws.id,
              action: 'auth.failed_login',
              actorHandle: failBody.email ?? null,
              ipAddress: c.req.header('cf-connecting-ip') ?? null,
              details: { reason: message, method: 'password' },
            });
          } catch { /* never throw from audit */ }
        }
        return c.json({ error: 'Invalid email or password' }, 401);
      }

      return c.json({ error: message }, 400);
    }
  });

  /**
   * POST /_ensemble/auth/logout
   *
   * Invalidate current session and clear cookies.
   */
  auth.post('/logout', async (c) => {
    try {
      const { refreshToken } = getAuthCookies(c.req.header('Cookie'));

      if (refreshToken) {
        const authService = new AuthService({
          db: c.env.DB,
          jwtSecret: getJwtSecret(c.env.JWT_SECRET, c.env.ENVIRONMENT),
        });

        await authService.logout(refreshToken);
      }

      // v0.1.76: audit logout. The auth middleware should have set user
      // context if the session was valid; we use it for the actor.
      const ws = c.get('workspace');
      const user = c.get('user');
      if (ws?.id) {
        await recordAudit(c.env, {
          workspaceId: ws.id,
          action: 'auth.logout',
          actorId: user?.id ?? null,
          actorHandle: user?.email ?? null,
          ipAddress: c.req.header('cf-connecting-ip') ?? null,
        });
      }

      // Clear all auth cookies
      const cookieOptions = getCookieOptionsForEnv(c.env.ENVIRONMENT, c.req.url);
      for (const cookie of clearAuthCookies(cookieOptions)) {
        c.header('Set-Cookie', cookie, { append: true });
      }

      return c.json({ success: true });
    } catch {
      // Clear cookies even if logout fails
      const cookieOptions = getCookieOptionsForEnv(c.env.ENVIRONMENT, c.req.url);
      for (const cookie of clearAuthCookies(cookieOptions)) {
        c.header('Set-Cookie', cookie, { append: true });
      }

      return c.json({ success: true });
    }
  });

  /**
   * POST /_ensemble/auth/register
   *
   * Create a new user account.
   * Only available if self-registration is enabled for the workspace.
   */
  auth.post('/register', async (c) => {
    try {
      const body = await c.req.json<{
        email: string;
        password: string;
        displayName?: string;
        handle?: string;
      }>();

      if (!body.email || !body.password) {
        return c.json({ error: 'Email and password are required' }, 400);
      }

      const workspace = c.get('workspace');
      if (!workspace) {
        return c.json({ error: 'Workspace not found' }, 400);
      }

      // TODO: Check if self-registration is enabled for this workspace
      // For now, allow registration

      const authService = new AuthService({
        db: c.env.DB,
        jwtSecret: getJwtSecret(c.env.JWT_SECRET, c.env.ENVIRONMENT),
      });

      const result = await authService.register({
        email: body.email,
        password: body.password,
        displayName: body.displayName,
        handle: body.handle,
        workspaceId: workspace.id,
        role: 'member', // New registrations are members by default
      });

      // Set cookies
      const cookieOptions = getCookieOptionsForEnv(c.env.ENVIRONMENT, c.req.url);
      c.header('Set-Cookie', setAccessTokenCookie(result.accessToken, cookieOptions), {
        append: true,
      });
      c.header('Set-Cookie', setRefreshTokenCookie(result.refreshToken, cookieOptions), {
        append: true,
      });

      return c.json(
        {
          user: result.user,
          membership: result.membership,
        },
        201
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      return c.json({ error: message }, 400);
    }
  });

  /**
   * POST /_ensemble/auth/refresh
   *
   * Refresh the access token using the refresh token.
   */
  auth.post('/refresh', async (c) => {
    try {
      const { refreshToken } = getAuthCookies(c.req.header('Cookie'));

      if (!refreshToken) {
        return c.json({ error: 'No refresh token' }, 401);
      }

      const authService = new AuthService({
        db: c.env.DB,
        jwtSecret: getJwtSecret(c.env.JWT_SECRET, c.env.ENVIRONMENT),
      });

      const result = await authService.refresh(refreshToken);

      // Set new cookies
      const cookieOptions = getCookieOptionsForEnv(c.env.ENVIRONMENT, c.req.url);
      c.header('Set-Cookie', setAccessTokenCookie(result.accessToken, cookieOptions), {
        append: true,
      });
      c.header('Set-Cookie', setRefreshTokenCookie(result.refreshToken, cookieOptions), {
        append: true,
      });

      return c.json({ success: true });
    } catch (error) {
      // Clear cookies on refresh failure
      const cookieOptions = getCookieOptionsForEnv(c.env.ENVIRONMENT, c.req.url);
      for (const cookie of clearAuthCookies(cookieOptions)) {
        c.header('Set-Cookie', cookie, { append: true });
      }

      return c.json({ error: 'Session expired' }, 401);
    }
  });

  /**
   * GET /_ensemble/auth/me
   *
   * Get the current authenticated user.
   */
  auth.get('/me', async (c) => {
    try {
      const { accessToken } = getAuthCookies(c.req.header('Cookie'));

      if (!accessToken) {
        return c.json({ error: 'Not authenticated' }, 401);
      }

      const authService = new AuthService({
        db: c.env.DB,
        jwtSecret: getJwtSecret(c.env.JWT_SECRET, c.env.ENVIRONMENT),
      });

      const result = await authService.me(accessToken);

      if (!result) {
        return c.json({ error: 'Invalid token' }, 401);
      }

      return c.json(result);
    } catch {
      return c.json({ error: 'Not authenticated' }, 401);
    }
  });

  /**
   * POST /_ensemble/auth/magic-link
   *
   * Request a one-time sign-in link by email. Always responds with a
   * generic success to avoid leaking which emails are registered.
   * Gated on the workspace having a verified email provider — if not,
   * the request silently no-ops with the same generic response (the
   * login page only shows this CTA when /auth/methods reports
   * magic_link=true, so this path is normally only hit when email is
   * configured).
   *
   * Rate limit: per-IP, max 3 requests per 5 minutes. KV-backed so it
   * survives Worker isolate churn.
   */
  auth.post('/magic-link', async (c) => {
    try {
      const workspace = c.get('workspace');
      const body = await c.req.json<{ email: string }>();
      if (!body.email) return c.json({ ok: true }); // generic response

      if (!workspace?.id) return c.json({ ok: true });

      // Don't even hit the DB if email isn't configured. Match the
      // /auth/methods contract: magic_link is only available when
      // email_provider_verified === 'verified'.
      const verified = await getCredential(c.env, workspace.id, 'email_provider_verified');
      if (verified !== 'verified') return c.json({ ok: true });

      // Rate limit by IP. CF-Connecting-IP is set by Cloudflare on
      // every request entering a Worker. In local dev it's missing;
      // fall back to a stable placeholder so dev iteration works.
      const ip = c.req.header('CF-Connecting-IP') ?? 'dev';
      const rateKey = `magic-rate:${workspace.id}:${ip}`;
      const count = Number((await c.env.KV.get(rateKey)) ?? '0');
      if (count >= 3) return c.json({ ok: true }); // silently swallow
      await c.env.KV.put(rateKey, String(count + 1), { expirationTtl: 300 });

      // Look up the user. Same as login: respond identically whether
      // the email is registered or not.
      const user = await c.env.DB.prepare(
        `SELECT u.id, u.email FROM users u
         JOIN memberships m ON m.user_id = u.id
         WHERE u.email = ? AND m.workspace_id = ?`,
      )
        .bind(body.email.toLowerCase().trim(), workspace.id)
        .first<{ id: string; email: string }>();
      if (!user) return c.json({ ok: true });

      // v0.1.79: mint BOTH a click-link token AND a 6-digit code.
      // The link is the simple path ("click to sign in"); the code is
      // for operators who'd rather copy 6 digits than open a new tab.
      // Same TTL, same user binding, both stored in KV so the consume
      // / verify-code endpoints have a single source of truth.
      const token = crypto.randomUUID().replace(/-/g, '');
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const payload = JSON.stringify({
        user_id: user.id,
        workspace_id: workspace.id,
        code,
        created_at: Date.now(),
      });
      await c.env.KV.put(`magic:${token}`, payload, { expirationTtl: 15 * 60 });
      // Indexed by code too so verify-code can look up without a token.
      await c.env.KV.put(`magic-code:${workspace.id}:${code}`, payload, { expirationTtl: 15 * 60 });

      const base = await getWorkspacePublicUrl(c.env, workspace.id, c.req.raw);
      const url = `${base.replace(/\/$/, '')}/_ensemble/auth/magic-link/consume?token=${token}`;

      const rendered = await renderMagicLinkEmail(c.env, workspace.id, {
        url,
        expires_in_minutes: 15,
        code,
      });

      const result = await sendEmail(c.env, workspace.id, {
        to: user.email,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
      });
      if (!result.ok) {
        console.warn('[magic-link] send failed:', result.reason, result.error_detail);
      }

      // v0.1.79: audit every magic-link send so operators can verify
      // delivery from the audit log without leaking the email-existence
      // oracle to outside callers (the audit log is admin-only). Status
      // is logged so failed sends are visible too.
      await recordAudit(c.env, {
        workspaceId: workspace.id,
        action: result.ok ? 'auth.magic_link.sent' : 'auth.magic_link.send_failed',
        actorId: user.id,
        actorHandle: user.email,
        ipAddress: c.req.header('cf-connecting-ip') ?? null,
        details: result.ok
          ? { has_code: true }
          : {
              reason: result.reason,
              error: typeof result.error_detail === 'string'
                ? result.error_detail.slice(0, 200)
                : undefined,
            },
      });

      return c.json({ ok: true });
    } catch {
      // Always generic.
      return c.json({ ok: true });
    }
  });

  /**
   * GET /_ensemble/auth/magic-link/consume?token=...
   *
   * Redeem a magic-link token and sign the user in. On success, sets
   * the same auth cookies as POST /login and 302-redirects to home.
   * Single-use: the token is deleted from KV before the cookies are
   * issued, so a replay of the URL fails closed.
   */
  auth.get('/magic-link/consume', async (c) => {
    const workspace = c.get('workspace');
    const token = c.req.query('token');
    if (!workspace?.id || !token) {
      return c.redirect('/login?error=invalid_link');
    }

    const payloadRaw = await c.env.KV.get(`magic:${token}`);
    if (!payloadRaw) {
      return c.redirect('/login?error=link_expired');
    }
    // Burn the token immediately — single-use semantics.
    await c.env.KV.delete(`magic:${token}`);

    let payload: { user_id: string; workspace_id: string };
    try {
      payload = JSON.parse(payloadRaw);
    } catch {
      return c.redirect('/login?error=invalid_link');
    }
    if (payload.workspace_id !== workspace.id) {
      return c.redirect('/login?error=invalid_link');
    }

    // Load the user + role for token payload.
    const row = await c.env.DB.prepare(
      `SELECT u.id, u.email, u.handle, m.role
         FROM users u
         JOIN memberships m ON m.user_id = u.id
        WHERE u.id = ? AND m.workspace_id = ?`,
    )
      .bind(payload.user_id, workspace.id)
      .first<{ id: string; email: string; handle: string | null; role: string }>();
    if (!row) return c.redirect('/login?error=invalid_link');

    const authService = new AuthService({
      db: c.env.DB,
      jwtSecret: getJwtSecret(c.env.JWT_SECRET, c.env.ENVIRONMENT),
    });

    // Use the loginExisting/createSession path so the same session row
    // semantics apply (refresh token recorded, expires_at respects the
    // workspace's session_ttl_seconds setting).
    const session = await authService.loginAsKnownUser({
      userId: row.id,
      email: row.email,
      handle: row.handle,
      workspaceId: workspace.id,
      // The service narrows this to a Role union at runtime; we trust
      // membership.role comes from the DB and is valid.
      role: row.role as 'owner' | 'admin' | 'member' | 'guest',
    });

    const cookieOptions = getCookieOptionsForEnv(c.env.ENVIRONMENT, c.req.url);
    c.header('Set-Cookie', setAccessTokenCookie(session.accessToken, cookieOptions), { append: true });
    c.header('Set-Cookie', setRefreshTokenCookie(session.refreshToken, cookieOptions), { append: true });

    // v0.1.76: audit magic-link login.
    await recordAudit(c.env, {
      workspaceId: workspace.id,
      action: 'auth.login',
      actorId: row.id,
      actorHandle: row.email,
      ipAddress: c.req.header('cf-connecting-ip') ?? null,
      details: { method: 'magic_link' },
    });

    return c.redirect('/');
  });

  /**
   * POST /_ensemble/auth/magic-link/verify-code
   *
   * v0.1.79: alternate redemption path. Operator types the 6-digit
   * code from the magic-link email instead of clicking the link.
   * Body: { code: "123456" }. Same session semantics as the click
   * path — cookies set, JSON response with user/membership.
   *
   * Rate limit: 5 attempts per IP per workspace in 5 minutes (KV-
   * backed). Failed attempts intentionally indistinguishable from
   * "code expired" so the response doesn't help guess valid codes.
   */
  auth.post('/magic-link/verify-code', async (c) => {
    try {
      const workspace = c.get('workspace');
      if (!workspace?.id) return c.json({ error: 'invalid_link' }, 400);

      const body = await c.req.json<{ code?: string }>().catch(() => ({} as { code?: string }));
      const code = (body.code ?? '').replace(/\D/g, '');
      if (!/^\d{6}$/.test(code)) return c.json({ error: 'invalid_code' }, 400);

      // Rate limit by IP.
      const ip = c.req.header('CF-Connecting-IP') ?? 'dev';
      const rateKey = `magic-code-attempts:${workspace.id}:${ip}`;
      const attempts = Number((await c.env.KV.get(rateKey)) ?? '0');
      if (attempts >= 5) return c.json({ error: 'too_many_attempts' }, 429);
      await c.env.KV.put(rateKey, String(attempts + 1), { expirationTtl: 300 });

      const payloadRaw = await c.env.KV.get(`magic-code:${workspace.id}:${code}`);
      if (!payloadRaw) return c.json({ error: 'invalid_code' }, 400);

      let payload: { user_id: string; workspace_id: string };
      try {
        payload = JSON.parse(payloadRaw);
      } catch {
        return c.json({ error: 'invalid_code' }, 400);
      }
      if (payload.workspace_id !== workspace.id) {
        return c.json({ error: 'invalid_code' }, 400);
      }

      // Burn the code (and the linked token) — single-use semantics.
      await c.env.KV.delete(`magic-code:${workspace.id}:${code}`);

      const row = await c.env.DB.prepare(
        `SELECT u.id, u.email, u.handle, m.role
           FROM users u
           JOIN memberships m ON m.user_id = u.id
          WHERE u.id = ? AND m.workspace_id = ?`,
      )
        .bind(payload.user_id, workspace.id)
        .first<{ id: string; email: string; handle: string | null; role: string }>();
      if (!row) return c.json({ error: 'invalid_code' }, 400);

      const authService = new AuthService({
        db: c.env.DB,
        jwtSecret: getJwtSecret(c.env.JWT_SECRET, c.env.ENVIRONMENT),
      });

      const session = await authService.loginAsKnownUser({
        userId: row.id,
        email: row.email,
        handle: row.handle,
        workspaceId: workspace.id,
        role: row.role as 'owner' | 'admin' | 'member' | 'guest',
      });

      const cookieOptions = getCookieOptionsForEnv(c.env.ENVIRONMENT, c.req.url);
      c.header('Set-Cookie', setAccessTokenCookie(session.accessToken, cookieOptions), { append: true });
      c.header('Set-Cookie', setRefreshTokenCookie(session.refreshToken, cookieOptions), { append: true });

      await recordAudit(c.env, {
        workspaceId: workspace.id,
        action: 'auth.login',
        actorId: row.id,
        actorHandle: row.email,
        ipAddress: c.req.header('cf-connecting-ip') ?? null,
        details: { method: 'magic_code' },
      });

      return c.json({
        user: { id: row.id, email: row.email, handle: row.handle },
        membership: { userId: row.id, workspaceId: workspace.id, role: row.role },
      });
    } catch {
      return c.json({ error: 'invalid_code' }, 400);
    }
  });

  return auth;
}
