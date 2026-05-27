/**
 * Workspace invite service (v0.1.88).
 *
 * One responsibility: mint a magic-link token for a *pending invite*
 * user, write it to KV, render the invite email, send it, and update
 * the user row's invite metadata. Both the People app's POST /invite
 * and POST /members/:userId/resend-invite call this — the only
 * difference is whether they're inviting a freshly-created user or
 * re-issuing a token for one that already exists.
 *
 * Why the longer TTL than sign-in magic-links:
 *   Sign-in magic-links last 15 minutes (the user requested one,
 *   they're at their inbox right now). Invitations sit unread for
 *   days. We use 7 days so a vacationing invitee can still accept,
 *   while still being short enough that a stale invite token doesn't
 *   linger forever.
 *
 * Why revoke-prior-on-resend:
 *   If an admin clicks Resend, the prior invite token must stop
 *   working — otherwise an old token from a forwarded email would
 *   stay valid alongside the new one. We track the most recently-
 *   issued token on users.invite_token and delete its KV entry on
 *   resend before minting + storing the new one.
 */
import { renderInviteEmail } from './email-templates.js';
import { sendEmail } from './email.js';
import { getCredential, getWorkspacePublicUrl } from './credentials.js';
/** Invite token TTL, in seconds. 7 days. */
const INVITE_TTL_SECONDS = 7 * 24 * 60 * 60;
/**
 * Issue or re-issue a magic-link invitation. Caller is responsible for
 * the auth/permission check + recording an audit log entry; this
 * service is pure plumbing.
 *
 * Side effects:
 *   • Writes `magic:${token}` to KV with a 7-day TTL.
 *   • Updates users.{invite_pending, invited_at, invited_by_user_id,
 *     invite_token} for the target user.
 *   • If `revokePrior`, deletes the user's previous magic-link KV
 *     entry before minting the new one.
 *   • Sends the email via sendEmail (Cloudflare Email Sending or
 *     Resend, per workspace config).
 *
 * Returns the email-send result so the caller can surface delivery
 * failures to the admin (without rolling back the user row — the row
 * stays in invite_pending=1 and the admin can Resend later).
 */
export async function issueInvite(env, input) {
    // Revoke the prior token, if any. We delete the KV entry but not the
    // user row's invite_token yet — that gets overwritten below.
    if (input.revokePrior) {
        const prior = await env.DB.prepare(`SELECT invite_token FROM users WHERE id = ?`).bind(input.userId).first();
        if (prior?.invite_token) {
            await env.KV.delete(`magic:${prior.invite_token}`);
        }
    }
    // Mint a fresh token. Same shape as POST /_ensemble/auth/magic-link
    // so the existing consume handler at GET /magic-link/consume works
    // unchanged. The only difference is the TTL (7 days vs 15 minutes).
    const token = crypto.randomUUID().replace(/-/g, '');
    const payload = JSON.stringify({
        user_id: input.userId,
        workspace_id: input.workspaceId,
        created_at: Date.now(),
        /** Marker so the consume handler can audit "invite accept" vs "sign-in". */
        invite: true,
    });
    await env.KV.put(`magic:${token}`, payload, { expirationTtl: INVITE_TTL_SECONDS });
    // Compose the consume URL. Same path as a regular magic-link.
    const base = await getWorkspacePublicUrl(env, input.workspaceId, input.request);
    const url = `${base.replace(/\/$/, '')}/_ensemble/auth/magic-link/consume?token=${token}`;
    // Render via the existing invite email template (subject, html, text).
    const rendered = await renderInviteEmail(env, input.workspaceId, {
        url,
        inviter_name: input.inviterDisplayName ?? undefined,
        expires_in_days: 7,
    });
    const emailResult = await sendEmail(env, input.workspaceId, {
        to: input.email,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
    });
    // Update the user row. We do this regardless of email-send result —
    // a failed send doesn't roll back, the admin can Resend (which is
    // exactly this same code path).
    const invitedAt = new Date().toISOString();
    await env.DB.prepare(`UPDATE users
        SET invite_pending = 1,
            invited_at = ?,
            invited_by_user_id = ?,
            invite_token = ?
      WHERE id = ?`).bind(invitedAt, input.inviterUserId, token, input.userId).run();
    return { emailResult, token, invitedAt };
}
/**
 * Helper: does the workspace have email sending configured + verified?
 * People routes call this before attempting an invite send so the admin
 * gets a useful "email not configured" toast instead of a generic
 * "send failed".
 */
export async function isEmailReady(env, workspaceId) {
    const verified = await getCredential(env, workspaceId, 'email_provider_verified');
    return verified === 'verified';
}
//# sourceMappingURL=invites.js.map