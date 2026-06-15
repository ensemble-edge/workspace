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
import type { Env } from '../types';
import { type EmailResult } from './email';
export interface IssueInviteInput {
    workspaceId: string;
    /** The new (or pending) user receiving the invite. */
    userId: string;
    email: string;
    /** Admin issuing the invite, for the "by N" attribution. */
    inviterUserId: string | null;
    inviterDisplayName: string | null;
    /** The incoming request — used to derive the public origin. */
    request: Request;
    /** If true, revoke the prior token (resend path). */
    revokePrior?: boolean;
}
export interface IssueInviteResult {
    emailResult: EmailResult;
    token: string;
    /** ISO timestamp written to users.invited_at. */
    invitedAt: string;
}
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
export declare function issueInvite(env: Env, input: IssueInviteInput): Promise<IssueInviteResult>;
/**
 * Helper: does the workspace have email sending configured + verified?
 * People routes call this before attempting an invite send so the admin
 * gets a useful "email not configured" toast instead of a generic
 * "send failed".
 */
export declare function isEmailReady(env: Env, workspaceId: string): Promise<boolean>;
//# sourceMappingURL=invites.d.ts.map