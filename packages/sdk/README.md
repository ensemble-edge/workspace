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
