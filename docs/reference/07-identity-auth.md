## 11. The Identity & Authentication Model

This is the hardest design problem in AIUX. The requirements pull in opposite directions:

- **Simplicity:** A user should be able to sign in and start working in seconds
- **Cross-workspace identity:** `@maycotte` should work across 10 different workspaces
- **Enterprise SSO:** A company using Google Workspace / Okta / Azure AD shouldn't have to manage a second identity system
- **Developer simplicity:** A workspace admin shouldn't need a PhD in SAML to set this up
- **Guest access:** A borrower checking their loan status shouldn't need to understand any of this

The solution: **a layered identity model where federation creates identity rather than replacing it.**

### The Three Layers

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1: AIUX IDENTITY                                        │
│  ─────────────────────                                          │
│  The universal, portable layer. One per human.                  │
│                                                                 │
│  @maycotte                                                      │
│  id: usr_abc123                                                 │
│  handle: maycotte                                               │
│  email: ho@ownly.com (primary)                                  │
│  name: H.O. Maycotte                                            │
│  avatar: [uploaded image]                                       │
│  mfa: enabled (TOTP)                                            │
│  created: 2026-03-25                                            │
│                                                                 │
│  This is like a GitHub account. It exists independent of any    │
│  workspace. It persists even if every workspace kicks you out.  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 2: AUTH METHODS                                          │
│  ────────────────────                                           │
│  How the identity proves itself. Multiple methods can be        │
│  linked to a single identity.                                   │
│                                                                 │
│  ┌─ Password ──────────────────────────────────────────────┐    │
│  │ hash: argon2id$...                                      │    │
│  │ set: 2026-03-25                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─ Google OAuth ──────────────────────────────────────────┐    │
│  │ provider_id: google                                     │    │
│  │ provider_user_id: 1029384756                            │    │
│  │ email: ho@ownly.com                                     │    │
│  │ linked: 2026-03-25                                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─ Google Workspace SSO (via Ownly's IdP) ────────────────┐   │
│  │ provider_id: saml_ws_ownly                              │   │
│  │ provider_user_id: ho@ownly.com                          │   │
│  │ linked: 2026-03-26 (auto-linked on first SSO login)     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─ Passkey ───────────────────────────────────────────────┐   │
│  │ credential_id: cred_xxx                                  │   │
│  │ device: "MacBook Pro Touch ID"                          │   │
│  │ registered: 2026-04-01                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  An identity can have many auth methods. Any method can         │
│  prove the identity. New methods can be linked over time.       │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 3: WORKSPACE MEMBERSHIPS                                 │
│  ──────────────────────────────                                 │
│  What the identity can access. Scoped per workspace.            │
│                                                                 │
│  ┌─ Ownly Group (ws_ownly) ─────────────────────────────────┐  │
│  │ role: superadmin                                          │  │
│  │ apps: [ALL]                                               │  │
│  │ display_name: H.O.                                        │  │
│  │ joined_via: direct (created the workspace)                │  │
│  │ sso_required: false (admin override)                      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ Circuit Holdings (ws_circuit) ───────────────────────────┐  │
│  │ role: viewer                                              │  │
│  │ apps: [bundled:files]                                     │  │
│  │ display_name: Higinio Oliver Maycotte                     │  │
│  │ joined_via: invite (link from Tucker)                     │  │
│  │ sso_required: false                                       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ Ownly Capital Portal (ws_ownly_portal) ──────────────────┐ │
│  │ role: admin                                               │ │
│  │ apps: [ALL]                                               │ │
│  │ display_name: H.O.                                        │ │
│  │ joined_via: workspace_creation                            │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Handles

Every AIUX identity has a globally unique handle (within the deployment):

- Format: `@lowercase-alphanumeric` (3-32 chars, hyphens allowed)
- Set during account creation (suggested from name or email)
- Changeable (with cooldown to prevent squatting abuse)
- Used for: mentions (`@maycotte`), invite targets, profile URLs, API references

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,              -- usr_xxxxxxxxxxxx
  handle TEXT UNIQUE NOT NULL,      -- 'maycotte' (stored without @)
  email TEXT UNIQUE NOT NULL,       -- primary email
  email_verified INTEGER DEFAULT 0,
  name TEXT NOT NULL,
  avatar_key TEXT,
  mfa_secret TEXT,
  mfa_enabled INTEGER DEFAULT 0,
  handle_changed_at TEXT,           -- rate-limit handle changes
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Auth methods (replaces the old password_hash column + user_oauth table)
CREATE TABLE auth_methods (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,               -- 'password', 'oauth', 'saml', 'passkey'
  provider TEXT,                    -- 'google', 'github', 'microsoft', 'saml_ws_ownly'
  provider_user_id TEXT,            -- external ID from provider
  credential TEXT,                  -- password hash, or passkey credential, etc.
  email TEXT,                       -- email associated with this method
  metadata TEXT,                    -- JSON: tokens, device info, etc.
  last_used_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(type, provider, provider_user_id)
);

-- Workspace SSO configuration
CREATE TABLE workspace_sso (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  protocol TEXT NOT NULL,           -- 'saml', 'oidc'
  provider_name TEXT,               -- 'Google Workspace', 'Okta', 'Azure AD'
  -- SAML fields
  idp_entity_id TEXT,
  idp_sso_url TEXT,
  idp_certificate TEXT,
  -- OIDC fields
  oidc_issuer TEXT,
  oidc_client_id TEXT,
  oidc_client_secret_enc TEXT,
  -- Shared config
  email_domain TEXT,                -- 'ownly.com' — auto-match users from this domain
  auto_create_membership INTEGER DEFAULT 1,  -- auto-add users who SSO in
  default_role TEXT DEFAULT 'member',
  enforce_sso INTEGER DEFAULT 0,    -- require SSO for this workspace
  group_mapping TEXT,               -- JSON: map IdP groups to AIUX roles
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now'))
);
```

### The Eight Auth Flows

Here's every way a person ends up authenticated in an AIUX workspace:

#### Flow 1: Direct Signup (Self-Service)

The simplest path. User creates an AIUX identity from scratch.

```
1. User visits ensemble.ai/signup (or workspace login page)
2. Enters: name, email, password, chooses handle
3. Email verification sent
4. Identity created: usr_xxx, @chosen-handle
5. Auth method created: type=password
6. If they arrived via invite link → membership auto-created
7. If not → they land on "select workspace" (empty until invited somewhere)
```

#### Flow 2: OAuth Signup (Google/GitHub/Microsoft)

User signs up using an existing social/work account.

```
1. User clicks "Continue with Google"
2. OAuth flow completes → we receive: email, name, Google ID
3. Check: does an AIUX identity exist for this email?
   - No → create identity, suggest handle from name
   - Yes → link this OAuth method to existing identity
4. Auth method created: type=oauth, provider=google
5. User logged in
```

#### Flow 3: Invite Link (No Account Yet)

Someone invites `jane@acme.com` to the Acme workspace. Jane has never used AIUX.

```
1. Admin creates invite for jane@acme.com (role: member, apps: [ALL])
2. Jane receives email with invite link
3. Jane clicks link → lands on signup page (pre-filled email)
4. Jane creates identity (password or OAuth) + chooses handle
5. Membership auto-created based on invite params
6. Jane lands in the Acme workspace, ready to work
```

#### Flow 4: Invite Link (Existing Account)

H.O. (`@maycotte`, already has AIUX identity) is invited to the Circuit Holdings workspace.

```
1. Tucker creates invite for ho@ownly.com to Circuit Holdings
2. H.O. receives email → clicks link
3. AIUX recognizes the email → "Sign in to accept this invite"
4. H.O. signs in (any method: password, Google, passkey)
5. Membership created: Circuit Holdings, role: viewer, apps: [bundled:files]
6. Circuit Holdings appears in H.O.'s workspace switcher
```

#### Flow 5: Enterprise SSO — First Login (No AIUX Account)

Acme Corp has Google Workspace. They configure SSO in AIUX. Employee Bob has never used AIUX.

```
1. Acme admin configures SSO:
   - Protocol: OIDC (Google Workspace)
   - Email domain: acme.com
   - Auto-create membership: yes
   - Default role: member
   - Enforce SSO: yes (only SSO login allowed for this workspace)

2. Bob visits acme.ensemble.ai
3. Sees "Sign in with Acme Google Workspace" (branded by Brand Manager)
4. Clicks → Google OAuth flow → returns with bob@acme.com
5. AIUX checks: no identity for bob@acme.com
6. Auto-creates AIUX identity:
   - email: bob@acme.com
   - name: Bob Smith (from Google profile)
   - handle: @bob-smith (auto-suggested, Bob can change later)
7. Auth method created: type=saml, provider=saml_ws_acme
8. Membership auto-created: Acme workspace, role: member
9. Bob is in. He never typed a password. He might not even know AIUX is a separate thing.
```

**The key insight:** Bob now has an AIUX identity (`@bob-smith`). If he's later invited to a different workspace (say, a client portal), his identity already exists. He just gets a new membership. His Acme SSO auth method can log him into any workspace where he has membership (unless that workspace also enforces its own SSO).

#### Flow 6: Enterprise SSO — Returning Login (Has AIUX Account)

H.O. already has `@maycotte`. Ownly Group configures Google Workspace SSO.

```
1. Ownly admin configures SSO for ownly.com domain
2. H.O. visits ownly.ensemble.ai
3. Sees "Sign in with Ownly Google Workspace" + regular login options
4. H.O. clicks SSO → Google flow → returns with ho@ownly.com
5. AIUX checks: identity exists for ho@ownly.com → usr_abc123
6. Links SSO auth method to existing identity (if not already linked)
7. Logs in as @maycotte, lands in Ownly workspace
```

H.O. can still use password or other methods for workspaces that don't enforce SSO.

#### Flow 7: Domain Auto-Join

A workspace can be configured so anyone with a matching email domain is auto-invited.

```
1. Acme admin enables: "Auto-join for @acme.com emails"
2. New Acme employee Carol visits acme.ensemble.ai
3. Signs up or uses SSO → identity created with carol@acme.com
4. Domain match detected → membership auto-created (role: member)
5. Carol is immediately in the workspace
```

#### Flow 8: Magic Link / Passwordless

For low-friction guest access (e.g., borrower portals):

```
1. Ownly Capital Portal sends magic link to borrower@gmail.com
2. Borrower clicks link → email verified → logged in
3. If no identity: auto-created with suggested handle
4. Auth method: type=magic-link (upgradeable to password or OAuth later)
5. Borrower lands in portal, sees only their permitted apps
```

### SSO Configuration — The Admin Experience

The Auth & Security core app provides a guided SSO setup:

```
┌── SSO Configuration ────────────────────────────────────────┐
│                                                              │
│  Provider: [Google Workspace ▾]                              │
│                                                              │
│  ┌─ Step 1: Connect ──────────────────────────────────────┐  │
│  │ Client ID:     [_________________________]             │  │
│  │ Client Secret: [_________________________]             │  │
│  │ Domain:        [ownly.com________________]             │  │
│  │                                                        │  │
│  │ AIUX Callback URL (copy to Google Admin):              │  │
│  │ https://ownly.ensemble.ai/auth/sso/callback               │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ Step 2: Behavior ─────────────────────────────────────┐  │
│  │ ☑ Auto-create membership for new SSO users             │  │
│  │   Default role: [Member ▾]                             │  │
│  │   Default apps: [All enabled apps ▾]                   │  │
│  │                                                        │  │
│  │ ☐ Enforce SSO (block password login for this workspace)│  │
│  │                                                        │  │
│  │ ☑ Sync display name from IdP                          │  │
│  │ ☐ Sync avatar from IdP                                │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ Step 3: Group Mapping (optional) ─────────────────────┐  │
│  │ IdP Group          →  AIUX Role                        │  │
│  │ ──────────────────────────────────                     │  │
│  │ Engineering        →  member (+ engineering group)     │  │
│  │ Leadership         →  admin                            │  │
│  │ Contractors        →  viewer                           │  │
│  │ [+ Add mapping]                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  [Test Connection]  [Save & Activate]                        │
└──────────────────────────────────────────────────────────────┘
```

### The Resolution Algorithm

When a request comes in, the auth middleware resolves identity through this flow:

```
Request arrives
    │
    ▼
┌─ Has JWT cookie? ─┐
│                   │
│ YES               │ NO
│                   │
▼                   ▼
Validate JWT     ┌─ Workspace enforces SSO? ─┐
│                │                           │
│ Valid          │ YES                       │ NO
│                │                           │
▼                ▼                           ▼
Resolve user     Redirect to SSO            Show login page
Load memberships provider login              (password + OAuth
Check workspace                              + SSO if configured)
membership                                       │
│                                               │
▼                                               ▼
Inject into      ──── Auth completes ────────►  Resolve identity
Hono context                                    │
│                                               │
▼                                   ┌──────────┤
Proceed to                          │          │
route handler                 Existing    New identity
                              identity     │
                                  │        Create identity
                                  │        Create auth method
                                  │        Check pending invites
                                  │        Check domain auto-join
                                  │        │
                                  ▼        ▼
                              Create JWT session
                              Set cookie
                              Redirect to workspace
```

### Cross-Instance Identity (Future: AIUX Cloud)

In the self-hosted world, handles are unique within a single AIUX deployment (one Worker). A company deploying their own AIUX has their own handle namespace.

When AIUX Cloud launches, we introduce **federated identity**:

- Cloud-hosted instances share a global handle registry
- `@maycotte` is globally unique across all Cloud workspaces
- Self-hosted instances can optionally join the federation
- Identity portability: `@maycotte@cloud.ensemble.ai` (ActivityPub-style, if needed)

But this is a future concern. For v1, handles are deployment-scoped, which is fine because a typical deployment serves one company (with multiple workspaces).

### Permission Hierarchy — Complete

```
AIUX Identity (@maycotte)
    │
    ├─ Global capabilities
    │   ├─ Create new workspaces
    │   ├─ Accept invitations
    │   └─ Manage personal profile + auth methods
    │
    ├─ Workspace Membership (Ownly Group)
    │   ├─ Role: superadmin
    │   │   ├─ All admin permissions
    │   │   ├─ Can delete workspace
    │   │   ├─ Can transfer ownership
    │   │   └─ Can configure SSO
    │   │
    │   ├─ App Access: [ALL]
    │   │   ├─ Core apps: all visible
    │   │   ├─ Bundled apps: all enabled visible
    │   │   └─ Guest apps: all installed visible
    │   │
    │   ├─ Group: "Leadership"
    │   │   └─ Inherits: leadership-specific nav section, bonus bookmarks
    │   │
    │   └─ Workspace-specific profile
    │       ├─ display_name: "H.O."
    │       ├─ title: "Managing Partner & CTO"
    │       └─ avatar: (uses global avatar unless overridden)
    │
    ├─ Workspace Membership (Circuit Holdings)
    │   ├─ Role: viewer
    │   ├─ App Access: [bundled:files]
    │   ├─ Groups: none
    │   └─ Profile: display_name: "Higinio Oliver Maycotte"
    │
    └─ Workspace Membership (Ownly Capital Portal)
        ├─ Role: admin
        ├─ App Access: [ALL]
        └─ Profile: display_name: "H.O."
```

### Roles — Built-In + Custom

| Role | Description | Typical Permissions |
|---|---|---|
| **superadmin** | Workspace creator / owner. Unrestricted. | Everything, including destructive actions |
| **admin** | Day-to-day administrator. | Manage people, apps, brand, knowledge. Can't delete workspace. |
| **member** | Standard team member. | Use enabled apps, create content, view people directory. |
| **viewer** | Read-only access. | View permitted apps, no create/edit. |
| **guest** | External user with minimal access. | View specific apps only. No workspace settings. |
| **custom:___** | Workspace-defined role. | Admin configures exact permissions. |

Custom roles are defined in the People & Teams core app. They're permission bundles:

```json
{
  "id": "role:board-member",
  "name": "Board Member",
  "description": "External board member with data room access",
  "base": "viewer",
  "permissions": {
    "files:read": true,
    "files:download": true,
    "files:comment": true,
    "files:upload": false,
    "knowledge:read": false,
    "people:directory": true,
    "people:manage": false
  },
  "default_app_access": ["bundled:files", "bundled:dashboard"],
  "default_nav_section": "dataroom"
}
```

---

---

