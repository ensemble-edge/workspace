# Workstream 8: First-Party Connectors

> Official Ensemble connectors that wrap third-party APIs.

## Scope

Connectors are the highest-leverage guest apps — build once, serve every workspace. This workstream builds the first-party connectors under `@ensemble-edge/*`:

| Connector | Service | Priority |
|-----------|---------|----------|
| `@ensemble-edge/stripe` | Payments, customers, invoices | P0 |
| `@ensemble-edge/google-drive` | File browser, search, sharing | P0 |
| `@ensemble-edge/github` | Repos, issues, PRs | P1 |
| `@ensemble-edge/slack` | Channels, messages, notifications | P1 |
| `@ensemble-edge/notion` | Pages, databases | P2 |
| `@ensemble-edge/linear` | Issues, projects | P2 |
| `@ensemble-edge/google-calendar` | Events, scheduling | P2 |
| `@ensemble-edge/quickbooks` | Accounting, invoices | P3 |
| `@ensemble-edge/hubspot` | CRM contacts, deals | P3 |
| `@ensemble-edge/intercom` | Support tickets | P3 |

## Reference Specs

| Spec | Sections |
|------|----------|
| [05-guest-sdk.md](../reference/05-guest-sdk.md) | Connector category, manifest fields |
| [specs/ensemble/connector.md](../../../specs/categories/ensemble/connector.md) | Connector spec from library |

## Dependencies

**Blocked by:**
- Workstream 5 (Guest Platform) — SDK and gateway must exist

**Blocks:**
- Nothing directly, but connectors drive adoption

## Connector Architecture

Every connector follows the same pattern:

```
1. Authenticate to third-party via OAuth or API key (per-workspace settings)
2. Expose third-party data through standard guest app API routes
3. Render themed UI for browsing and managing external data
4. Register AI panel tools for natural language interaction
5. Emit events to workspace event bus (stripe:payment.received, etc.)
```

## Deliverables

### Phase 8a: Stripe Connector (P0)
- [ ] OAuth flow for Stripe Connect
- [ ] Customers view (list, detail, search)
- [ ] Payments view (list, filter by status)
- [ ] Invoices view (create, send, track)
- [ ] AI tools: "show recent payments", "create invoice for X"
- [ ] Events: `stripe:payment.received`, `stripe:invoice.paid`
- [ ] Manifest with `category: "connector"`, `connects_to: "stripe.com"`

### Phase 8b: Google Drive Connector (P0)
- [ ] OAuth flow for Google Workspace
- [ ] File browser (folders, files, breadcrumbs)
- [ ] Search across Drive
- [ ] File preview (docs, sheets, images)
- [ ] Sharing (get link, set permissions)
- [ ] AI tools: "find document about X", "share file with Y"
- [ ] Events: `gdrive:file.created`, `gdrive:file.shared`

### Phase 8c: GitHub Connector (P1)
- [ ] OAuth flow for GitHub App
- [ ] Repository browser
- [ ] Issues list with filters
- [ ] Pull requests with status
- [ ] AI tools: "show open PRs", "find issues labeled bug"
- [ ] Events: `github:pr.merged`, `github:issue.opened`

### Phase 8d: Slack Connector (P1)
- [ ] OAuth flow for Slack App
- [ ] Channel browser
- [ ] Message search
- [ ] Post message capability
- [ ] AI tools: "search Slack for X", "post to #channel"
- [ ] Events: `slack:message.received` (configurable channels)

### Phase 8e: Additional Connectors (P2-P3)
- [ ] Notion — page browser, database views
- [ ] Linear — issue tracker integration
- [ ] Google Calendar — event list, scheduling
- [ ] QuickBooks, HubSpot, Intercom — as resources allow

## Connector Manifest Template

```json
{
  "id": "stripe-billing",
  "name": "Stripe",
  "version": "1.0.0",
  "category": "connector",
  "connects_to": "stripe.com",
  "icon": "credit-card",

  "settings": {
    "admin": [
      {
        "group": "API Connection",
        "fields": [
          { "key": "stripe_api_key", "type": "secret", "label": "Stripe API Key", "required": true }
        ]
      }
    ]
  },

  "nav": {
    "label": "Stripe",
    "icon": "credit-card",
    "position": "sidebar",
    "children": [
      { "label": "Payments", "path": "/payments" },
      { "label": "Customers", "path": "/customers" },
      { "label": "Invoices", "path": "/invoices" }
    ]
  },

  "ai": {
    "context_prompt": "Use Stripe tools for payment, invoice, and customer billing questions.",
    "tools": [
      { "name": "list_payments", "description": "List recent payments", "api_route": "GET /payments" },
      { "name": "create_invoice", "description": "Create an invoice", "api_route": "POST /invoices", "requires_confirmation": true }
    ]
  },

  "widgets": [
    { "id": "revenue-today", "name": "Today's Revenue", "size": "small", "api_route": "GET /widgets/revenue" }
  ],

  "search": {
    "endpoint": "GET /search",
    "result_types": [
      { "type": "payment", "icon": "dollar-sign", "display": "{amount} from {customer}" },
      { "type": "customer", "icon": "user", "display": "{name} ({email})" }
    ]
  },

  "health": {
    "endpoint": "GET /health",
    "dependencies": [
      { "name": "Stripe API", "endpoint": "https://api.stripe.com/healthcheck", "type": "external" }
    ]
  }
}
```

## Acceptance Criteria

- [ ] Each connector authenticates via OAuth or API key
- [ ] Data renders in themed UI inside workspace
- [ ] AI panel can query and act on external service
- [ ] Events flow through workspace event bus
- [ ] Search results appear in command palette
- [ ] Health status shows in Status dashboard

## Open Questions

1. **OAuth callback domain**: Where do OAuth flows redirect? (Proposal: `registry.ensemble.ai/oauth/callback/:connector`)
2. **Rate limiting**: Honor third-party rate limits? (Proposal: yes, with exponential backoff)
3. **Data caching**: Cache API responses? (Proposal: KV with short TTL, configurable per connector)

## Estimated Effort

**2 weeks per connector** for full implementation with AI tools, search, widgets, and events.

**Suggested order:**
1. Stripe (2 weeks) — most valuable for business workspaces
2. Google Drive (2 weeks) — universal file access
3. GitHub (2 weeks) — developer teams
4. Slack (2 weeks) — communication bridge
5. Others as resources allow
