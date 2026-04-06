# Ensemble Architecture Shift: Edge-Served Shell

**Status:** Decision Record
**Author:** H.O. Maycotte / Ensemble Edge AI
**Date:** March 29, 2026

---

## Summary

We are fundamentally changing where the Ensemble shell lives. Previously, each workspace Worker bundled and served the shell (the SPA — sidebar, toolbar, viewport, theme engine, login UI). In the new model, the workspace Worker is a pure API and the shell is served by Ensemble's edge infrastructure.

This is not a refactor. It changes the deployment model, the upgrade model, the auth model, the developer experience, and the adoption pitch. Everything downstream simplifies.

---

## What Was: Shell-in-Worker

In the original architecture, the workspace Worker was a monolith. It contained:

- The Hono API server (`/_ensemble/*` routes returning JSON)
- The Preact SPA bundle (shell, sidebar, toolbar, viewport, theme engine, router)
- Static assets (CSS, JS chunks, icons, fonts)
- Auth middleware that handled both session management AND login UI rendering
- The switcher component

A request to `hub.acme.com` hit the Worker, which decided: is this an API call? Serve JSON. Is this a page load? Serve the SPA HTML + JS bundle, which then hydrated by calling the API.

**Deployment looked like this:**

```
Developer writes API handlers
  + Ensemble shell source code (npm dependency)
  → Build step bundles API + shell together
  → Single Worker deployed to Cloudflare
  → Worker serves both API and frontend
```

**Upgrading the shell meant:**

```
Ensemble releases shell v1.3.0
  → Developer runs `ensemble upgrade` (updates npm dependency)
  → Rebuild the entire Worker bundle
  → Redeploy with `wrangler deploy`
  → Per workspace. Every workspace. Independently.
```

### Problems with this model

**Version drift.** Every workspace runs whatever shell version the developer last deployed. Some workspaces are on v1.1, some on v1.3, some on a fork. Bug in the switcher? Can't fix it network-wide — each workspace has to independently upgrade and redeploy.

**Developer burden.** Workspace developers are responsible for frontend concerns they didn't ask for — build tooling, shell dependencies, SPA bundling, cache headers, asset optimization. They came here to build a CRM API, not maintain a frontend build pipeline.

**Shell/API coupling.** A change to the shell requires a full Worker redeploy, even if the API didn't change. A change to the API requires a full Worker redeploy, even if the shell didn't change. They're in the same binary.

**Auth complexity.** Each workspace had to implement auth flows — magic link handling, session management, cookie setting, login UI rendering. The auth component shipped as part of the SDK, but the workspace Worker was responsible for wiring it up.

**No network-level consistency.** The switcher's behavior, appearance, and capabilities could vary between workspaces depending on shell version. The one thing that should feel identical everywhere... didn't.

---

## What Is: Edge-Served Shell

In the new architecture, the workspace Worker is a pure JSON API. The shell is served by an Ensemble edge proxy that sits in front of every workspace domain.

### How requests flow now

```
Browser requests hub.acme.com
  → DNS: hub.acme.com CNAMEs to proxy.ensemble.ai
  → Request hits Cloudflare edge
  → Ensemble proxy Worker handles routing:
      ├── Non-API route (/, /app/*, etc.)
      │   → Serve shell from R2/KV cache
      │   → Same static bundle for every workspace on earth
      │
      └── API route (/_ensemble/*)
          → Validate session cookie
          → Inject user context headers (X-Ensemble-User, X-Ensemble-Roles, etc.)
          → Proxy to workspace's API Worker
          → Return JSON response
```

**The browser always shows `hub.acme.com` in the URL bar.** The CNAME resolution is invisible. Cookies are scoped to `hub.acme.com`. The user never sees `ensemble.ai` unless they go to `app.ensemble.ai` directly.

### What the workspace developer deploys

A Cloudflare Worker that serves `/_ensemble/*` API routes. That's it. No frontend code. No SPA bundle. No static assets. No auth UI. No build step that touches the shell.

```javascript
// The entire workspace Worker is just API handlers
import { Hono } from 'hono'

const app = new Hono()

// Workspace config — drives shell theming, nav, app registry
app.get('/_ensemble/workspace', (c) => {
  return c.json({
    name: 'AcmeCorp',
    icon: '/api/assets/icon.png',
    theme: { canvas: '#FAF7F2', card: '#1C1917', accent: '#E85D3A' },
    navigation: [
      { id: 'home', label: 'Home', icon: 'home' },
      { id: 'deals', label: 'Deals', app: 'crm' },
    ]
  })
})

// App-specific API routes
app.get('/_ensemble/apps/crm/deals', (c) => {
  const userId = c.req.header('X-Ensemble-User')
  // ... fetch deals for this user
  return c.json({ deals: [...] })
})

export default app
```

No auth middleware. No session handling. No cookie parsing. The proxy already validated the session and injected headers. The workspace Worker just reads headers and returns JSON.

### What the shell knows and does

The shell boots on any Ensemble workspace domain and immediately:

1. Calls `/_ensemble/workspace` → gets theme, nav, workspace name/icon
2. Applies theme (CSS variables injected)
3. Renders sidebar with navigation
4. Checks session state with `app.ensemble.ai` → populates switcher with connected workspaces
5. Renders the active app's viewport by calling that app's API routes

The shell is the same Preact SPA everywhere. The workspace API is what makes each workspace different — the theme, the navigation, the apps, the data.

---

## What Changed: Auth

### Before

Each workspace handled its own auth. The shell was a component library that rendered login UI, but the workspace Worker was responsible for:

- Sending magic links (or configuring SSO)
- Handling magic link callbacks
- Creating sessions
- Setting cookies
- Validating sessions on every request

### After

Auth is owned entirely by the edge layer: the Ensemble proxy Worker + `app.ensemble.ai`.

**Login flow:**

1. User visits `hub.acme.com` — proxy serves shell
2. Shell detects: no valid session cookie on `hub.acme.com`
3. Shell shows login UI within the workspace (not a redirect)
4. User enters email
5. Shell calls `app.ensemble.ai/api/magic-link` with `{email, workspace: "hub.acme.com"}`
6. Magic link email sent from `auth@app.ensemble.ai` (device-locked to this browser session)
7. User clicks link → `app.ensemble.ai/verify` validates, workspace confirms auth and returns opaque user ID
8. `app.ensemble.ai` creates or finds a network identity (see "Network Identity & Cross-Device Switching" section below), stores the workspace link, attaches the device session
9. Redirects to `hub.acme.com/_ensemble/auth/callback?token=<jwt>`
10. Proxy Worker at `hub.acme.com` intercepts the callback, validates JWT, sets workspace session cookie on `hub.acme.com`
11. User is authenticated. Shell loads. Switcher populates with all linked workspaces (this one active, others showing as "needs login on this device"). Workspace API calls carry user context headers.

**The workspace API Worker never sees auth traffic.** It never handles callbacks, never parses tokens, never sets cookies. It just receives pre-authenticated requests with headers.

**Switching flow:**

1. User clicks another workspace in the switcher
2. Shell redirects to `app.ensemble.ai/switch?to=hub.other.com`
3. `app.ensemble.ai` validates central session, issues short-lived JWT
4. Redirects to `hub.other.com/_ensemble/auth/token-login?token=<jwt>`
5. Proxy Worker at `hub.other.com` validates JWT, sets local cookie
6. Shell loads at `hub.other.com` — already cached, instant paint
7. Shell calls `hub.other.com/_ensemble/workspace` for theme/nav
8. Workspace appears. Sub-second total.

---

## What's New: Network Identity & Cross-Device Switching

The switcher needs to work across devices. If Horacio adds 5 workspaces on his MacBook, his iPhone should show those same 5 workspaces without re-adding each one. This requires a durable identity layer at `app.ensemble.ai` — but one that's invisible to the user, stores no plaintext emails, and creates itself automatically.

### The Rule

Every **successful** login creates or finds a network identity. No special cases. No opt-in flow. No "Create Network Identity" button. The identity is infrastructure, not UX. The user's mental model is just "I added my workspaces to the switcher."

**Critical:** Network identities, links, and merges only happen after the workspace confirms authentication. The flow is:

1. User initiates login (magic link or SSO)
2. User completes authentication
3. **Workspace validates and confirms** — returns success + opaque user ID
4. Only then does `app.ensemble.ai` create/discover/merge the network identity

This means the workspace is the gatekeeper. If a workspace blocks disposable emails, rejects unverified domains, or enforces any other policy — `app.ensemble.ai` never sees the failed attempt. No network identity pollution. No spam accounts in the identity layer.

### Identity Lifecycle: Three Operations

**Create.** Every **successful** login through `app.ensemble.ai` that doesn't match an existing record creates a new network identity. First-ever login? Create `nid_1` with one workspace link. Log into a different workspace on a different device with no switcher? Create `nid_2` with one workspace link. Every identity starts as a single-workspace island. This is fine.

**Discover.** Every **successful** login that matches an existing record attaches the device session to that identity. The switcher populates with all linked workspaces. No merge, no conflict. Just: "I know this email at this workspace — here's your identity, here are your other workspaces."

**Merge.** Only happens when a **successful** login resolves to a different network identity than the current device session. The session has `nid_A`. The login resolves to `nid_B`. All of `nid_B`'s workspace links move to `nid_A`. `nid_B` is deleted. This is an atomic database operation. Other devices on `nid_B` discover the merge on next refresh and pick up the fuller workspace list.

### How It Works: Step by Step

**First login (MacBook, Nendo):**

1. Horacio logs into `hub.nendo.ai` with `ho@nendo.ai`
2. `app.ensemble.ai` computes `sha256("hub.nendo.ai" + "ho@nendo.ai")` → not found
3. Creates `nid_1`, stores the workspace link and hash index
4. Workspace confirms auth, returns opaque user ID `usr_001`
5. Durable link stored: `nid_1 → (hub.nendo.ai, usr_001, "Nendo")`
6. Switcher shows: `[Nendo ●] [+]`

**Adds AcmeCorp from switcher (MacBook):**

1. Clicks "+", types `hub.acme.com`, enters `horacio@acme.com`
2. Magic link sent to `horacio@acme.com`, Horacio clicks it
3. `app.ensemble.ai` computes `sha256("hub.acme.com" + "horacio@acme.com")` → not found
4. Creates `nid_2` with one link to AcmeCorp
5. **But** the current MacBook session is on `nid_1` → **merge event**
6. `nid_2`'s links move to `nid_1`. `nid_2` is deleted.
7. `nid_1` now has: Nendo + AcmeCorp
8. Switcher shows: `[Nendo ●] [Acme ●] [+]`

**New device (iPhone), logs into Nendo:**

1. Logs into `hub.nendo.ai` with `ho@nendo.ai`
2. `app.ensemble.ai` computes hash → **found** → `nid_1`
3. Attaches iPhone session to `nid_1`
4. Pulls all linked workspaces: Nendo, AcmeCorp
5. Switcher immediately shows: `[Nendo ●] [Acme ○] [+]`
6. Green dot on Nendo (active session on this device), red/hollow on Acme (linked but needs login on this device)
7. Horacio taps Acme → login flow → magic link to `horacio@acme.com` → clicks → now `[Nendo ●] [Acme ●]`

**He authenticated once per workspace per device. He only "added" each workspace once, ever.**

### Two Devices, Independent Logins, Then Merge

The rare but handled case: Horacio uses two devices, logs into different workspaces on each, never uses the switcher.

1. MacBook: logs into Nendo → creates `nid_1` (Nendo only)
2. iPad: logs into Ownly → creates `nid_3` (Ownly only)
3. Two separate identities. Two separate switcher states. Each device sees one workspace. This is fine.
4. Later, on MacBook: clicks "+", adds Ownly, logs in with `ho@ownly.com`
5. Hash lookup finds `nid_3`. MacBook session is `nid_1`. → **merge event**
6. `nid_3`'s links move to `nid_1`. `nid_3` deleted.
7. MacBook switcher: `[Nendo ●] [Ownly ●]`
8. iPad: on next refresh, discovers `nid_3` no longer exists, but the Ownly workspace link now lives on `nid_1`. iPad session attaches to `nid_1`. Switcher: `[Nendo ○] [Ownly ●]`

If merge never happens — if Horacio has five separate identities, one per workspace, because he always logged in directly — that's fine too. Each identity is a single-workspace switcher. No harm. The moment he uses "+", identities start merging and his switcher fills up.

### Switcher States

Each workspace in the switcher has one of three states:

| State | Indicator | On Click |
|---|---|---|
| Active session on this device | ● green | Instant switch (redirect through `app.ensemble.ai`, JWT exchange, sub-second) |
| Linked but no session on this device | ○ red/hollow | Login flow for that workspace (magic link or SSO) |
| Not linked | Not shown | "+" to add |

**Unlink actions** (available per workspace via long-press or context menu):

- **Log out on this device** — clears the workspace session on this device only. Workspace goes from ● to ○. Other devices unaffected.
- **Unlink from all devices** — removes the workspace link from the network identity at `app.ensemble.ai`. Workspace disappears from the switcher everywhere. The user still exists in that workspace — they can re-add it anytime with "+". This is a switcher action, not an account deletion.

### Security: No Plaintext Emails

`app.ensemble.ai` never stores email addresses. The email is used transiently during magic link delivery and then discarded. What's stored:

**Hashed email index (discovery only):**

```
sha256("hub.nendo.ai" + "ho@nendo.ai")     → nid_1
sha256("hub.acme.com" + "horacio@acme.com") → nid_1
sha256("hub.ownly.com" + "ho@ownly.com")    → nid_1
```

These are one-way hashes. `app.ensemble.ai` cannot reverse them to recover the email. They exist solely so that a login on a new device can find the existing network identity.

**Durable workspace links (keyed on opaque user ID, not email):**

```
nid_1 → (hub.nendo.ai, usr_001, "Nendo", icon_url)
nid_1 → (hub.acme.com, usr_482, "AcmeCorp", icon_url)
nid_1 → (hub.ownly.com, usr_037, "Ownly", icon_url)
```

The email is the bootstrap lookup. The durable relationship is `(network_id, workspace_domain, workspace_user_id)`. If an email changes (SSO migration, corporate rebrand), the durable link is unaffected.

**If `app.ensemble.ai` is compromised, the attacker sees:** network identity IDs, hashed composite keys (useless without rainbow tables for every possible email+domain combination), workspace domains, and workspace display names. They know "identity X is linked to Nendo and AcmeCorp." They don't know who identity X is or what email they used.

### Magic Links Are Device-Locked

Magic links are cryptographically bound to the device and browser session that initiated them. A magic link generated on a MacBook will not work if opened on an iPhone. This prevents:

- Magic link interception/forwarding attacks
- Accidental cross-device auth (clicking a link in a mobile email client when the login was initiated on desktop)
- Session hijacking via shared email accounts

If the user opens the magic link on the wrong device, they see a clear error: "This link was generated for a different device. Please request a new one."

### Data Model at `app.ensemble.ai`

```sql
-- Network identities (created automatically on every new login)
CREATE TABLE network_identities (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);

-- Durable workspace links (survive across devices and sessions)
CREATE TABLE workspace_links (
  network_id TEXT NOT NULL,
  workspace_domain TEXT NOT NULL,
  workspace_user_id TEXT NOT NULL,
  workspace_name TEXT,
  workspace_icon_url TEXT,
  linked_at TEXT NOT NULL,
  PRIMARY KEY (network_id, workspace_domain),
  FOREIGN KEY (network_id) REFERENCES network_identities(id)
);

-- Hashed email index (discovery only — no plaintext emails)
CREATE TABLE email_index (
  link_hash TEXT PRIMARY KEY,           -- sha256(workspace_domain + email)
  network_id TEXT NOT NULL,
  workspace_domain TEXT NOT NULL,       -- needed for the lookup join
  FOREIGN KEY (network_id) REFERENCES network_identities(id)
);

-- Device sessions (ephemeral, per-device)
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  network_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_active_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (network_id) REFERENCES network_identities(id)
);

-- Which workspaces have active auth on this device session
CREATE TABLE session_workspaces (
  session_id TEXT NOT NULL,
  workspace_domain TEXT NOT NULL,
  workspace_user_id TEXT NOT NULL,
  authenticated_at TEXT NOT NULL,
  PRIMARY KEY (session_id, workspace_domain),
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Rate limiting for magic link sends (hashed, no plaintext)
CREATE TABLE magic_link_rate_limits (
  workspace_domain TEXT NOT NULL,
  email_hash TEXT NOT NULL,
  sent_at TEXT NOT NULL
);
```

**What is NOT stored:**

- Plaintext email addresses (only hashed composites in the email index)
- User names, profiles, or any workspace-specific user data
- Cross-workspace identity assertions ("these emails are the same person")
- Any workspace data, content, or business information

---

## What Changed: Upgrades

### Before

```
Ensemble ships shell v1.3.0
  → Developer runs `ensemble upgrade`
  → Rebuilds Worker
  → Deploys with `wrangler deploy`
  → Per workspace, on the developer's schedule
  → Some forget, version drift accumulates
  → Critical bug? 10,000 separate deploys needed
```

### After

```
Ensemble ships shell v1.3.0
  → Push to R2
  → Invalidate edge cache
  → Every workspace on the planet is running v1.3.0
  → Instantly
  → The developer didn't do anything
  → They didn't even know it happened
```

**The workspace Worker never changes when the shell changes.** It doesn't contain frontend code. There's no build step that includes the shell. The shell is Ensemble's responsibility, deployed by Ensemble, cached at Ensemble's edge.

**Staged rollouts become trivial.** Route 1% of requests to the new shell, monitor, scale to 100%. If something breaks, roll back in seconds. No workspace is harmed.

**Enterprise shell pinning** (paid feature): enterprise workspaces can pin to a specific shell version, preview the next version in a staging environment, and approve upgrades on their schedule. Free tier always gets latest.

---

## What Changed: The Proxy Layer

A new component exists that didn't before: the **Ensemble proxy Worker**. It sits at Cloudflare's edge on every workspace custom domain (via CNAME) and on `*.ensemble.ai` subdomains.

**Responsibilities:**

| Concern | Who Handles It |
|---|---|
| Serving the shell HTML/JS/CSS | Proxy (from R2/KV cache) |
| Session cookie validation | Proxy |
| User context injection (headers) | Proxy |
| CORS headers | Proxy |
| Rate limiting | Proxy |
| Auth callbacks (magic link, SSO, token-login) | Proxy |
| API request proxying | Proxy → Workspace Worker |
| Business logic API responses | Workspace Worker |
| Workspace config (theme, nav, apps) | Workspace Worker |
| App data (CRM records, docs, etc.) | Workspace Worker |

The proxy is thin and generic. It doesn't contain workspace-specific logic. It's the same proxy code for every workspace domain — just pointed at different upstream workspace Workers.

---

## What Changed: The Developer Experience

### Before: "Build a workspace"

1. `npm create ensemble-workspace`
2. Configure workspace (env vars, branding, etc.)
3. Write API handlers AND customize shell components
4. Build (shell + API bundled together)
5. Deploy with `wrangler deploy`
6. Set up DNS (CNAME + TXT)
7. Run bootstrap
8. Monitor for shell upgrades, rerun build + deploy

### After: "Deploy an API"

1. `npm create ensemble-workspace`
2. Configure workspace (env vars: admin email, workspace name)
3. Write API handlers (Hono routes returning JSON)
4. Deploy with `wrangler deploy`
5. Set up DNS (CNAME + TXT)
6. Visit workspace URL → bootstrap screen appears (shell served automatically)
7. Add DNS TXT record for verification
8. Click initialize → magic link → workspace is live
9. Never think about the shell again

**The developer never:**

- Bundles frontend code
- Manages shell dependencies
- Handles auth flows
- Parses cookies or tokens
- Writes session management code
- Deploys shell updates
- Worries about CORS
- Configures cache headers for static assets

They write API handlers. The shell calls those handlers. The proxy handles everything in between.

---

## What Changed: The Workspace Switcher

### Before

The switcher was a component embedded in the shell, which was embedded in the workspace Worker. Its behavior depended on which shell version the workspace was running. Connecting workspaces required the workspace to implement specific auth endpoints.

### After

The switcher is part of the globally-deployed shell. It behaves identically on every workspace because it IS the same code everywhere. It communicates with `app.ensemble.ai` for session state and workspace switching. The workspace Worker doesn't implement any switcher-related endpoints.

**Adding a workspace:**

1. User clicks "+" in switcher
2. Switcher drawer expands
3. User types workspace address (domain or ~address)
4. Shell fetches target workspace's login options
5. User authenticates (magic link or SSO — handled by shell + `app.ensemble.ai`)
6. `app.ensemble.ai` creates workspace link on user's network identity (with merge if needed)
7. Workspace session cookie set via redirect
8. Switcher now shows both workspaces with active sessions
9. On other devices: switcher shows the new workspace on next refresh (as "needs login")

**Switching between workspaces:**

Switching is a two-redirect hop through `app.ensemble.ai`. Sub-second. No login prompt (as long as the workspace session is active on this device).

**Cross-device experience:**

The switcher shows all workspaces linked to the user's network identity, not just the ones authenticated on the current device. Workspaces with active sessions show a green indicator. Workspaces that need authentication on this device show a red/hollow indicator — tapping one initiates a login flow for that workspace.

**Unlinking:**

Each workspace in the switcher has two actions (via long-press or context menu):
- **Log out on this device** — clears the session for that workspace on this device. Other devices unaffected.
- **Unlink from all devices** — removes the workspace from the network identity entirely. Disappears from the switcher everywhere. The user still exists in the workspace and can re-add it anytime.

**The workspace developer implements zero code to enable switching.** If their workspace is DNS-verified and running on Ensemble's proxy layer, switching just works.

---

## What Changed: The Native App

### Before (hypothetical)

The Tauri app would have bundled the shell locally and pointed at workspace APIs. Shell updates would require app store updates.

### After

The Tauri app bundles the shell locally (for instant startup and offline access) BUT can hot-swap the shell from Ensemble's edge on launch. The native layer is minimal and stable:

- Credential storage (OS keychain)
- Biometric auth (Touch ID / Face ID / Windows Hello)
- System tray with workspace badges and unread counts
- Push notifications (APNs / FCM)
- Global hotkey for quick access
- Deep link protocol handler (`ensemble://~acme/app/deals`)
- Local shell cache with edge-sync on startup

**The native layer rarely needs updating** because it doesn't contain business logic or UI logic. It's a thin OS integration bridge. The shell updates come from the edge. The workspace data comes from the API. The native binary is stable — no weekly app store updates.

This is the opposite of the Electron pattern used by Slack, Claude Desktop, and ChatGPT Desktop, where every new feature requires a binary update because the native bridge layer keeps expanding. Ensemble's native layer is deliberately minimal: OS primitives only. Everything else flows through the web shell, updated from the edge.

---

## Deployment Modes: Standalone vs Ensemble Cloud

Ensemble supports two deployment modes. The **same `@ensemble-edge/core` package** powers both — the difference is what sits in front of the workspace Worker.

### Mode 1: Standalone

In Standalone mode, the workspace Worker handles everything: shell serving, authentication, session management, and API routes. There's no dependency on Ensemble infrastructure.

```
STANDALONE MODE
───────────────────
Browser
   │
   ▼
Workspace Worker (customer-deployed)
├── Serves shell (bundled in Worker)
├── Handles auth (magic link, password, OIDC)
├── Manages sessions (JWT cookies)
├── /_ensemble/* API routes
└── D1/KV/R2 (customer's Cloudflare account)
```

**Use Standalone when:**
- You want zero dependency on Ensemble infrastructure
- You're developing locally before connecting to Ensemble Cloud
- You need to run in an air-gapped or regulated environment
- You want full control over the entire stack

**What you handle:**
- Shell updates (redeploy to upgrade)
- Auth configuration (email provider for magic links, OIDC setup)
- Session management (JWT secrets, cookie policies)
- Rate limiting

### Mode 2: Ensemble Cloud

In Ensemble Cloud mode, Ensemble's edge infrastructure handles the shell, auth, and session management. Your workspace Worker is a **pure JSON API** — it receives pre-authenticated requests with user context headers.

```
ENSEMBLE CLOUD MODE
───────────────────
Browser
   │
   ▼
Ensemble Proxy (proxy.ensemble.ai)
├── Serves shell (from R2, globally cached)
├── Validates session cookies
├── Handles auth callbacks
├── Injects X-Ensemble-User headers
   │
   ▼
Workspace Worker (customer-deployed)
├── /_ensemble/* API routes (JSON only)
├── No shell serving
├── No auth handling
└── D1/KV/R2 (customer's Cloudflare account)
```

**Critical: You still deploy a Workspace Worker.** Ensemble Cloud doesn't run your code — it handles the shell and auth layer in front of your code. Your workspace Worker contains:
- Your business logic and app data
- Core apps (People, Brand, Admin, etc.)
- Bundled apps (if any)
- All your D1/KV/R2 data

**Use Ensemble Cloud when:**
- You want instant shell upgrades without redeploying
- You want cross-workspace switching (the switcher)
- You want cross-device workspace discovery (network identity)
- You want managed auth (magic links, SSO) without implementing it
- You're building a workspace that participates in the Ensemble network

**What Ensemble handles:**
- Shell serving and upgrades
- Auth flows (magic link, SSO)
- Session management
- Network identity and workspace switching
- Rate limiting at the edge

### Configuration

A single flag in `ensemble.config.ts` controls the mode:

```typescript
// ensemble.config.ts
import { defineConfig } from '@ensemble-edge/core'

export default defineConfig({
  mode: 'standalone',  // or 'cloud'

  // Required in standalone mode, ignored in cloud mode
  standalone: {
    auth: {
      provider: 'magic-link',  // 'magic-link' | 'password' | 'oidc'
      email: {
        provider: 'resend',
        from: 'auth@myworkspace.com',
      },
    },
    session: {
      secret: process.env.JWT_SECRET,
      lifetime: '7d',
    },
  },

  // Common settings (both modes)
  workspace: {
    name: 'My Workspace',
    slug: 'myworkspace',
  },
})
```

### What the SDK Does

The `@ensemble-edge/core` SDK abstracts the mode difference. Your app code is identical:

```typescript
// This works in BOTH modes
app.get('/_ensemble/apps/crm/deals', (c) => {
  const user = c.get('user')  // Same API regardless of mode
  const deals = await getDeals(user.id)
  return c.json({ deals })
})
```

**In standalone mode**, the SDK:
- Bundles and serves the shell
- Mounts auth routes (`/_ensemble/auth/*`)
- Parses JWT from cookies to populate `c.get('user')`
- Handles session refresh

**In cloud mode**, the SDK:
- Does NOT serve the shell (proxy handles it)
- Does NOT mount auth routes (proxy handles it)
- Reads `X-Ensemble-User` header to populate `c.get('user')`
- Trusts the proxy's session validation

### Switching Modes

**Standalone → Ensemble Cloud:**

1. Change `mode: 'standalone'` to `mode: 'cloud'`
2. Set up DNS: `CNAME hub.acme.com → proxy.ensemble.ai`
3. Add DNS TXT record for verification: `_ensemble TXT ensemble-verify=<token>`
4. Redeploy Worker (shell bundling removed, auth routes removed)
5. Users authenticate via `app.ensemble.ai` magic link
6. Switcher appears, cross-device sync works

**Ensemble Cloud → Standalone:**

1. Change `mode: 'cloud'` to `mode: 'standalone'`
2. Add standalone auth config (email provider, JWT secret)
3. Point DNS directly at Worker (remove CNAME)
4. Redeploy Worker (shell bundled, auth routes added)
5. Users authenticate via workspace's own auth
6. No switcher, no cross-device sync

**User migration note:** Switching modes changes the session system. Existing users will need to re-authenticate. Plan for this in your migration.

### Feature Comparison

| Feature | Standalone | Ensemble Cloud |
|---------|------------|----------------|
| Shell serving | Worker bundles shell | Proxy serves from R2 |
| Shell upgrades | Redeploy to upgrade | Instant, automatic |
| Auth handling | Worker handles | `app.ensemble.ai` handles |
| Magic link | You configure email provider | Ensemble sends emails |
| SSO (SAML/OIDC) | You implement | Ensemble handles (Pro tier) |
| Session management | Worker manages JWT | Proxy manages |
| Workspace switching | ❌ Not available | ✅ Cross-workspace switcher |
| Cross-device sync | ❌ Not available | ✅ Network identity |
| Rate limiting | You implement | Edge + your implementation |
| Your data location | Your Cloudflare account | Your Cloudflare account |
| Your code location | Your Worker | Your Worker |

### Guest Apps Work in Both Modes

Guest apps connect to your workspace through the API gateway, regardless of mode:

```
                    [Proxy or Worker]
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
    Workspace        Guest App      Guest App
    Worker           Worker         (Vercel)
    (core +          (@acme/crm)    (external)
     bundled)
```

Guest apps:
- Authenticate via capability tokens (issued by your workspace)
- Can be Cloudflare Workers, Vercel functions, or any HTTP endpoint
- Work identically in standalone and Ensemble Cloud modes

---

## What Changed: The Business Model

### Before

The shell was open source, bundled in the workspace. Monetization was unclear — hosting? Support? Enterprise features bolted onto a self-contained system?

### After

The shell is the distribution surface. `app.ensemble.ai` is the service layer. Two deployment modes, multiple pricing tiers:

| Mode | Tier | What You Get |
|------|------|--------------|
| **Standalone** | Free (MIT) | Self-host everything. Run your own shell, your own auth. No Ensemble dependency. |
| **Ensemble Cloud** | Free | Shell from edge, magic link auth via `app.ensemble.ai`, cross-workspace switching, network identity. |
| **Ensemble Cloud** | Pro (paid/workspace) | SSO (SAML/OIDC), MFA enforcement, custom email domain, session policies, shell version pinning. |
| **Ensemble Cloud** | Enterprise (paid/org) | SCIM provisioning, cross-workspace admin console, compliance exports, SLA, SOC2 attestation. |

**In both modes, you deploy your own Workspace Worker.** Ensemble Cloud is not "hosted Ensemble" — it's managed shell + auth in front of your self-deployed Worker. Your code and data stay in your Cloudflare account.

SSO and enterprise auth features are configured through the workspace admin UI (a core app in the shell) and stored at `app.ensemble.ai`. The workspace developer doesn't implement SSO. They don't even know SSO is enabled. The proxy and `app.ensemble.ai` handle it entirely. The workspace Worker still just receives authenticated API calls with headers.

---

## What Changed: The Security Story

### Before

Security was distributed. Each workspace managed its own auth, its own session handling, its own token validation. A vulnerability in the auth component required every workspace to upgrade.

### After

Security is centralized at the proxy and `app.ensemble.ai`:

- **Auth vulnerabilities:** Patched once at the edge, effective immediately for every workspace.
- **Shell vulnerabilities:** Same — push to R2, cache invalidate, done.
- **Session management:** Owned by the proxy. Workspace Workers never touch credentials.
- **Token signing:** Ed25519 keys managed by `app.ensemble.ai`. Workspace Workers only verify signatures using a public key.
- **No plaintext emails:** `app.ensemble.ai` stores only hashed composite keys (`sha256(domain + email)`) for identity discovery. Emails are used transiently during magic link delivery and discarded. If the identity database is compromised, the attacker sees opaque hashes, workspace domains, and display names — never email addresses.
- **Device-locked magic links:** Magic links are cryptographically bound to the device and browser session that initiated them. Cannot be forwarded, intercepted, or used on a different device.
- **SOC2 scope:** Covers the shell, the proxy, and `app.ensemble.ai`. The workspace Worker is the customer's code — out of scope, just like AWS Lambda functions are out of scope for AWS's SOC2.

The enterprise sales conversation becomes: "Your data lives in your workspace Worker. We handle auth, SSO, the UI, session management, and audit logging. Here's our SOC2 report. Your team writes API endpoints."

### Rate Limiting

`app.ensemble.ai` enforces rate limits on magic link requests to prevent abuse:

| Scope | Limit | Window |
|-------|-------|--------|
| Per IP | 5 requests | per minute |
| Per IP | 20 requests | per hour |
| Per IP | 50 requests | per day |
| Per email (hashed) | 3 requests | per 10 minutes |
| Per email (hashed) | 10 requests | per hour |
| Per workspace domain | 1000 requests | per day |

Workspaces should implement their own rate limiting as a best practice — the central limits are a backstop, not the only defense.

### Token Lifetimes

| Token | Lifetime | Purpose |
|-------|----------|---------|
| Magic link | 15 minutes | Email verification — single-use, device-locked |
| Switch JWT | 30 seconds | Workspace-to-workspace switching — very short-lived |
| Central session cookie | 30 days | `app.ensemble.ai` session persistence |
| Workspace session | Workspace-controlled | Each workspace sets its own policy |

---

## What's New: Three-Tier Rendering Model

The edge-served shell introduces a rendering architecture where workspace APIs send data and configuration, and the shell merges it with a shared component library to produce the UI. The workspace never sends HTML or components — it sends intent, and the shell interprets it.

Think of it like a game engine. Unity doesn't download 3D models AND the renderer from each game. The renderer is Unity. The game sends assets and scene descriptions. Unity renders them. The Ensemble shell is the renderer. The workspace API sends the scene description.

### Tier 1: Data Descriptors (Zero Frontend Code)

The workspace API returns a JSON view descriptor. The shell's built-in component library renders everything — tables, forms, detail views, kanban boards, timelines. The developer writes zero frontend code.

**Example — the workspace API returns:**

```json
{
  "view": "table",
  "title": "Active Deals",
  "columns": [
    { "key": "name", "label": "Deal Name", "type": "text" },
    { "key": "value", "label": "Value", "type": "currency", "currency": "USD" },
    { "key": "stage", "label": "Stage", "type": "badge", "colorMap": {
      "Discovery": "blue", "Proposal": "amber", "Closing": "green"
    }},
    { "key": "owner", "label": "Owner", "type": "avatar" }
  ],
  "rows": [ ... ],
  "actions": [
    { "id": "add", "label": "New Deal", "icon": "plus", "action": "navigate", "to": "/app/crm/deals/new" }
  ]
}
```

The shell has `<DataTable>`, `<Badge>`, `<Avatar>`, `<CurrencyDisplay>` components. It stitches them together from the descriptor and renders a rich, interactive, themed table with sorting, filtering, and row actions — all built-in behaviors that every workspace gets for free.

**What the developer gets for free:** theming, accessibility, responsive behavior, keyboard navigation, shell upgrades that improve every view automatically. When Ensemble adds inline editing to `<DataTable>`, every workspace using data descriptors gets it instantly.

**Covers ~80% of use cases.** Navigation, settings panels, data tables, detail views, forms, dashboards — all expressible as data descriptors.

### Tier 2: Shell Component Library (Custom Preact Components)

For apps that need custom layouts or interactions the descriptor system doesn't cover, the developer writes Preact components using `@ensemble-edge/ui` — the shell's component library.

```javascript
import { useTheme, Button, Card, DataGrid } from '@ensemble-edge/ui'

export function DealPipeline({ deals }) {
  const theme = useTheme()
  return (
    <div className="flex gap-4">
      {stages.map(stage => (
        <Card key={stage}>
          {/* Custom layout, but shared themed components */}
        </Card>
      ))}
    </div>
  )
}
```

The guest app imports the shell's components and builds custom layouts with shared primitives. It inherits theme, accessibility, and visual consistency for free. It just arranges the pieces differently.

**Covers ~15% of use cases.** Custom dashboards, specialized data visualizations, workflow builders — anything that needs a bespoke layout but can still use the shared component vocabulary.

### Tier 3: Sandboxed Iframe Embed (Full Custom UI)

For apps that need complete control — a canvas-based diagram editor, a third-party embed, a legacy web app, something the component library can't express — the shell renders a sandboxed iframe in the viewport.

**Descriptor:**

```json
{
  "view": "iframe",
  "src": "https://hub.acme.com/_ensemble/apps/designer/embed",
  "title": "Pipeline Designer",
  "height": "full",
  "sandbox": ["allow-scripts", "allow-forms"],
  "context": true
}
```

The `context: true` flag tells the shell to pass workspace context into the iframe — user info, theme tokens, permissions — via `postMessage`. The iframe app can adopt the workspace theme or ignore it entirely.

**Covers ~5% of use cases.** Complex custom editors, third-party embeds (Figma, Loom, Stripe), legacy apps that need a viewport without rewriting.

### Theme Cascading into Embeds

Theme tokens cascade into iframe embeds by default (opt-in by the descriptor's `context: true` flag, which is the default for Ensemble-native apps).

**Two mechanisms ensure the iframe can theme itself before first paint:**

1. **Query parameter on iframe src.** The shell appends base64-encoded theme tokens to the iframe URL so the iframe can apply the theme on initial load without waiting for a message:

```
https://hub.acme.com/_ensemble/apps/designer/embed?theme=eyJjYW52YXMiOi...
```

2. **`postMessage` on load and on change.** The shell sends the full theme token set immediately after the iframe loads, and sends updates whenever the theme changes (dark mode toggle, admin changes accent color, etc.):

```javascript
// Shell → iframe
iframe.contentWindow.postMessage({
  type: 'ensemble:context',
  theme: {
    canvas: '#FAF7F2',
    card: '#1C1917',
    accent: '#E85D3A',
    text: '#1C1917',
    textMuted: '#78716C',
    border: '#E7E5E4',
    radius: '8px',
    fontFamily: 'Inter, system-ui, sans-serif'
    // ... full token set
  },
  user: { id: 'usr_482', name: 'Horacio', roles: ['admin'] },
  workspace: { name: 'AcmeCorp', domain: 'hub.acme.com' }
}, '*')
```

**Three levels of buy-in for iframe developers:**

**SDK (automatic).** If the iframe app uses `@ensemble-edge/guest`, theming is one line:

```javascript
import { useWorkspaceTheme } from '@ensemble-edge/guest'

function MyApp() {
  const theme = useWorkspaceTheme()
  // CSS variables injected into :root automatically
  // Updates reactively on theme changes
  return <div>Themed automatically</div>
}
```

**CSS variables (manual).** Without the SDK, the iframe app listens for the `postMessage` and sets CSS custom properties on `:root`. Any element styled with `var(--ensemble-accent)` just works.

**Ignore it.** Third-party embeds (Figma, Loom, etc.) set `context: false` in the descriptor and render their own UI untouched.

### Iframe ↔ Shell Communication

The iframe communicates with the shell via a structured `postMessage` protocol. The iframe can request actions from the shell without owning the chrome:

```javascript
// Iframe → Shell: navigate to a route
window.parent.postMessage({
  type: 'ensemble:navigate',
  to: '/app/crm/deals/deal_123'
}, '*')

// Iframe → Shell: show a notification
window.parent.postMessage({
  type: 'ensemble:notify',
  message: 'Deal saved successfully',
  level: 'success'
}, '*')

// Iframe → Shell: open a panel app
window.parent.postMessage({
  type: 'ensemble:panel',
  app: 'ai-assistant',
  context: { dealId: 'deal_123' }
}, '*')
```

The shell stays in control of navigation, auth, notifications, and the overall experience. The iframe participates in the workspace through a well-defined message protocol.

**Security model:** The iframe sandbox is strict. It cannot access the parent DOM, cannot read cookies from the workspace domain, cannot execute scripts outside its sandbox. The only communication is structured `postMessage`. If a guest app goes rogue, it's contained.

### The Rendering Pipeline

```
Shell boots (cached from edge, instant)
  │
  ├── GET /_ensemble/workspace → theme + nav + app registry
  │     Shell applies theme (CSS variables)
  │     Shell renders sidebar (built-in NavSidebar component)
  │     Shell renders toolbar (built-in Toolbar component)
  │
  ├── User clicks "Deals" in sidebar
  │     Shell resolves: Deals → guest app "crm" → route /deals
  │
  ├── GET /_ensemble/apps/crm/deals → response includes view descriptor
  │
  ├── Shell inspects "view" field and renders accordingly:
  │     ├── "table" → Tier 1: DataTable component with returned data
  │     ├── "custom" → Tier 2: Load guest app's Preact component
  │     └── "iframe" → Tier 3: Render sandboxed iframe, pass context
  │
  ├── User interacts with the view
  │     Shell handles navigation, notifications, panel actions
  │     Guest app (any tier) calls workspace API for mutations
  │
  └── Real-time updates via WebSocket (Durable Object)
        Shell receives push → updates component state → UI refreshes
        Iframe apps receive updates via postMessage bridge
```

### Why Three Tiers

The component library is the product moat. The richer it gets, the more a workspace developer can express with pure data descriptors, the less reason anyone has to write custom UI, the more consistent the experience across the network. A workspace that describes its UI as data gets free upgrades forever.

But without Tier 3 (iframes), advanced users hit a wall. The iframe is the escape hatch that means nobody ever has a reason to leave. And it opens the door to a third-party app marketplace — someone builds a Kanban component, a Gantt chart, a diagram editor, ships it as an iframe app, and any workspace can install it. The shell handles permissions and the iframe handles rendering.

---

## What Happens If `app.ensemble.ai` Is Down?

The architecture is designed so that `app.ensemble.ai` is not a single point of failure for authenticated users. Here's the degradation model:

| Capability | Status When `app.ensemble.ai` Is Down | Why |
|------------|---------------------------------------|-----|
| **Shell boot** | ✅ Works | Shell is cached in R2/KV at the edge. No dependency on `app.ensemble.ai` for static assets. |
| **Workspace API calls** | ✅ Works | Proxy validates JWT locally using a cached public key. No runtime call to `app.ensemble.ai` for authenticated requests. |
| **Switcher display** | ⚠️ Stale data | Switcher shows last-known workspace list from local cache. May not reflect recent additions/removals. Graceful error if cache is empty. |
| **Switching workspaces** | ❌ Fails | Switching requires `app.ensemble.ai` to issue a short-lived JWT for the target workspace. User sees "Switching unavailable" message. |
| **Login (magic link)** | ❌ Fails | Magic link generation and verification depend on `app.ensemble.ai`. User sees "Login temporarily unavailable" message. |
| **Login (SSO)** | ❌ Fails | SSO broker runs on `app.ensemble.ai`. IdP redirect fails. |

**The acceptable failure mode:** Already-authenticated users can keep working in their current workspace indefinitely. They can't log in on a new device or switch workspaces until `app.ensemble.ai` recovers. This is similar to how Slack behaves — if Slack's auth service is down, you can't log in, but open sessions continue working.

**Mitigation strategies:**

1. **Edge caching of session validation.** The proxy caches JWT public keys aggressively. Token validation never hits `app.ensemble.ai` in the hot path.

2. **Switcher state caching.** The shell caches the workspace list in `localStorage`. Even if `app.ensemble.ai` is unreachable, the switcher renders from cache (with a subtle "offline" indicator).

3. **Multi-region deployment.** `app.ensemble.ai` runs on Cloudflare Workers with automatic failover. True global outage is rare.

4. **Graceful degradation UI.** The shell detects `app.ensemble.ai` unavailability and shows clear, non-alarming messages: "Workspace switching is temporarily unavailable. You can continue working here."

**What we explicitly avoid:** Making `app.ensemble.ai` a dependency for every API call. The proxy handles auth validation locally. The workspace Worker never calls `app.ensemble.ai`. The only runtime dependencies are login and switching — both acceptable to degrade.

---

## What Didn't Change

- **The API contract.** `/_ensemble/*` routes, the workspace config schema, the JWT format, the guest app protocol — all unchanged. This is the stable surface that workspace developers build against.
- **The guest app model.** Guest apps are still separate Workers (or remote services) called via service binding or HTTP proxy through the API gateway. They still use `@ensemble-edge/guest` SDK. They still render in the shell's viewport.
- **Everything is an app.** Core apps, bundled apps, guest apps — same manifest, same permissions, same API architecture. Core apps ship as `@ensemble-edge/core` SDK inside the developer's Worker, with direct access to the workspace's Cloudflare bindings (D1, KV, R2). All workspace data — user records, brand config, permissions, knowledge graph, business data — lives in the developer's infrastructure. `app.ensemble.ai` stores only auth sessions, hashed identity indexes, and workspace display metadata.
- **The Company Knowledge Graph.** Still D1, still workspace-local, still queryable by apps and agents.
- **Edge-native.** Still Cloudflare Workers, D1, KV, R2, Durable Objects, Queues all the way down.

---

## The One-Sentence Version

**The workspace is an API. The shell is Ensemble's. Auth is Ensemble's. Identity is automatic and cross-device. Upgrades are instant. No plaintext emails stored. The developer writes business logic and deploys a Worker. Everything else is handled.**

---

## DNS Setup (Complete)

For a workspace on a custom domain, the entire infrastructure setup is:

```
hub.acme.com      CNAME   proxy.ensemble.ai
_ensemble          TXT     ensemble-verify=<token>
```

Two DNS records. Then deploy your API Worker, point it at the proxy, visit the URL, initialize. Live workspace with auth, switching, theming, and the full shell.

For workspaces on `*.ensemble.ai` subdomains, DNS is automatic — no setup required.

---

## Architecture Diagram (After)

```
                    CLIENTS
    ┌──────────────────────────────────────────┐
    │                                          │
    │  Browser           Tauri App             │
    │  (hub.acme.com)    (bundled shell        │
    │                     + edge sync)         │
    │                                          │
    └──────────┬──────────────────┬────────────┘
               │                  │
               ▼                  ▼
         ENSEMBLE EDGE LAYER (Cloudflare)
    ┌──────────────────────────────────────────┐
    │                                          │
    │  Proxy Worker (on every workspace domain)│
    │  ┌────────────────────────────────────┐  │
    │  │ • Serve shell (R2/KV cached)       │  │
    │  │ • Validate session cookies         │  │
    │  │ • Inject user context headers      │  │
    │  │ • Handle auth callbacks            │  │
    │  │ • Proxy /_ensemble/* to workspace  │  │
    │  └────────────────────────────────────┘  │
    │                                          │
    │  app.ensemble.ai                         │
    │  ┌────────────────────────────────────┐  │
    │  │ • Magic link service               │  │
    │  │ • Network identity (create/merge)  │  │
    │  │ • Session multiplexer              │  │
    │  │ • Cross-device workspace discovery │  │
    │  │ • DNS verification                 │  │
    │  │ • SSO broker (Pro/Enterprise)      │  │
    │  │ • JWT signing                      │  │
    │  │ • Workspace registry               │  │
    │  │ • No plaintext emails stored       │  │
    │  └────────────────────────────────────┘  │
    │                                          │
    │  Shell Bundle (R2)                       │
    │  ┌────────────────────────────────────┐  │
    │  │ • Preact SPA                       │  │
    │  │ • Sidebar, toolbar, viewport       │  │
    │  │ • Theme engine                     │  │
    │  │ • Switcher                         │  │
    │  │ • Login UI                         │  │
    │  │ • Versioned, globally cached       │  │
    │  └────────────────────────────────────┘  │
    │                                          │
    └──────────┬───────────────────────────────┘
               │
               │  Authenticated API calls
               │  (with X-Ensemble-User headers)
               │
               ▼
         WORKSPACE WORKERS (Customer-deployed)
    ┌──────────────────────────────────────────┐
    │                                          │
    │  hub.acme.com Worker                     │
    │  ┌────────────────────────────────────┐  │
    │  │ • /_ensemble/workspace (config)    │  │
    │  │ • /_ensemble/apps/crm/* (data)     │  │
    │  │ • /_ensemble/apps/docs/* (data)    │  │
    │  │ • Pure JSON API                    │  │
    │  │ • No auth logic                    │  │
    │  │ • No frontend code                 │  │
    │  │ • No shell dependencies            │  │
    │  └────────────────────────────────────┘  │
    │                                          │
    │  Cloudflare Bindings                     │
    │  D1 │ KV │ R2 │ DO │ Queues │ AI        │
    │                                          │
    └──────────────────────────────────────────┘
```