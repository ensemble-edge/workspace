# People App — Invite-by-Email + Resend (Magic-Link First Login)

> **Status**: spec, target v0.1.88
> **Owner**: core / people subsystem
> **Goal**: When an admin invites someone from the People app, send them a
> magic-link email so they can complete first login by clicking the link.
> Admins can resend the invite at any time.

## Why

Today the People app's invite endpoint creates a user row + membership +
hashed temp password — and then **discards the temp password without
sending it anywhere**. The invitee can't log in. There's also no way to
resend an invitation (re-inviting the same email returns 409). This is a
real gap on a built-in app.

The fix uses what's already in production:
- Cloudflare Email Sending is fully wired ([packages/core/src/services/email.ts](../../packages/core/src/services/email.ts) — `sendEmail()`).
- Magic-link issue + consume routes are shipping ([packages/core/src/routes/auth.ts](../../packages/core/src/routes/auth.ts) — `POST /_ensemble/auth/magic-link`, `GET /_ensemble/auth/magic-link/consume?token=…`).
- An invite-shaped email template already exists ([packages/core/src/services/email-templates.ts:281](../../packages/core/src/services/email-templates.ts#L281) — `renderInviteEmail()` takes `{ url, inviter_name, expires_in_days }`).

So this is plumbing, not new infrastructure.

## Design principles

1. **Magic link, not emailed password.** Avoids the standard "password
   in email" weakness (archives, forwarded mail, account breaches).
   User clicks → lands authenticated. Setting a password is optional
   and happens later from their own account settings.
2. **Idempotent resend.** A resend issues a *fresh* magic-link token
   and invalidates the prior one. Operators can resend as many times
   as they want without leaving a trail of valid tokens.
3. **Visible pending state.** The People UI shows who hasn't accepted
   the invite yet, so an admin can spot a stalled invite and resend
   without guessing.
4. **Reuse the existing magic-link infrastructure.** No new token
   table, no parallel auth flow. The invite *is* a magic-link send
   tied to a freshly-created user row.
5. **Audit everything.** Invite sent, invite resent, invite accepted
   (first magic-link consume that flips `invite_pending` → 0) — all
   land in the audit log so operators can answer "did we invite
   them?" without grep.

## What changes

### 1. Database

New migration **`014_users_invite_pending.ts`**:

```sql
ALTER TABLE users ADD COLUMN invite_pending INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN invited_at TEXT;
ALTER TABLE users ADD COLUMN invited_by_user_id TEXT;
```

- `invite_pending = 1` from invite creation until the first successful
  magic-link consume, then flipped to 0.
- `invited_at`, `invited_by_user_id` are audit/UX metadata. They let
  the People UI render "Invited 3 days ago by Alice" on pending rows.
- Existing users get `invite_pending = 0` by default (they're already
  in the workspace, they don't need an invite).
- No `temp_password_hash` column — we don't email passwords, so the
  user row keeps the random hash set at invite time (so the row is
  valid SQL-wise) but the user never sees it. They can `Set a
  password` later from account settings if they want.

### 2. Invite endpoint — `POST /_ensemble/core/people/invite`

Currently in [packages/core/src/apps/core/people/routes.ts](../../packages/core/src/apps/core/people/routes.ts).

Changes:
- Keep the existing user-row + membership creation. Drop the
  `tempPassword` plaintext entirely — it's never used. Still generate
  a random `password_hash` so the column is non-null.
- After creating the user, issue a magic-link token (same code path as
  `POST /_ensemble/auth/magic-link`, factored into a service function
  so both routes share it).
- Compose the invite URL: `${origin}/_ensemble/auth/magic-link/consume?token=${token}`.
- Render via `renderInviteEmail()` with `{ url, inviter_name, expires_in_days }`.
  Default expiry **7 days** (longer than a sign-in link's typical ~15min
  because invitations sit in inboxes longer).
- Call `sendEmail(env, workspace.id, rendered)`.
- Set `invite_pending = 1`, `invited_at = now`, `invited_by_user_id`.
- Return `{ success: true, userId, status: 'invited', email_sent: result.ok, reason?: result.reason }`.
  If `email_sent: false`, the People UI shows a "Email failed — resend"
  affordance. We do NOT roll back the user row on email failure —
  resend is the recovery path.

For an **existing user** being added to the workspace (the "user already
exists, add to workspace" branch on line 116), no email is sent —
they're already a known account and they get a workspace notification
in-app (audit log entry) when their next session loads. Email-invite
semantics only apply to *new* users.

### 3. Resend endpoint — `POST /_ensemble/core/people/members/:userId/resend-invite`

New endpoint. Admin-only.

- 400 if the target user is `invite_pending = 0` (they've already
  accepted; resending is meaningless).
- Issue a fresh magic-link token. Implementation: revoke any
  outstanding magic-link tokens for this user_id (set their
  `consumed_at = now` or delete) before issuing the new one. This
  prevents a stale token from a prior send still working.
- Re-render `renderInviteEmail()` with the new URL.
- Call `sendEmail()`. Update `invited_at` to the new time (so the
  "Invited N days ago" stays accurate).
- Audit `people.invite.resent`.
- Return `{ success: true, email_sent: result.ok, reason?: result.reason }`.

### 4. Magic-link consume — flip `invite_pending`

In [packages/core/src/routes/auth.ts](../../packages/core/src/routes/auth.ts)'s `/magic-link/consume` handler:

- After successful login, if `users.invite_pending = 1` for that user,
  flip it to 0 and audit `people.invite.accepted`.
- No UI change needed — they're logged in. (Future: redirect first-time
  users to a `/welcome` page; out of scope for v0.1.88.)

### 5. People API — list endpoint surfaces pending state

`GET /_ensemble/core/people/members` adds the new columns to the
SELECT so the UI can render the pending badge:

```sql
SELECT u.id, u.email, u.handle, u.display_name, u.avatar_url, u.locale, u.created_at,
       u.invite_pending, u.invited_at, u.invited_by_user_id,
       m.role, m.created_at as joined_at
  FROM memberships m
  JOIN users u ON u.id = m.user_id
  WHERE m.workspace_id = ?
  ORDER BY u.invite_pending DESC, m.role ASC, u.display_name ASC
```

Sort pending members to the top so admins see who needs attention first.

### 6. People UI

[packages/shell/src/apps/core/people/PeoplePage.tsx](../../packages/shell/src/apps/core/people/PeoplePage.tsx).

- **Pending badge.** Rows with `invite_pending = 1` get a small
  `<Badge variant="outline">Pending</Badge>` next to the name. Tooltip:
  "Invited {relativeTime}{inviter ? ` by ${inviter.display_name}` : ''}.
  Has not signed in yet."
- **Resend invite button.** On rows with `invite_pending = 1`, add a
  row-action "Resend invite" that POSTs to `/members/:userId/resend-invite`.
  On success: toast "Invite resent to {email}".
  On `email_sent: false`: toast `error` with the reason
  (`not_configured` → link to Settings → Connections → Email;
  `unverified_domain` → "DNS records not verified yet";
  `provider_error` → "Email provider returned an error — see audit log").
- **Invite dialog feedback.** When the admin submits the invite form,
  show the email-send result in the success toast: "Invited {email} —
  email sent" or "Invited {email}, but email failed (reason). Resend
  from their row."

### 7. Email template

Reuse `renderInviteEmail()` unchanged in v0.1.88. It already produces
both text + HTML and uses the workspace's brand tokens (logo, colors,
typography) so the email matches the workspace look. If we later want
"resent" vs first-send wording, add a `is_resend?: boolean` flag —
not required for v0.1.88.

## What does NOT change

- Existing users joining a new workspace (already-known account): no
  email, audit-only, same as today.
- Direct password login: still works for accounts where the user has
  set a password. Magic-link is for *first* login on invite; users
  can keep using it indefinitely if they prefer.
- The `users.password_hash` column: still required NOT NULL. Invite
  creates a row with a random hash that's never used (the user logs in
  via magic link, then optionally sets a real password from account
  settings).

## Failure modes & operator UX

| Failure | What user sees | What admin sees |
|---|---|---|
| Email provider not configured | n/a (email never sent) | Toast on invite: "Email not configured — set up under Settings → Connections → Email". Resend button works the moment they configure it. |
| Email sent, user never clicks | n/a | "Pending" badge stays. Admin can resend. |
| User clicks expired token | "This invite has expired. Ask {inviter} to resend." | Their pending badge stays. They can resend. |
| User already accepted, admin clicks Resend | n/a (button is hidden) | n/a |
| Two admins invite same email simultaneously | Second invite returns 409 "User is already a member" | The second admin sees the existing pending row. |

## Out of scope for v0.1.88

- Welcome page / onboarding on first login.
- Bulk invite (CSV / multi-email at once).
- Inviter signature / personal note in the email body.
- Per-workspace customization of the invite text (the brand-themed
  template is shared across workspaces).
- Showing the magic link in the People UI as a "copy invite link"
  affordance (useful when the user reports the email never arrived).
  Might add in a fast-follow if operators ask.

## Files touched

- `packages/core/src/db/migrations/014_users_invite_pending.ts` — new
- `packages/core/src/db/migrations/index.ts` — register 014
- `packages/core/src/apps/core/people/routes.ts` — invite handler + new resend handler + members SELECT
- `packages/core/src/routes/auth.ts` — magic-link consume flips `invite_pending`
- `packages/core/src/services/invites.ts` — new, factors out token-issue + email-render + send from the routes
- `packages/shell/src/apps/core/people/PeoplePage.tsx` — pending badge + resend button + toast wiring
- `packages/core/src/routes/credentials.ts` — fingerprint bump v0.1.88

## Acceptance

- Admin invites a new email → user receives styled email with a
  one-click "Accept invite" button → click logs them in → audit log
  shows `people.invite.sent` then `people.invite.accepted`.
- Admin invites, email fails (provider not configured) → admin sees
  toast "Invited but email failed — configure email or resend".
- Admin clicks Resend → new email sent → old magic-link token from
  prior send no longer works → new token works.
- Audit log answers "did we invite X?" by searching the audit log
  for `people.invite.sent` + the email.
