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

### Tabs — match the Brand/Settings pattern (auto-responsive)

Guest apps with multi-section views should use the same Tabs primitive
the built-in apps use (Brand, Settings, Admin). It's `Tabs`, `TabsList`,
`TabsTrigger`, `TabsContent` from `@ensemble-edge/ui`. Configure with
`variant="line"` to match the underline-style look of workspace pages.

```typescript
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@ensemble-edge/ui';

export function MyAppPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My App</h1>
        <p className="text-muted-foreground">Section description</p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList variant="line" className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewPanel /></TabsContent>
        <TabsContent value="settings"><SettingsPanel /></TabsContent>
        <TabsContent value="advanced"><AdvancedPanel /></TabsContent>
      </Tabs>
    </div>
  );
}
```

**Variants:**
  • `variant="line"` — underline-style strip. Brand, Settings, Admin
    use this. Recommended for guest apps that want to feel native.
  • `variant="default"` — pill-style strip in a rounded gray bar
    (subtler). Use when tabs are a secondary affordance, not the
    main page chrome.

**Responsive mobile collapse is automatic.** TabsList uses a
ResizeObserver to watch its container's width — when narrower than
640px, the strip silently collapses into a native `<select>`
dropdown. No media queries to manage, no breakpoints. Width-based
(not viewport-based) so a tab strip inside a narrow sidebar
collapses correctly even on a desktop. Brand/Settings get this same
behavior; guest apps get it for free.

To DISABLE auto-collapse (rare — e.g. a tab strip that's always
expected to fit), pass `noCollapse` on TabsList:

```typescript
<TabsList variant="line" noCollapse>...</TabsList>
```

#### Hash-based tab routing (deep linking)

Built-in apps sync the active tab with the URL hash so
`/brand-app#colors` deep-links to the Colors tab. Guest apps can
adopt the same pattern with a small hook — useful for sharable /
bookmarkable URLs per tab:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@ensemble-edge/ui';

function useHashTab(defaultTab: string, validTabs: readonly string[]) {
  const getTab = useCallback(() => {
    const hash = window.location.hash.replace('#', '');
    return validTabs.includes(hash) ? hash : defaultTab;
  }, [defaultTab, validTabs]);

  const [tab, setTabState] = useState(getTab);

  useEffect(() => {
    const onHashChange = () => setTabState(getTab());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [getTab]);

  const setTab = useCallback((value: string) => {
    setTabState(value);
    window.history.replaceState(null, '', `#${value}`);
  }, []);

  return [tab, setTab] as const;
}

export function MyAppPage() {
  const TABS = ['overview', 'settings', 'advanced'] as const;
  const [tab, setTab] = useHashTab('overview', TABS);

  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <TabsList variant="line" className="mb-6">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
        <TabsTrigger value="advanced">Advanced</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">…</TabsContent>
      <TabsContent value="settings">…</TabsContent>
      <TabsContent value="advanced">…</TabsContent>
    </Tabs>
  );
}
```

The hook is ~20 lines — paste it into your guest app rather than
importing from the workspace shell. The SDK may export it as
`useHashTab` in a future release.

#### Other patterns from built-in apps worth copying

- **PageHeader pattern**: `<div><h1 className="text-3xl font-bold
  tracking-tight">Title</h1><p className="text-muted-foreground">
  Subtitle</p></div>` followed by `space-y-6` on the outer
  container. Brand, Settings, Admin all use this — keeps
  title/subtitle/content spacing consistent.
- **Card + CardHeader + CardContent**: every distinct section inside
  a tab is a `<Card>`. Group related controls inside `<CardContent
  className="space-y-4">`. Use `<CardDescription>` for help text
  under the title.
- **AlertDialog for destructive actions**: revoke / delete confirms
  go through `<AlertDialog>` with explicit Cancel / Action buttons.
  See Settings → API → "Revoke" for the pattern.
- **Empty states**: when a list has no items, center an icon
  (`text-muted-foreground/50`) + a short explainer + an optional
  call-to-action button. See Settings → API when no keys exist for
  the canonical layout.

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

### useAI() hook — identical shape across all three runtimes

v0.1.83+: the same hook is available from:
  • `@ensemble-edge/guest-runtime` — for iframe-tier guests
  • `@ensemble-edge/sdk` — for external React apps + standalone pages
  • Shell's built-in runtime — for component-tier guests in workspace

All three expose IDENTICAL contract so guest-app code lifts cleanly
between contexts:

```typescript
import { useAI } from '@ensemble-edge/guest-runtime';
// or '@ensemble-edge/sdk' — same shape

function Summarize() {
  const ai = useAI({ tier: 'smart' });

  async function go(text: string) {
    const result = await ai.call({
      messages: [
        { role: 'system', content: 'Summarize concisely.' },
        { role: 'user', content: text },
      ],
      max_tokens: 256,
    });

    // result.text — convenience accessor; assistant's reply
    //               (covers OpenAI / Anthropic / Workers AI shapes)
    // result.data — raw provider response (for tool calls, multi-choice)
    // result.fallback — set if workspace fell back to a different tier
    // result.response — raw fetch Response (streaming, headers, etc)

    return result.text;
  }

  return (
    <button disabled={ai.loading} onClick={() => go('...')}>
      {ai.loading ? 'Thinking…' : 'Summarize'}
    </button>
  );
}
```

Hook return: `{ call, loading, error, fallback }`.
Call return: `{ response, data, text, fallback }`.

### Raw fetch (no SDK)

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
const text = body.choices[0].message.content;  // OpenAI shape
// Anthropic: body.content[0].text
// Workers AI: body.result.response (or body.response)
```

### Tier fallback behavior

If the operator hasn't configured the tier you requested, the workspace
silently falls back to the `good` tier (if one exists). The
`X-Ensemble-Tier-Fallback` response header carries the originally-
requested tier name. The hook surfaces this as `result.fallback`
(per-call) and `ai.fallback` (most-recent-call on the hook).

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

## Toast Notifications (v0.1.86)

Guest apps can show workspace-styled toast notifications. The toast
renders in the workspace's own toaster (bottom-right corner, same as
core-app toasts) — so it stays consistent with the rest of the shell
and survives iframe navigation.

### Iframe-tier (window.Ensemble)

```tsx
function SaveButton() {
  async function onSave() {
    try {
      await fetch('/api/save', { method: 'POST' });
      window.Ensemble.toast.success('Saved');
    } catch (e) {
      window.Ensemble.toast.error('Save failed', { description: String(e) });
    }
  }
  return <button onClick={onSave}>Save</button>;
}
```

Four kinds — `success`, `error`, `warning`, `info`. Each accepts an
optional `{ description, duration }` payload (`duration: 0` for a
persistent toast that only dismisses when the user clicks it).

### Component-tier + external React (via @ensemble-edge/sdk)

```tsx
import { useToast } from '@ensemble-edge/sdk';

function ImportPanel() {
  const toast = useToast();
  // toast.success(...), toast.error(...), etc.
}
```

Or call directly outside React:

```ts
import { toast } from '@ensemble-edge/sdk';
toast.warning('Quota at 80%');
```

### Limitations (iframe-tier only)

- **No action buttons.** Functions can't cross the postMessage boundary,
  so the bridge supports `kind / message / description / duration`
  only. If your toast needs an "Undo" or other inline button, use a
  component-tier guest — those share the host React tree and can use
  the full shell toast API with `action: { label, onClick }`.
- **No programmatic dismiss.** The bridge currently fires-and-forgets;
  toasts auto-dismiss after `duration` (or stay until clicked when
  `duration: 0`).

### When to use a toast vs an inline message

Toasts are for *transient* signals — "Saved", "Imported 42 rows",
"Quota approaching". For errors that block continuing the user's flow
(form validation, missing required input), render an inline message
near the relevant control instead — toasts disappear and a user who
glanced away misses them.

## Encrypted Secret Storage (v0.1.85)

Guest apps that need to hold secrets (downstream API keys, OAuth
refresh tokens, per-user credentials) have a built-in option:

> **Guest apps do NOT have to use the workspace secret store.**
> You can keep secrets in your own worker storage (KV, D1, Durable
> Objects, Secrets Manager) — the workspace doesn't require it.
> The store described below is an *optional convenience* for apps
> that don't want to manage encryption keys themselves.

When you DO opt in, the workspace encrypts at rest with a key the
guest worker never sees (AES-256-GCM, HKDF-derived from a
workspace-only secret), and exposes plaintext only over the
authenticated HTTPS gateway connection.

### Two scopes

| Scope    | Shared?            | Read                              | Write                          |
|----------|--------------------|-----------------------------------|--------------------------------|
| `app`    | Yes (app-global)   | Any authenticated member          | Workspace admins only          |
| `user`   | No (per-user)      | Only the authenticated user       | Only the authenticated user    |

The per-user scope is **truly private** — even workspace admins
cannot read or write another user's secrets through this surface.
This is intentional: it gives users a "private to me" affordance
inside an app even when operators are otherwise privileged.

### From a React/component-tier guest

```tsx
import { useSecret } from '@ensemble-edge/sdk';

function StripeKeyField() {
  const stripe = useSecret({ appId: 'tasks-app', key: 'stripe_api_key' });

  const save = async (v: string) => {
    await stripe.set(v);
  };
  const load = async () => {
    const k = await stripe.get(); // string | null
    return k;
  };
  // ...
}

// Per-user (private to the caller, admins cannot read):
const notion = useSecret({
  appId: 'tasks-app',
  key: 'notion_oauth_refresh',
  scope: 'user',
});
```

### From an iframe-tier guest (window.Ensemble)

`window.Ensemble.useSecret({ key })` — appId is auto-derived from the
iframe URL, so just pass `key` (+ optional `scope`):

```tsx
function PrivacyPanel() {
  const notion = window.Ensemble.useSecret({ key: 'notion_token', scope: 'user' });
  // notion.{ get, set, remove, loading, error }
}
```

### From a non-React app (Vue, Solid, vanilla)

```ts
import { createSecretsClient } from '@ensemble-edge/sdk';

const secrets = createSecretsClient('tasks-app');
await secrets.set('stripe_api_key', 'sk_live_…');
await secrets.set('notion_token', 'tok_…', 'user');
const k = await secrets.get('stripe_api_key');
await secrets.remove('stripe_api_key');
const all = await secrets.list(); // metadata only, never plaintext
```

### From your guest worker (backend)

Your worker can read its own app-global secrets server-side by
calling back to the workspace gateway with a workspace API key (or
the forwarded user session). This is useful when the secret is
needed at request-time and you don't want to round-trip via the
browser:

```ts
// Inside your guest worker:
const r = await fetch(
  `${env.WORKSPACE_URL}/_ensemble/apps/${env.APP_ID}/_secrets/stripe_api_key?scope=app`,
  { headers: { Authorization: `Bearer ${env.WORKSPACE_API_KEY}` } },
);
const { value } = await r.json();
```

### When the workspace store is the wrong choice

- High-volume per-user app state — this is for *secrets*, not
  arbitrary user data. Use D1/KV in your own worker for that.
- Sub-millisecond reads at request-time — fetching across the
  gateway adds a network hop. If your worker reads the same secret
  on every request, cache it in your worker memory (KV-backed) and
  treat the workspace store as the source of truth on write.

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
