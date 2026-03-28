# Hello World: First Workspace Deployment

> Getting a real Ensemble Workspace running at `workspace.nendo.ai`

---

## Goal

Deploy the first production Ensemble Workspace — **~nendo** — for Matt Hawkins at HOSS Technologies. This is the internal management system for the Nendo API platform, not the customer-facing SPA (that's `client-hoss-nendo`). This workspace becomes the reference implementation that every future workspace is built from.

By the end of this plan, you'll have:
- A branded Nendo workspace shell running on Cloudflare Workers
- A real guest app (customer manager) calling the existing `iq.ensemble.ai` API
- The full architecture proven: thin workspace Worker + separate guest app Worker + service binding

---

## Target URLs

| URL | Type | Phase |
|-----|------|-------|
| `workspace.nendo.ai` | Custom domain, direct deployment | Phase 1 (this plan) |
| `nendo.ensemble.ai` | Ensemble subdomain | Phase 2 (requires cloud services) |
| `app.ensemble.ai` → `~nendo` | Web app via tilde address | Phase 2 (requires directory service) |

Phase 1 focuses on `workspace.nendo.ai` — a Worker deployed directly to Cloudflare. No cloud services, no tilde resolution, no directory. Just a workspace on a domain.

---

## Prerequisites (Day 0)

Before writing any code, set up the Cloudflare infrastructure:

### Cloudflare Account Setup

- [ ] Cloudflare account with Workers Paid plan ($5/month) — required for D1, R2, service bindings
- [ ] `nendo.ai` domain added to Cloudflare (if not already)

### Create Resources

```bash
# Create D1 database
wrangler d1 create nendo-workspace
# → Note the database_id for wrangler.toml

# Create KV namespace
wrangler kv:namespace create KV
# → Note the id for wrangler.toml

# Create R2 bucket
wrangler r2 bucket create nendo-workspace-assets
```

### Configure Custom Domain

1. In Cloudflare dashboard → Workers & Pages → nendo-workspace
2. Settings → Triggers → Custom Domains
3. Add `workspace.nendo.ai`
4. Cloudflare auto-provisions SSL

### Secrets

```bash
# JWT signing secret (generate a random 256-bit key)
wrangler secret put JWT_SECRET
# → Paste a secure random string (e.g., openssl rand -base64 32)

# Initial admin password (temporary, will be hashed on first seed)
wrangler secret put INITIAL_ADMIN_PASSWORD
# → Paste Matt's initial password
```

### Verify Setup

```bash
# List resources to confirm
wrangler d1 list
wrangler kv:namespace list
wrangler r2 bucket list
```

**Deliverables:**
- [ ] D1 database created, ID noted
- [ ] KV namespace created, ID noted
- [ ] R2 bucket created
- [ ] Custom domain configured with SSL
- [ ] JWT_SECRET set as Worker secret
- [ ] INITIAL_ADMIN_PASSWORD set as Worker secret

---

## Architecture

```
Phase 1 — Direct Deployment
───────────────────────────────────────────────────────────────

Browser → workspace.nendo.ai
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│  Workspace Worker (thin)                                     │
│  @ensemble-edge/core → createWorkspace()                     │
│                                                              │
│  Shell (Preact SPA):                                         │
│    Workspace switcher strip │ Sidebar │ Toolbar │ Viewport   │
│    AI panel placeholder │ Bookmark bar                       │
│                                                              │
│  Core apps (compiled in):                                    │
│    Admin │ Brand │ People │ Auth │ Nav                        │
│                                                              │
│  API gateway:                                                │
│    /_ensemble/* routes + guest app proxy                        │
│                                                              │
│  D1 │ KV │ R2                                                │
└──────────────────────┬──────────────────────────────────────┘
                       │ service binding (0ms)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Customer Manager Guest App (separate Worker)                │
│  @ensemble-edge/guest-cloudflare                             │
│                                                              │
│  Calls iq.ensemble.ai for enrichment data                    │
│  Calls Unkey for key management                              │
│  Renders in workspace viewport                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Step 1: Wire Up the Worker (Day 1-2)

**Goal:** `createWorkspace()` returns a Hono app that serves HTML at `workspace.nendo.ai`

**Files:**

```
client-hoss-nendo-workspace/
├── src/
│   └── worker.ts
├── ensemble.config.ts
├── assets/
│   ├── logo.svg
│   └── favicon.ico
├── wrangler.toml
├── package.json
└── README.md
```

**worker.ts** (~20 lines, rarely changes):

```typescript
import { createWorkspace } from '@ensemble-edge/core'
import config from '../ensemble.config'

const app = createWorkspace({ config })

export default app
```

**ensemble.config.ts:**

```typescript
import { defineConfig } from '@ensemble-edge/core'

export default defineConfig({
  workspace: {
    name: 'Nendo',
    slug: 'nendo',
    type: 'organization',
  },

  brand: {
    accent: '#d85a30',
    base_theme: 'warm',
    name: 'Nendo',
    // logo_mark loaded from R2 or assets/
  },

  locale: {
    base_language: 'en',
    supported_languages: ['en'],
    timezone: 'America/Chicago',
    date_format: 'us',
    number_format: 'us',
  },

  auth: {
    providers: ['email'],
  },

  // External apps that can consume brand tokens via /_ensemble/brand/public
  cors: {
    brand_origins: [
      'https://nendo.com',           // Customer-facing SPA
      'https://app.nendo.com',       // Alternate SPA domain
      'http://localhost:3000',       // Local SPA development
    ],
  },
})
```

**wrangler.toml:**

```toml
name = "nendo-workspace"
main = "src/worker.ts"
compatibility_date = "2026-03-01"

[vars]
ENVIRONMENT = "production"

[[d1_databases]]
binding = "DB"
database_name = "nendo-workspace"
database_id = "..."

[[kv_namespaces]]
binding = "KV"
id = "..."

[[r2_buckets]]
binding = "R2"
bucket_name = "nendo-workspace-assets"

# Guest app service bindings (added in Step 5)
# [services]
# customers = { service = "nendo-customers", environment = "production" }
```

**Deliverables:**
- [ ] Worker serves HTML at `/`
- [ ] Static assets served (logo, favicon)
- [ ] `wrangler dev` works locally
- [ ] Config reads from `ensemble.config.ts`

---

### Step 2: Shell Layout (Day 3-5)

**Goal:** Render the full shell layout with all zones reserved — even if some are empty placeholders.

```
┌────┬──────────┬──────────────────────────────────────┬──────────┐
│    │          │  Breadcrumb          [⌘K Search] [AI]│          │
│    │ [Logo]   ├──────────────────────────────────────┤          │
│    │ Nendo    │                                      │ Ensemble │
│ WS │          │                                      │ AI       │
│ strip│ APPS   │       Welcome to Nendo               │          │
│    │ ◆ Home   │                                      │ (empty   │
│ [N]│          │       Your workspace is ready.       │  panel,  │
│    │ WORKSPACE│                                      │  toggle  │
│    │ ◇ People │                                      │  works)  │
│    │ ◇ Brand  │                                      │          │
│    │ ◇ Settings│                                     │          │
│    │          │                                      │          │
│    │──────────│                                      │          │
│    │ [MH]     │                                      │          │
│    │ @hawkins │                                      │          │
│[+] │          │                                      │          │
├────┴──────────┴──────────────────────────────────────┴──────────┤
│ [Bookmark bar placeholder]                                       │
└──────────────────────────────────────────────────────────────────┘
```

**All 6 zones present from day one:**

| Zone | Width | Day 3-5 state |
|------|-------|---------------|
| Workspace switcher | 52px | Shows [N] for Nendo, [+] button (non-functional) |
| Sidebar | 220px | Logo, workspace name, nav sections with items |
| Toolbar | 44px | Breadcrumb, search trigger (placeholder), AI toggle |
| Viewport | fills | Renders the active app |
| AI panel | 340px | Toggles open/closed, shows "Coming soon" placeholder |
| Bookmark bar | 34px | Empty with [+] button (placeholder) |

**Implementation approach:** Start with server-rendered HTML, then add Preact hydration. The shell HTML is a static template served by the Worker. Preact mounts on the client for interactivity (sidebar clicks, viewport routing, panel toggle). This lets us get something visible fast without building the full SPA upfront.

**Theming:** CSS custom properties injected into `:root` from `brand_tokens` in D1 (or from config as a fallback for the first deploy before D1 is seeded). The shell references these variables everywhere — `var(--brand-accent)`, `var(--shell-sidebar-bg)`, etc.

**Deliverables:**
- [ ] Shell HTML with all 6 zones at correct dimensions
- [ ] CSS custom properties for theming (`--brand-accent`, `--shell-sidebar-bg`, etc.)
- [ ] Sidebar renders with sections (Apps, Workspace) and items
- [ ] Viewport renders a placeholder home screen
- [ ] AI panel toggles open/closed (empty placeholder content)
- [ ] Workspace switcher strip renders (visual only, no switching)
- [ ] Nendo logo and brand colors applied

---

### Step 3: Authentication (Day 6-8)

**Goal:** User can log in and maintain a session. Protected routes redirect to login.

**Auth flow:**
1. User visits `workspace.nendo.ai` → middleware checks for session cookie
2. No session → redirect to `/login` (themed to Nendo brand)
3. User enters email + password → `POST /_ensemble/auth/login`
4. Server validates credentials, generates JWT, sets signed HTTP-only cookie (7-day TTL)
5. Redirect to `/` → shell loads with user context
6. Subsequent requests: middleware validates cookie → injects user into context

**Login page:** A clean, branded login form. Nendo logo at top, email + password fields, submit button in accent color. No signup (admin creates accounts manually for hello world). Styled with workspace theme tokens.

**Deliverables:**
- [ ] Login page at `/login` (themed, responsive)
- [ ] `POST /_ensemble/auth/login` — validate credentials, return JWT in cookie
- [ ] `POST /_ensemble/auth/logout` — clear session
- [ ] `GET /_ensemble/auth/me` — return current user
- [ ] Auth middleware on all `/_ensemble/*` routes (except brand and auth)
- [ ] D1 `users` table seeded with Matt's account
- [ ] D1 `sessions` table for session management
- [ ] JWT signing with Worker secret (never in source)
- [ ] Redirect loop protection (login page doesn't redirect to login)

---

### Step 4: Brand Theming + Navigation API (Day 9-11)

**Goal:** Theme served from D1 via the real `brand_tokens` table. Navigation served from API, role-filtered.

**Brand tokens:** Even though Nendo only needs a few tokens right now, we use the real `brand_tokens` schema from the spec. Seed it with Nendo's values:

```sql
-- Seed Nendo brand tokens
INSERT INTO brand_tokens (workspace_id, category, key, value, type, label) VALUES
('ws_nendo', 'colors', 'accent', '#d85a30', 'color', 'Accent'),
('ws_nendo', 'colors', 'primary', '#2c1810', 'color', 'Primary'),
('ws_nendo', 'colors', 'surface', '#fafaf8', 'color', 'Surface'),
('ws_nendo', 'typography', 'heading_font', 'DM Sans', 'text', 'Heading font'),
('ws_nendo', 'typography', 'body_font', 'DM Sans', 'text', 'Body font'),
('ws_nendo', 'typography', 'mono_font', 'JetBrains Mono', 'text', 'Mono font'),
('ws_nendo', 'identity', 'legal_name', 'HOSS Technologies, LLC', 'text', 'Legal name'),
('ws_nendo', 'identity', 'display_name', 'Nendo', 'text', 'Display name'),
('ws_nendo', 'identity', 'website', 'https://nendo.com', 'text', 'Website'),
('ws_nendo', 'spatial', 'radius', '8px', 'text', 'Border radius');
```

**Navigation:** The `GET /_ensemble/nav` endpoint returns the sidebar config, filtered by role. For hello world, a simple static config:

```json
{
  "sections": [
    {
      "id": "apps",
      "label": "Apps",
      "items": [
        { "id": "home", "label": "Home", "icon": "home", "path": "/app/home" }
      ]
    },
    {
      "id": "workspace",
      "label": "Workspace",
      "visibility": "admin",
      "items": [
        { "id": "people", "label": "People", "icon": "users", "path": "/app/_people" },
        { "id": "brand", "label": "Brand", "icon": "palette", "path": "/app/_brand" },
        { "id": "settings", "label": "Settings", "icon": "settings", "path": "/app/_settings" }
      ]
    }
  ]
}
```

**Deliverables:**
- [ ] `brand_tokens` table created with real schema (category, key, value, type, label, locale, is_stale)
- [ ] Nendo brand tokens seeded
- [ ] `GET /_ensemble/brand/theme` — returns CSS variables from brand_tokens
- [ ] `GET /_ensemble/brand/tokens` — returns full token set as JSON
- [ ] Shell reads theme from API on load, injects into `:root`
- [ ] `GET /_ensemble/nav` — returns sidebar config, role-filtered
- [ ] Sidebar renders from API response (not hardcoded)
- [ ] Client-side navigation: click sidebar item → viewport changes (no full page reload)
- [ ] KV cache for theme (reads from KV, falls back to D1)

---

### Step 5: Deploy to Production (Day 12-14)

**Goal:** Live at `workspace.nendo.ai` with Nendo branding, auth, and the shell.

**Deliverables:**
- [ ] Custom domain `workspace.nendo.ai` configured in Cloudflare
- [ ] SSL certificate active
- [ ] D1 production database created and migrated
- [ ] Brand tokens and admin user seeded in production
- [ ] KV namespace created
- [ ] R2 bucket created with logo and assets
- [ ] Worker deployed via `wrangler deploy`
- [ ] Smoke test: login → see shell → navigate sidebar → log out

**Success criteria — the shell is alive when:**
1. Visit `workspace.nendo.ai` → see Nendo-branded login page
2. Log in with Matt's credentials → see shell with sidebar
3. Sidebar shows Apps section + Workspace section (admin-only)
4. Click "Home" → viewport shows home screen
5. AI panel toggles open/closed (placeholder content)
6. Log out → return to login page
7. Theme matches Nendo brand (coral accent, warm palette, DM Sans)

---

### Step 6: First Guest App — Customer Manager (Day 15-19)

**Goal:** A real guest app running as a separate Worker, connected via service binding, rendering inside the workspace shell with real data from `iq.ensemble.ai`.

This is the architecture proof: the workspace Worker is thin, the guest app is a separate Worker, they communicate via service binding with zero latency, and the guest app renders inside the viewport themed to Nendo's brand.

**What the customer manager does:**
- Lists all Nendo API customers (from Unkey via the existing provisioning API)
- Shows key status, credit balance, tier, last active date
- Drill into a customer: usage history, credit transactions, key management
- Trial review queue: pending trial requests with approve/reject
- Calls `iq.ensemble.ai` for enrichment stats

**Guest app structure:**

```
client-hoss-nendo-workspace/apps/customers/
├── src/
│   └── index.ts               # defineGuestApp() with cloudflareAdapter()
├── manifest.json              # Full manifest with extension points
├── wrangler.toml              # Separate Worker config
├── package.json               # Depends on @ensemble-edge/guest-cloudflare
└── README.md
```

**manifest.json (key parts):**

```json
{
  "id": "nendo-customers",
  "name": "Customers",
  "version": "1.0.0",
  "category": "tool",

  "nav": {
    "label": "Customers",
    "icon": "users",
    "position": "sidebar",
    "children": [
      { "label": "All customers", "path": "/customers" },
      { "label": "Trial queue", "path": "/trials" }
    ]
  },

  "api": {
    "backend": "https://nendo-customers.your-workers.dev",
    "routes": [
      { "method": "GET", "path": "/customers", "description": "List all customers" },
      { "method": "GET", "path": "/customers/:id", "description": "Customer detail" },
      { "method": "GET", "path": "/trials", "description": "Pending trial requests" },
      { "method": "POST", "path": "/trials/:id/approve", "description": "Approve trial" },
      { "method": "POST", "path": "/trials/:id/reject", "description": "Reject trial" }
    ]
  },

  "widgets": [
    {
      "id": "active-keys",
      "name": "Active keys",
      "size": "small",
      "api_route": "GET /widgets/active-keys"
    },
    {
      "id": "trial-queue",
      "name": "Trial queue",
      "size": "small",
      "api_route": "GET /widgets/trial-queue",
      "badge": true
    }
  ],

  "notifications": [
    {
      "event": "trial_request.submitted",
      "display": "New trial request from {customer}",
      "icon": "user-plus",
      "priority": "normal"
    },
    {
      "event": "credits.exhausted",
      "display": "{customer} has run out of credits",
      "icon": "alert-circle",
      "priority": "high"
    }
  ],

  "health": {
    "endpoint": "GET /health",
    "interval": 60,
    "timeout": 5000,
    "display_name": "Customer manager",
    "dependencies": [
      { "name": "iq.ensemble.ai", "endpoint": "https://iq.ensemble.ai/health", "type": "external" },
      { "name": "Unkey", "endpoint": "https://api.unkey.dev/v1/liveness", "type": "external" }
    ]
  },

  "settings": {
    "admin": [
      {
        "group": "API connection",
        "fields": [
          { "key": "iq_tenant_key", "type": "secret", "label": "Ensemble tenant key", "required": true },
          { "key": "unkey_root_key", "type": "secret", "label": "Unkey root key", "required": true }
        ]
      }
    ]
  },

  "ai": {
    "tools": [
      { "name": "list_customers", "description": "List all customers with optional filters", "api_route": "GET /customers" },
      { "name": "approve_trial", "description": "Approve a pending trial", "api_route": "POST /trials/{id}/approve", "requires_confirmation": true }
    ],
    "context_prompt": "Manages Nendo API customers. Customers have API keys, credit balances, and usage history."
  }
}
```

**Connect via service binding:**

```toml
# In client-hoss-nendo-workspace/wrangler.toml
[services]
customers = { service = "nendo-customers", environment = "production" }
```

The workspace gateway detects the service binding and uses it (0ms latency) instead of HTTP.

**Deliverables:**
- [ ] Guest app Worker scaffolded with `@ensemble-edge/guest-cloudflare`
- [ ] Manifest with nav, api, widgets, notifications, health, settings, ai.tools
- [ ] API routes calling `iq.ensemble.ai` and Unkey for real data
- [ ] Guest app deployed as separate Worker
- [ ] Service binding configured in workspace's `wrangler.toml`
- [ ] Gateway proxies `/app/customers/*` to guest app Worker
- [ ] Guest app renders in viewport with Nendo theme tokens
- [ ] Customer list shows real data
- [ ] Trial approve/reject works
- [ ] Health endpoint responds
- [ ] Settings surface in workspace admin (API keys required before activation)

**Success criteria — the architecture works when:**
1. Click "Customers" in sidebar → viewport shows customer list from real Unkey data
2. Click a customer → detail view with usage and credits
3. Click "Trial queue" → pending requests with approve/reject buttons
4. Approve a trial → key provisioned in Unkey, welcome email sent
5. Guest app is a separate Worker (its own `wrangler.toml`, its own deployment)
6. Workspace and guest app talk via service binding (verify in logs: no HTTP round-trip)

---

### Step 7: Tauri macOS App (Day 20-22)

**Goal:** A native macOS app that wraps the workspace in a proper window with OS integration. This proves the native app architecture early, while the shell is still simple.

**Why now?** Building the Tauri wrapper early has advantages:
- The shell is simple, easier to debug WebView issues
- Native notifications can be tested alongside the web version
- Matt gets a menu bar app for quick access
- Proves the "same shell, native wrapper" architecture

**What the Tauri app does (Phase 1):**
- Opens `workspace.nendo.ai` in a WebView
- macOS menu bar with workspace icon
- Native window chrome (traffic lights, title bar)
- Stores session in macOS Keychain (not localStorage)
- Deep link support: `ensemble://nendo/...`

**What it doesn't do yet (Phase 2+):**
- Multi-workspace switcher (connect screen)
- Native push notifications
- Touch ID authentication
- Offline mode

**Project structure:**

```
apps/desktop/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs           # Tauri entry point
│   │   ├── keychain.rs       # macOS Keychain integration
│   │   └── commands.rs       # IPC commands (get_token, set_token)
│   ├── Cargo.toml
│   ├── tauri.conf.json       # App config, permissions, window settings
│   └── icons/
│       └── icon.icns         # macOS app icon
├── src/
│   └── main.ts               # Preload script (bridges web ↔ native)
├── package.json
└── README.md
```

**tauri.conf.json (key parts):**

```json
{
  "productName": "Nendo",
  "identifier": "ai.ensemble.nendo",
  "version": "0.1.0",
  "build": {
    "devUrl": "http://localhost:8787",
    "frontendDist": "../dist"
  },
  "app": {
    "withGlobalTauri": true,
    "windows": [
      {
        "title": "Nendo",
        "width": 1280,
        "height": 800,
        "minWidth": 900,
        "minHeight": 600,
        "url": "https://workspace.nendo.ai",
        "decorations": true,
        "transparent": false
      }
    ],
    "security": {
      "dangerousRemoteDomainIpcAccess": [
        {
          "domain": "workspace.nendo.ai",
          "windows": ["main"],
          "enableTauriAPI": true
        }
      ]
    }
  },
  "bundle": {
    "active": true,
    "targets": ["dmg", "app"],
    "icon": ["icons/icon.icns"],
    "macOS": {
      "minimumSystemVersion": "10.15"
    }
  },
  "plugins": {
    "deep-link": {
      "desktop": {
        "schemes": ["ensemble"]
      }
    }
  }
}
```

**Keychain integration (Rust):**

```rust
// src-tauri/src/keychain.rs
use security_framework::passwords::{get_generic_password, set_generic_password, delete_generic_password};

const SERVICE_NAME: &str = "ai.ensemble.nendo";

#[tauri::command]
pub fn get_token(workspace_slug: &str) -> Result<String, String> {
    let account = format!("token:{}", workspace_slug);
    get_generic_password(SERVICE_NAME, &account)
        .map(|bytes| String::from_utf8_lossy(&bytes).to_string())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_token(workspace_slug: &str, token: &str) -> Result<(), String> {
    let account = format!("token:{}", workspace_slug);
    set_generic_password(SERVICE_NAME, &account, token.as_bytes())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_token(workspace_slug: &str) -> Result<(), String> {
    let account = format!("token:{}", workspace_slug);
    delete_generic_password(SERVICE_NAME, &account)
        .map_err(|e| e.to_string())
}
```

**Web ↔ Native bridge:**

The shell detects if it's running in Tauri and uses native storage instead of cookies:

```typescript
// In the shell's auth module
import { invoke } from '@tauri-apps/api/core'

const isNative = '__TAURI__' in window

export async function getSessionToken(): Promise<string | null> {
  if (isNative) {
    try {
      return await invoke('get_token', { workspaceSlug: 'nendo' })
    } catch {
      return null
    }
  }
  // Fall back to cookie-based auth for web
  return getCookieToken()
}

export async function setSessionToken(token: string): Promise<void> {
  if (isNative) {
    await invoke('set_token', { workspaceSlug: 'nendo', token })
  } else {
    setCookieToken(token)
  }
}
```

**Deliverables:**
- [ ] Tauri project scaffolded with Tauri v2
- [ ] macOS app opens `workspace.nendo.ai` in WebView
- [ ] Native window with traffic lights
- [ ] App icon (Nendo logo)
- [ ] Keychain integration for session storage
- [ ] Shell detects Tauri and uses native token storage
- [ ] Deep link `ensemble://nendo` opens the app
- [ ] DMG built and signed (ad-hoc for now, proper signing later)

**Success criteria — the native app works when:**
1. Open Nendo.app → workspace loads in native window
2. Log in → token stored in macOS Keychain (verify in Keychain Access)
3. Quit and reopen → still logged in (session persisted)
4. Click `ensemble://nendo/app/customers` in browser → opens in native app
5. Native window feels like a real macOS app (proper traffic lights, resize, etc.)

---

## Database Schema (Hello World)

Uses the real spec schema, not a simplified version. Tables empty or minimally seeded at first.

```sql
-- Workspace
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'organization',
  settings_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Users
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  handle TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  locale TEXT DEFAULT 'en',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Memberships
CREATE TABLE memberships (
  user_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, workspace_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

-- Sessions
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Brand tokens (the real schema from the spec)
CREATE TABLE brand_tokens (
  workspace_id TEXT NOT NULL,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  type TEXT NOT NULL,
  label TEXT,
  description TEXT,
  locale TEXT,
  is_stale INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  updated_by TEXT,
  PRIMARY KEY (workspace_id, category, key, COALESCE(locale, ''))
);

-- Brand token custom groups
CREATE TABLE brand_token_groups (
  workspace_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  PRIMARY KEY (workspace_id, slug)
);

-- Installed apps
CREATE TABLE installed_apps (
  workspace_id TEXT NOT NULL,
  app_id TEXT NOT NULL,
  manifest_json TEXT NOT NULL,
  settings_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'active',
  installed_at TEXT DEFAULT (datetime('now')),
  installed_by TEXT,
  PRIMARY KEY (workspace_id, app_id)
);

-- Audit log
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  actor_id TEXT,
  actor_handle TEXT,
  app_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details_json TEXT,
  ip_address TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Nav config
CREATE TABLE nav_config (
  workspace_id TEXT PRIMARY KEY,
  config_json TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now')),
  updated_by TEXT
);
```

---

## API Routes (Hello World)

### Shell routes (no auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Shell HTML (SPA entry point) |
| GET | `/login` | Login page |
| GET | `/assets/*` | Static assets (logo, favicon, CSS, JS) |

### Auth routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/_ensemble/auth/login` | No | Authenticate, set session cookie |
| POST | `/_ensemble/auth/logout` | Yes | Clear session |
| GET | `/_ensemble/auth/me` | Yes | Current user + workspace + role |

### Brand routes (public by default)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/_ensemble/brand/theme` | No | CSS variables from brand_tokens |
| GET | `/_ensemble/brand/tokens` | No | Full token set as JSON with etag |
| GET | `/_ensemble/brand/css` | No | Generated CSS file |
| GET | `/_ensemble/brand/public` | No | Public brand tokens for external apps (CORS-enabled) |

**Cross-origin brand consumption:** The `/_ensemble/brand/public` endpoint is designed for external apps (like the Nendo customer SPA at `nendo.com`) to consume brand tokens. It:
- Returns a subset of tokens: colors, typography, identity, spatial (not internal settings)
- Includes CORS headers for configured external origins
- Cached aggressively (1 hour TTL, stale-while-revalidate)
- Returns CSS custom properties ready to inject

This enables **single-source branding**: change colors in the workspace Brand Manager → both the internal workspace AND the public Nendo SPA update automatically.

### Navigation routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/_ensemble/nav` | Yes | Sidebar config, role-filtered |

### People routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/_ensemble/people` | Yes | Workspace members |
| GET | `/_ensemble/people/:id` | Yes | Single member |
| PATCH | `/_ensemble/people/me` | Yes | Update own profile |

### Admin routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/_ensemble/admin/settings` | Admin | Workspace settings |
| PATCH | `/_ensemble/admin/settings` | Admin | Update settings |
| GET | `/_ensemble/admin/apps` | Admin | Installed apps + status |
| GET | `/_ensemble/admin/apps/:id/settings` | Admin | App admin settings |
| PUT | `/_ensemble/admin/apps/:id/settings` | Admin | Update app admin settings |

### Guest app proxy routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| ALL | `/app/:app_id/*` | Yes | Proxied to guest app via service binding or HTTP |

---

## Seed Data

Seeding requires a script (not raw SQL) because passwords must be hashed. Create `scripts/seed.ts`:

```typescript
// scripts/seed.ts
import { hash } from '@node-rs/argon2'

export async function seed(db: D1Database, initialPassword: string) {
  // Hash the initial password
  const passwordHash = await hash(initialPassword, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  })

  // Create workspace
  await db.exec(`
    INSERT INTO workspaces (id, slug, name, type) VALUES
    ('ws_nendo', 'nendo', 'Nendo', 'organization');
  `)

  // Create admin users with hashed password
  await db.prepare(`
    INSERT INTO users (id, email, password_hash, handle, display_name) VALUES
    ('user_matt', 'matt@hoss.com', ?, 'hawkins', 'Matt Hawkins')
  `).bind(passwordHash).run()

  await db.prepare(`
    INSERT INTO users (id, email, password_hash, handle, display_name) VALUES
    ('user_ho', 'ho@ownly.com', ?, 'ho', 'H.O. Maycotte')
  `).bind(passwordHash).run()

  // Create memberships
  await db.exec(`
    INSERT INTO memberships (user_id, workspace_id, role) VALUES
    ('user_matt', 'ws_nendo', 'owner'),
    ('user_ho', 'ws_nendo', 'admin');
  `)

  // Seed brand tokens (see Step 4 for full set)
  await db.exec(`
    INSERT INTO brand_tokens (workspace_id, category, key, value, type, label) VALUES
    ('ws_nendo', 'colors', 'accent', '#d85a30', 'color', 'Accent'),
    ('ws_nendo', 'colors', 'primary', '#2c1810', 'color', 'Primary'),
    ('ws_nendo', 'colors', 'surface', '#fafaf8', 'color', 'Surface'),
    ('ws_nendo', 'typography', 'heading_font', 'DM Sans', 'text', 'Heading font'),
    ('ws_nendo', 'typography', 'body_font', 'DM Sans', 'text', 'Body font'),
    ('ws_nendo', 'typography', 'mono_font', 'JetBrains Mono', 'text', 'Mono font'),
    ('ws_nendo', 'identity', 'legal_name', 'HOSS Technologies, LLC', 'text', 'Legal name'),
    ('ws_nendo', 'identity', 'display_name', 'Nendo', 'text', 'Display name'),
    ('ws_nendo', 'identity', 'website', 'https://nendo.com', 'text', 'Website'),
    ('ws_nendo', 'spatial', 'radius', '8px', 'text', 'Border radius');
  `)

  // Seed nav config
  await db.prepare(`
    INSERT INTO nav_config (workspace_id, config_json) VALUES (?, ?)
  `).bind('ws_nendo', JSON.stringify({
    sections: [
      {
        id: 'apps',
        label: 'Apps',
        items: [
          { id: 'home', label: 'Home', icon: 'home', path: '/app/home' }
        ]
      },
      {
        id: 'workspace',
        label: 'Workspace',
        visibility: 'admin',
        items: [
          { id: 'people', label: 'People', icon: 'users', path: '/app/_people' },
          { id: 'brand', label: 'Brand', icon: 'palette', path: '/app/_brand' },
          { id: 'settings', label: 'Settings', icon: 'settings', path: '/app/_settings' }
        ]
      }
    ]
  })).run()

  console.log('✓ Seed complete')
}
```

Run the seed script:

```bash
# Local development
wrangler d1 execute nendo-workspace --local --file=./db/schema.sql
bun run scripts/seed.ts --local

# Production (uses INITIAL_ADMIN_PASSWORD secret)
wrangler d1 execute nendo-workspace --file=./db/schema.sql
wrangler d1 execute nendo-workspace --command="SELECT 1" # verify connection
# Seed runs automatically on first deploy if tables are empty
```

**Important:** After seeding, users should change their passwords via the profile page. The `INITIAL_ADMIN_PASSWORD` secret can be removed after first login.

---

## Timeline Summary

| Days | Step | Outcome |
|------|------|---------|
| 0 | Prerequisites | Cloudflare resources created, secrets configured |
| 1-2 | Wire up the Worker | `createWorkspace()` serves HTML, local dev works |
| 3-5 | Shell layout | All 6 zones rendered, themed, sidebar clickable |
| 6-8 | Authentication | Login, sessions, protected routes, JWT |
| 9-11 | Brand + navigation | Tokens from D1, theme via API, nav role-filtered |
| 12-14 | Deploy to production | Live at `workspace.nendo.ai`, smoke tested |
| 15-19 | First guest app | Customer manager with real data, service binding proven |
| 20-22 | Tauri macOS app | Native wrapper with Keychain, deep links |

**Total: ~22 working days to a production workspace with a guest app and native macOS app.**

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Shell too complex for day 3-5 | Server-rendered HTML first, Preact hydration incremental |
| Auth edge cases | Use `jose` library for JWT, simple email/password first, magic link later |
| D1 schema too ambitious | Use the real schema but seed minimally — empty tables are fine |
| Guest app integration complex | Build the guest app API routes first (test with curl), then wire up the UI |
| Service binding issues | HTTP proxy fallback already in the gateway — if binding fails, fall back gracefully |
| Theme/CSS complexity | Start with 10 core variables, expand as needed |

---

## What Comes After Hello World

| Phase | What | When |
|-------|------|------|
| Phase 1.5 | Usage analytics guest app (charts, reconciliation) | Week 5 |
| Phase 1.5 | Multi-workspace connect screen (native app) | Week 5 |
| Phase 2 | AI panel (Workers AI, tool calling, action cards) | Week 6-7 |
| Phase 2 | Magic link auth (replace password flow) | Week 6 |
| Phase 2 | Command palette (⌘K, federated search) | Week 7 |
| Phase 2 | Dashboard with widgets from guest apps | Week 7-8 |
| Phase 2 | Native push notifications (macOS) | Week 8 |
| Phase 3 | Brand Manager UI (visual token editor) | Week 9 |
| Phase 3 | Status app (health polling) | Week 9 |
| Phase 3 | More core apps (Knowledge, Files, Activity) | Week 10-13 |
| Phase 3 | iOS/Windows/Linux native apps | Week 12+ |

---

## Success Criteria

### The shell is alive:
- [ ] `workspace.nendo.ai` loads with Nendo branding
- [ ] Login works, sessions persist across browser restarts
- [ ] Sidebar navigates without page reloads
- [ ] AI panel toggles (placeholder)
- [ ] Workspace switcher strip visible (placeholder)

### The architecture is proven:
- [ ] Workspace Worker is thin (~20 line entry point, config-driven)
- [ ] Guest app is a separate Worker with its own `wrangler.toml`
- [ ] Service binding connects them at zero latency
- [ ] Gateway proxies requests, injects context, logs to audit
- [ ] Guest app renders inside the viewport with Nendo theme
- [ ] Guest app shows real data from `iq.ensemble.ai`

### The native app works:
- [ ] Nendo.app opens workspace in native macOS window
- [ ] Session stored in macOS Keychain, not browser storage
- [ ] Deep links (`ensemble://nendo/...`) open in native app
- [ ] Same shell code runs in both web and native — no forking

### The upgrade path works:
- [ ] `bun update @ensemble-edge/core` brings new features
- [ ] `ensemble.config.ts` and guest apps untouched by upgrade
- [ ] No merge conflicts between framework updates and workspace code

---

---

## Appendix: External Brand Consumption (Nendo SPA)

The customer-facing Nendo SPA (`client-hoss-nendo` at `nendo.com`) can consume brand tokens from the workspace, creating a **single source of truth** for all Nendo branding.

### How it works

```
┌─────────────────────────────────────────────────────────────────┐
│  Brand Manager (workspace.nendo.ai)                              │
│                                                                  │
│  Admin changes accent color: #d85a30 → #e85a40                  │
│  Clicks "Save" → brand_tokens table updated                     │
│  KV cache invalidated                                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           │                               │
           ▼                               ▼
┌─────────────────────┐         ┌─────────────────────┐
│  Workspace Shell    │         │  Nendo SPA          │
│  workspace.nendo.ai │         │  nendo.com          │
│                     │         │                     │
│  Fetches theme on   │         │  Fetches theme on   │
│  page load          │         │  page load          │
│                     │         │                     │
│  New color appears  │         │  New color appears  │
│  immediately        │         │  within 1 hour      │
│                     │         │  (cache TTL)        │
└─────────────────────┘         └─────────────────────┘
```

### Nendo SPA integration

```typescript
// In client-hoss-nendo (the customer SPA)
// src/lib/brand.ts

const WORKSPACE_URL = 'https://workspace.nendo.ai'

interface BrandTokens {
  colors: {
    accent: string
    primary: string
    surface: string
  }
  typography: {
    heading_font: string
    body_font: string
  }
  identity: {
    display_name: string
    legal_name: string
    website: string
  }
  spatial: {
    radius: string
  }
}

// Fetch brand tokens from workspace
export async function fetchBrandTokens(): Promise<BrandTokens> {
  const response = await fetch(`${WORKSPACE_URL}/_ensemble/brand/public`, {
    headers: { 'Accept': 'application/json' },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch brand tokens')
  }

  return response.json()
}

// Apply brand tokens as CSS custom properties
export function applyBrandTokens(tokens: BrandTokens): void {
  const root = document.documentElement

  // Colors
  root.style.setProperty('--brand-accent', tokens.colors.accent)
  root.style.setProperty('--brand-primary', tokens.colors.primary)
  root.style.setProperty('--brand-surface', tokens.colors.surface)

  // Typography
  root.style.setProperty('--font-heading', tokens.typography.heading_font)
  root.style.setProperty('--font-body', tokens.typography.body_font)

  // Spatial
  root.style.setProperty('--radius', tokens.spatial.radius)
}

// Initialize on app load
export async function initBrand(): Promise<void> {
  try {
    const tokens = await fetchBrandTokens()
    applyBrandTokens(tokens)

    // Cache in localStorage for offline/fast reload
    localStorage.setItem('brand_tokens', JSON.stringify(tokens))
  } catch (error) {
    // Fall back to cached tokens
    const cached = localStorage.getItem('brand_tokens')
    if (cached) {
      applyBrandTokens(JSON.parse(cached))
    }
    console.warn('Using cached brand tokens:', error)
  }
}
```

```typescript
// In the SPA's main entry point
// src/main.tsx

import { initBrand } from './lib/brand'

// Initialize brand before rendering
await initBrand()

// Now render the app with brand tokens applied
ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
)
```

### Response format

`GET https://workspace.nendo.ai/_ensemble/brand/public`

```json
{
  "colors": {
    "accent": "#d85a30",
    "primary": "#2c1810",
    "surface": "#fafaf8"
  },
  "typography": {
    "heading_font": "DM Sans",
    "body_font": "DM Sans",
    "mono_font": "JetBrains Mono"
  },
  "identity": {
    "display_name": "Nendo",
    "legal_name": "HOSS Technologies, LLC",
    "website": "https://nendo.com",
    "logo_url": "https://workspace.nendo.ai/_ensemble/brand/assets/logo"
  },
  "spatial": {
    "radius": "8px"
  },
  "_meta": {
    "etag": "\"abc123\"",
    "cache_until": "2026-03-28T15:00:00Z"
  }
}
```

### Benefits

1. **Single source of truth** — Brand changes in one place propagate everywhere
2. **No deploy required** — Change accent color in Brand Manager, SPA picks it up automatically
3. **Consistency** — Internal tools and customer-facing apps share exact same brand tokens
4. **Offline resilient** — SPA caches tokens locally, works even if workspace is down
5. **Future-proof** — When you add brand tokens (e.g., dark mode), SPA gets them for free

---

*This plan gets Nendo from zero to a production workspace in 22 days. The first 14 days prove the shell. Days 15-19 prove the guest app architecture. Days 20-22 prove the native app wrapper. Everything after is adding features to a foundation that already works.*