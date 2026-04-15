/**
 * core:people — Server-side API routes
 *
 * Member directory, invites, and role management.
 * Routes mounted under /_ensemble/core/people/*
 */

import { Hono } from 'hono';
import type { Env, ContextVariables } from '../../../types';
import { auth, requireRole } from '../../../middleware';

export function registerPeopleRoutes(
  app: Hono<{ Bindings: Env; Variables: ContextVariables }>
): void {
  // All people routes require authentication
  app.use('/_ensemble/core/people/*', auth());

  // GET /_ensemble/core/people/members — List workspace members
  app.get('/_ensemble/core/people/members', async (c) => {
    const workspace = c.get('workspace');
    if (!workspace?.id) return c.json({ error: 'Workspace not found' }, 400);

    try {
      const result = await c.env.DB.prepare(
        `SELECT u.id, u.email, u.handle, u.display_name, u.avatar_url, u.locale, u.created_at,
                m.role, m.created_at as joined_at
         FROM memberships m
         JOIN users u ON u.id = m.user_id
         WHERE m.workspace_id = ?
         ORDER BY m.role ASC, u.display_name ASC`
      ).bind(workspace.id).all();

      return c.json({ data: result.results || [] });
    } catch (error) {
      console.error('Failed to fetch members:', error);
      return c.json({ error: 'Failed to fetch members' }, 500);
    }
  });

  // PUT /_ensemble/core/people/members/:userId/role — Update member role
  app.put('/_ensemble/core/people/members/:userId/role', async (c) => {
    const workspace = c.get('workspace');
    const currentUser = c.get('user');
    const membership = c.get('membership');
    const targetUserId = c.req.param('userId');

    if (!workspace?.id) return c.json({ error: 'Workspace not found' }, 400);
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }

    const body = await c.req.json<{ role: string }>();
    if (!body.role || !['admin', 'member', 'viewer', 'guest'].includes(body.role)) {
      return c.json({ error: 'Invalid role' }, 400);
    }

    // Cannot change owner role
    const target = await c.env.DB.prepare(
      `SELECT role FROM memberships WHERE user_id = ? AND workspace_id = ?`
    ).bind(targetUserId, workspace.id).first<{ role: string }>();

    if (target?.role === 'owner') {
      return c.json({ error: 'Cannot change owner role' }, 400);
    }

    // Cannot promote to owner
    if (body.role === 'owner') {
      return c.json({ error: 'Cannot promote to owner' }, 400);
    }

    try {
      await c.env.DB.prepare(
        `UPDATE memberships SET role = ? WHERE user_id = ? AND workspace_id = ?`
      ).bind(body.role, targetUserId, workspace.id).run();

      return c.json({ success: true });
    } catch (error) {
      console.error('Failed to update role:', error);
      return c.json({ error: 'Failed to update role' }, 500);
    }
  });

  // POST /_ensemble/core/people/invite — Invite a new member
  app.post('/_ensemble/core/people/invite', async (c) => {
    const workspace = c.get('workspace');
    const membership = c.get('membership');

    if (!workspace?.id) return c.json({ error: 'Workspace not found' }, 400);
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }

    const body = await c.req.json<{ email: string; displayName?: string; role?: string }>();
    if (!body.email) return c.json({ error: 'Email is required' }, 400);

    const role = body.role || 'member';
    if (!['admin', 'member', 'viewer', 'guest'].includes(role)) {
      return c.json({ error: 'Invalid role' }, 400);
    }

    // Check if user already exists
    const existing = await c.env.DB.prepare(
      `SELECT id FROM users WHERE email = ?`
    ).bind(body.email).first<{ id: string }>();

    if (existing) {
      // Check if already a member
      const existingMembership = await c.env.DB.prepare(
        `SELECT user_id FROM memberships WHERE user_id = ? AND workspace_id = ?`
      ).bind(existing.id, workspace.id).first();

      if (existingMembership) {
        return c.json({ error: 'User is already a member' }, 409);
      }

      // Add existing user to workspace
      await c.env.DB.prepare(
        `INSERT INTO memberships (user_id, workspace_id, role) VALUES (?, ?, ?)`
      ).bind(existing.id, workspace.id, role).run();

      return c.json({ success: true, userId: existing.id, status: 'added' });
    }

    // Create new user + membership
    const userId = `user_${crypto.randomUUID().replace(/-/g, '')}`;

    // Import password hashing
    const { hashPassword } = await import('../../../utils/password');
    const tempPassword = crypto.randomUUID().slice(0, 16);
    const passwordHash = await hashPassword(tempPassword);

    try {
      await c.env.DB.prepare(
        `INSERT INTO users (id, email, password_hash, display_name, locale)
         VALUES (?, ?, ?, ?, 'en')`
      ).bind(userId, body.email, passwordHash, body.displayName || body.email.split('@')[0]).run();

      await c.env.DB.prepare(
        `INSERT INTO memberships (user_id, workspace_id, role) VALUES (?, ?, ?)`
      ).bind(userId, workspace.id, role).run();

      return c.json({ success: true, userId, status: 'invited' });
    } catch (error) {
      console.error('Failed to invite member:', error);
      return c.json({ error: 'Failed to invite member' }, 500);
    }
  });

  // DELETE /_ensemble/core/people/members/:userId — Remove member
  app.delete('/_ensemble/core/people/members/:userId', async (c) => {
    const workspace = c.get('workspace');
    const membership = c.get('membership');
    const targetUserId = c.req.param('userId');

    if (!workspace?.id) return c.json({ error: 'Workspace not found' }, 400);
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }

    // Cannot remove owner
    const target = await c.env.DB.prepare(
      `SELECT role FROM memberships WHERE user_id = ? AND workspace_id = ?`
    ).bind(targetUserId, workspace.id).first<{ role: string }>();

    if (target?.role === 'owner') {
      return c.json({ error: 'Cannot remove workspace owner' }, 400);
    }

    try {
      await c.env.DB.prepare(
        `DELETE FROM memberships WHERE user_id = ? AND workspace_id = ?`
      ).bind(targetUserId, workspace.id).run();

      return c.json({ success: true });
    } catch (error) {
      console.error('Failed to remove member:', error);
      return c.json({ error: 'Failed to remove member' }, 500);
    }
  });
}
