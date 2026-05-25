# AI Coding Agent Guidance for @ensemble-edge/guest

This document provides context for AI coding agents working on the @ensemble-edge/guest package.

## Package Purpose

@ensemble-edge/guest is the platform-agnostic SDK for building guest apps:
- Zero runtime dependencies (works anywhere)
- HTTP-first API surface (with postMessage as a transport for UI events)
- Type-safe context, auth, theme, and events
- Works in browsers, workers, and any JS runtime

## ⚠️ Build guest apps API-first

**Strongly recommended:** structure your guest app as an HTTP API first,
and expose every business action via an endpoint reachable through the
workspace gateway. Treat UI rendering as a SECOND concern that *consumes*
your own API.

Why:

1. **Operators can debug your app via the workspace API key.** Anyone with
   a workspace `wks_*` token can hit `/_ensemble/apps/<your-app-id>/*` and
   call your endpoints directly — no UI session needed. This unlocks
   troubleshooting, scripting, CI integrations, agent workflows, monitoring.

2. **The workspace itself uses your API for sidebar widgets, search, AI
   tool integrations, dashboard cards.** If those affordances aren't backed
   by stable HTTP endpoints, the workspace can't surface them.

3. **Cross-app integrations work for free.** Another guest app can call
   yours via the gateway. Without an API, every integration becomes UI
   scraping or postMessage choreography.

4. **Testing is cheap.** `curl` against your endpoints from a CI step
   exercises the real production code path. UI tests are slower + more
   fragile.

### What "API-first" looks like in practice

Your guest app exposes routes like:

```
GET    /api/schemas            — list resources
POST   /api/schemas            — create
GET    /api/schemas/:id        — read
PATCH  /api/schemas/:id        — update
DELETE /api/schemas/:id        — delete
POST   /api/schemas/:id/<verb> — domain action (publish, translate, etc)
GET    /health                 — liveness probe
GET    /manifest               — your app's manifest JSON (the workspace
                                 caches this for the sidebar / install UI)
```

The workspace forwards every request that comes in at
`/_ensemble/apps/<your-app-id>/*` to your worker, injecting these headers
that the SDK exposes via `getContext()`:

| Header | Use |
|---|---|
| `X-Ensemble-Workspace-Id` | Which workspace is calling — scope your data |
| `X-Ensemble-User-Id` | The acting user (or workspace API key's creator) |
| `X-Ensemble-User-Email` | Human-readable actor for audit logs |
| `X-Ensemble-User-Role` | One of `owner`/`admin`/`member`/`guest` |
| `X-Ensemble-App-Id` | Your own app id — verify it matches what you expect |
| `X-Ensemble-Capability-Token` | A workspace-issued capability token (currently unverified, future feature) |
| `X-Ensemble-Request-Id` | Trace ID — include in your logs |

Treat these as the source of truth for "who is calling and why." Do not
re-authenticate inside your guest app — the workspace already did that.

### Endpoints to ALWAYS expose

| Endpoint | Why |
|---|---|
| `GET /health` | Liveness probe — workspace marks unhealthy apps in the install UI |
| `GET /manifest` | Self-describing manifest (id, name, version, permissions, entry, widgets, etc) |
| `GET /api/<resource>` | List operations — used by widgets, search, dashboards |

### What NOT to do

- ❌ Don't hide business logic inside `onActivate()` event handlers
  with no HTTP equivalent. UI-only logic is invisible to the workspace
  and unscriptable.
- ❌ Don't require a browser session to read data. If your app stores
  data, that data should be readable via the API with the right scope.
- ❌ Don't ship a guest app whose only entry point is `/` returning HTML.
  At minimum, expose `/manifest` and `/health` as JSON.

## Key Concepts

1. **Guest apps are services first, UI second.** They run in CF Workers
   (or HTTP services) and serve a JSON API. The UI is a consumer of that
   API.
2. **The workspace is a privileged client.** It can call any of your
   endpoints via the gateway with full workspace context injected.
3. **Permissions are explicit** — apps declare what they need in
   manifest.permissions. The workspace enforces these at the gateway.
4. **Theme sync is automatic** — UI components receive theme updates from
   the workspace via the workspace-context endpoint.

## API Surface (SDK helpers)

```typescript
// Define your app
defineGuestApp({ manifest, onInit, onActivate, onDeactivate, fetch })

// Get workspace context (from X-Ensemble-* headers)
getContext() → { workspaceId, userId, userEmail, role, appId, requestId, capabilityToken }

// Theme (workspace-context-driven, no postMessage in 2026+)
getTheme() → ThemeContext  // colors, typography, spatial, mode
onThemeChange(callback) → unsubscribe

// Events bus
events.on(type, handler) → unsubscribe
events.emit(type, payload)

// Auth utilities (validate the workspace's capability token)
getAuth() → { token, ... } | null
```

For the React-app SDK (`@ensemble-edge/sdk`), see its own claude.md.

## Platform Adapters

This package is platform-agnostic. Platform-specific adapters:
- `@ensemble-edge/guest-cloudflare` — For Cloudflare Workers (typical)
- `@ensemble-edge/guest-react` — For React apps (future)
- `@ensemble-edge/guest-vue` — For Vue apps (future)

## Testing Guest Apps

Guest apps can be tested several ways. Prefer the higher-confidence
test types whenever possible:

1. **Curl against deployed**: `curl https://workspace.example.com/_ensemble/apps/<your-app>/api/...`
   with a workspace API key. Exercises the real production path.
2. **Unit tests**: mock the workspace context (X-Ensemble-* headers),
   call your route handlers directly, assert on the JSON response.
3. **Simulate postMessage events**: for UI components only — the API
   surface should be tested separately.
