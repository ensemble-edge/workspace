## 8. Guest Apps, Delivery Methods & The Guest SDK

Guest apps are where the real power of Ensemble lives. They're the company's custom tools, the community's shared utilities, and — ultimately — the way major SaaS products integrate with the workspace. Every guest app, whether built by the workspace developer or by Linear or Stripe, shows up identically in the workspace: same sidebar, same theme, same permissions, same audit trail.

### The Architectural Principle: Guest Apps Are Always Separate Services

> **⚠️ Architecture Update (March 2026):** The architecture has shifted further. See [`02-shell-shift.md`](./02-shell-shift.md) for the authoritative model.

**The workspace Worker is a pure JSON API — it does NOT run the shell, core app UIs, or bundled app UIs.** Those are served by Ensemble's edge proxy. The workspace Worker only provides:
- `/_ensemble/workspace` — workspace config (theme, nav, name)
- `/_ensemble/apps/*` — API routes for core/bundled apps
- Guest app proxying via service bindings or HTTP

Guest apps always run as separate services. Even "your own" guest apps run on separate Workers in the same Cloudflare zone.

Why:

- The workspace Worker is truly thin — just JSON API routes
- The shell is served by Ensemble's edge (R2/KV cached globally) — developers never deploy it
- Auth is handled by the edge proxy + `app.ensemble.ai` — workspace Workers receive pre-authenticated requests
- Guest apps have independent deployment lifecycles — deploy your CRM without touching the workspace
- Guest apps can be built on any platform — Cloudflare Workers, Vercel, AWS Lambda, Node, Deno
- The same guest app can serve multiple workspaces without being compiled into each one
- The security boundary is cleaner — guest apps never run in the same execution context as the core

The edge proxy routes requests to the workspace Worker, which then proxies to guest apps. For same-zone Cloudflare Workers, this uses service bindings (effectively zero latency). For remote apps, it's a standard HTTP proxy with capability token injection.

```
┌─── Ensemble Edge Layer (served by Ensemble) ────────────┐
│                                                          │
│  Shell (Preact SPA from R2) + Edge Proxy                 │
│  - Serves shell to browser                               │
│  - Validates sessions, injects X-Ensemble-User headers   │
│  - Routes /_ensemble/* to workspace Worker               │
│                                                          │
└───────────────────────┬──────────────────────────────────┘
                        │ Pre-authenticated requests
                        ▼
┌─── Workspace Worker (pure JSON API) ────────────────────┐
│                                                          │
│  @ensemble-edge/core: API routes only                    │
│  - /_ensemble/workspace → config JSON                    │
│  - /_ensemble/apps/* → core/bundled app API routes       │
│                                                          │
│  Guest app proxying via gateway:                         │
│  /app/crm/*        → CRM Worker (same CF zone)          │
│  /app/wiki/*       → Wiki Worker (same CF zone)          │
│  /app/linear/*     → linear-ensemble.app (remote)        │
│                                                          │
└──────────────────────────────────────────────────────────┘
         │                    │                    │
    Service binding      Service binding      HTTP proxy
    (0ms latency)        (0ms latency)        (normal latency)
         │                    │                    │
         ▼                    ▼                    ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐
│ CRM Worker   │  │ Wiki Worker  │  │ linear-ensemble.app  │
│ (your CF     │  │ (your CF     │  │ (Linear's infra,     │
│  account,    │  │  account,    │  │  could be anywhere)  │
│  same zone)  │  │  same zone)  │  │                      │
│              │  │              │  │ Uses @ensemble-edge/guest      │
│ Uses         │  │ Uses         │  │ SDK for auth +        │
│ @ensemble-edge/guest  │  │ @ensemble-edge/guest  │  │ context               │
│ -cloudflare  │  │ -cloudflare  │  │                      │
└──────────────┘  └──────────────┘  └──────────────────────┘
```

### Two SDKs, Clear Boundary

| Package | Who uses it | Where it runs | Purpose |
|---|---|---|---|
| `@ensemble-edge/sdk` | Core and bundled app code | Inside the workspace Worker | Hooks for code that's part of the workspace engine |
| `@ensemble-edge/guest` | Guest app developers | On their own infrastructure | SDK for building independently deployed guest apps |

`@ensemble-edge/sdk` is internal to the workspace. `@ensemble-edge/guest` is the public contract — the interface that any developer, anywhere, uses to build apps that connect to Ensemble workspaces.

### The `@ensemble-edge/guest` SDK

This is the SDK that guest app developers install. It handles workspace communication, auth token validation, theme consumption, event bus integration, and context parsing.

#### Platform Adapters

The guest SDK has a core package and platform-specific adapters:

| Package | Platform | What it adds |
|---|---|---|
| `@ensemble-edge/guest` | Core (platform-agnostic) | Manifest types, context parsing, auth validation, theme helpers |
| `@ensemble-edge/guest-cloudflare` | Cloudflare Workers | Service binding support, D1 storage adapter, Workers-native request handling |
| `@ensemble-edge/guest-vercel` | Vercel Functions | Edge/serverless function adapter, Vercel KV/Postgres helpers |
| `@ensemble-edge/guest-node` | Node.js / Express / Fastify | Standard Node HTTP adapter, any database |
| `@ensemble-edge/guest-deno` | Deno / Deno Deploy | Deno-native adapter |
| `@ensemble-edge/guest-aws` | AWS Lambda | Lambda handler adapter, DynamoDB helpers |
| `@ensemble-edge/guest-bun` | Bun | Bun-native HTTP adapter |

A guest app developer picks the adapter for their platform:

```typescript
// A guest app on Cloudflare Workers
import { defineGuestApp } from '@ensemble-edge/guest'
import { cloudflareAdapter } from '@ensemble-edge/guest-cloudflare'

export default defineGuestApp({
  adapter: cloudflareAdapter(),
  manifest: { ... },
  handlers: { ... },
})
```

```typescript
// The same guest app on Vercel
import { defineGuestApp } from '@ensemble-edge/guest'
import { vercelAdapter } from '@ensemble-edge/guest-vercel'

export default defineGuestApp({
  adapter: vercelAdapter(),
  manifest: { ... },  // Same manifest
  handlers: { ... },  // Same handlers
})
```

```typescript
// The same guest app on a plain Node server
import { defineGuestApp } from '@ensemble-edge/guest'
import { nodeAdapter } from '@ensemble-edge/guest-node'
import express from 'express'

const app = express()
const guestApp = defineGuestApp({
  adapter: nodeAdapter({ expressApp: app }),
  manifest: { ... },
  handlers: { ... },
})
app.listen(3000)
```

The manifest and handlers are identical across platforms. Only the adapter changes. Build once, deploy anywhere.

#### The Guest App Manifest

Every guest app serves its manifest at a well-known URL:

```
https://my-app.com/.well-known/ensemble-manifest.json
```

```json
{
  "id": "loan-tracker",
  "name": "Loan tracker",
  "version": "1.0.0",
  "description": "Track loan applications and status",
  "author": "Ownly Capital",
  "icon": "file-text",
  "homepage": "https://github.com/ownly/loan-tracker",

  "display": {
    "modes": ["viewport"],
    "default": "viewport"
  },

  "nav": {
    "label": "Loans",
    "icon": "file-text",
    "position": "sidebar",
    "children": [
      { "label": "Applications", "path": "/applications" },
      { "label": "Pipeline", "path": "/pipeline" }
    ]
  },

  "permissions": {
    "required": ["storage:read", "storage:write"],
    "optional": ["ai:invoke", "knowledge:read"]
  },

  "events": {
    "emits": ["loan:application.submitted", "loan:status.changed"],
    "listens": ["people:member.created"]
  },

  "api": {
    "backend": "https://loan-tracker.ownly-workers.dev",
    "routes": [
      { "method": "GET", "path": "/applications", "description": "List applications" },
      { "method": "POST", "path": "/applications", "description": "Create application" },
      { "method": "GET", "path": "/applications/:id", "description": "Get application" }
    ]
  },

  "ui": {
    "type": "url",
    "entry": "https://loan-tracker.ownly-workers.dev/ui"
  },

  "settings": {
    "schema": {
      "defaultReviewer": { "type": "string", "label": "Default reviewer handle" },
      "autoNotify": { "type": "boolean", "label": "Auto-notify on status change", "default": true }
    }
  }
}
```

#### The Guest App Context

When the workspace gateway proxies a request to a guest app, it injects a rich context:

```typescript
interface GuestAppContext {
  // The workspace
  workspace: {
    id: string
    slug: string
    name: string
    endpoint: string
    locale: {
      base_language: string       // 'en' — the workspace's source language
      supported_languages: string[] // ['en', 'es', 'pt']
      timezone: string            // 'America/Chicago'
      date_format: string         // 'us' | 'eu' | 'iso'
      number_format: string       // 'us' | 'eu'
    }
  }

  // The user (null for webhook/system calls)
  user: {
    id: string
    handle: string
    name: string
    role: string
    email: string
    locale: string                // User's preferred language ('es') — falls back to workspace base
  } | null

  // This app's settings for this workspace
  settings: Record<string, any>

  // Scoped storage (workspace's D1, namespaced to this app)
  storage: {
    query: (sql: string, params?: any[]) => Promise<any>
  }

  // Event bus
  events: {
    emit: (event: string, data: any) => Promise<void>
  }

  // Theme tokens
  theme: {
    colors: Record<string, string>
    fonts: Record<string, string>
    radius: string
    density: string
  }

  // Knowledge graph (if permitted)
  knowledge: {
    get: (path: string) => Promise<any>
    search: (query: string) => Promise<any[]>
  } | null

  // Helpers
  json: (data: any) => Response
  error: (status: number, message: string) => Response
}
```

#### Cloudflare Service Bindings (Same-Zone Optimization)

When both the workspace Worker and a guest app Worker are in the same Cloudflare account, the gateway uses service bindings instead of HTTP. This gives effectively zero-latency communication — the Workers talk directly, no network round-trip:

```toml
# In the workspace's wrangler.toml
[services]
loan_tracker = { service = "loan-tracker-worker", environment = "production" }
wiki = { service = "wiki-worker", environment = "production" }
```

```typescript
// In the workspace gateway, when routing to a same-zone guest app
const response = await c.env.loan_tracker.fetch(proxiedRequest)
// vs. for a remote guest app
const response = await fetch('https://remote-app.com/api/...', proxiedRequest)
```

The developer's experience is the same either way — they build with `@ensemble-edge/guest-cloudflare` and deploy to their CF account. The workspace admin configures the service binding in `wrangler.toml`. The gateway detects whether a service binding exists and uses it automatically, falling back to HTTP.

### Guest App Addresses & The Registry

Guest apps have their own address format in the Ensemble Registry:

| Format | Example | Meaning |
|---|---|---|
| `@app-name` | `@loan-tracker` | Community or individual app |
| `@org/app-name` | `@linear/sync` | Organization-scoped app |
| `@ensemble-edge/app-name` | `@ensemble-edge/crm` | Official Ensemble app |
| Manifest URL | `https://my-app.com/.well-known/ensemble-manifest.json` | Self-hosted, unregistered |

Publishing to the registry:

```bash
# Publish your guest app
ensemble app publish

# Register a self-hosted app (no registry, just makes the manifest discoverable)
ensemble app register --url https://my-app.com/.well-known/ensemble-manifest.json
```

Installing in a workspace:

```bash
# From registry
ensemble app install @linear/sync

# From URL
ensemble app install --url https://my-internal-tool.com/.well-known/ensemble-manifest.json

# Via the App Manager UI in the workspace
# Via the API (agent-driven)
POST /_ensemble/apps/install { "registry_id": "@linear/sync" }
```

### Security Model for Guest Apps

| Concern | How it's handled |
|---|---|
| **Auth** | Workspace issues short-lived capability tokens per request. Guest app validates against workspace's public key. Never sees the user's main JWT. |
| **Data isolation** | Each workspace gets its own scoped storage namespace. A guest app serving 100 workspaces has 100 isolated data stores. |
| **Settings encryption** | API keys and secrets are encrypted at rest in D1, decrypted only when injected into proxied requests. |
| **Frontend isolation** | Remote app frontends render in sandboxed iframe. Theme tokens passed via postMessage only. Cannot access parent shell DOM. |
| **Rate limiting** | Gateway rate-limits per user, per app. A misbehaving app can't DoS the workspace. |
| **Audit trail** | Every proxied request logged with actor, app, action, timestamp. |
| **Permissions** | Declared in manifest, approved at install time. Apps cannot escalate. |
| **Revocation** | Uninstall immediately revokes tokens, removes routes, optionally purges scoped storage. |

### The Future: Major Products as Guest Apps

When Ensemble reaches critical mass:

```
Linear builds @linear/sync        →  Issues inside any workspace
Stripe builds @stripe/billing      →  Payment management inside any workspace
Figma builds @figma/design         →  Design review inside any workspace
GitHub builds @github/repos        →  Repo management inside any workspace
Notion builds @notion/docs         →  Docs inside any workspace
Intercom builds @intercom/support  →  Support inside any workspace
```

Each renders inside the workspace shell with the workspace's brand. Each respects permissions. Each is searchable via the command palette. Each flows through the API gateway. Each is audited. The workspace becomes the universal shell for all business software.

### Guest App Categories

All guest apps use the same SDK, same manifest, same gateway proxy, same theming. The architecture is one thing. But the marketplace categorizes them for discoverability via a `category` field in the manifest:

| Category | What it is | Examples |
|---|---|---|
| **Connector** | Thin wrapper around a third-party API. Renders their data inside the workspace. The most reusable type — every company using Stripe can install `@ensemble-edge/stripe`. | Stripe billing, Google Drive browser, Slack bridge, GitHub repos, QuickBooks sync, HubSpot CRM, Intercom support |
| **Tool** | Purpose-built business application. May be company-specific or general-purpose. | CRM, project tracker, invoice generator, loan tracker, recruitment pipeline |
| **Portal** | Customer-facing or partner-facing app. Set to `visibility: public` or `restricted`. | Borrower portal, investor data room, client dashboard, vendor onboarding |
| **Agent** | AI-powered app that acts autonomously. Subscribes to events, executes workflows, reports results. **Same manifest, same SDK, same gateway.** | Deal sourcing agent, compliance checker, content generator, churn predictor, auto-recharge monitor |
| **Utility** | Small single-purpose tools. Calculators, converters, generators. | Timezone converter, invoice calculator, QR generator, URL shortener |

### Guest Agents ARE Guest Apps

This is a foundational architectural insight: **a guest agent is just a guest app with `category: "agent"` that acts autonomously instead of waiting for clicks.** There is no separate agent framework, no separate SDK, no separate gateway, no separate permission model. The manifest declares everything an agent needs — because everything an agent needs is already in the guest app manifest.

| Manifest field | How a tool uses it | How an agent uses it |
|---|---|---|
| `api.routes` | Endpoints the user hits via the viewport | Endpoints the AI panel or other agents call |
| `events.listens` | Reacts when user navigates or data changes | Triggers autonomous behavior (the primary interaction mode) |
| `events.emits` | Notifies on user actions | Reports what the agent did |
| `ai.tools` | AI panel can call the app's APIs | Other agents and the AI panel can invoke the agent |
| `notifications` | Shows results of user actions | Shows results of autonomous actions |
| `activity` | Logs user activity | Logs agent activity (who did what, when, why) |
| `health` | Is the app running? | Is the agent running? |
| `settings` | User-facing configuration | Agent behavior configuration (thresholds, schedules, toggles) |
| `widgets` | Dashboard data cards | Agent activity dashboard (runs, successes, failures, actions taken) |
| `nav` | Sidebar link to the viewport UI | Sidebar link to agent config/monitoring UI (or omitted for headless agents) |

An agent guest app might have a viewport UI for monitoring and configuration — a dashboard showing its recent actions, success rates, and settings toggles. Or it might be **headless** — no `nav` entry, no viewport, just a background service that subscribes to events and acts. Both are valid. Both use the same manifest.

**Example: auto-recharge agent for Nendo**

```json
{
  "id": "nendo-auto-recharge",
  "name": "Auto-recharge monitor",
  "category": "agent",
  "description": "Monitors customer credit balances and triggers auto-recharge when thresholds are hit",

  "events": {
    "listens": ["credits.low", "credits.exhausted", "customer.settings.changed"],
    "emits": ["agent:recharge.triggered", "agent:recharge.failed", "agent:recharge.skipped"]
  },

  "settings": {
    "schema": {
      "enabled": { "type": "boolean", "label": "Agent active", "default": true },
      "check_interval_minutes": { "type": "number", "label": "Check interval", "default": 60 },
      "notify_on_failure": { "type": "boolean", "label": "Notify admin on failure", "default": true }
    }
  },

  "health": {
    "endpoint": "GET /health",
    "interval": 120,
    "display_name": "Auto-recharge agent"
  },

  "widgets": [
    {
      "id": "recharge-activity",
      "name": "Auto-recharge activity",
      "size": "medium",
      "api_route": "GET /widgets/activity"
    }
  ],

  "notifications": [
    {
      "event": "agent:recharge.triggered",
      "display": "Auto-recharged {customer} with {amount} credits",
      "icon": "zap",
      "priority": "normal"
    },
    {
      "event": "agent:recharge.failed",
      "display": "Auto-recharge failed for {customer}: {reason}",
      "icon": "alert-circle",
      "priority": "high"
    }
  ],

  "activity": [
    {
      "event": "agent:recharge.triggered",
      "template": "Auto-recharge agent recharged {customer} with {amount} credits",
      "icon": "zap"
    }
  ],

  "ai": {
    "tools": [
      {
        "name": "check_recharge_status",
        "description": "Check which customers are near their recharge threshold",
        "api_route": "GET /status"
      },
      {
        "name": "trigger_manual_recharge",
        "description": "Manually trigger a recharge for a specific customer",
        "api_route": "POST /recharge/{customer_id}",
        "requires_confirmation": true
      }
    ],
    "context_prompt": "This agent monitors customer credit balances and triggers auto-recharge via Stripe when thresholds are hit."
  }
}
```

This agent has no `nav` entry — it's headless. It shows up in the sidebar only if the workspace admin pins it. Its presence in the workspace is felt through notifications ("Auto-recharged Clay Power Users with 10,000 credits"), activity feed entries, the dashboard widget, and the status dashboard's health check. The AI panel can query it ("which customers are near recharge?") and invoke it ("manually recharge DataDriven").

**The Conductor connection:** For complex multi-step agent workflows (check balance → verify payment method → charge Stripe → add credits → send confirmation → handle failure), the agent's internal logic can be orchestrated using Ensemble Conductor's YAML workflow definitions. Conductor becomes the engine that powers agent behavior under the hood — not a separate product, but the orchestration layer that guest agents use to define their workflows.

The category appears in the manifest:

```json
{
  "id": "stripe-billing",
  "name": "Stripe",
  "category": "connector",
  "connects_to": "stripe.com",
  "...": "..."
}
```

The marketplace at `registry.ensemble.ai` uses this to power browse, filter, and search. "Show me all connectors" or "What tools are available for finance teams."

### Connectors — API Gateway Guest Apps

Connectors deserve special attention because they're the highest-leverage guest apps. A single connector — say `@ensemble-edge/stripe` — can be installed in thousands of workspaces. Building connectors is how you seed the marketplace and make Ensemble immediately useful.

A connector is a guest app that wraps a third-party API and renders its data inside the workspace shell. It typically:

1. Authenticates to the third-party service via OAuth or API key (configured per workspace in the app's settings)
2. Exposes the third-party service's data through the standard guest app API routes
3. Renders a themed UI for browsing, searching, and managing the external data
4. Registers AI panel tools so the assistant can query and act on the external service
5. Emits events to the workspace event bus (e.g., `stripe:payment.received`, `github:pr.merged`)

```
User installs @ensemble-edge/stripe
        │
        ▼
App settings: "Enter your Stripe API key"
        │
        ▼
Now in the workspace:
  - Sidebar shows "Stripe" with sub-items: Payments, Customers, Invoices
  - Viewport renders Stripe data with workspace branding
  - AI panel can "show me recent failed payments"
  - Event bus fires on payment events
  - Command palette: "stripe: search customer John"
```

The beauty is that the workspace owner doesn't build any of this. They install a connector like installing an npm package. The connector developer built it once with `@ensemble-edge/guest`, and it works in every workspace.

**Ensemble-built connectors (first-party):** These are published under the `@ensemble-edge/` org in the registry and maintained by the Ensemble team. They're the reason someone says "wow, I installed Ensemble and all my tools are already here."

Planned first-party connectors:

| Connector | Third-party service |
|---|---|
| `@ensemble-edge/stripe` | Payment management, invoices, customers |
| `@ensemble-edge/google-drive` | File browser, search, sharing |
| `@ensemble-edge/google-calendar` | Calendar view, scheduling |
| `@ensemble-edge/github` | Repos, issues, PRs, code review |
| `@ensemble-edge/slack` | Channel browser, message search, notifications |
| `@ensemble-edge/notion` | Page browser, database views |
| `@ensemble-edge/linear` | Issue tracker, project boards |
| `@ensemble-edge/quickbooks` | Accounting, invoices, reports |
| `@ensemble-edge/hubspot` | CRM contacts, deals, pipelines |
| `@ensemble-edge/intercom` | Support tickets, conversations |

Each one follows the same pattern: `@ensemble-edge/guest` SDK, manifest with `category: "connector"` and `connects_to`, OAuth/API key settings, themed UI, AI panel tools, event bus integration.

### Manifest Extension Points — How Guest Apps Extend the Workspace

Guest apps don't just live in the viewport. They bleed into every shared surface of the workspace. The manifest is the single declaration of how an app participates — the shell reads all installed app manifests at startup and stitches their contributions together. No app knows about any other app. They just declare. The shell composes.

#### The Shared Surfaces

| Surface | What the shell provides | What guest apps contribute |
|---|---|---|
| **Dashboard** | Widget grid with drag-and-drop layout | Widgets: small data cards, charts, lists, quick-action panels |
| **Command palette** (`⌘K`) | Federated search across all apps | Search endpoint + result types |
| **Docs** | Unified docs browser, navigable by section | Documentation pages stitched into the tree |
| **Notifications** | Aggregated notification center | Event types with display templates and priority |
| **Activity feed** | Chronological stream from all apps | Event templates with actor/object rendering |
| **AI panel** | Tool calling, context assembly | Callable API routes, context prompts (covered in §7) |
| **Quick actions** | Bookmark bar and command palette shortcuts | Pinnable actions (navigate, create, trigger) |
| **Status** | Unified health dashboard | Health check endpoint + external dependencies |
| **Settings** | Centralized workspace admin UI | Admin-configurable fields (API keys, toggles, defaults) |

#### Full Manifest Extension Schema

Every field below is optional. A guest app can contribute to all surfaces or none — the simplest app just declares `nav` and `api` and everything else defaults to absent.

```json
{
  "id": "nendo-customers",
  "name": "Customers",
  "version": "1.2.0",
  "category": "tool",

  "nav": { "...": "as documented above" },
  "api": { "...": "as documented above" },
  "permissions": { "...": "as documented above" },
  "settings": { "...": "as documented above" },
  "ui": { "...": "as documented above" },

  "ai": {
    "tools": [
      {
        "name": "list_customers",
        "description": "Search and filter customers",
        "api_route": "GET /customers",
        "parameters": {
          "status": { "type": "string", "enum": ["active", "trial", "exhausted"] },
          "credits_below": { "type": "number" }
        }
      },
      {
        "name": "approve_trial",
        "description": "Approve a pending trial request",
        "api_route": "POST /trials/{id}/approve",
        "requires_confirmation": true
      }
    ],
    "context_prompt": "Manages Nendo API customers. Customers have statuses, credit balances, and usage history."
  },

  "widgets": [
    {
      "id": "credit-balance",
      "name": "Credit balance",
      "description": "Shows total credits in circulation across all keys",
      "size": "small",
      "api_route": "GET /widgets/credit-balance",
      "refresh_interval": 60
    },
    {
      "id": "active-customers",
      "name": "Active customers",
      "description": "List of recently active customers with call counts",
      "size": "medium",
      "api_route": "GET /widgets/active-customers",
      "refresh_interval": 300
    },
    {
      "id": "trial-queue",
      "name": "Trial queue",
      "description": "Pending trial requests awaiting approval",
      "size": "small",
      "api_route": "GET /widgets/trial-queue",
      "refresh_interval": 60,
      "badge": true
    }
  ],

  "search": {
    "endpoint": "GET /search",
    "debounce_ms": 200,
    "result_types": [
      {
        "type": "customer",
        "icon": "user",
        "display": "{name} — {email}",
        "action": "navigate",
        "path": "/customers/{id}"
      },
      {
        "type": "trial_request",
        "icon": "clock",
        "display": "Trial: {company} ({email})",
        "action": "navigate",
        "path": "/trials/{id}"
      }
    ]
  },

  "docs": [
    {
      "title": "Managing API customers",
      "path": "/docs/managing-customers",
      "section": "Operations",
      "order": 1
    },
    {
      "title": "Trial approval workflow",
      "path": "/docs/trial-workflow",
      "section": "Operations",
      "order": 2
    },
    {
      "title": "Credit system and auto-recharge",
      "path": "/docs/credit-system",
      "section": "Billing",
      "order": 1
    }
  ],

  "notifications": [
    {
      "event": "trial_request.submitted",
      "display": "New trial request from {customer}",
      "icon": "user-plus",
      "priority": "normal",
      "action": { "type": "navigate", "path": "/trials/{id}" }
    },
    {
      "event": "credits.exhausted",
      "display": "{customer} has run out of credits",
      "icon": "alert-circle",
      "priority": "high",
      "action": { "type": "navigate", "path": "/customers/{id}" }
    },
    {
      "event": "credits.low",
      "display": "{customer} below {threshold} credits",
      "icon": "alert-triangle",
      "priority": "normal"
    }
  ],

  "activity": [
    {
      "event": "customer.created",
      "template": "{actor} added new customer {customer}",
      "icon": "user-plus"
    },
    {
      "event": "trial.approved",
      "template": "{actor} approved trial for {customer}",
      "icon": "check-circle"
    },
    {
      "event": "credits.purchased",
      "template": "{customer} purchased {amount} credits",
      "icon": "credit-card"
    },
    {
      "event": "key.revoked",
      "template": "{actor} revoked API key for {customer}",
      "icon": "x-circle"
    }
  ],

  "quick_actions": [
    {
      "id": "new-customer",
      "label": "New customer",
      "icon": "user-plus",
      "action": "navigate",
      "path": "/customers/new",
      "pinnable": true
    },
    {
      "id": "approve-trials",
      "label": "Review trials",
      "icon": "check-square",
      "action": "navigate",
      "path": "/trials",
      "pinnable": true,
      "badge_source": "trial_request.submitted"
    }
  ],

  "health": {
    "endpoint": "GET /health",
    "interval": 60,
    "timeout": 5000,
    "display_name": "Customer manager",
    "dependencies": [
      {
        "name": "iq.ensemble.ai",
        "endpoint": "https://iq.ensemble.ai/health",
        "type": "external"
      },
      {
        "name": "Unkey API",
        "endpoint": "https://api.unkey.dev/v1/liveness",
        "type": "external"
      },
      {
        "name": "Stripe API",
        "endpoint": "https://api.stripe.com/healthcheck",
        "type": "external"
      }
    ]
  },

  "settings": {
    "admin": [
      {
        "group": "API connection",
        "order": 1,
        "fields": [
          {
            "key": "iq_tenant_key",
            "type": "secret",
            "label": "Ensemble tenant key",
            "description": "ens_master_ key for iq.ensemble.ai. Stored encrypted.",
            "required": true
          },
          {
            "key": "unkey_root_key",
            "type": "secret",
            "label": "Unkey root key",
            "required": true
          }
        ]
      },
      {
        "group": "Notifications",
        "order": 2,
        "fields": [
          {
            "key": "low_credit_threshold",
            "type": "number",
            "label": "Low credit alert threshold",
            "description": "Percentage at which low-credit emails fire",
            "default": 25
          },
          {
            "key": "send_admin_alerts",
            "type": "toggle",
            "label": "Send admin alerts",
            "description": "Email admin on new signups, exhausted credits, churn risk",
            "default": true
          },
          {
            "key": "admin_email",
            "type": "text",
            "label": "Admin notification email",
            "default": ""
          }
        ]
      }
    ],
    "internal": {
      "schema": {
        "defaultReviewer": { "type": "string", "label": "Default trial reviewer handle" },
        "autoNotify": { "type": "boolean", "label": "Auto-notify on status change", "default": true }
      }
    }
  }
}
```

#### How the Shell Stitches It Together

At workspace startup, the shell loads all installed guest app manifests (cached in KV). Each shared surface reads the relevant section from every manifest and composes a unified view:

**Dashboard:**

```
Shell loads: all manifests with "widgets" field
User opens dashboard → sees widget catalog
Available widgets: 3 from @nendo/customers + 2 from @nendo/usage + 1 from @ensemble-edge/stripe
User drags "Credit balance" into their grid
Widget calls: GET /_ensemble/customers/widgets/credit-balance (through gateway)
Data renders in the widget card, refreshes every 60 seconds
```

Widget sizes: `small` (1 grid unit, stat card or single metric), `medium` (2 units, list or mini-chart), `large` (3-4 units, full chart or table). The dashboard is a CSS grid. Users drag and arrange widgets per their preference. Layout is stored per user in D1.

Widgets can declare `badge: true` — the widget shows a badge count from its data (e.g., "2 pending trials"). This badge also appears on the dashboard's sidebar nav item.

**Command palette (`⌘K`):**

```
User hits ⌘K, types "acme"
Shell sends "acme" to every installed app's search endpoint in parallel:
  GET /_ensemble/customers/search?q=acme    → [{ type: "customer", name: "Acme Corp", ... }]
  GET /_ensemble/usage/search?q=acme        → [{ type: "usage_report", name: "Acme Corp March", ... }]
  GET /_ensemble/stripe/search?q=acme       → [{ type: "stripe_customer", name: "Acme Corp", ... }]
Shell merges, deduplicates, and ranks results
Each result renders with its app icon + display template
User selects → navigates to the result's path in the contributing app
```

The command palette also shows quick actions from all apps (filtered by the search query). Typing "new" shows "New customer" from the CRM, "New deal" from the pipeline, "New file" from the file manager.

Search is debounced per the app's `debounce_ms` setting. Slow endpoints don't block fast ones — results stream in as they arrive.

**Docs:**

```
Shell loads: all manifests with "docs" field
Builds a unified doc tree:

  Operations
  ├── Managing API customers         (from @nendo/customers)
  ├── Trial approval workflow         (from @nendo/customers)
  └── Usage monitoring               (from @nendo/usage)

  Billing
  ├── Credit system and auto-recharge (from @nendo/customers)
  └── Stripe integration guide        (from @ensemble-edge/stripe)

  Platform
  ├── Getting started with Ensemble   (from core:admin)
  └── Brand guidelines               (from core:brand)
```

Each doc page is served by the contributing guest app (via the gateway). The docs browser just provides the navigation tree and renders the content in its viewport. Core apps also contribute docs — the admin app provides onboarding guides, the brand app provides theming documentation.

The docs browser IS the built-in docs bundled app discussed earlier. Guest app docs get stitched into it automatically. The workspace admin can reorder sections, add custom docs pages, or hide specific contributions.

This means a workspace's documentation is always complete and always current — when you install `@ensemble-edge/stripe`, its docs pages appear in the docs browser immediately. Uninstall it, they disappear.

**Notifications:**

```
Guest app emits: { event: "trial_request.submitted", data: { customer: "RevenueOS", id: "trial_123" } }
Shell matches: event → @nendo/customers manifest → notifications[0]
Renders: "New trial request from RevenueOS" with user-plus icon
User clicks → navigates to /app/customers/trials/trial_123
```

The notification center aggregates events from all apps. Users configure preferences per event type (email me for "credits.exhausted" but just show in-app for "trial_request.submitted"). Priority levels determine badge urgency — `high` events bump the notification count and may trigger push notifications in the native app.

**Activity feed:**

```
Shell loads recent events from all apps (via gateway):
  GET /_ensemble/events?since=2026-03-25&limit=50

Returns merged, chronological stream:
  10:30 — @hawkins approved trial for RevenueOS         (from @nendo/customers)
  10:28 — RevenueOS purchased 1,000 credits              (from @nendo/customers)
  10:15 — Stripe payment received: $45.00 from Acme Corp (from @ensemble-edge/stripe)
  09:45 — @hawkins updated brand colors                   (from core:brand)

Each entry rendered with its app icon + template + actor avatar
```

The activity feed is the workspace's "what happened" timeline. It subscribes to events from all installed apps via the event bus. Each app's manifest defines which events should appear in the feed and how to display them.

**Quick actions:**

Quick actions appear in two places — the command palette (always) and the bookmark bar (if the user pins them).

```
⌘K → shows all quick actions from all apps:
  [+] New customer         (@nendo/customers)
  [✓] Review trials        (@nendo/customers)  [2]
  [+] New deal             (@pipeline/deals)
  [📄] Upload file         (bundled:files)

Bookmark bar → user pins their favorites:
  [New customer] [Review trials ②] [Stripe dashboard ↗]
```

Quick actions with `badge_source` show a live badge count from the corresponding notification event. "Review trials" shows [2] because there are 2 pending trial_request.submitted events.

**Settings:**

Guest apps declare admin-configurable settings in their manifest. The workspace admin UI (`core:admin`) stitches them into a centralized settings area — no need to open each app individually.

```
Settings (core:admin viewport)
├── General                         (workspace-level: name, slug, domain)
├── Locale & region                 (workspace-level: language, timezone)
├── Appearance                      (workspace-level: delegates to Brand)
│
├── Customer manager                (from @nendo/customers manifest)
│   ├── API connection
│   │   ├── Ensemble tenant key: ●●●●●●●●
│   │   └── Unkey root key: ●●●●●●●●
│   └── Notifications
│       ├── Low credit alert threshold: 25%
│       ├── Send admin alerts: ON
│       └── Admin notification email: matt@hoss.com
│
├── Stripe                          (from @ensemble-edge/stripe manifest)
│   ├── API connection
│   │   ├── Stripe API key: ●●●●●●●●
│   │   └── Webhook signing secret: ●●●●●●●●
│   └── Defaults
│       ├── Default currency: USD
│       └── Auto-sync transactions: ON
│
├── Auto-recharge agent             (from @nendo/auto-recharge manifest)
│   └── Behavior
│       ├── Agent active: ON
│       ├── Check interval: 60 min
│       └── Notify admin on failure: ON
│
├── Integrations                    (workspace-level: webhooks, API keys)
└── Danger zone                     (workspace-level: transfer, archive, delete)
```

Three levels of settings, clear separation:

| Level | Where configured | Who owns it | Examples |
|---|---|---|---|
| **Workspace** | `core:admin` built-in sections | The workspace | Name, slug, language, timezone, appearance, integrations |
| **App-admin** | `core:admin` app sections (from manifest `settings.admin`) | The app, configured centrally | API keys, behavior toggles, thresholds, defaults |
| **App-internal** | Inside the app's own UI (from manifest `settings.internal`) | The app, managed locally | User preferences, per-record config, view settings |

The admin UI renders each app's `settings.admin` groups as collapsible sections. Groups have an `order` field for sorting within the app's section. Apps are sorted alphabetically or by install order.

**Field types:**

| Type | Editor | Use case |
|---|---|---|
| `text` | Single-line text input | Email addresses, names, identifiers |
| `secret` | Masked input, stored encrypted in D1 | API keys, tokens, signing secrets |
| `number` | Number input with optional min/max | Thresholds, intervals, limits |
| `toggle` | On/off switch | Feature flags, enable/disable |
| `select` | Dropdown | Currency, region, mode |
| `multi_select` | Multi-select chips | Tags, categories, roles |
| `url` | URL input with validation | Webhook endpoints, external service URLs |
| `color` | Color picker | App-specific brand colors |
| `textarea` | Multi-line text | Descriptions, templates, custom messages |

**How it works technically:**

1. Shell loads all installed app manifests at startup
2. `core:admin` reads `settings.admin` from each manifest
3. Admin opens Settings → sees workspace sections + one section per app
4. Admin fills in fields → values stored per-workspace, per-app in D1
5. When the gateway proxies a request to the guest app, it injects `context.settings` — a merged object of both admin and internal settings
6. `secret` type fields are encrypted at rest in D1, decrypted only when injected into the context
7. Fields with `required: true` must be filled before the app can be activated
8. Changes trigger `app:settings.updated` event on the event bus
9. Audit log records who changed which setting, when

**Activation gating:** If a guest app has required admin settings that haven't been configured yet, the app shows as "Needs configuration" in the sidebar instead of being active. Clicking it navigates to the admin settings section for that app. This prevents apps from failing at runtime because an API key was never entered.

#### The Principle

The manifest is the contract between a guest app and the workspace shell. The app declares what it can contribute. The shell decides how to compose those contributions into a coherent experience. No app reaches into another app's territory. The shell is the compositor.

This is why Ensemble isn't just "a shell for apps" — it's a workspace where every app makes every other app's experience richer, without any of them knowing about each other.

---

### Workspace Credentials & AI Tiers (v0.1.12)

Workspace operators configure cross-cutting integrations under **Settings → Auth & Security → Credentials**. Guest apps don't see those secrets directly — they consume the *capabilities* the workspace exposes. This section documents what's available and how to use it.

#### Mental Model

The workspace stores three kinds of integration credentials:

- **Connection** — Cloudflare account ID + API token + the workspace's own public URL. Used for DNS, AI Gateway provisioning, and outbound email when Cloudflare is the email provider.
- **Notifications** — A single email provider (Cloudflare *or* Resend) plus sending domain + from address. There is no failover by design; the operator picks one.
- **AI Access** — A Cloudflare AI Gateway (named gateway + token) and a set of **tiers**.

Secrets are encrypted at rest using HKDF-derived keys from the workspace's `JWT_SECRET`. The list endpoint never returns secret values — only an "is set" flag. Guest apps never receive raw API keys; they call workspace-scoped endpoints that proxy through.

#### AI Tiers

A **tier** is a stable, kebab-case name that maps to a dynamic AI Gateway route (`ws/<tier-name>`). Each workspace ships with three defaults:

| Tier name | Default display name | Purpose |
|-----------|----------------------|---------|
| `smart`   | "Smart" | High-capability model — reasoning, analysis, complex synthesis. |
| `good`    | "Good" | General-purpose default — drafts, summaries, classification. |
| `simple`  | "Simple" | Fast and cheap — short rewrites, extraction, classification at scale. |

Operators can rename tiers (display name is cosmetic) and add custom tiers. The **`name` is the API contract** that guest apps reference; the **`display_name` is the label** users see in admin UIs.

When a guest app requests a tier that does not exist, the workspace falls back to the configured default tier and surfaces the substitution via the `X-Ensemble-Tier-Fallback` response header. This is intentional: a tier rename should never break a deployed guest app.

#### `Ensemble.useAI({ tier })`

The runtime exposes a single hook for AI access:

```tsx
function MyComponent() {
  const { call, loading, error, fallback } = Ensemble.useAI({ tier: 'good' });

  const handleSummarize = async (text: string) => {
    const { data } = await call({
      messages: [
        { role: 'system', content: 'Summarize the following text in one sentence.' },
        { role: 'user', content: text },
      ],
      max_tokens: 200,
    });
    // data is the AI Gateway response — provider-shaped (OpenAI-compatible).
  };

  return (
    <Ensemble.Button disabled={loading} onClick={() => handleSummarize(input)}>
      {loading ? 'Thinking…' : 'Summarize'}
      {fallback && <Ensemble.Badge variant="outline">used {fallback}</Ensemble.Badge>}
    </Ensemble.Button>
  );
}
```

**Behavior:**

- The hook returns `{ call, loading, error, fallback }`. It does **not** auto-fire on mount — call it from a user action or effect.
- `call(body)` POSTs `body` to `/_ensemble/ai/call/<tier>` on the workspace origin. The body is forwarded verbatim to the configured AI Gateway route, so the schema matches whatever model that route is configured to call (typically the OpenAI chat-completions shape).
- `credentials: 'include'` is set automatically. Component-tier guests share the host's session; iframe-tier guests use their same-origin cookie.
- If the workspace has no AI Gateway configured, `call` returns an `error` response and `error` is set. Always render a graceful fallback.
- `fallback` is the name of the actual tier used when the requested tier was missing. Treat it as informational; the guest does not need to switch behavior.

**The hook works in both tiers:**

- **Component tier** — `window.Ensemble.useAI` is installed by the shell client. The host's React reconciler tracks state.
- **Iframe tier** — `window.Ensemble.useAI` is installed by the bundled runtime served at `/_ensemble/runtime/v1/runtime.js`. The iframe's own React reconciler tracks state.

#### What Guest Apps Should *Not* Do

- **Don't store provider API keys in your guest app's KV/D1.** If your app needs AI, use `useAI`. If you genuinely need a provider key the workspace doesn't broker (e.g., a vendor without an AI Gateway route), declare it as a *required admin setting* in your manifest and let the operator enter it once.
- **Don't bypass the gateway.** Calling `api.openai.com` directly from a guest worker means the workspace can't apply rate limits, caching, or cost tracking, and your guest stops working when the operator rotates their gateway.
- **Don't assume a tier exists.** Always handle the `fallback` case — it means an admin renamed something between deploys.

#### Request/response shapes by provider (v0.1.15)

Tiers carry a `provider` hint so the workspace's "Test tier" button can fire a sensible canary call. Guest apps still POST whatever body they want — the workspace doesn't reshape requests — but knowing the right shape per provider saves you from trial-and-error.

##### `workers-ai` (Cloudflare Workers AI)

Cloudflare AI Gateway can route to many Workers AI models. Each model accepts a different body. Common shapes:

| Model family | Example | Request shape | Response shape |
|--------------|---------|----------------|----------------|
| Text generation (instruct/chat) | `@cf/meta/llama-3.1-8b-instruct` | `{ prompt: string, max_tokens?: number }` or `{ messages: [{role, content}], max_tokens?: number }` | `{ result: { response: string } }` |
| Translation | `@cf/meta/m2m100-1.2b`, `@cf/meta/nllb-200-3.3b` | `{ text: string, source_lang: string, target_lang: string }` | `{ result: { translated_text: string } }` |
| Embeddings | `@cf/baai/bge-base-en-v1.5` | `{ text: string \| string[] }` | `{ result: { data: number[][] } }` |
| Summarization | `@cf/facebook/bart-large-cnn` | `{ input_text: string, max_length?: number }` | `{ result: { summary: string } }` |

```tsx
function TranslateButton({ text, target }) {
  const { call, loading } = Ensemble.useAI({ tier: 'translate' });

  async function go() {
    const { data } = await call({
      text,
      source_lang: 'english',
      target_lang: target, // 'spanish', 'french', etc. — Workers AI uses
                            // human-readable names for m2m100/nllb.
    });
    // data.result.translated_text
    return data;
  }

  return <button disabled={loading} onClick={go}>Translate</button>;
}
```

##### `openai-chat` (OpenAI Chat Completions, or compatible)

The AI Gateway can also front OpenAI directly or compatible providers (Azure OpenAI, Together, etc.). All of them use the OpenAI Chat Completions shape:

```ts
// Request
{
  model?: string,             // optional if the gateway route pins it
  messages: [{ role: 'system' | 'user' | 'assistant', content: string }],
  max_tokens?: number,
  temperature?: number,
}

// Response
{
  choices: [{ message: { role: 'assistant', content: string }, finish_reason: string }],
  usage: { prompt_tokens, completion_tokens, total_tokens },
  // ...
}
```

```tsx
function Summarize({ text }) {
  const { call, loading } = Ensemble.useAI({ tier: 'good' });
  const onClick = async () => {
    const { data } = await call({
      messages: [
        { role: 'system', content: 'Summarize the user message in one sentence.' },
        { role: 'user', content: text },
      ],
      max_tokens: 80,
    });
    // data.choices[0].message.content
  };
  return <button disabled={loading} onClick={onClick}>Summarize</button>;
}
```

##### `anthropic-messages` (Anthropic Messages API)

```ts
// Request
{
  model: string,              // e.g. 'claude-3-haiku-20240307'
  max_tokens: number,         // required
  messages: [{ role: 'user' | 'assistant', content: string }],
  system?: string,
}

// Response
{
  content: [{ type: 'text', text: string }],
  stop_reason: string,
  usage: { input_tokens, output_tokens },
}
```

##### `custom`

Pick this when no canary applies. The "Test tier" button will be disabled — operators verify the tier directly from their guest app. Use `custom` for: models with bespoke request shapes (Stable Diffusion, etc.), gateway routes wired to your own backend behind the gateway, or anything the workspace can't validate generically.

#### Provisioning Notes (for app authors who also write activation flows)

Custom tiers can be created by admins via the UI. The first time the workspace saves an AI Gateway name + token, it seeds the default tiers (`smart`/`good`/`simple`) and provisions the corresponding dynamic routes via the Cloudflare API. Tier route provisioning is idempotent — re-running it on an existing route succeeds.

If route provisioning fails (typically: missing AI Gateway:Edit on the token, or the gateway name doesn't exist), the tier is created in the workspace DB but marked `route_provisioned: false`. The admin UI surfaces a "Retry" affordance. Guest apps calling such a tier get an error response with the underlying CF error in the body.

---

### Save Patterns & `Ensemble.SaveStatus` (v0.1.17)

Save behavior used to vary tab-by-tab in the workspace itself, which confused operators ("did I have to click Save? Did it autosave?"). v0.1.17 ships a small set of well-defined save modalities and a shared `SaveStatus` indicator. **Guest apps should use the same patterns** — operators carry their save-model expectations across the workspace boundary, so a guest that picks a different pattern feels jarring.

#### The four modalities

| Modality | When to use | UI cue |
|---|---|---|
| **Manual save** | Long-form edits with validation (multi-field forms, anything with required-fields or cross-field rules) | Save button + `<SaveStatus state="dirty" />` while pending |
| **Autosave on blur** | Single-purpose editors with per-field independence (text fields, sliders) | No Save button. `<SaveStatus state="autosaved" />` ambient |
| **Immediate** | Discrete actions (toggles, deletes, "promote default", item-level mutations) | Action takes effect on click. Optional `<SaveStatus state="immediate" />` label if non-obvious |
| **Edit mode** | Sensitive fields that need a confirm step (API tokens, dangerous toggles) | Read-only view by default; "Edit" reveals fields + Save/Cancel |

Workspace examples to model from:

- **Manual save**: Settings → Sessions tab, Brand → Identity / Colors / Typography tabs. Long forms with a bottom "Save X" button.
- **Autosave on blur**: (none yet in workspace as of v0.1.17 — Messaging tab is the first; future v0.1.x will roll more cards over).
- **Immediate**: Brand → Languages (add/remove/promote-default), Settings → Danger Zone toggles, AI tier provision/test buttons.
- **Edit mode**: Settings → Connections (Cloudflare token, email provider, AI gateway namespace).

#### `Ensemble.SaveStatus` — the visible indicator

```tsx
function MyForm() {
  const [value, setValue] = Ensemble.useState('');
  const [dirty, setDirty] = Ensemble.useState(false);
  const [inFlight, setInFlight] = Ensemble.useState(false);

  const status = Ensemble.useSaveStatus({ dirty, inFlight, manual: true });

  async function save() {
    setInFlight(true);
    try {
      await fetch('/api/save', { method: 'POST', body: JSON.stringify({ value }) });
      setDirty(false);
    } finally {
      setInFlight(false);
    }
  }

  return (
    <Ensemble.Card>
      <Ensemble.CardHeader>
        <Ensemble.CardTitle>My setting</Ensemble.CardTitle>
        {status !== 'clean' && <Ensemble.SaveStatus state={status} />}
      </Ensemble.CardHeader>
      <Ensemble.CardContent>
        <Ensemble.Input value={value} onChange={(e) => { setValue(e.target.value); setDirty(true); }} />
      </Ensemble.CardContent>
      <Ensemble.CardFooter>
        <Ensemble.Button onClick={save} disabled={!dirty || inFlight}>
          {inFlight ? 'Saving…' : 'Save'}
        </Ensemble.Button>
      </Ensemble.CardFooter>
    </Ensemble.Card>
  );
}
```

**States** the component renders:

- `clean` — no changes; manual-save cards typically hide the indicator (`{status !== 'clean' && ...}`)
- `autosaved` — autosave is active and no edit is pending
- `dirty` — user edited; click Save (amber, attention-getting)
- `saving` — write in flight (spinner)
- `saved` — just wrote (green check; the `useSaveStatus` hook auto-fades back after ~1.5s)
- `error` — last save failed (destructive tone; clears on next edit)
- `immediate` — discrete action surface (no save needed)

#### Picking a modality for your guest app

- **Default to manual save** for any form longer than two fields. Operators trust it; the click is a small price for explicit confirmation.
- **Use autosave on blur** for single-field editors where mistakes are cheap and undo is one keystroke (text notes, free-form labels). Always pair with a visible `<SaveStatus state="autosaved" />` so operators know to expect it.
- **Use immediate for discrete actions** — buttons, switches, item-level mutations. Don't add a Save button to a Switch.
- **Use edit mode for credentials or destructive toggles** — operators need a "no, wait, cancel" affordance for high-stakes fields.

**Avoid mixing modalities inside one card.** If a card has any manual-save fields, the whole card should be manual. The exception is *immediate* actions (a Delete button on a row inside a manual-save card is fine — the row mutates immediately, the form below stays dirty until Save).

#### Mirroring the workspace's `useFormStatus` hook

The shell uses a small `useFormStatus({ value, mode })` hook that snapshots the loaded value as a baseline and returns the right `SaveStatusState` based on whether the current value diverges. Guest apps can copy this pattern verbatim — the source is in `packages/shell/src/hooks/useFormStatus.ts`. It's not on the runtime by default (it's a few lines and apps tend to want their own variants), but the underlying primitive (`useSaveStatus`) is exposed on `Ensemble`.

---

### Storage Model (v0.1.17)

Guest apps run as their own Cloudflare Workers — they have their own infrastructure, own their data, and own their lifecycle. The workspace exposes a small set of *services* guests can consume via HTTP, but never gives raw access to its own storage. This section is the canonical reference for "how do I store stuff in a guest app."

#### Guest apps own their own storage

Every guest declares its own bindings in its `wrangler.toml`:

```toml
# packages/connectors/notes/wrangler.toml
[[d1_databases]]
binding = "DB"
database_name = "notes-db"
database_id = "abc123..."

[[kv_namespaces]]
binding = "CACHE"
id = "def456..."

[[r2_buckets]]
binding = "FILES"
bucket_name = "notes-files"
```

Those bindings belong to your guest app. The workspace can't read them; other guest apps can't read them; only your worker code can. Same for Durable Objects, queues, secrets, and any other Cloudflare resource.

#### Scoping data by workspace

The same guest worker serves *every workspace* that installs it. The notes connector is the canonical example — one D1 instance hosts notes for Workspace A, Workspace B, Workspace C, and on. Isolation is **by convention**: every query is scoped by `workspace_id`.

```tsx
import { requireContext } from '@ensemble-edge/guest';

router.get('/api/notes', async (c) => {
  const ctx = requireContext(c.req.raw);
  const result = await c.env.DB.prepare(
    `SELECT * FROM notes WHERE workspace_id = ?`
  ).bind(ctx.workspace.workspaceId).all();
  return c.json({ notes: result.results });
});
```

`requireContext()` returns the workspace + user context the runtime injected on the inbound request. Always scope by `workspace.workspaceId`. Scope by `user.userId` too when data is per-user (e.g. drafts). The runtime won't enforce this — that's your responsibility.

**Migrations:** guests own their own. The notes connector uses the lazy-init-on-first-request pattern (`CREATE TABLE IF NOT EXISTS …`), which works for simple schemas. For complex schemas, ship a migration registry similar to the workspace's `packages/core/src/db/migrations/`.

#### What the workspace exposes (read-only HTTP services)

Guests can't reach into the workspace's D1, KV, or R2 directly — that would break the security model. Instead the workspace exposes a small, intentional service surface:

| Surface | What | Hook |
|---|---|---|
| AI Gateway | LLM/translation calls through workspace-managed tiers | `Ensemble.useAI({ tier })` |
| Locales | Configured content languages | `Ensemble.useLocales()` |
| Auth context | Current user + role | `Ensemble.useUser()` / `/_ensemble/auth/me` |
| Brand identity | Colors, typography, logos, messaging | `/_ensemble/brand/spec`, `/_ensemble/brand/theme`, etc. |
| Brand assets | Workspace-uploaded R2-backed images | `/_ensemble/brand/asset/<key>` |
| Events | Change notifications (see Workspace Events below) | `Ensemble.useWorkspaceEvent(...)` |

Each is an HTTP call. The iframe carries the workspace's session cookie, so requests are authenticated automatically — no token plumbing in the guest worker. Same for component-tier guests in the host React tree.

#### Anti-patterns

- **Don't store secrets in the guest worker without using Cloudflare secrets**. Use `wrangler secret put` for API keys; do not hardcode in `wrangler.toml`.
- **Don't rely on the workspace's storage existing for your data**. Even if you knew the workspace's D1 binding, your worker can't access it — they're different isolates with different bindings.
- **Don't skip workspace_id scoping**. A single missing WHERE clause leaks data across workspaces. Always treat `workspaceId` as a required filter, not an optional one.
- **Don't store per-user data without user_id scoping**. Drafts, preferences, anything user-specific should also key by `user.userId`. Sharing across users within a workspace is fine; mixing is not.

#### What's deferred

Not yet provided by the workspace, but possibly in future releases:

- **Shared KV slot** for tiny guests that don't want to set up their own KV namespace
- **Workspace R2 upload service** for guests to share file storage
- **Cross-guest event channel** for guests that want to react to other guests' mutations

If you need any of these today, file it against the `@ensemble-edge/workspace` repo or implement your own.

---

### Workspace Events & `Ensemble.useWorkspaceEvent()` (v0.1.17)

When the operator changes something in the workspace — adds a language, swaps the default locale, updates brand colors, changes a user's role — guest apps that depend on that state need to know. Pre-v0.1.17 guests either polled or stayed stale until a manual reload. v0.1.17 ships a small event bus that solves this cleanly.

#### Subscribing

```tsx
function MyGuest() {
  const { locales } = Ensemble.useLocales();
  const [forceRefresh, setForceRefresh] = Ensemble.useState(0);

  // When the workspace's locale list changes, refetch.
  Ensemble.useWorkspaceEvent(
    ['locale.added', 'locale.removed', 'locale.default-changed'],
    () => setForceRefresh((n) => n + 1),
  );

  // useLocales caches at module level — bump a state to force its
  // refetch. The simpler pattern is to keep your *own* state and
  // refresh it directly on the event.
  ...
}
```

The hook accepts either a single event type or an array. Handler doesn't need a stable reference — the subscription re-registers when it changes.

#### Event catalog (v0.1.17)

| Type | When | Payload |
|---|---|---|
| `locale.added` | Operator added a content locale | `{ code, display_name }` |
| `locale.removed` | Operator removed a locale (data deleted) | `{ code }` |
| `locale.default-changed` | Default locale promotion | `{ code }` |
| `brand.tokens.changed` | Brand token mutation (any tab) | `{ category, key?, locale? }` |
| `user.role.changed` | A user's role in this workspace changed | `{ user_id, role }` |
| `workspace.settings.changed` | A workspace_setting was updated | `{ key, value }` |

This list is intentionally narrow. Adding new event types is additive; renaming or repurposing an existing one is a breaking change.

#### Transport — how it works under the hood

- **Component-tier guests** (in the host React tree): events flow through an in-memory event bus shared with the shell. Subscription is synchronous.
- **Iframe-tier guests**: the runtime sends `ensemble:subscribe-events` to the host on first `useWorkspaceEvent` call. The host then `postMessage`s every emitted event to the iframe's window. Same handler shape; same payload format.

Guest code doesn't need to know which tier it's in — both surfaces register against `window.Ensemble.useWorkspaceEvent` and get the same behavior.

#### What events are NOT for

- **Streaming data**: events are coarse pub/sub for "something changed," not a real-time data stream. Don't use them for chat messages, presence, etc. — those need a dedicated WebSocket / Durable Object / SSE channel.
- **Cross-guest communication**: events only flow workspace → guest. Guest → guest needs a different mechanism (your own backend, or a future cross-guest channel).
- **Replay / audit log**: events fire and forget. If you missed one, you missed it. Refetch on mount; don't try to reconstruct state from a stream of past events.

#### Anti-patterns

- **Don't subscribe to all event types and switch inside the handler**. Pass an array; the runtime filters before invoking.
- **Don't trigger heavyweight refetches on every event**. Debounce or coalesce inside your handler. `brand.tokens.changed` can fire several times in a row when an operator is editing the messaging tab field-by-field.
- **Don't rely on events for security-critical state changes**. A `user.role.changed` event is a hint; always re-verify role on the server side of any privileged operation. The event is the convenience layer, not the source of truth.

---

### Workspace Typography & `Ensemble.useFonts()` (v0.1.17)

Operators configure their brand typography under **Brand → Typography** (five roles: display, heading, body, mono, wordmark). Each role has a family, a weight, and a style. The workspace loads the right Google Fonts CSS at the page-shell layer and publishes CSS variables consumers reference: `--font-display`, `--font-display-weight`, `--font-display-style`, and the same triplet for each other role.

Guest apps should respect this scheme so the operator's brand reads consistently across the entire workspace.

#### Easy path: just use CSS variables

The workspace already loads the right Google Fonts and publishes the variables to every page (shell + iframe contexts inherit the shell CSS). Guest app CSS can reference them directly:

```css
.guest-heading {
  font-family: var(--font-heading);
  font-weight: var(--font-heading-weight);
  font-style: var(--font-heading-style);
}
```

For most guest apps this is all you need. The workspace handles font loading, weight selection, and italic toggling — your CSS just inherits.

#### When to use `Ensemble.useFonts()`

When you need the resolved typography in code (e.g. to apply different styling per role, or to detect whether the operator is on a system stack vs a Google Font), call the hook:

```tsx
function MyGuest() {
  const { roles, loading } = Ensemble.useFonts();
  if (loading || !roles) return null;

  return (
    <div style={{ fontFamily: roles.body.stack, fontWeight: Number(roles.body.weight) }}>
      <h1 style={{ fontFamily: roles.heading.stack, fontWeight: Number(roles.heading.weight) }}>
        Hello
      </h1>
      {roles.display.isSystem ? (
        <p>Operator uses a system stack — no Google Fonts load needed.</p>
      ) : null}
    </div>
  );
}
```

Each role returns `{ family, weight, style, isSystem, stack }`. The `stack` is the pre-computed `font-family` CSS string (with quoting and fallbacks); apply it directly without further processing.

#### Caching + invalidation

The hook fetches once per module load and caches at module level — multiple components calling it share one request. When the operator changes brand tokens, `brand.tokens.changed` fires (see Workspace Events); the runtime invalidates the cache automatically so the next mount picks up the new values. To force a refetch in-place, listen to the event yourself:

```tsx
Ensemble.useWorkspaceEvent('brand.tokens.changed', () => {
  // Trigger your own refetch / re-render
});
```

#### What `useFonts` does NOT do

- It doesn't load Google Fonts CSS for you. The workspace already does this — the operator's chosen families are available via system `<link>` tags loaded by the shell.
- It doesn't include sizes or scale ratios. That's separate from font-role configuration. Guest apps choose their own type scale.
- It doesn't honor per-role variants beyond family + weight + style. If you need oblique-15° or weight 250, the workspace doesn't track those — your CSS handles them directly.

#### Listing all available Google Fonts

If your guest app needs to expose its own font picker (rare — most guests should match the workspace's typography rather than offer their own), the workspace publishes the cached Google Fonts catalog at `GET /_ensemble/core/fonts/google`. Same data the Brand → Typography picker uses.

---

### Workspace Locales & `Ensemble.useLocales()` (v0.1.17)

Operators configure which BCP-47 content locales their workspace supports under **Brand → Languages**. English is always enabled and serves as the ultimate fallback; other locales are opt-in. Exactly one is the default at any time.

Guest apps that render localized content — translation apps, marketing-copy editors, knowledge-base apps, anything that *speaks* to users — should consume the configured locales rather than ship their own hardcoded list. Operators expect language choices made in one place to apply everywhere.

#### The hook

```tsx
const { locales, defaultLocale, enabledCodes, loading, error } = Ensemble.useLocales();
```

Returns:
- `locales` — full list of `{ code, display_name, is_default, enabled }` rows from the workspace.
- `defaultLocale` — BCP-47 code of the workspace's default locale (e.g. `'en'`, `'es'`, `'fr-CA'`).
- `enabledCodes` — convenience array of enabled codes with default-first ordering.
- `loading` — true on first mount until fetch completes.
- `error` — message string if the fetch failed (network, permission, etc.).

The data is fetched once per page-load and cached at module level — multiple components calling `useLocales()` share one HTTP request.

#### Worked example: a per-locale picker

```tsx
function LanguagePicker({ value, onChange }) {
  const { locales, loading } = Ensemble.useLocales();

  if (loading) return <Ensemble.Skeleton className="h-8 w-32" />;

  return (
    <Ensemble.Select value={value} onValueChange={onChange}>
      <Ensemble.SelectTrigger>
        <Ensemble.SelectValue />
      </Ensemble.SelectTrigger>
      <Ensemble.SelectContent>
        {locales.filter((l) => l.enabled).map((l) => (
          <Ensemble.SelectItem key={l.code} value={l.code}>
            {l.display_name}
            <span className="ml-2 text-xs font-mono text-muted-foreground">{l.code}</span>
            {l.is_default && <Ensemble.Badge variant="outline" className="ml-2 text-[10px]">Default</Ensemble.Badge>}
          </Ensemble.SelectItem>
        ))}
      </Ensemble.SelectContent>
    </Ensemble.Select>
  );
}
```

#### Patterns that work

- **Bound to user preference**: persist the user's choice in your guest app's storage, but only offer codes from `enabledCodes`. If a previously-chosen locale gets disabled by the operator, fall back to `defaultLocale`.
- **Accept-Language negotiation**: when your guest app's API renders localized content, take the user's request `Accept-Language`, match against `enabledCodes`, fall back to `defaultLocale`. Don't render a locale the workspace doesn't claim to support.
- **Translation guest apps**: combine with `Ensemble.useAI({ tier })` pointing at a `workers-ai` translation model. `enabledCodes` tells you which targets to offer; `defaultLocale` tells you which to use as the default source.

#### What `useLocales` does NOT do

- It doesn't translate anything. Use `Ensemble.useAI({ tier })` pointing at a `workers-ai` tier (typically named `translate`) for that.
- It doesn't manage the user's *currently selected* locale. That's per-user/per-app state; store it however you like (`localStorage`, your own backend, URL param). The hook only tells you what's *available*.
- It doesn't push real-time updates when operators change the locale list. Locale changes are rare; a remount picks up the new list. If you need real-time, listen to your own postMessage / refetch on focus.

---

### Brand Domains & `publicDomain` (v0.1.108)

Operators can give a workspace its own **brand domain** — a tenant
hostname (e.g. `curalisto.com`) that workspace public surfaces serve
under instead of the workspace subdomain (`workspace.curalisto.com`).
They configure it under **Settings → Domains**. Once set, the workspace
resolves requests on that host to the tenant, and core public pages
(legal, brand guide) emit canonical URLs + hreflang against it.

Guest apps that emit **public or shareable URLs** — a footer of links, a
link in an email or PDF, an `og:url`, a "copy link" button — should build
those URLs against the brand domain when the tenant has one, so the URL
the end user sees and shares is the tenant's domain, not the workspace
subdomain. Internal, same-page links don't need this: a path-relative
`/foo` already resolves under whatever host served the page.

#### Reading it from workspace context

The brand domain is part of the unified workspace context
(`/_ensemble/workspace/context`), exposed as `publicDomain`:

```ts
const ctx = await fetch('/_ensemble/workspace/context', { credentials: 'include' })
  .then((r) => r.json());
// ctx.publicDomain is either null (no brand domain) or:
//   { domain: 'curalisto.com', proto: 'https', origin: 'https://curalisto.com' }
```

- `publicDomain` is **null** when the tenant hasn't configured one — fall
  back to the guest's own request origin.
- `origin` is the ready-to-use `proto://host` prefix; concatenate a
  root-relative path onto it.

#### Worked example: a shareable URL helper

```ts
/** Build an absolute, brand-aware URL for a public path. */
function publicUrl(ctx, path /* e.g. '/legal/privacy' */) {
  const origin = ctx.publicDomain?.origin ?? window.location.origin;
  return `${origin}${path}`;
}

// Footer link a patient can share:
const privacyUrl = publicUrl(ctx, '/legal/privacy');
// → https://curalisto.com/legal/privacy   (brand domain set)
// → https://workspace.curalisto.com/legal/privacy   (no brand domain)
```

The same rule the core legal pages follow: **only fully-qualified,
outward-facing URLs use `publicDomain`** (canonical, hreflang, emails,
share links). Everything that stays on the current page stays
path-relative and Just Works under either host.

#### Linking to the legal read API

The legal app's read API is path-relative and host-independent, so a
guest fetching legal copy uses a plain path — it resolves under whichever
host the guest is served on:

```ts
const r = await fetch('/api/legal/active?lang=' + ctx.locale.default);
const { docs } = await r.json();
// Render share links with the brand-aware helper:
const links = docs.map((d) => `<a href="${publicUrl(ctx, '/legal/' + d.slug)}">${d.title}</a>`);
```

#### Managing domains (operator surface, not guest-facing)

Adding/removing brand domains is an **operator** action via the admin API
(`GET/POST/DELETE /_ensemble/domains`, admin-gated) and the **Settings →
Domains** UI — not something a guest app does. Guests only *read*
`publicDomain` from context. If your guest needs a domain configured, ask
the operator to add it in Settings; don't try to register one
programmatically.

#### What this does NOT do

- It doesn't rewrite your guest's internal routing or asset paths — those
  stay path-relative and resolve under whatever host serves your guest.
- It doesn't give a guest its *own* subdomain. `publicDomain` is the
  *workspace's* brand domain, shared by all of that tenant's public
  surfaces.
- It doesn't push real-time updates. Brand domains change rarely; a
  remount / context refetch picks up a new one.
