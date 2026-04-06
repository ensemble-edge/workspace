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

      return c.json({
        user: result.user,
        membership: result.membership,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';

      // Don't reveal if email exists or not
      if (message === 'Invalid credentials' || message === 'User is not a member of this workspace') {
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

  return auth;
}
