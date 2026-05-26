# @ensemble-edge/sdk

Workspace context hooks for guest apps running in Ensemble Workspace.

## Quick start

```ts
import { useWorkspaceContext } from '@ensemble-edge/sdk';

function MyGuestApp() {
  const { ctx } = useWorkspaceContext();
  if (!ctx) return <Loading />;

  const lang = ctx.locale.userPreferred ?? ctx.locale.default;
  const userName = ctx.user?.displayName ?? 'Guest';

  return <div>Hi {userName}, your language is {lang}.</div>;
}
```

## What's in `ctx`

`useWorkspaceContext()` returns the complete, versioned workspace
state in a single object. Every guest-app feature reads from this —
no other API calls needed for workspace identity, user info, locale
config, theme, or brand.

```ts
ctx.version              // 1 — schema version for migrations
ctx.workspace.{ id, slug, name, displayName }
ctx.user.{ id, email, displayName, role, locale } | null
ctx.locale.{ default, supported, userPreferred }
ctx.theme.{ mode, primary, accent }
ctx.brand.{ name, tagline, wordmarkUrl, iconUrl }
ctx.capabilities         // future: feature gating
ctx.featureFlags         // future: operator-toggleable flags
```

## Selector hooks

For code that only needs one domain, selector hooks are typed
wrappers that destructure cleanly:

```ts
import { useLocale, useUser, useTheme, useBrand, useWorkspace } from '@ensemble-edge/sdk';

const locale = useLocale();        // ctx.locale
const user = useUser();            // ctx.user
const theme = useTheme();          // ctx.theme
const brand = useBrand();          // ctx.brand
const workspace = useWorkspace();  // ctx.workspace
```

All selector hooks share the same singleton client under the hood —
calling `useUser()` and `useWorkspaceContext()` in the same component
is free, not a second fetch.

## i18n example

The most common use case for `useLocale()`:

```ts
import { useLocale } from '@ensemble-edge/sdk';
import { i18n } from './your-i18n-setup';

function MyApp() {
  const locale = useLocale();
  if (!locale) return null;

  const active = locale.userPreferred ?? locale.default;

  useEffect(() => {
    i18n.changeLanguage(active);
  }, [active]);

  // The user can change their preferred locale from the workspace's
  // bottom-right user menu. Your guest app auto-re-renders here when
  // the context updates.
}
```

## Updating the user's preferred locale (from a guest app)

```ts
import { useWorkspaceContext } from '@ensemble-edge/sdk';

function MyLanguagePicker() {
  const { ctx, setUserLocale } = useWorkspaceContext();
  if (!ctx) return null;

  return (
    <select
      value={ctx.locale.userPreferred ?? ctx.locale.default}
      onChange={(e) => setUserLocale(e.target.value)}
    >
      {ctx.locale.supported.map((code) => (
        <option key={code} value={code}>{code}</option>
      ))}
    </select>
  );
}
```

The workspace also provides this picker in its bottom-right user
menu — your guest app doesn't need to build its own unless you want
to.

## Non-React guest apps

The framework-agnostic client works with Vue, Solid, Svelte, vanilla
JS, anything:

```ts
import { workspaceContextClient } from '@ensemble-edge/sdk';

const ctx = await workspaceContextClient.get();
const lang = ctx?.locale.userPreferred ?? ctx?.locale.default ?? 'en';

// Subscribe to changes:
const unsub = workspaceContextClient.subscribe((ctx) => {
  console.log('Context updated', ctx);
});
```

## Extensibility contract

The shape of `WorkspaceContext` grows by addition only:

- **Adding a field is safe.** A guest app pinned to an older SDK
  version sees the new field as `undefined`. Your code continues to
  work. The workspace's data is still there — you just need to
  upgrade the SDK to access it via a typed field.

- **Renaming or removing a field is a breaking change.** Requires
  bumping `ctx.version` from `1` to `2`. This has never happened —
  the design intent is that `v1` is forever. New capabilities go
  into new top-level keys (`timezone`, `featureFlags`, etc.), not
  field renames.

- **Domains are top-level keys.** Every domain (workspace, user,
  locale, theme, brand, ...) is a top-level key on the context
  object. When the surface grows, group new fields into the right
  domain or add a new domain — don't sprinkle fields at the root.

## Server-side: adding a field to the context

For Ensemble contributors. Adding a field guest apps can read takes
three edits:

1. **`packages/sdk/src/types.ts`** — extend the `WorkspaceContext`
   type with your new field. Make it optional (`field?: T`) so older
   server versions that don't return it don't break the SDK.

2. **`packages/core/src/services/workspace-context.ts`** — add a
   resolver function (e.g. `resolveTimezone()`) and call it from
   `resolveWorkspaceContext()`. Resolvers should degrade gracefully
   on error (return a sensible default rather than throwing).

3. **Optional: a selector hook** in
   `packages/sdk/src/hooks/use-workspace.ts`, e.g. `useTimezone()`.

That's it. No new endpoint, no new SDK version bump, no client-side
fetch changes. Guest apps that upgrade the SDK see the new field;
older guests continue working.

## API reference

### `useWorkspaceContext()`

Returns `{ ctx, refresh, setUserLocale }`:

- `ctx: WorkspaceContext | null` — full context, or `null` while
  loading
- `refresh: () => Promise<void>` — force re-fetch (rarely needed;
  setters auto-refresh)
- `setUserLocale: (locale: string | null) => Promise<void>` — update
  the current user's preferred locale (pass `null` to clear)

### Selector hooks

- `useLocale()` — returns `ctx.locale | null`
- `useUser()` — returns `ctx.user | null` (null when unauthenticated)
- `useTheme()` — returns `ctx.theme | null`
- `useBrand()` — returns `ctx.brand | null`
- `useWorkspace()` — returns `ctx.workspace | null`

### `useAuth()`

Returns `{ user, isAuthenticated, logout }`. Same `user` slice as
`useUser()`, plus a `logout()` action that hits the auth endpoint.

### `useEvents()`

Subscribe to workspace events (brand changes, sessions, etc.).
Unchanged from earlier SDK versions.

### `useAI({ tier })`

Call workspace-managed AI tiers (`smart` / `good` / `simple` / custom)
without seeing provider credentials. The operator wires each tier
name to a specific model in the workspace's Settings → Connections →
AI Access tab; your guest app picks a tier by name.

**Identical shape** to `@ensemble-edge/guest-runtime`'s `useAI` — code
lifts cleanly between iframe-tier guests, component-tier guests, and
external SDK consumers.

```ts
import { useAI } from '@ensemble-edge/sdk';

function Summarize() {
  const ai = useAI({ tier: 'smart' });

  async function go(text: string) {
    const { text: reply, data, fallback } = await ai.call({
      messages: [
        { role: 'system', content: 'Summarize concisely.' },
        { role: 'user', content: text },
      ],
      max_tokens: 256,
    });
    return reply;
    // Full provider response also available as `data`
  }

  return <button disabled={ai.loading} onClick={() => go('...')}>
    {ai.loading ? 'Thinking...' : 'Summarize'}
  </button>;
}
```

Hook return:
- `call(body) → Promise<AiCallResult>` — send a chat-completion body
- `loading: boolean` — true while a call is in flight
- `error: string | null` — set on the most recent failure
- `fallback: string | null` — set if the most recent call used a
  fallback tier (the workspace served a different tier than requested)

`AiCallResult` shape:
- `text: string` — convenience accessor; the assistant's reply
  extracted from common provider shapes (OpenAI chat completion,
  Anthropic messages, Workers AI generate). Empty string for shapes
  the SDK doesn't recognize — use `data` directly in that case.
- `data: unknown` — the full parsed response body, provider-shaped.
- `fallback: string | null` — same signal as the hook's `fallback`,
  scoped to this specific call.
- `response: Response` — raw fetch Response for advanced uses
  (streaming, custom header inspection, etc).

Conventional tier semantics (operator-configurable, but typical):

| Tier | Use for |
|---|---|
| `simple` | Fast & cheap. Classification, autocomplete, short responses. |
| `good`   | Production default. Balanced quality and cost. |
| `smart`  | Maximum capability. Reasoning, planning, long-form. |

The workspace's session cookie is sent automatically (`credentials:
'include'`), so embedded guest apps "just work." Standalone usage
requires the workspace API key on the request.

#### Provider response shapes (when to use `data` vs `text`)

`text` covers ~90% of cases (single-turn chat completion). For other
patterns — multi-choice (n > 1), function calls / tool use, vision
input, streaming — drop down to `data` and reach into the
provider-shaped payload directly:

```ts
const { data } = await ai.call({ ... });

// OpenAI multi-choice:
const allChoices = (data as any).choices.map((c: any) => c.message.content);

// Anthropic tool use:
const toolCalls = (data as any).content.filter((b: any) => b.type === 'tool_use');

// OpenAI function call:
const fn = (data as any).choices[0].message.function_call;
```

The hook intentionally does NOT normalize across providers beyond
`text` — the assumption is that guest apps building advanced features
already know which tier (= which provider) they're calling.

## Using @ensemble-edge/ui for guest-app interfaces

Guest apps can — and should — use the same shared component library
as the workspace shell. Visual consistency between operator-facing
admin (in workspace) and public-facing pages (on consumer domains)
becomes automatic.

```ts
import { Card, Button, Dialog, Input } from '@ensemble-edge/ui';

export function MyView() {
  return (
    <Card>
      <Button>Click me</Button>
    </Card>
  );
}
```

The library exports ~30 shadcn-derived primitives (Card, Button,
Dialog, AlertDialog, Tabs, Input, Select, Badge, Toast, …) — see
`@ensemble-edge/ui`'s exports for the full list.

### In-workspace component-tier apps

Your app renders inside the workspace's React tree, so it inherits
the workspace's Tailwind config + brand CSS variables automatically.
Just `import { Button } from '@ensemble-edge/ui'` and ship — pixel-
identical to core apps.

### Standalone public pages (consumer domain)

If your guest app also serves public pages on a different domain (e.g.
the public quiz on `quiz.example.com` while the CMS lives in the
workspace), use the same components but bring two things:

1. **Tailwind scan path:**
   `content: ['./node_modules/@ensemble-edge/ui/**/*.{js,ts,jsx,tsx}']`

2. **Workspace brand CSS** — load
   `https://workspace.<your-domain>/_ensemble/brand/css` as a
   `<link rel="stylesheet">` in `<head>`. v0.1.81+ caches this
   cross-origin with 5-min freshness + 24h SWR.

**Defensive tip for first-paint races on cellular:** hardcode hex
fallbacks next to `var()` references for above-the-fold colors:

```css
.cta {
  /* var() takes over once workspace CSS arrives; hex is the safety net */
  background: var(--brand-secondary-main, #137774);
}
```

CSS variable fallback only fires when the variable is *undefined*, not
when it's slow to load. Hex literal bridges the cold-cache window.

### Tabs — match the Brand/Settings pattern (auto-responsive)

For multi-section guest-app pages, use the same Tabs primitive the
built-in apps (Brand, Settings, Admin) use. Configure with
`variant="line"` to match the underline-style look of workspace pages:

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

**Responsive mobile collapse is automatic.** TabsList uses a
ResizeObserver to watch its container — when narrower than 640px the
strip silently swaps to a native `<select>` dropdown. No media
queries, no breakpoints, width-based (not viewport-based) so even a
tab strip inside a narrow sidebar collapses correctly. Brand/Settings
get this behavior; guest apps get it for free.

To DISABLE auto-collapse (rare — pass `noCollapse`):

```typescript
<TabsList variant="line" noCollapse>…</TabsList>
```

#### Hash-based tab routing (deep linking)

Built-in apps sync the active tab with the URL hash so
`/brand-app#colors` deep-links to the Colors tab. Same pattern is
available to guest apps via a small hook — paste into your guest app:

```typescript
import { useState, useEffect, useCallback } from 'react';

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

// Usage:
const TABS = ['overview', 'settings', 'advanced'] as const;
const [tab, setTab] = useHashTab('overview', TABS);
<Tabs value={tab} onValueChange={setTab}>…</Tabs>
```

The hook is ~20 lines; the SDK may export it as `useHashTab` in a
future release. For now: copy-paste into your guest app.

## Encrypted secret storage (`useSecret`, v0.1.85)

Guest apps frequently need to store API keys, OAuth refresh tokens, or
per-user credentials for downstream services (e.g. a user's Notion
token, an admin-configured Stripe key). The workspace can hold these
secrets for you — encrypted at rest with a key your app never sees —
so you don't have to manage encryption yourself.

> **You don't have to use this.** Guest apps are free to store
> secrets in their own worker storage (KV, D1, Durable Objects,
> Secrets Manager, whatever). The workspace secret store is an
> *optional* convenience for apps that don't want to roll their own
> encryption envelope.

### React hook

```ts
import { useSecret } from '@ensemble-edge/sdk';

function StripeConfigPanel({ appId }: { appId: string }) {
  const stripeKey = useSecret({ appId, key: 'stripe_api_key' });

  async function save(newValue: string) {
    await stripeKey.set(newValue); // encrypts + writes
  }

  async function load() {
    const v = await stripeKey.get(); // decrypts + returns
    if (v === null) return 'not configured';
    return v;
  }

  return (
    <div>
      {stripeKey.error && <p>Error: {stripeKey.error}</p>}
      <button disabled={stripeKey.loading} onClick={() => save('sk_live_…')}>
        Save Stripe key
      </button>
    </div>
  );
}
```

### Two scopes

- **`scope: 'app'`** (default) — app-global. Shared across all users of
  the app. Workspace admins can write; any authenticated member can
  read. Use this for operator-configured provider keys (e.g. the
  workspace's Stripe API key, an Anthropic API key the admin set up).
- **`scope: 'user'`** — per-user. Private to the authenticated user.
  Admins **cannot** read or write another user's secrets, by design.
  Use this for tokens the user themselves authorized (e.g. a user's
  Notion OAuth refresh token, their personal calendar credential).

```ts
const notionToken = useSecret({
  appId: 'tasks-app',
  key: 'notion_oauth_refresh',
  scope: 'user', // per-user, private to the caller
});
```

### Framework-agnostic client

For Vue, Solid, vanilla, or non-React guest UIs:

```ts
import { createSecretsClient } from '@ensemble-edge/sdk';

const secrets = createSecretsClient('your-app-id');

await secrets.set('stripe_api_key', 'sk_live_…');          // app scope
await secrets.set('notion_token', 'tok_…', 'user');        // user scope
const k = await secrets.get('stripe_api_key');             // → string | null
await secrets.remove('stripe_api_key');                    // → boolean
const all = await secrets.list();                          // → metadata only, no values
```

### How it works

The workspace mounts the secret routes at
`/_ensemble/apps/<your-app-id>/_secrets/*` *before* forwarding to your
worker — the `_secrets` underscore prefix is reserved for
workspace-served paths. Each call:

1. Goes to the workspace, authenticated by the user's session cookie
   (browser) or a `wks_*` API key (script/CI).
2. The workspace encrypts the plaintext with AES-256-GCM, key derived
   via HKDF from a workspace-only secret. Your guest worker never
   touches the encryption key and never sees the ciphertext at rest.
3. On read, the workspace decrypts and returns plaintext over the wire
   (HTTPS). Plaintext only exists in transit — the SDK does **not**
   cache it in localStorage or sessionStorage by default.

The encryption envelope is independent from the workspace's own
credential store (different HKDF info string), so a compromise of one
doesn't leak the other.

### When NOT to use it

- **You need the secret in your worker at request-time, not just from
  the browser.** The workspace stores secrets; your worker reads them
  by calling its own gateway path from inside (or by talking to the
  workspace API with its app token). If you want zero round-trips,
  keep secrets in your own KV.
- **You're storing high-volume per-user data.** This is for *secrets*
  (typically a handful of values per app), not arbitrary user state.

### `workspaceContextClient`

Framework-agnostic client for non-React guest apps:

- `get(options?: { refresh?: boolean })` — fetch + cache
- `peek()` — synchronous current value
- `subscribe(fn)` — change notifications
- `setUserLocale(locale)` — update + auto-refresh

## Caching

The SDK keeps the context in memory across hook invocations on the
same page — calling `useWorkspaceContext()` from multiple components
is free after the first fetch. The HTTP response has a short
`Cache-Control: private, max-age=10` so user-locale changes
propagate within ~10 seconds at most. Force-refresh with
`refresh()` when you need immediate freshness.
