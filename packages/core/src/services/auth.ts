/**
 * Auth Service
 *
 * Handles authentication, session management, and user operations.
 * Uses D1 for persistent storage and JWT for stateless auth.
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { User, Session, Membership, Role, JWTPayload } from '../types';
import { hashPassword, verifyPassword, validatePassword } from '../utils/password';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../utils/jwt';

/**
 * Auth service configuration.
 */
export interface AuthConfig {
  db: D1Database;
  jwtSecret: string;
}

/**
 * Login credentials.
 */
export interface LoginCredentials {
  email: string;
  password: string;
  workspaceId: string;
}

/**
 * Registration data.
 */
export interface RegisterData {
  email: string;
  password: string;
  displayName?: string;
  handle?: string;
  workspaceId: string;
  role?: Role;
}

/**
 * Auth result returned from login/register.
 */
export interface AuthResult {
  user: User;
  membership: Membership;
  accessToken: string;
  refreshToken: string;
}

/**
 * Generate a unique ID using crypto.
 */
function generateId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hash a session token for storage.
 */
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Auth Service class.
 *
 * @example
 * ```ts
 * const auth = new AuthService({ db: c.env.DB, jwtSecret: c.env.JWT_SECRET });
 *
 * // Login
 * const result = await auth.login({
 *   email: 'user@example.com',
 *   password: 'password123',
 *   workspaceId: 'ws_123'
 * });
 *
 * // Set cookies and return
 * c.header('Set-Cookie', setAccessTokenCookie(result.accessToken));
 * ```
 */
export class AuthService {
  private db: D1Database;
  private jwtSecret: string;

  constructor(config: AuthConfig) {
    this.db = config.db;
    this.jwtSecret = config.jwtSecret;
  }

  /**
   * Register a new user.
   *
   * @param data - Registration data
   * @returns Auth result with tokens
   * @throws Error if email already exists or validation fails
   */
  async register(data: RegisterData): Promise<AuthResult> {
    // Validate password
    const validation = validatePassword(data.password);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid password');
    }

    // Check if email exists
    const existing = await this.db
      .prepare('SELECT id FROM users WHERE email = ?')
      .bind(data.email.toLowerCase())
      .first();

    if (existing) {
      throw new Error('Email already registered');
    }

    // Generate IDs
    const userId = generateId();
    const sessionId = generateId();

    // Hash password
    const passwordHash = await hashPassword(data.password);

    // Create user
    await this.db
      .prepare(
        `INSERT INTO users (id, email, password_hash, display_name, handle, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`
      )
      .bind(
        userId,
        data.email.toLowerCase(),
        passwordHash,
        data.displayName || null,
        data.handle || null
      )
      .run();

    // Create membership
    const role = data.role || 'member';
    await this.db
      .prepare(
        `INSERT INTO memberships (user_id, workspace_id, role, created_at)
         VALUES (?, ?, ?, datetime('now'))`
      )
      .bind(userId, data.workspaceId, role)
      .run();

    // Create session and tokens
    const { accessToken, refreshToken, tokenHash, expiresAt } = await this.createSession(
      userId,
      data.email.toLowerCase(),
      null, // handle
      data.workspaceId,
      role
    );

    // Store session
    await this.db
      .prepare(
        `INSERT INTO sessions (id, user_id, workspace_id, token_hash, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`
      )
      .bind(sessionId, userId, data.workspaceId, tokenHash, expiresAt)
      .run();

    // Return result
    const user: User = {
      id: userId,
      email: data.email.toLowerCase(),
      handle: data.handle || null,
      displayName: data.displayName || null,
      avatarUrl: null,
      locale: 'en',
      createdAt: new Date().toISOString(),
    };

    const membership: Membership = {
      userId,
      workspaceId: data.workspaceId,
      role,
      createdAt: new Date().toISOString(),
    };

    return { user, membership, accessToken, refreshToken };
  }

  /**
   * Authenticate a user with email and password.
   *
   * @param credentials - Login credentials
   * @returns Auth result with tokens
   * @throws Error if credentials are invalid
   */
  async login(credentials: LoginCredentials): Promise<AuthResult> {
    // Find user
    const user = await this.db
      .prepare(
        `SELECT id, email, password_hash, handle, display_name, avatar_url, locale, created_at
         FROM users WHERE email = ?`
      )
      .bind(credentials.email.toLowerCase())
      .first<{
        id: string;
        email: string;
        password_hash: string;
        handle: string | null;
        display_name: string | null;
        avatar_url: string | null;
        locale: string;
        created_at: string;
      }>();

    if (!user || !user.password_hash) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const valid = await verifyPassword(credentials.password, user.password_hash);
    if (!valid) {
      throw new Error('Invalid credentials');
    }

    // Find membership
    const membership = await this.db
      .prepare(
        `SELECT user_id, workspace_id, role, created_at
         FROM memberships WHERE user_id = ? AND workspace_id = ?`
      )
      .bind(user.id, credentials.workspaceId)
      .first<{
        user_id: string;
        workspace_id: string;
        role: Role;
        created_at: string;
      }>();

    if (!membership) {
      throw new Error('User is not a member of this workspace');
    }

    // Create session
    const sessionId = generateId();
    const { accessToken, refreshToken, tokenHash, expiresAt } = await this.createSession(
      user.id,
      user.email,
      user.handle,
      credentials.workspaceId,
      membership.role
    );

    // Store session
    await this.db
      .prepare(
        `INSERT INTO sessions (id, user_id, workspace_id, token_hash, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`
      )
      .bind(sessionId, user.id, credentials.workspaceId, tokenHash, expiresAt)
      .run();

    return {
      user: {
        id: user.id,
        email: user.email,
        handle: user.handle,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        locale: user.locale,
        createdAt: user.created_at,
      },
      membership: {
        userId: membership.user_id,
        workspaceId: membership.workspace_id,
        role: membership.role,
        createdAt: membership.created_at,
      },
      accessToken,
      refreshToken,
    };
  }

  /**
   * Logout and invalidate session.
   *
   * @param refreshToken - Refresh token to invalidate
   */
  async logout(refreshToken: string): Promise<void> {
    // Verify and extract session ID
    const sessionId = await verifyRefreshToken(refreshToken, this.jwtSecret);
    if (!sessionId) {
      return; // Token invalid, nothing to do
    }

    // Delete session
    await this.db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
  }

  /**
   * Refresh access token using refresh token.
   *
   * @param refreshToken - Current refresh token
   * @returns New tokens
   * @throws Error if refresh token is invalid
   */
  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    // Verify refresh token
    const sessionId = await verifyRefreshToken(refreshToken, this.jwtSecret);
    if (!sessionId) {
      throw new Error('Invalid refresh token');
    }

    // Find session
    const session = await this.db
      .prepare(
        `SELECT s.id, s.user_id, s.workspace_id, s.expires_at,
                u.email, u.handle,
                m.role
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         JOIN memberships m ON m.user_id = s.user_id AND m.workspace_id = s.workspace_id
         WHERE s.id = ?`
      )
      .bind(sessionId)
      .first<{
        id: string;
        user_id: string;
        workspace_id: string;
        expires_at: string;
        email: string;
        handle: string | null;
        role: Role;
      }>();

    if (!session) {
      throw new Error('Session not found');
    }

    // Check if expired
    if (new Date(session.expires_at) < new Date()) {
      await this.db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
      throw new Error('Session expired');
    }

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken, tokenHash, expiresAt } =
      await this.createSession(
        session.user_id,
        session.email,
        session.handle,
        session.workspace_id,
        session.role
      );

    // Update session with new token hash and expiry
    await this.db
      .prepare('UPDATE sessions SET token_hash = ?, expires_at = ? WHERE id = ?')
      .bind(tokenHash, expiresAt, sessionId)
      .run();

    return { accessToken, refreshToken: newRefreshToken };
  }

  /**
   * Get current user from access token.
   *
   * @param accessToken - JWT access token
   * @returns User and membership or null if invalid
   */
  async me(accessToken: string): Promise<{ user: User; membership: Membership } | null> {
    // Verify token
    const payload = await verifyAccessToken(accessToken, this.jwtSecret);
    if (!payload) {
      return null;
    }

    // Fetch fresh user data
    const user = await this.db
      .prepare(
        `SELECT id, email, handle, display_name, avatar_url, locale, created_at
         FROM users WHERE id = ?`
      )
      .bind(payload.sub)
      .first<{
        id: string;
        email: string;
        handle: string | null;
        display_name: string | null;
        avatar_url: string | null;
        locale: string;
        created_at: string;
      }>();

    if (!user) {
      return null;
    }

    // Fetch membership
    const membership = await this.db
      .prepare(
        `SELECT user_id, workspace_id, role, created_at
         FROM memberships WHERE user_id = ? AND workspace_id = ?`
      )
      .bind(payload.sub, payload.wid)
      .first<{
        user_id: string;
        workspace_id: string;
        role: Role;
        created_at: string;
      }>();

    if (!membership) {
      return null;
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        handle: user.handle,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        locale: user.locale,
        createdAt: user.created_at,
      },
      membership: {
        userId: membership.user_id,
        workspaceId: membership.workspace_id,
        role: membership.role,
        createdAt: membership.created_at,
      },
    };
  }

  /**
   * Verify access token and return payload.
   *
   * @param accessToken - JWT access token
   * @returns Payload or null if invalid
   */
  async verifyToken(accessToken: string): Promise<JWTPayload | null> {
    return verifyAccessToken(accessToken, this.jwtSecret);
  }

  /**
   * Create session tokens.
   */
  private async createSession(
    userId: string,
    email: string,
    handle: string | null,
    workspaceId: string,
    role: Role
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    tokenHash: string;
    expiresAt: string;
  }> {
    const sessionId = generateId();

    const accessToken = await signAccessToken(
      { userId, email, handle, workspaceId, role },
      this.jwtSecret
    );

    const refreshToken = await signRefreshToken(sessionId, this.jwtSecret);

    // Hash the refresh token for storage
    const tokenHash = await hashToken(refreshToken);

    // Calculate expiry (7 days from now)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    return { accessToken, refreshToken, tokenHash, expiresAt };
  }
}

/**
 * Create an auth service instance.
 *
 * @param config - Auth configuration
 * @returns Auth service instance
 */
export function createAuthService(config: AuthConfig): AuthService {
  return new AuthService(config);
}
