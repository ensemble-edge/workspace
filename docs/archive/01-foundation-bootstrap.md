# Workspace bootstrap

**Applies to:** `@ensemble-edge/core`
**Phase:** Hello world (day 1)
**Status:** Spec

> **⚠️ Architecture Update (March 2026):** This document describes the ORIGINAL bootstrap flow where the workspace Worker handled auth. **The current architecture** uses the edge proxy + `app.ensemble.ai` for all auth. See [`02-shell-shift.md`](./02-shell-shift.md).
>
> **Key changes:**
> - The shell (including the setup screen) is served by Ensemble's edge proxy, not the workspace Worker
> - Bootstrap auth (magic link) is handled by `app.ensemble.ai`
> - The workspace Worker only needs to create the user/workspace records when `app.ensemble.ai` confirms auth
> - No JWT session management in the workspace Worker

---

## Overview

Every workspace starts empty. There are no users, no brand tokens, no nav config, no memberships. Someone has to be the first. This spec covers how a workspace goes from a freshly deployed Worker with empty D1 tables to a functioning workspace with an owner, a brand, and a login flow.

**Under the new architecture:** The bootstrap flow is initiated by the edge-served shell, auth is handled by `app.ensemble.ai` via magic link, and the workspace Worker only provides the data endpoints.

---

## The bootstrapping problem

The workspace has an auth system, but the auth system protects everything, and no one exists yet to authenticate. The setup screen solves this by detecting the empty state and presenting a one-time onboarding flow that creates the owner account and initializes the workspace.

After bootstrap completes, the setup screen is gone forever. The workspace operates normally from that point forward.

---

## Detection

The workspace Worker checks for the bootstrap condition on every request before the auth middleware runs:

```typescript
// In the middleware pipeline, before auth
async function bootstrapCheck(c, next) {
  const userCount = await c.env.DB
    .prepare('SELECT COUNT(*) as count FROM users')
    .first('count')

  if (userCount === 0) {
    // No users exist — workspace needs bootstrap
    if (c.req.path === '/_ensemble/bootstrap' || c.req.path.startsWith('/assets/')) {
      return next() // Allow bootstrap routes and static assets
    }
    // Redirect everything else to bootstrap
    return c.redirect('/_ensemble/bootstrap')
  }

  // Users exist — normal operation, skip bootstrap forever
  return next()
}
```

This check runs before auth middleware. It's a single `COUNT(*)` query — fast, cached in KV after first check. Once the first user exists, the bootstrap check short-circuits via KV and adds zero overhead to normal requests.

---

## The setup screen

**Route:** `/_ensemble/bootstrap`
**Auth:** None (this is the only unauthenticated route besides brand assets)
**Availability:** Only when `users` table has zero rows

A clean, centered form with the Ensemble logo (not the workspace's logo — the workspace has no brand yet):

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    ◆ Ensemble Workspace                     │
│                                                             │
│              Set up your workspace                          │
│                                                             │
│   Workspace name    [                           ]           │
│   Your name         [                           ]           │
│   Your email        [                           ]           │
│   Your @handle      [@                          ]           │
│   Password          [                           ]           │
│   Confirm password  [                           ]           │
│                                                             │
│              [ Create workspace ]                           │
│                                                             │
│   This creates the owner account. You can invite            │
│   team members and configure branding after setup.          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

The form has no framework — it's a static HTML page served by the Worker. No Preact, no JS framework needed. It works without JavaScript (progressive enhancement). CSS uses Ensemble's default design tokens (neutral theme, no brand accent yet).

---

## What happens on submit

`POST /_ensemble/bootstrap` with form data. The handler runs in a single D1 transaction:

```
1. Validate inputs
   - Workspace name: required, 2-64 characters
   - Name: required, 2-100 characters
   - Email: required, valid format, will become the owner's login
   - Handle: required, 3-30 chars, lowercase alphanumeric + hyphens, no leading/trailing hyphens
   - Password: required, minimum 8 characters
   - Confirm password: must match

2. In a single D1 transaction:
   a. Create workspace record
      INSERT INTO workspaces (id, slug, name, type, settings_json)
      VALUES ('ws_...', slug_from_config, name, 'organization', '{}')

   b. Create user record
      INSERT INTO users (id, email, password_hash, handle, display_name, locale)
      VALUES ('user_...', email, pbkdf2(password), handle, name, 'en')

   c. Create membership (owner role)
      INSERT INTO memberships (user_id, workspace_id, role)
      VALUES ('user_...', 'ws_...', 'owner')

   d. Seed default brand tokens (from ensemble.config.ts or defaults)
      INSERT INTO brand_tokens (workspace_id, category, key, value, type, label) VALUES
      ('ws_...', 'colors', 'accent', '#d85a30', 'color', 'Accent'),
      ('ws_...', 'colors', 'primary', '#1a1a2e', 'color', 'Primary'),
      ('ws_...', 'colors', 'surface', '#fafaf8', 'color', 'Surface'),
      ('ws_...', 'identity', 'display_name', workspace_name, 'text', 'Display name'),
      ...defaults from ensemble.config.ts brand section

   e. Seed default nav config
      INSERT INTO nav_config (workspace_id, config_json, updated_by)
      VALUES ('ws_...', default_nav_json, handle)

   f. Create audit log entry
      INSERT INTO audit_log (id, workspace_id, actor_id, actor_handle, action, details_json)
      VALUES ('...', 'ws_...', 'user_...', handle, 'workspace.bootstrapped', '{}')

3. Bust KV cache key for bootstrap check
   KV.put('ws:bootstrap_complete', 'true')

4. Generate JWT, set session cookie

5. Redirect to / (the shell loads with the owner logged in)
```

The entire bootstrap is atomic. If any step fails, nothing is written. The workspace stays in bootstrap mode until it succeeds.

---

## Where brand defaults come from

The bootstrap seeds brand tokens from two sources, in priority order:

1. **`ensemble.config.ts`** — if the developer configured brand settings, use those:

```typescript
// ensemble.config.ts
export default defineConfig({
  brand: {
    accent: '#d85a30',
    base_theme: 'warm',
    name: 'Nendo',
  },
})
```

2. **Ensemble defaults** — if no config, use the neutral theme with a blue accent:

```
accent: '#378add'
base_theme: 'neutral'
name: (from workspace name entered in setup form)
```

The workspace name entered in the form becomes both the workspace record's `name` and the `identity.display_name` brand token. The developer can change everything later in the Brand Manager.

---

## After bootstrap

The owner is logged in and sees the shell. The workspace is functional:

- Sidebar shows default nav (Home, People, Brand, Settings)
- Brand tokens are seeded (accent color, base theme, workspace name)
- The owner can invite team members from People
- The owner can customize branding from Brand Manager
- The owner can install guest apps from App Manager

The bootstrap route returns 404 for all future requests. The KV flag ensures the `COUNT(*)` query isn't needed on every request.

---

## Auth model — phased

### Phase 1: Email + password (hello world)

Simple, no external dependencies. Works immediately.

| Concern | Implementation |
|---|---|
| Password hashing | PBKDF2 via Web Crypto API (100k iterations, OWASP recommended, native to Workers) |
| JWT signing | `jose` library, signing key stored as Worker secret (`JWT_SECRET`) |
| Session storage | JWT in HTTP-only, Secure, SameSite=Lax cookie. 15-min access token, 7-day refresh token. |
| Token refresh | Refresh token endpoint issues new access token. |
| Login | `POST /_ensemble/auth/login` — validate email + PBKDF2 hash → set cookie |
| Logout | `POST /_ensemble/auth/logout` — clear cookie, invalidate session in D1 |
| Current user | `GET /_ensemble/auth/me` — return user + workspace + role from JWT |

**Login page** (`/login`):

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│              [Logo]  Nendo                                   │
│                                                             │
│              Sign in to your workspace                      │
│                                                             │
│   Email      [                           ]                  │
│   Password   [                           ]                  │
│                                                             │
│              [ Sign in ]                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

The login page IS themed — it reads from `/_ensemble/brand/theme` (public, no auth) to show the workspace's logo and accent color. This is the first branded thing users see.

### Phase 2: Magic link (replaces passwords)

Requires email sending. Use **Resend** until Cloudflare Email Service exits beta.

| Concern | Implementation |
|---|---|
| Magic link flow | User enters email → server generates one-time token (stored in D1, 15-min expiry) → sends email via Resend → user clicks link → server validates token → sets JWT cookie |
| Token storage | D1 `magic_tokens` table: `id, email, token_hash, expires_at, used_at, ip_address` |
| Token security | Tokens are hashed in D1 (never stored raw), single-use, IP-bound, 15-minute expiry |
| Rate limiting | Max 3 magic link requests per email per 15 minutes |
| Email provider | Resend (configured via Worker secret `RESEND_API_KEY`). Swap to CF Email Service when GA. |
| Fallback | If email delivery fails, show error with retry option. Don't fall back to password silently. |

**Login page (Phase 2):**

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│              [Logo]  Nendo                                   │
│                                                             │
│              Sign in to your workspace                      │
│                                                             │
│   Email      [                           ]                  │
│                                                             │
│              [ Send magic link ]                             │
│                                                             │
│   We'll email you a link to sign in.                        │
│   No password needed.                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**After clicking "Send magic link":**

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│              [Logo]  Nendo                                   │
│                                                             │
│              Check your email                               │
│                                                             │
│   We sent a sign-in link to matt@hoss.com                   │
│                                                             │
│   The link expires in 15 minutes.                           │
│                                                             │
│   [ Resend link ]         [ Use a different email ]         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

When the magic link flow is live, the bootstrap setup screen changes too — it drops the password fields and uses magic link for the first login after setup. But the bootstrap still creates a password hash as a fallback (the user enters a password during setup, it's hashed and stored, but the primary login method becomes magic link).

### Phase 3: SSO (Google, OIDC, SAML)

Enterprise auth. Configured in workspace admin settings.

| Concern | Implementation |
|---|---|
| Google Workspace | OAuth 2.0 via Google. Domain auto-join: anyone @hoss.com gets member role. |
| Generic OIDC | Standard OIDC flow. Works with Okta, Auth0, Azure AD, etc. |
| SAML | For enterprises that require it. XML-based, more complex. |
| Domain auto-join | Workspace admin configures: "anyone with @hoss.com email gets `member` role automatically" |
| Role mapping | Map external groups to workspace roles (e.g., "Engineering" group → `admin` role) |

SSO providers are registered as extensions (`defineExtension({ type: 'auth-provider' })`) so workspace developers can add custom auth without modifying core.

---

## Inviting users

After bootstrap, the owner invites team members. Phase 1 flow:

1. Owner goes to People → Invite
2. Enters email, name, role (member or admin)
3. System creates user record with a temporary random password
4. Sends invite email: "Matt Hawkins invited you to Nendo. Click to set your password."
5. Invitee clicks link → set password screen → password saved → redirected to login
6. Invitee logs in → sees the shell

Phase 2 (with magic links): step 4 becomes "Click to sign in" — no password needed. The invite link IS the magic link. One click and they're in.

---

## Email provider abstraction

Auth needs to send emails (magic links, invites, password resets). The email provider is abstracted behind an interface so swapping Resend for CF Email Service (or any other provider) is a one-line config change:

```typescript
// ensemble.config.ts
export default defineConfig({
  email: {
    provider: 'resend',  // 'resend' | 'cloudflare' | 'sendgrid' | 'smtp'
    from: 'nendo@nendo.com',
    replyTo: 'matt@hoss.com',
  },
})

// Worker secrets (not in config):
// RESEND_API_KEY=re_xxxx
```

The email service interface:

```typescript
interface EmailService {
  send(options: {
    to: string
    subject: string
    html: string
    text?: string
  }): Promise<{ id: string; success: boolean }>
}
```

Each provider implements this interface. The workspace loads the correct implementation based on config. Guest apps that need email (e.g., notification extensions) go through the same service.

---

## Security considerations

| Concern | How it's handled |
|---|---|
| Bootstrap screen exposure | Only accessible when `users` table has zero rows. After first user, returns 404 forever. |
| Race condition on bootstrap | D1 transaction with `INSERT` on `users` — if two requests race, one gets a unique constraint violation and fails cleanly. |
| Password storage | PBKDF2 hash (100k iterations), never stored or logged in plaintext |
| JWT secret | Worker secret (`JWT_SECRET`), never in source code, never in config files |
| Cookie security | HTTP-only (no JS access), Secure (HTTPS only), SameSite=Lax, 7-day expiry |
| Magic link tokens | Hashed in D1, single-use, IP-bound, 15-minute expiry, rate-limited |
| Invite links | Single-use, expire in 7 days, tied to specific email address |
| Brute force | Rate limit on login: 5 attempts per email per 15 minutes. KV-based counter. |
| Session invalidation | Logout clears cookie. Optional: blacklist token ID in KV (TTL = remaining token lifetime). |

---

## Database tables (auth-specific)

These are in addition to the main workspace schema. Created during D1 migration, populated during bootstrap.

```sql
-- Magic link tokens (Phase 2)
CREATE TABLE magic_tokens (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  ip_address TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Invite tokens
CREATE TABLE invite_tokens (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  invited_by TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (invited_by) REFERENCES users(id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

-- Login rate limiting (KV-based, not D1)
-- Key: rate:login:{email}
-- Value: { count: N, window_start: ISO timestamp }
-- TTL: 15 minutes
```

---

## API routes

All bootstrap and auth routes use the `/_ensemble/` prefix.

| Method | Path | Auth | Phase | Description |
|--------|------|------|-------|-------------|
| GET | `/_ensemble/bootstrap` | No | 1 | Setup screen (only when zero users) |
| POST | `/_ensemble/bootstrap` | No | 1 | Create workspace + owner (only when zero users) |
| GET | `/login` | No | 1 | Login page (themed) |
| POST | `/_ensemble/auth/login` | No | 1 | Email + password authentication |
| POST | `/_ensemble/auth/logout` | Yes | 1 | Clear session |
| GET | `/_ensemble/auth/me` | Yes | 1 | Current user + workspace + role |
| POST | `/_ensemble/auth/magic-link` | No | 2 | Request magic link email |
| GET | `/_ensemble/auth/verify/:token` | No | 2 | Verify magic link token, set session |
| POST | `/_ensemble/auth/invite` | Admin | 1 | Send invite to new user |
| GET | `/_ensemble/auth/invite/:token` | No | 1 | Accept invite page |
| POST | `/_ensemble/auth/invite/:token/accept` | No | 1 | Accept invite, set password, create session |
| POST | `/_ensemble/auth/sso/initiate` | No | 3 | Start SSO flow |
| GET | `/_ensemble/auth/sso/callback` | No | 3 | SSO callback handler |

---

## Testing checklist

- [ ] Fresh workspace with empty D1 → visiting `/` redirects to `/_ensemble/bootstrap`
- [ ] Bootstrap form validates all fields (empty, too short, invalid email, handle format, password mismatch)
- [ ] Successful bootstrap creates workspace, user (owner), membership, brand tokens, nav config, audit entry — all in one transaction
- [ ] After bootstrap, visiting `/_ensemble/bootstrap` returns 404
- [ ] After bootstrap, visiting `/` redirects to `/login`
- [ ] Login page is themed (logo, accent color from brand tokens)
- [ ] Successful login sets HTTP-only cookie and redirects to `/`
- [ ] Failed login (wrong password) shows error, increments rate limit
- [ ] 6th failed login attempt in 15 minutes returns 429
- [ ] Authenticated request to `/_ensemble/auth/me` returns user + role
- [ ] Unauthenticated request to protected route returns 401 (API) or redirects to `/login` (HTML)
- [ ] Logout clears cookie, subsequent requests are unauthenticated
- [ ] JWT with expired TTL is rejected, user redirected to login
- [ ] Two simultaneous bootstrap submissions — one succeeds, one fails gracefully
- [ ] Invite flow: admin invites → email sent → invitee clicks → sets password → logs in
- [ ] Magic link flow (Phase 2): enter email → link sent → click → logged in → link is single-use
- [ ] Magic link expired (>15 min) → rejected with clear error
- [ ] Magic link rate limit: 4th request in 15 min → 429

---

## Migration path to CF Email Service

When Cloudflare Email Service exits beta:

1. Add email binding to `wrangler.toml`:
   ```toml
   [[email]]
   binding = "EMAIL"
   ```

2. Update `ensemble.config.ts`:
   ```typescript
   email: {
     provider: 'cloudflare',  // was 'resend'
     from: 'nendo@nendo.com',
   }
   ```

3. Remove `RESEND_API_KEY` from Worker secrets

4. Deploy. Done.

The email service interface stays the same. Only the provider implementation changes. No auth flow code is modified.