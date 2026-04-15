## 13. The API Gateway

This is where the "Dual Interface" principle becomes something much bigger. Because every app — core, bundled, and guest — declares API routes in its manifest, and because all routes flow through the same Hono Worker with the same auth middleware, **AIUX is automatically an API gateway for the entire company.**

### What This Means

Every AIUX workspace exposes a unified API surface:

```
https://acme.ensemble.ai/_ensemble/
    │
    ├── /discover                    ← Agent discovery
    ├── /admin/...                   ← core:admin API
    ├── /brand/...                   ← core:brand API
    ├── /people/...                  ← core:people API
    ├── /auth/...                    ← core:auth API
    ├── /knowledge/...               ← core:knowledge API
    ├── /apps/...                    ← core:apps API
    ├── /audit/...                   ← core:audit API
    ├── /nav/...                     ← core:nav API
    ├── /dashboard/...               ← bundled:dashboard API
    ├── /files/...                   ← bundled:files API
    ├── /notifications/...           ← bundled:notifications API
    ├── /crm/...                     ← guest:crm API
    ├── /wiki/...                    ← guest:wiki API
    ├── /loan-tracker/...            ← guest:loan-tracker API
    └── /events/...                  ← Event subscriptions (WebSocket/webhook)
```

One base URL. One auth token. Every capability in the workspace. This is fundamentally different from having 15 separate APIs for 15 separate tools.

### The Gateway Middleware Pipeline

Every API request passes through the same pipeline:

```
Request: GET https://acme.ensemble.ai/_ensemble/crm/contacts?limit=50
         Authorization: Bearer <jwt_or_api_key>

    │
    ▼
┌─ 1. Workspace Resolution ──────────────────────────────────┐
│  Host: acme.ensemble.ai → workspace: ws_acme                   │
│  Load workspace config from D1 (cached in KV)               │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─ 2. Authentication ────────────────────────────────────────┐
│  JWT cookie → human user (usr_abc123)                       │
│  Bearer ak_xxx → agent key (ak_acme_deploy_bot)            │
│  Neither → 401 Unauthorized                                 │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─ 3. Membership Check ─────────────────────────────────────┐
│  Is usr_abc123 a member of ws_acme? → Yes (role: admin)     │
│  No → 403 Forbidden                                         │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─ 4. App Resolution ───────────────────────────────────────┐
│  Path: /_ensemble/crm/contacts → app: guest:crm               │
│  Is guest:crm enabled in ws_acme? → Yes                     │
│  Does the user have access to guest:crm? → Yes              │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─ 5. Rate Limiting ────────────────────────────────────────┐
│  Check per-workspace + per-key rate limits                   │
│  Log request to Durable Object counter                       │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─ 6. Route Handler ────────────────────────────────────────┐
│  Delegate to guest:crm's API handler for GET /contacts      │
│  Handler uses @ensemble-edge/sdk for scoped storage access            │
│  Storage automatically scoped to ws_acme + guest:crm         │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─ 7. Response + Audit ─────────────────────────────────────┐
│  Return JSON response with standard envelope                 │
│  Log to audit_log: who, what, when, which app                │
└─────────────────────────────────────────────────────────────┘
```

### Standard API Envelope

All API responses follow a consistent envelope:

```json
{
  "data": { ... },
  "meta": {
    "workspace": "ws_acme",
    "app": "guest:crm",
    "request_id": "req_xxxxx",
    "timestamp": "2026-03-25T10:30:00Z"
  },
  "pagination": {
    "total": 142,
    "limit": 50,
    "offset": 0,
    "has_more": true
  },
  "errors": null
}
```

### Why This Is Powerful

**For agents:** One API key, one base URL, every tool in the company. An agent doesn't need separate credentials for the CRM, the wiki, the file manager, and the knowledge graph. It authenticates once and can orchestrate across all of them.

**For integrations:** Webhooks from external services (Stripe, GitHub, Slack) hit one URL. The gateway routes them to the right app. No per-app webhook configuration.

**For mobile apps:** The native shell app has one API surface to call. Authentication is shared. Data from any app is one fetch away.

**For inter-company communication:** When AIUX Cloud launches, workspace-to-workspace API calls become possible. Ownly Capital's workspace can query a borrower's portal workspace — same protocol, different data, proper auth.

**For compliance:** Every API call is logged in the audit trail. One place to review all access. One place to set rate limits. One place to revoke access.

### OpenAPI Auto-Generation

Because every app declares its routes in the manifest, AIUX can auto-generate an OpenAPI spec for the entire workspace:

```
GET /_ensemble/openapi.json
```

Returns a complete OpenAPI 3.1 document describing every available endpoint across all enabled apps. This means:
- Agents can auto-discover and understand the full API surface
- Developer portals are auto-generated
- Client SDKs can be generated for any language
- API documentation stays in sync with reality

### Webhook Ingress

The gateway also handles inbound webhooks — external services calling into the workspace:

```
POST /_ensemble/webhooks/:app_id/:hook_id
```

Each app can register webhook receivers. The gateway validates the webhook signature, routes to the correct app handler, and logs the event. This replaces per-app webhook URLs scattered across different services.

### Event Egress

The flip side — the gateway can push events out:

```
POST /_ensemble/events/subscribe
{
  "events": ["crm:contact.created", "files:document.uploaded", "audit:role.changed"],
  "delivery": "webhook",
  "url": "https://agent.example.com/hooks",
  "secret": "whsec_XXXXX"
}
```

Or via WebSocket:

```
WS /_ensemble/events/stream
→ { "subscribe": ["crm:*", "knowledge:*"] }
← { "event": "crm:contact.created", "data": { ... }, "app": "guest:crm" }
```

The gateway aggregates events from all apps into a single stream. An agent subscribing to `crm:*` gets every CRM event without knowing the CRM's internal architecture.

### Gateway Configuration (Per Workspace)

Workspace admins can configure gateway behavior in the Auth & Security core app:

```typescript
interface GatewayConfig {
  // Rate limiting
  rateLimits: {
    global: number            // requests/minute across all keys
    perKey: number            // requests/minute per API key
    perUser: number           // requests/minute per human user
  }

  // CORS
  cors: {
    allowedOrigins: string[]  // ['https://app.acme.com', 'https://mobile.acme.com']
    allowedMethods: string[]
    allowCredentials: boolean
  }

  // IP allowlisting (optional)
  ipAllowlist?: string[]

  // Webhook signing
  webhookSecret: string

  // Response headers
  customHeaders?: Record<string, string>

  // API versioning
  defaultVersion: string      // 'v1'
  supportedVersions: string[] // ['v1']
}
```

---

## 14. The Agent Protocol Layer

Every capability in AIUX is accessible via UI (for humans clicking) and API (for agents calling).

### Agent Authentication

```bash
curl -H "Authorization: Bearer ak_ownly_XXXXX" \
     https://acme.ensemble.ai/_ensemble/discover
```

### Discovery Endpoint

An agent's first call — "what can I do here?"

```json
{
  "workspace": {
    "id": "ws_ownly",
    "name": "Ownly Group",
    "type": "organization"
  },
  "apps": {
    "core": [
      { "id": "core:brand", "enabled": true },
      { "id": "core:people", "enabled": true },
      { "id": "core:knowledge", "enabled": true }
    ],
    "bundled": [
      { "id": "bundled:dashboard", "enabled": true },
      { "id": "bundled:ai-assistant", "enabled": true },
      { "id": "bundled:files", "enabled": true }
    ],
    "guest": [
      { "id": "guest:crm", "version": "1.2.0", "endpoints": [...] },
      { "id": "guest:wiki", "version": "2.0.1", "endpoints": [...] }
    ]
  },
  "knowledge": {
    "domains": ["brand", "messaging", "engineering", "org"],
    "context_endpoints": [
      "/_ensemble/knowledge/context?for=app-development",
      "/_ensemble/knowledge/context?for=content-writing",
      "/_ensemble/knowledge/context?for=onboarding"
    ]
  },
  "agent": {
    "scopes": ["apps:read", "apps:write", "knowledge:read", "build:*"],
    "rate_limit": { "requests_per_minute": 1000, "remaining": 987 }
  }
}
```

### App Building via API

An agent can create and deploy guest apps programmatically:

```
POST /_ensemble/apps
Content-Type: application/json

{
  "manifest": {
    "id": "guest:loan-tracker",
    "name": "Loan Tracker",
    "tier": "guest",
    ...
  },
  "source": {
    "type": "inline",
    "entry": "... (compiled Preact component) ..."
  }
}
```

The agent built this app having already consumed the workspace's brand, code standards, and messaging guidelines from the knowledge graph. The result looks native.

---

