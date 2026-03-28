## 7. Bundled Apps — Overview

Bundled apps ship in the same binary as core apps but represent optional functionality that most workspaces will want. Workspace admins can enable or disable them. Workspace templates can set default states.

### Bundled App: Dashboard

**ID:** `bundled:dashboard`
**Display:** viewport
**Nav:** 📊 Dashboard (sidebar, section: "tools", order: 1)

Customizable widget grid. Each widget is a mini-view from another app or a standalone metric.

**Features:** Widget grid layout (drag/drop), built-in widget types (stat card, chart, activity feed, quick actions, recent items), apps can register custom widgets via SDK, per-user dashboard customization within workspace.

---

### Bundled App: AI Assistant (The AI Panel)

**ID:** `bundled:ai-assistant`
**Display:** panel (right, pinnable, resizable)
**Nav:** AI (panel-bar, keyboard shortcut)
**Toggle:** toolbar button or `⌘+Shift+A`

The AI panel is the most important bundled app. It's not a chatbot — it's a **workspace-aware agent** that can see what you're looking at, query any app's API through the gateway, execute multi-step actions across apps, read the knowledge graph, and compose workflows from natural language prompts.

**The core insight:** Every guest app exposes API routes through the gateway. Every API route is documented in the app's manifest. The AI panel can call any of them on behalf of the user — with the user's permissions. "Show me customers with low credits and send them a reminder" triggers a GET to the customer manager app's API, filters results, then calls the email extension. All from one sentence.

#### How the AI Panel Works

```
User types: "approve both pending trials and draft a recharge email for DataDriven"
                                     │
                                     ▼
┌─── AI Panel (bundled:ai-assistant) ────────────────────────────────────┐
│                                                                        │
│  1. CONTEXT ASSEMBLY                                                   │
│     - Active app: @nendo/customers (from viewport state)               │
│     - Current view: customer list, filtered by "all"                   │
│     - Available APIs: all installed guest app manifests                 │
│     - User permissions: admin (can approve trials, send emails)        │
│     - Knowledge: workspace knowledge graph (brand voice, etc.)         │
│                                                                        │
│  2. TOOL RESOLUTION                                                    │
│     - "approve trials" → POST /_ensemble/customers/trials/{id}/approve    │
│     - "draft email" → calls LLM to compose, presents as action card    │
│     - "send email" → POST /_ensemble/extensions/resend/send               │
│                                                                        │
│  3. EXECUTION (via API gateway, same auth as user)                     │
│     - Gateway validates permissions per call                           │
│     - Audit log records each action                                    │
│     - Results streamed back to AI panel                                │
│                                                                        │
│  4. RESPONSE RENDERING                                                 │
│     - Text responses as chat bubbles                                   │
│     - Data results as action cards (structured, interactive)           │
│     - Pending actions as confirmation cards (user must approve)        │
│     - Links to navigate to relevant app views                          │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

#### Interactive Response Types

The AI panel doesn't just return text. It renders structured, interactive content:

**Chat bubbles** — standard conversational text for explanations and summaries.

**Action cards** — structured results with data and optional action buttons. Example: a list of customers matching a query, with "Email all" or "Export CSV" buttons. The buttons call guest app APIs through the gateway.

**Confirmation cards** — when the AI wants to take a destructive or significant action (send an email, revoke a key, approve a trial), it presents a confirmation card first. The user clicks "Confirm" or "Edit first." No actions happen without explicit approval.

**Navigation links** — "View this customer" links that navigate the viewport to the relevant app and page.

**Inline data** — small tables, metric summaries, charts that render directly in the panel without navigating away from the current viewport.

#### LLM Configuration — Who Pays?

LLM calls are a real cost. The configuration is hierarchical:

```
┌─ Ensemble-level defaults ─────────────────────────────────────────┐
│  Workers AI (free tier models) — available to all workspaces      │
│  This is the zero-config baseline. The AI panel works out of the  │
│  box with Workers AI models at no additional cost.                │
└───────────────────────────────┬───────────────────────────────────┘
                                │ workspace can override
                                ▼
┌─ Workspace-level config ──────────────────────────────────────────┐
│  Set in ensemble.config.ts or Admin → AI settings:                    │
│                                                                    │
│  ai: {                                                             │
│    provider: 'anthropic',           // or 'openai', 'workers-ai'  │
│    model: 'claude-sonnet-4-20250514',                              │
│    apiKey: env.ANTHROPIC_API_KEY,   // workspace secret            │
│    maxTokensPerRequest: 4096,                                      │
│    maxRequestsPerUser: 100,         // daily per-user limit        │
│    systemPrompt: 'You are the AI assistant for Nendo...',          │
│  }                                                                 │
│                                                                    │
│  The workspace owner pays for LLM calls. The API key is stored    │
│  as a Worker secret, never exposed to the client.                 │
└───────────────────────────────┬───────────────────────────────────┘
                                │ guest apps can add context
                                ▼
┌─ Guest app-level context ─────────────────────────────────────────┐
│  Guest apps don't configure their own LLM. Instead, they          │
│  contribute context and tools to the workspace AI panel:          │
│                                                                    │
│  // In the guest app manifest                                      │
│  "ai": {                                                           │
│    "tools": [                                                      │
│      {                                                             │
│        "name": "list_customers",                                   │
│        "description": "List customers with optional filters",     │
│        "api_route": "GET /customers",                             │
│        "parameters": {                                             │
│          "status": "active | trial | exhausted",                  │
│          "credits_below": "number",                               │
│          "sort": "last_active | credits | calls"                  │
│        }                                                           │
│      },                                                            │
│      {                                                             │
│        "name": "approve_trial",                                    │
│        "description": "Approve a pending trial request",          │
│        "api_route": "POST /trials/{id}/approve",                  │
│        "requires_confirmation": true                               │
│      }                                                             │
│    ],                                                              │
│    "context_prompt": "This app manages Nendo API customers..."    │
│  }                                                                 │
│                                                                    │
│  The AI panel reads all installed apps' ai.tools at startup and   │
│  includes them as available function calls in the LLM context.    │
└───────────────────────────────────────────────────────────────────┘
```

**The billing model is clean:** The workspace owner configures and pays for the LLM. They choose the provider and model. They set per-user limits. Guest apps contribute tools and context but don't incur LLM costs themselves — they just expose API routes that the AI panel can call. The LLM call happens in the workspace Worker; the API calls to guest apps happen through the gateway with normal auth.

**For Ensemble Cloud:** Cloud workspaces get Workers AI for free (bundled in the hosting cost). Upgrading to Anthropic/OpenAI models is a workspace-level setting with usage-based billing.

#### SDK Support for AI Panel

**For guest app developers (`@ensemble-edge/guest`):**

Add an `ai` section to your manifest to make your app AI-panel-aware:

```typescript
export default defineGuestApp({
  manifest: {
    // ...existing manifest fields...

    ai: {
      // Tools the AI panel can call (maps to your API routes)
      tools: [
        {
          name: 'list_customers',
          description: 'Search and filter customers by status, credits, usage',
          api_route: 'GET /customers',
          parameters: {
            status: { type: 'string', enum: ['active', 'trial', 'exhausted'] },
            credits_below: { type: 'number', description: 'Filter by credit threshold' },
          },
        },
        {
          name: 'approve_trial',
          description: 'Approve a pending trial request and provision API key',
          api_route: 'POST /trials/{id}/approve',
          requires_confirmation: true,  // AI must show confirmation card
        },
        {
          name: 'send_recharge_reminder',
          description: 'Send a recharge reminder email to a customer',
          api_route: 'POST /customers/{id}/remind',
          requires_confirmation: true,
        },
      ],

      // Additional context for the AI when this app is in the viewport
      context_prompt: 'The Nendo customer manager tracks API key customers. Customers have statuses (active, trial, exhausted), credit balances, and usage history. Trial customers need manual approval.',

      // What the AI should know about the current view state
      context_provider: 'viewport',  // AI gets notified of viewport state changes
    },
  },
})
```

**For the workspace shell (`@ensemble-edge/sdk`):**

The AI panel uses the SDK's event bus to know what's happening in the viewport:

```typescript
// The AI panel listens to viewport state changes
import { useAppContext } from '@ensemble-edge/sdk'

// Inside a guest app, broadcast context to the AI panel
const { broadcastAIContext } = useAppContext()

broadcastAIContext({
  currentView: 'customer-list',
  filters: { status: 'all' },
  selectedItems: ['customer_123'],
  dataCount: 147,
})
```

#### What Makes This Different from ChatGPT

This isn't a generic LLM chat. The difference is:

1. **It knows your workspace.** The system prompt includes the workspace name, the knowledge graph, the installed apps, and the current user's role.

2. **It can act.** Function calling through the API gateway means it doesn't just answer questions — it approves trials, sends emails, queries databases, exports reports. Every guest app's API is a tool.

3. **It respects permissions.** The AI calls APIs with the user's JWT. If a viewer asks the AI to revoke an API key, the gateway returns 403. The AI tells the user they don't have permission. No special-casing needed.

4. **It shows, not tells.** Action cards, confirmation dialogs, navigation links, inline data. The AI panel renders structured UI, not just text.

5. **It's contextual.** When you're looking at a customer list, the AI knows. When you switch to usage analytics, the AI's available tools and context change. The viewport drives the conversation context.

---

### Bundled App: File Manager

**ID:** `bundled:files`
**Display:** viewport / panel
**Nav:** 📁 Files (sidebar, section: "tools")

R2-backed file storage with workspace-scoped permissions.

**Features:** Folder hierarchy, file upload (drag/drop, bulk), preview (images, PDFs, text), file sharing (internal links), storage quota management, version history for documents.

---

### Bundled App: Notifications

**ID:** `bundled:notifications`
**Display:** panel (right)
**Nav:** 🔔 Notifications (panel-bar)

Unified notification center across all apps.

**Features:** Aggregated notifications from all installed apps. Read/unread state. Notification preferences (per app, per event type). Mark all read. Click to navigate to source.

---

### Bundled App: Activity Feed

**ID:** `bundled:activity`
**Display:** viewport / panel
**Nav:** 📡 Activity (sidebar, section: "tools")

Real-time feed of everything happening in the workspace.

**Features:** Event stream from all apps (human and agent activity). Filterable by app, person, event type. "What happened while I was away" summary. Subscribable — follow specific apps or people.

---

### Bundled App: Status

**ID:** `bundled:status`
**Display:** viewport
**Nav:** Status (sidebar, section: "workspace")

Unified health dashboard for the entire workspace. Aggregates health check endpoints from all installed guest apps and external services into one view.

**How it works:** Guest apps declare a `health` field in their manifest:

```json
{
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
      }
    ]
  }
}
```

The status app polls each guest app's health endpoint through the gateway (same-zone via service binding, remote via HTTP). It also polls declared external dependencies directly. Results are cached in KV with the configured interval.

**Features:**

- Consolidated health view — every installed app + their declared dependencies in one page
- Status indicators: healthy (green), degraded (yellow), down (red), unknown (gray)
- Response time tracking per endpoint (p50, p95, p99 over last 24h)
- Incident timeline — when did something go down, when did it recover
- Uptime percentages (24h, 7d, 30d) per app and dependency
- Alert configuration — workspace admins set thresholds for email/push notifications
- AI panel integration — "is anything down?" returns a summary from the status app
- Public status page option — toggle `visibility: public` to expose a branded status page at `~acme/status` for customers
- Cron-powered: a scheduled trigger polls all endpoints at their configured intervals and writes results to D1. The dashboard reads from D1/KV, not from live checks.

**The manifest `health` field:**

| Field | Type | Description |
|---|---|---|
| `endpoint` | string | The app's own health check route (called through gateway) |
| `interval` | number | Poll interval in seconds (default: 60) |
| `timeout` | number | Max response time in ms before marking degraded (default: 5000) |
| `display_name` | string | How this app appears in the status dashboard |
| `dependencies` | array | External services this app depends on (polled directly) |
| `dependencies[].name` | string | Display name of the dependency |
| `dependencies[].endpoint` | string | Full URL to poll |
| `dependencies[].type` | string | `external` (third-party) or `internal` (another workspace app) |

A healthy response is any `2xx` status code returned within the timeout. The response body can optionally include structured health data:

```json
{
  "status": "healthy",
  "checks": {
    "database": "ok",
    "cache": "ok",
    "enrichment_api": "degraded"
  },
  "latency_ms": 12
}
```

If the response includes `checks`, the status app displays per-subsystem health, giving more granular visibility than a simple up/down.

---

