/**
 * Migration 014: users.invite_pending + invite metadata
 *
 * Three new columns on `users` to drive the v0.1.88 People-invite flow:
 *
 *   invite_pending      0/1. 1 from invite creation until the first
 *                       successful magic-link consume, then 0. Drives
 *                       the People UI's "Pending" badge + Resend button.
 *   invited_at          ISO timestamp of the most recent invite send
 *                       (set on invite, refreshed on resend). Used by
 *                       the UI to show "Invited N days ago".
 *   invited_by_user_id  The admin who issued the invite. Used by the
 *                       UI tooltip on the Pending badge.
 *
 *   invite_token        The currently-active magic-link token string
 *                       for this user's pending invite. Lets the
 *                       Resend endpoint revoke the prior token by
 *                       deleting `magic:${token}` from KV before
 *                       minting the new one. NULL once the invite is
 *                       accepted (or for users who were never invited
 *                       via the email-invite flow).
 *
 * No backfill: existing users default to invite_pending = 0 (they're
 * already in the workspace, the email-invite flow doesn't apply to
 * them). New users created via the invite endpoint flip this to 1.
 */
export const migration = {
    name: '014_users_invite_pending',
    sql: `
    ALTER TABLE users ADD COLUMN invite_pending INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN invited_at TEXT;
    ALTER TABLE users ADD COLUMN invited_by_user_id TEXT;
    ALTER TABLE users ADD COLUMN invite_token TEXT;
    CREATE INDEX idx_users_invite_pending ON users(invite_pending) WHERE invite_pending = 1;
  `,
};
//# sourceMappingURL=014_users_invite_pending.js.map