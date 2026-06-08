/**
 * core:people — Server-side API routes
 *
 * Member directory, invites, and role management.
 * Routes mounted under /_ensemble/core/people/*
 */
import { auth } from '../../../middleware/index.js';
import { issueInvite } from '../../../services/invites.js';
import { recordAudit } from '../../../services/audit-log.js';
export function registerPeopleRoutes(app) {
    // All people routes require authentication
    app.use('/_ensemble/core/people/*', auth());
    // GET /_ensemble/core/people/members — List workspace members
    //
    // v0.1.88: surfaces invite_pending + invited_at + the inviter's
    // display name so the UI can render the "Pending" badge and the
    // tooltip "Invited N days ago by Alice". Pending members sort to
    // the top so admins notice stalled invites first.
    app.get('/_ensemble/core/people/members', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'Workspace not found' }, 400);
        try {
            const result = await c.env.DB.prepare(`SELECT u.id, u.email, u.handle, u.display_name, u.avatar_url, u.locale, u.created_at,
                u.invite_pending, u.invited_at,
                inviter.display_name AS invited_by_name,
                m.role, m.created_at as joined_at
         FROM memberships m
         JOIN users u ON u.id = m.user_id
         LEFT JOIN users inviter ON inviter.id = u.invited_by_user_id
         WHERE m.workspace_id = ?
         ORDER BY u.invite_pending DESC, m.role ASC, u.display_name ASC`).bind(workspace.id).all();
            return c.json({ data: result.results || [] });
        }
        catch (error) {
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
        if (!workspace?.id)
            return c.json({ error: 'Workspace not found' }, 400);
        if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
            return c.json({ error: 'Insufficient permissions' }, 403);
        }
        const body = await c.req.json();
        if (!body.role || !['admin', 'member', 'viewer', 'guest'].includes(body.role)) {
            return c.json({ error: 'Invalid role' }, 400);
        }
        // Cannot change owner role
        const target = await c.env.DB.prepare(`SELECT role FROM memberships WHERE user_id = ? AND workspace_id = ?`).bind(targetUserId, workspace.id).first();
        if (target?.role === 'owner') {
            return c.json({ error: 'Cannot change owner role' }, 400);
        }
        // Cannot promote to owner
        if (body.role === 'owner') {
            return c.json({ error: 'Cannot promote to owner' }, 400);
        }
        try {
            await c.env.DB.prepare(`UPDATE memberships SET role = ? WHERE user_id = ? AND workspace_id = ?`).bind(body.role, targetUserId, workspace.id).run();
            return c.json({ success: true });
        }
        catch (error) {
            console.error('Failed to update role:', error);
            return c.json({ error: 'Failed to update role' }, 500);
        }
    });
    // POST /_ensemble/core/people/invite — Invite a new member
    app.post('/_ensemble/core/people/invite', async (c) => {
        const workspace = c.get('workspace');
        const membership = c.get('membership');
        if (!workspace?.id)
            return c.json({ error: 'Workspace not found' }, 400);
        if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
            return c.json({ error: 'Insufficient permissions' }, 403);
        }
        const body = await c.req.json();
        if (!body.email)
            return c.json({ error: 'Email is required' }, 400);
        const role = body.role || 'member';
        if (!['admin', 'member', 'viewer', 'guest'].includes(role)) {
            return c.json({ error: 'Invalid role' }, 400);
        }
        // Check if user already exists
        const existing = await c.env.DB.prepare(`SELECT id FROM users WHERE email = ?`).bind(body.email).first();
        if (existing) {
            // Check if already a member
            const existingMembership = await c.env.DB.prepare(`SELECT user_id FROM memberships WHERE user_id = ? AND workspace_id = ?`).bind(existing.id, workspace.id).first();
            if (existingMembership) {
                return c.json({ error: 'User is already a member' }, 409);
            }
            // Add existing user to workspace
            await c.env.DB.prepare(`INSERT INTO memberships (user_id, workspace_id, role) VALUES (?, ?, ?)`).bind(existing.id, workspace.id, role).run();
            return c.json({ success: true, userId: existing.id, status: 'added' });
        }
        // Create new user + membership.
        //
        // v0.1.88: the user logs in via magic-link, not a password — but
        // users.password_hash is NOT NULL, so we still write an unguessable
        // random hash. The user never sees this; if they want to set a
        // real password they do it from account settings later.
        const userId = `user_${crypto.randomUUID().replace(/-/g, '')}`;
        const { hashPassword } = await import('../../../utils/password.js');
        const passwordHash = await hashPassword(crypto.randomUUID());
        const currentUser = c.get('user');
        try {
            await c.env.DB.prepare(`INSERT INTO users (id, email, password_hash, display_name, locale, invite_pending)
         VALUES (?, ?, ?, ?, 'en', 1)`).bind(userId, body.email, passwordHash, body.displayName || body.email.split('@')[0]).run();
            await c.env.DB.prepare(`INSERT INTO memberships (user_id, workspace_id, role) VALUES (?, ?, ?)`).bind(userId, workspace.id, role).run();
            // Issue the magic-link invitation. issueInvite() handles KV +
            // user-row metadata updates internally; we just need to send and
            // record the audit entry.
            const { emailResult } = await issueInvite(c.env, {
                workspaceId: workspace.id,
                userId,
                email: body.email,
                inviterUserId: currentUser?.id ?? null,
                inviterDisplayName: currentUser?.displayName ?? currentUser?.email ?? null,
                request: c.req.raw,
                revokePrior: false,
            });
            await recordAudit(c.env, {
                workspaceId: workspace.id,
                action: emailResult.ok ? 'people.invite.sent' : 'people.invite.send_failed',
                actorId: currentUser?.id ?? null,
                actorHandle: currentUser?.email ?? null,
                ipAddress: c.req.header('cf-connecting-ip') ?? null,
                details: emailResult.ok
                    ? { invitee_email: body.email, invitee_user_id: userId, role }
                    : {
                        invitee_email: body.email,
                        invitee_user_id: userId,
                        role,
                        reason: emailResult.reason,
                        error: typeof emailResult.error_detail === 'string'
                            ? emailResult.error_detail.slice(0, 200)
                            : undefined,
                    },
            });
            return c.json({
                success: true,
                userId,
                status: 'invited',
                email_sent: emailResult.ok,
                email_reason: emailResult.ok ? undefined : emailResult.reason,
            });
        }
        catch (error) {
            console.error('Failed to invite member:', error);
            return c.json({ error: 'Failed to invite member' }, 500);
        }
    });
    // POST /_ensemble/core/people/members/:userId/resend-invite
    //
    // v0.1.88: re-issues a fresh magic-link invitation for a user who's
    // still in invite_pending = 1 state. Admin-only. Revokes the prior
    // token (deletes its KV entry) before minting the new one, so a
    // stale token from a forwarded earlier email stops working.
    app.post('/_ensemble/core/people/members/:userId/resend-invite', async (c) => {
        const workspace = c.get('workspace');
        const membership = c.get('membership');
        const currentUser = c.get('user');
        const targetUserId = c.req.param('userId');
        if (!workspace?.id)
            return c.json({ error: 'Workspace not found' }, 400);
        if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
            return c.json({ error: 'Insufficient permissions' }, 403);
        }
        // Target must exist, be a member of this workspace, and still be pending.
        const target = await c.env.DB.prepare(`SELECT u.id, u.email, u.invite_pending
         FROM users u
         JOIN memberships m ON m.user_id = u.id
        WHERE u.id = ? AND m.workspace_id = ?`).bind(targetUserId, workspace.id).first();
        if (!target)
            return c.json({ error: 'User not found in this workspace' }, 404);
        if (!target.invite_pending) {
            return c.json({ error: 'User has already accepted their invite' }, 400);
        }
        const { emailResult } = await issueInvite(c.env, {
            workspaceId: workspace.id,
            userId: target.id,
            email: target.email,
            inviterUserId: currentUser?.id ?? null,
            inviterDisplayName: currentUser?.displayName ?? currentUser?.email ?? null,
            request: c.req.raw,
            revokePrior: true,
        });
        await recordAudit(c.env, {
            workspaceId: workspace.id,
            action: emailResult.ok ? 'people.invite.resent' : 'people.invite.resend_failed',
            actorId: currentUser?.id ?? null,
            actorHandle: currentUser?.email ?? null,
            ipAddress: c.req.header('cf-connecting-ip') ?? null,
            details: emailResult.ok
                ? { invitee_email: target.email, invitee_user_id: target.id }
                : {
                    invitee_email: target.email,
                    invitee_user_id: target.id,
                    reason: emailResult.reason,
                    error: typeof emailResult.error_detail === 'string'
                        ? emailResult.error_detail.slice(0, 200)
                        : undefined,
                },
        });
        return c.json({
            success: true,
            email_sent: emailResult.ok,
            email_reason: emailResult.ok ? undefined : emailResult.reason,
        });
    });
    // DELETE /_ensemble/core/people/members/:userId — Remove member
    app.delete('/_ensemble/core/people/members/:userId', async (c) => {
        const workspace = c.get('workspace');
        const membership = c.get('membership');
        const targetUserId = c.req.param('userId');
        if (!workspace?.id)
            return c.json({ error: 'Workspace not found' }, 400);
        if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
            return c.json({ error: 'Insufficient permissions' }, 403);
        }
        // Cannot remove owner
        const target = await c.env.DB.prepare(`SELECT role FROM memberships WHERE user_id = ? AND workspace_id = ?`).bind(targetUserId, workspace.id).first();
        if (target?.role === 'owner') {
            return c.json({ error: 'Cannot remove workspace owner' }, 400);
        }
        try {
            await c.env.DB.prepare(`DELETE FROM memberships WHERE user_id = ? AND workspace_id = ?`).bind(targetUserId, workspace.id).run();
            return c.json({ success: true });
        }
        catch (error) {
            console.error('Failed to remove member:', error);
            return c.json({ error: 'Failed to remove member' }, 500);
        }
    });
}
//# sourceMappingURL=routes.js.map