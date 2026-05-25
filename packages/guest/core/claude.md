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

## Using @ensemble-edge/ui in guest apps + public pages

**Yes — guest apps and public-facing sites built around them can use
the same shared UI component library as the workspace itself.** This is
the design intent: visual consistency between the operator-facing
admin (inside the workspace) and any public-facing pages the guest app
serves (on consumer domains) should be automatic, not something each
team rebuilds.

`@ensemble-edge/ui` is a shadcn-derived component library exporting
Card, Button, Dialog, Input, Select, Tabs, Badge, AlertDialog, Toast,
and ~30 more primitives. The same components the workspace shell uses
internally are available to anyone who installs the package.

### Scenario 1 — Component-tier guest app (in-workspace UI)

This is the modern primary tier (what `quiz-cms` and similar apps use).
Your app's React component renders inside the workspace's React tree,
so it inherits the workspace's Tailwind config + brand CSS variables
automatically.

```typescript
import { Button, Card, CardHeader, CardTitle, CardContent } from '@ensemble-edge/ui';

export function MyAppView() {
  return (
    <Card>
      <CardHeader><CardTitle>Hello</CardTitle></CardHeader>
      <CardContent>
        <Button>Click me</Button>
      </CardContent>
    </Card>
  );
}
```

No setup needed — the workspace already loaded Tailwind, brand CSS, and
shadcn primitives. Your component renders pixel-identical to a core app.

### Scenario 2 — Public-facing pages (consumer domain)

If your guest app also serves public pages on a different domain (e.g.
`quiz.example.com` for end users while the CMS lives in the workspace),
you can ALSO use `@ensemble-edge/ui` — but you need to bring in two
things:

1. **The Tailwind config + CSS** — `@ensemble-edge/ui` ships its components
   as Tailwind-styled React (or framework-of-your-choice via shadcn
   primitives). Your public site's Tailwind config needs to scan
   `node_modules/@ensemble-edge/ui` for class names. Standard
   `content: ['./node_modules/@ensemble-edge/ui/**/*.{js,ts,jsx,tsx}']`
   entry handles it.

2. **The workspace brand CSS** — load
   `https://workspace.<your-domain>/_ensemble/brand/css` as a
   `<link rel="stylesheet">` in `<head>`. This defines the CSS custom
   properties (`--brand-primary-main`, `--brand-background-light`, etc)
   that the components reference. Without it, components fall back to
   shadcn defaults (gray buttons, etc).

   v0.1.81+: the brand CSS endpoint is cross-origin-cached with
   `public, max-age=300, stale-while-revalidate=86400`, so it loads
   fast and doesn't block first paint after the first visit.

   **Defensive tip**: in your own component-level CSS or inline styles,
   hardcode hex fallbacks next to the `var()` reference for critical
   above-the-fold colors. On a cold cache + slow cellular connection,
   the cross-origin brand CSS can arrive AFTER your shell paints. Hex
   fallback bridges that race:

   ```css
   .quiz-button {
     /* Hex literal fallback for first-paint, var() takes over once CSS arrives */
     background: var(--brand-secondary-main, #137774);
     color: var(--brand-on-secondary, #ffffff);
   }
   ```

### Standalone pages NOT using the workspace brand CSS

If your public page genuinely doesn't want the workspace's brand styling
(e.g. a marketing page that uses its own design system), you can still
use `@ensemble-edge/ui` for the components but the styling will follow
shadcn defaults — neutral gray palette, system fonts. You can override
the CSS variables in your own stylesheet to match your design system
without changing the components.

### What `@ensemble-edge/ui` does NOT include

- Routing primitives (use the host framework's router)
- Data fetching (use the SDK's hooks for workspace-aware fetches)
- Layout chrome (the workspace provides Sidebar/Toolbar/Viewport — guest
  apps don't reimplement these for in-workspace use)
- Form state management (use React Hook Form, Formik, or vanilla state)

The component library is intentionally narrow: visual primitives only.
That keeps it framework-agnostic and version-stable.

## Calling AI from a guest app

The workspace exposes an AI tier proxy at `/_ensemble/ai/call/<tier-name>`.
Guest apps pick a tier by NAME (`smart` / `good` / `simple` / etc); the
operator wires each tier name to a specific model in the workspace's
Settings → Connections → AI Access tab.

**Critical security boundary:** provider credentials (OpenAI key,
Anthropic key, etc) live in the WORKSPACE, never in the guest app. Your
guest app just picks a tier name; the workspace handles auth + dispatch.

### Conventional tier semantics

| Tier | Use for |
|---|---|
| `simple` | Fast & cheap. Classification, autocomplete, short responses. |
| `good`   | Production default. Balanced quality and cost. The workhorse. |
| `smart`  | Maximum capability. Slower, more expensive. Reasoning, long-form. |

Operators can add custom tiers too (any name). Your guest app passes
whatever tier name it wants.

### React: useAI() hook (from @ensemble-edge/sdk)

```typescript
import { useAI } from '@ensemble-edge/sdk';

function MyComponent() {
  const ai = useAI('smart');

  async function summarize(text: string) {
    const result = await ai.run({
      messages: [
        { role: 'system', content: 'Summarize concisely.' },
        { role: 'user', content: text },
      ],
      max_tokens: 256,
    });
    return result.text;  // Just the assistant's reply
    // Full response also available: result.raw, result.model, result.usage
  }
}
```

### Non-React: aiClient directly

```typescript
import { aiClient } from '@ensemble-edge/sdk';

const result = await aiClient.run('good', {
  messages: [{ role: 'user', content: 'Hello' }],
  max_tokens: 64,
});
console.log(result.text);
```

### Raw fetch (no SDK)

If you can't bring the SDK in, hit the endpoint directly with the user's
session cookie (which the browser sends automatically for same-origin
embedded guests):

```typescript
const r = await fetch('/_ensemble/ai/call/smart', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'Hello' }],
    max_tokens: 64,
  }),
});
const body = await r.json();
const text = body.choices[0].message.content;
```

### Tier fallback behavior

If the operator hasn't configured the tier you requested, the workspace
silently falls back to the `good` tier (if one exists). The
`X-Ensemble-Tier-Fallback` response header carries the originally-
requested tier name when a fallback occurred. The `useAI` hook surfaces
this as `result.fallback_used` — useful for logging "guest asked for
`smart` but we served `good`" but typically not user-facing.

### Cost considerations

Every AI tier call hits a real provider. Each provider has its own
pricing (Cloudflare Workers AI is the cheapest, Anthropic Claude tends
to be the most expensive). Guest apps should:

  • Cache repeated requests where appropriate.
  • Use the cheapest tier that gives acceptable quality.
  • Prefer `simple` for high-volume short-response cases.
  • Reserve `smart` for genuinely complex reasoning tasks.

The workspace audit log records every credential-touching action but
NOT every AI call (too noisy). The Cloudflare AI Gateway dashboard
shows per-tier usage / cost / latency metrics — operators can grant
themselves the gateway view to monitor guest-app AI consumption.

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
