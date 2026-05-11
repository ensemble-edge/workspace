# Building a guest app for Ensemble Workspace

> **Workspace version:** v0.1.9+
> **Audience:** familiar with Cloudflare Workers + wrangler
> **Reference implementations:**
> - [`packages/connectors/hello-component/`](../../packages/connectors/hello-component/) — **component tier (primary)**
> - [`packages/connectors/hello-react/`](../../packages/connectors/hello-react/) — iframe tier
> - [`packages/connectors/hello-sandboxed/`](../../packages/connectors/hello-sandboxed/) — sandboxed tier

A guest app extends a workspace with new functionality. Workspace v0.1.9 supports three tiers, all using the same `guest_apps` table and gateway; they differ only in how the shell renders the app's UI.

## Pick your tier

| Tier | Renders | Use when | Visual integration | Crash isolation |
|---|---|---|---|---|
| **`component`** *(default)* | In the host's React tree | First-party trusted apps; anything you want to look exactly like a core app | Pixel-identical, automatic | None (crashes throw into shell) |
| **`iframe`** | Same-origin iframe with workspace runtime | First-party apps where you want an iframe boundary anyway (rare) | Near-identical via cssVars push | Document-level |
| **`sandboxed`** | Strict iframe sandbox | Third-party, customer-installed, agent-generated, or any code you don't fully trust | Best-effort; guest brings its own UI | Browser-enforced |

**Default to `component`.** That's the design ceiling — visually indistinguishable from a core app, no propagation logic, no boundary. Adding the 50th component-tier app is the same as adding the 1st.

Use `iframe` only if you specifically need an iframe document (e.g. third-party widgets that require their own document context). Use `sandboxed` when the iframe boundary IS the feature (you don't trust the code).

## Quick start (component tier — the primary path)

```bash
node node_modules/@ensemble-edge/workspace/scripts/create-guest-app.mjs \
  ./apps/my-app \
  --name "My App" \
  --id my-app \
  --icon clipboard-list
# → defaults to --tier component

cd apps/my-app
pnpm install
pnpm run build
pnpm run deploy
```

Then register the app with `tier = 'component'`:

1. Add to your **workspace** worker's `wrangler.toml`:
   ```toml
   [[services]]
   binding = "MY_APP"
   service = "my-app-guest"
   ```
2. Redeploy the workspace worker.
3. Insert a `guest_apps` row:
   ```bash
   wrangler d1 execute <workspace-db> --remote --command "
     INSERT INTO guest_apps (
       workspace_id, id, name, icon, category,
       connection_type, binding_name, enabled, required_role, tier
     ) VALUES (
       '<YOUR_WORKSPACE_ID>', 'my-app', 'My App', 'clipboard-list', 'tool',
       'service_binding', 'MY_APP', 1, 'member', 'component'
     );
   "
   ```

Your app appears in the sidebar. Click it. The shell dynamically imports `/_ensemble/apps/my-app/ui/component.js` and renders the component directly in its viewport.

## What a component-tier app looks like

Just JSX. No imports except types.

```tsx
// src/component.tsx
import type { EnsembleRuntime } from '@ensemble-edge/workspace/guest-runtime';

declare const Ensemble: EnsembleRuntime;
const { Page, Card, CardHeader, CardTitle, CardContent, Button } = Ensemble;

export default function MyApp() {
  return (
    <Page title="My App" description="Anything I want.">
      <Card>
        <CardHeader>
          <CardTitle>Hello</CardTitle>
        </CardHeader>
        <CardContent>
          <Button>Click me</Button>
        </CardContent>
      </Card>
    </Page>
  );
}
```

That compiles to ~500 bytes of factory calls against `Ensemble.createElement`. The shell already has React, Radix, and the workspace UI library loaded — the component module references them through `window.Ensemble` at runtime. No iframe.

## Worker entry for component tier

```ts
// src/index.ts
import { defineGuestApp } from '@ensemble-edge/workspace/guest';
import { createGuestWorker } from '@ensemble-edge/workspace/guest/cloudflare';
import { Hono } from 'hono';

// @ts-expect-error — Text loader rule turns this into a string at build time.
import componentBundle from '../dist/component.bundle.js';

const router = new Hono();

// The shell does `import('/_ensemble/apps/my-app/ui/component.js')` and
// gets back this module.
router.get('/ui/component.js', (c) => {
  return c.text(componentBundle as string, 200, {
    'Content-Type': 'application/javascript; charset=utf-8',
    'Cache-Control': 'public, max-age=300',
  });
});

// Your API routes go here.
// router.get('/api/things', async (c) => c.json({ things: [...] }));

const app = defineGuestApp({
  manifest: { id: 'my-app', name: 'My App', version: '0.0.1', icon: 'clipboard-list',
              category: 'tool', permissions: ['read:user'], entry: '/' },
  fetch: (request) => router.fetch(request),
});

export default createGuestWorker(app);
```

The worker now does two things: serves the component module, and (optionally) serves API routes for the app's data.

## What flows automatically (component tier)

The component runs in the host's React tree. Therefore:

- **All CSS variables** — same `:root`, no propagation
- **All fonts, padding, radius, spacing** — same document
- **Brand color changes** — host re-renders, guest re-renders along with it, no postMessage
- **Dark/light mode** — same class on `<html>`, instant
- **Future workspace tokens** — added to the host, applied to the guest on the next render
- **Workspace adds new components to `@ensemble-edge/ui`** — guests get them on next page load via `Ensemble.*`

Operator changes any setting → next render = the change is there. Zero per-guest plumbing.

## Iframe tier (when you actually want an iframe)

Use `--tier iframe`. The shell wraps your app in a same-origin iframe that loads `/_ensemble/runtime/v1/runtime.js`. The iframe's `:root` receives a snapshot of the host's CSS variables on mount (v0.1.8+). Useful when:

- You explicitly want an iframe boundary visible to the user
- You're integrating a third-party widget that requires its own document context

Bundle profile is similar to component-tier (~1KB gzipped), but the iframe carries its own document. Reference: [`packages/connectors/hello-react/`](../../packages/connectors/hello-react/).

## Sandboxed tier (untrusted code)

Use `--tier sandboxed`. Strict iframe sandbox (`allow-scripts` only). Guest brings its own framework; communication is postMessage only via [`@ensemble-edge/workspace/guest-sandbox`](../../packages/guest-sandbox/). Reference: [`packages/connectors/hello-sandboxed/`](../../packages/connectors/hello-sandboxed/).

| Capability | Component | Iframe | Sandboxed |
|---|---|---|---|
| Workspace cookies / auth | Yes (same window) | Yes (same-origin) | No |
| `window.Ensemble` (React + UI) | Yes (host's) | Yes (runtime-loaded) | No |
| `fetch('/_ensemble/...')` | Yes | Yes | No (no same-origin) |
| postMessage to host | Not needed (same window) | Available | Required |
| Crash blast radius | Host React tree | Iframe | Iframe |

## Migration from v0.1.5–v0.1.8

Existing apps were tier `iframe` (formerly `isolation = 'trusted'`). They keep working — migration 005 maps `isolation` values to `tier` automatically.

To upgrade an app to component tier (recommended):
1. Re-scaffold with default tier (`component`)
2. Move your component's JSX from the old `app.tsx` to the new `component.tsx`
3. Drop the HTML shell / `<script src="runtime.js">` / Tailwind build — none of that exists in component tier
4. Update the `guest_apps` row: `UPDATE guest_apps SET tier = 'component' WHERE id = '...'`
5. Redeploy

## Bundle profiles (verified per release)

| Tier | JS bundle (gzipped) | What's in it |
|---|---|---|
| `component` | ~500 bytes | JSX factory calls only |
| `iframe` | ~1 KB + cached 125 KB runtime | Same factory calls + the workspace runtime |
| `sandboxed` | Whatever the guest ships | Guest's full UI bundle |

## Debugging

1. **No sidebar entry** — `SELECT * FROM guest_apps WHERE id = '...'`. Verify `enabled = 1`, `tier` is what you expect.
2. **Sidebar entry but blank viewport** — for component tier, check browser Network for `/_ensemble/apps/<id>/ui/component.js` returning 200 with the right Content-Type. For iframe tier, check the iframe loads at all.
3. **Component renders but unstyled** — `window.Ensemble` not installed. Confirm shell is v0.1.9+ (`curl /_ensemble/version`).
4. **"Guest module did not export a default React component"** — your `src/component.tsx` is missing `export default function ...`.

## Versioning

The `guest_apps.tier` column + the `EnsembleRuntime` API surface are the v1 contract. Additive evolution within v1; breaking changes ship as a new runtime version. Guests pinned to v1 keep working.
