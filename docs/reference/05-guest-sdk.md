## 8. Guest Apps, Delivery Methods & The Guest SDK

Guest apps are where the real power of Ensemble lives. They're the company's custom tools, the community's shared utilities, and — ultimately — the way major SaaS products integrate with the workspace. Every guest app, whether built by the workspace developer or by Linear or Stripe, shows up identically in the workspace: same sidebar, same theme, same permissions, same audit trail.

### The Architectural Principle: Guest Apps Are Always Separate Services

In prior versions of this spec, guest apps could be compiled into the workspace Worker. We've revised this. **The workspace Worker is thin — it runs the shell, core apps, bundled apps, and the API gateway. Guest apps always run as separate services.** Even "your own" guest apps run on separate Workers in the same Cloudflare zone.

Why:

- The workspace Worker stays small, fast, and easily upgradeable (it's just `@ensemble-edge/core`)
- Guest apps have independent deployment lifecycles — deploy your CRM without touching the workspace
- Guest apps can be built on any platform — Cloudflare Workers, Vercel, AWS Lambda, Node, Deno
- The same guest app can serve multiple workspaces without being compiled into each one
- The security boundary is cleaner — guest apps never run in the same execution context as the core

The workspace's API gateway proxies requests between the shell and guest apps. For same-zone Cloudflare Workers, this uses service bindings (effectively zero latency). For remote apps, it's a standard HTTP proxy with auth token injection.

```
┌─── Workspace Worker (thin) ─────────────────────────────┐
│                                                          │
│  @ensemble-edge/core: shell, core apps, bundled apps, gateway     │
│                                                          │
│  All guest app requests are proxied through the gateway:  │
│                                                          │
│  /app/crm/*        → CRM Worker (same CF zone)          │
│  /app/wiki/*       → Wiki Worker (same CF zone)          │
│  /app/linear/*     → linear-ensemble.app (remote)        │
│  /app/stripe/*     → stripe-ensemble.app (remote)        │
│                                                          │
│  Gateway handles: auth, permissions, rate limiting,       │
│  audit logging, theme injection, settings injection       │
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

