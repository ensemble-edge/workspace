# Workstream 5: Guest Platform

> The SDK and gateway infrastructure that enables guest apps, agents, and connectors.

## Scope

This workstream builds the platform for third-party and custom apps:

- `@ensemble-edge/guest` SDK (core + platform adapters)
- API gateway with guest app proxy
- Manifest schema and validation
- Extension point stitching (widgets, search, notifications, etc.)
- Agent protocol layer

## Reference Specs

| Spec | Sections |
|------|----------|
| [05-guest-sdk.md](../reference/05-guest-sdk.md) | Guest SDK, manifest, platform adapters, categories |
| [02-app-architecture.md](../reference/02-app-architecture.md) | Three-tier model |
| [09-api-gateway.md](../reference/09-api-gateway.md) | Gateway middleware, agent protocol |

## Dependencies

**Blocked by:**
- Workstream 1 (Foundation) — auth, permissions
- Workstream 2 (Shell) — viewport for rendering
- Workstream 3 (Core Apps) — App Manager for install/config

**Blocks:**
- First-party connectors (@ensemble-edge/stripe, etc.)
- Community guest apps
- Agent ecosystem

## Deliverables

### Phase 5a: Guest SDK Core
- [ ] `@ensemble-edge/guest` package — manifest types, context parsing, auth validation
- [ ] `.well-known/ensemble-manifest.json` convention
- [ ] `GuestAppContext` interface (workspace, user, settings, storage, events, theme)
- [ ] Theme token helpers for CSS variable consumption

### Phase 5b: Platform Adapters
- [ ] `@ensemble-edge/guest-cloudflare` — CF Workers, service bindings, D1 scoped storage
- [ ] `@ensemble-edge/guest-vercel` — Vercel Functions adapter
- [ ] `@ensemble-edge/guest-node` — Express/Fastify adapter
- [ ] Additional: `guest-deno`, `guest-aws`, `guest-bun`

### Phase 5c: API Gateway
- [ ] Gateway middleware pipeline (auth → membership → app resolution → rate limit → proxy → audit)
- [ ] Service binding detection (0ms same-zone) vs HTTP proxy (remote)
- [ ] Capability token injection for guest app requests
- [ ] Standard API envelope (`data`, `meta`, `pagination`, `errors`)

### Phase 5d: Extension Point Stitching
- [ ] Dashboard widget compositor (manifest `widgets` field)
- [ ] Federated command palette search (manifest `search` field)
- [ ] Notification aggregator (manifest `notifications` field)
- [ ] Activity feed compositor (manifest `activity` field)
- [ ] Settings compositor (manifest `settings.admin` field)
- [ ] Health aggregator (manifest `health` field)
- [ ] Docs browser (manifest `docs` field)

### Phase 5e: Agent Protocol
- [ ] Discovery endpoint (`GET /_ensemble/discover`)
- [ ] Agent key auth (workspace-scoped API keys)
- [ ] Knowledge context compiler (`GET /_ensemble/knowledge/context?for=...`)
- [ ] OpenAPI auto-generation from manifests

## Acceptance Criteria

- [ ] Guest app can be built with `@ensemble-edge/guest-cloudflare`
- [ ] Guest app manifest validates correctly
- [ ] Gateway proxies requests with auth injection
- [ ] Service bindings work for same-zone apps
- [ ] Widgets from guest apps appear in dashboard
- [ ] Search returns results from all installed apps
- [ ] Agent can authenticate and call discovery endpoint

## Manifest Extension Points Summary

| Field | Surface | What it contributes |
|-------|---------|---------------------|
| `ai.tools` | AI Panel | Callable API routes for LLM |
| `ai.context_prompt` | AI Panel | App-specific context for prompts |
| `widgets` | Dashboard | Data cards, charts, lists |
| `search` | Command Palette | Searchable result types |
| `notifications` | Notification Center | Event display templates |
| `activity` | Activity Feed | Event templates with actors |
| `quick_actions` | Bookmarks | Pinnable shortcuts |
| `health` | Status Dashboard | Health endpoint + dependencies |
| `docs` | Docs Browser | Documentation pages |
| `settings.admin` | Settings | Admin-configurable fields |

## Open Questions

1. **Scoped storage schema**: Auto-create tables per app or require migrations? (Proposal: auto-create basic key-value, migrations for complex)
2. **Rate limits**: Per-app or global? (Proposal: configurable per-app with global fallback)
3. **Manifest caching**: KV TTL? (Proposal: 5 minutes, invalidate on app update)

## Estimated Effort

**5-6 weeks** — this is the most complex workstream, foundational to the ecosystem.
