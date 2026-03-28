## 9. The Workspace Model

### Workspace = Tenant

A **workspace** is the fundamental organizational unit. It has:

- A unique slug (e.g., `acme`, `ownly`, `higher-order`)
- A tilde address (`~acme`, `~ownly`) — the human-friendly workspace identifier
- Brand configuration (managed by the Brand Manager core app)
- A set of enabled core/bundled apps + installed guest apps
- A set of members with roles (managed by People & Teams core app)
- Permission policies (managed by Auth & Security core app)
- A Company Knowledge Graph (managed by Knowledge Editor core app)
- Optional custom domain (e.g., `hub.acme.com`)
- Agent access configuration (managed by People & Teams core app)

### Workspace Types

| Type | Description | Default Apps | Example |
|---|---|---|---|
| **Organization** | A company's primary workspace | All core + most bundled | Ownly Group's internal hub |
| **Project** | A scoped workspace for a specific initiative | Core + dashboard + files | Santo Domingo development data room |
| **Client Portal** | Customer-facing workspace with restricted apps | Core (admin-only) + select guest apps | Borrower tracking portal |
| **Community** | Public or semi-public workspace | Core + bundled + public guest apps | OSS project hub |

### Workspace Templates

When creating a new workspace, the admin chooses a template that pre-configures which bundled apps are enabled:

```typescript
const WORKSPACE_TEMPLATES = {
  'organization': {
    type: 'organization',
    bundledApps: {
      'bundled:dashboard': true,
      'bundled:ai-assistant': true,
      'bundled:files': true,
      'bundled:notifications': true,
      'bundled:activity': true,
    },
    defaultRole: 'member',
  },
  'data-room': {
    type: 'project',
    bundledApps: {
      'bundled:dashboard': false,
      'bundled:ai-assistant': false,
      'bundled:files': true,        // the main feature
      'bundled:notifications': true,
      'bundled:activity': true,
    },
    defaultRole: 'viewer',
  },
  'client-portal': {
    type: 'portal',
    bundledApps: {
      'bundled:dashboard': true,
      'bundled:ai-assistant': false,
      'bundled:files': false,
      'bundled:notifications': true,
      'bundled:activity': false,
    },
    defaultRole: 'guest',
  },
}
```

### Workspace Resolution

Every request hits the Worker. The workspace is resolved via:

1. **Tilde address** → `~acme` → resolved via Ensemble Directory or local cache → workspace `acme`
2. **Custom domain** → `hub.acme.com` → workspace `acme`
3. **Subdomain** → `acme.ensemble.ai` → workspace `acme`
4. **Path prefix** → `app.ensemble.ai/w/acme` → workspace `acme`

```typescript
import { createMiddleware } from 'hono/factory'

export const workspaceResolver = createMiddleware(async (c, next) => {
  const host = c.req.header('host') ?? ''
  const path = c.req.path

  let slug: string | null = null

  // 1. Custom domain lookup (cached in KV)
  slug = await resolveCustomDomain(host, c.env)

  // 2. Subdomain
  if (!slug) {
    const sub = host.split('.')[0]
    if (sub !== 'app' && sub !== 'www' && sub !== 'api') slug = sub
  }

  // 3. Path prefix
  if (!slug) {
    const match = path.match(/^\/w\/([a-z0-9-]+)/)
    if (match) slug = match[1]
  }

  if (!slug) return c.redirect('/select-workspace')

  const workspace = await getWorkspace(slug, c.env)
  if (!workspace) return c.notFound()

  c.set('workspace', workspace)
  await next()
})
```

---

## 10. The Workspace Address System

### The Problem with URLs

URLs are the addressing system of the web, but they're ugly, forgettable, and feel like plumbing:

```
https://ownly.ensemble.ai
https://app.ensemble.ai/w/ownly
https://hub.ownly.com
```

Nobody wants to tell a colleague "go to h-t-t-p-s colon slash slash ownly dot ensemble dot ai." That's not the future. That's not fun. That's not a product people love.

### The Tilde (`~`) Address

Ensemble workspaces use the **tilde** (`~`) as their address sigil. It's inspired by the Unix home directory (`~` = home), but repurposed for a new era:

```
~ownly
~circuit
~ho-capital
~ownly-portal
```

The tilde means "this is an Ensemble workspace." It's:

- **Short** — 1 character prefix + the workspace slug
- **Speakable** — "join me on tilde ownly" / "connect to tilde circuit"
- **Typeable** — In the Ensemble app, you just type `~ownly` in the connect field
- **Distinctive** — No other product uses tilde as an address sigil
- **Memorable** — People remember words, not URLs
- **Universal** — Works for self-hosted and cloud instances

### How Tilde Addresses Resolve

```
User types: ~ownly
             │
             ▼
┌─ Resolution Order ──────────────────────────────────────┐
│                                                          │
│  1. LOCAL CACHE                                          │
│     The app checks: have I connected to ~ownly before?   │
│     If yes → stored endpoint URL is used directly        │
│     (e.g., https://ownly.ensemble.ai or https://hub.ownly.com)│
│                                                          │
│  2. ENSEMBLE DIRECTORY (cloud)                           │
│     If not cached, query ensemble.ai's directory:        │
│     GET https://dir.ensemble.ai/resolve/~ownly           │
│     → { "endpoint": "https://ownly.ensemble.ai",            │
│         "name": "Ownly Group",                           │
│         "logo": "https://...",                            │
│         "type": "organization" }                         │
│                                                          │
│  3. SELF-HOSTED FALLBACK                                 │
│     If not in the cloud directory, the user can manually │
│     enter the full URL as a fallback                     │
│     (for air-gapped / private deployments)               │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### The Ensemble Directory

The directory at `dir.ensemble.ai` is a lightweight registry that maps tilde addresses to workspace endpoints. It's not a hosting platform — it's a DNS-like lookup service.

**Registration:**

When you deploy an AIUX workspace (self-hosted or cloud), you can optionally register your tilde address with the Ensemble Directory:

```bash
# Via CLI
ensemble register ~ownly --endpoint https://ownly.ensemble.ai

# Or via the Workspace Admin core app (Settings → Ensemble Directory)
```

Registration works like publishing an npm package:
- A valid workspace endpoint that responds to the AIUX discovery protocol
- Verification of ownership (DNS TXT record or endpoint verification)
- The tilde slug must be unique in the directory
- Once registered, the workspace is discoverable by anyone with the Ensemble app
- Workspaces can always fall back to direct URL access
- Direct URL access can be toggled on or off per workspace (default: on)

**For Cloud workspaces:** Registration is automatic. You create a workspace on ensemble.ai, you get `~your-slug` immediately.

**For self-hosted workspaces:** Registration is optional but recommended. You can use tilde addresses within your own app (locally cached after first connection) without registering in the directory. Direct URL access (`https://hub.ownly.com`) is always available as a fallback, and workspace admins can toggle whether the direct URL is publicly accessible or restricted to the tilde address / invite flow only.

### Address Variations

| Format | Context | Example |
|---|---|---|
| **`~slug`** | The primary address. Used in the app. | `~ownly` |
| **`~slug/app/path`** | Deep link to a specific app and page | `~ownly/app/crm/contacts/123` |
| **`ensemble://~slug`** | Protocol handler for deep links from web/other apps | `ensemble://~ownly/app/dashboard` |
| **`slug.ensemble.ai`** | Web URL (for Cloud workspaces) | `ownly.ensemble.ai` |
| **`custom.domain`** | Custom domain (any workspace) | `hub.ownly.com` |
| **QR Code** | Encodes `ensemble://~slug` | Scan to connect |
| **Invite Code** | Short code for one-time join | `~ownly/join/ABC123` |

### How It Feels in Practice

**Scenario 1: H.O. adds a new workspace**

```
1. Opens Ensemble macOS app
2. Clicks [+] in workspace switcher
3. Types: ~circuit
4. App resolves → Circuit Holdings workspace appears
5. H.O. is already a member (via @maycotte identity)
6. Circuit Holdings appears in the workspace switcher
7. Done. 2 seconds.
```

**Scenario 2: Tucker invites a board member**

```
1. Tucker opens People & Teams → Invite
2. Enters email: boardmember@acme.com
3. Board member receives email:
   "You've been invited to Circuit Holdings on Ensemble"
   [Connect to ~circuit]
4. Board member downloads Ensemble app
5. Opens app, types: ~circuit
6. Creates account (or signs in if they have @handle)
7. Sees only the data room app
```

**Scenario 3: A borrower checks loan status**

```
1. Borrower receives email from Ownly Capital:
   "Track your loan application on Ensemble"
   [Open ~ownly-portal]
2. Clicks link → opens Ensemble app (or web if no app)
3. Signs in via magic link
4. Sees: Loan Tracker app + Document Upload
5. Clean, branded, minimal
```

**Scenario 4: Sharing a workspace verbally**

```
H.O. on a phone call: "Hey, our deal room is on Ensemble.
  The address is tilde ownly-portal. Just download the app
  and type it in."
```

Compare that to: "Go to h-t-t-p-s colon slash slash ownly-portal dot ensemble dot ai." Night and day.

### Tilde Slug Rules

- 3-32 characters
- Lowercase alphanumeric + hyphens
- Must start with a letter
- No consecutive hyphens
- Must be unique in the Ensemble Directory (for registered workspaces)
- Reserved slugs: `admin`, `api`, `app`, `auth`, `cloud`, `dir`, `docs`, `help`, `www`, `ensemble`, etc.

### QR Codes

Every workspace has an auto-generated QR code (displayed in Workspace Admin → Settings):

```
┌──────────────────┐
│  ▄▄▄▄▄ ▄ ▄▄▄▄▄  │
│  █   █ █ █   █  │
│  ▀▀▀▀▀ █ ▀▀▀▀▀  │
│  ▄▄▄ █▄█▄█ ▄▄▄  │
│  ▀▀▀▀▀ █ ▀▀▀▀▀  │
│                  │
│   ~ownly         │
│   Ownly Group    │
└──────────────────┘
```

The QR encodes `ensemble://~ownly`. When scanned:
- If Ensemble app is installed → opens the app, prompts to connect
- If not installed → opens `ensemble.ai/connect/~ownly` in the browser (with app store links)

---

