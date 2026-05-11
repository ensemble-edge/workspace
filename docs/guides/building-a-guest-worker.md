# Building a guest worker for Ensemble Workspace

> **Workspace version:** v0.1.6+
> **Audience:** familiar with Cloudflare Workers + wrangler
> **Reference implementations:**
> - [`packages/connectors/hello-react/`](../../packages/connectors/hello-react/) — trusted (pixel-native UI)
> - [`packages/connectors/hello-sandboxed/`](../../packages/connectors/hello-sandboxed/) — sandboxed (iframe isolation)

A guest worker is a Cloudflare Worker that renders inside an iframe in the workspace shell. There are **two isolation modes** — pick based on whether you trust the guest code:

| Mode | When to use | UI | Sandbox |
|---|---|---|---|
| **trusted** (default) | First-party apps, your own code, audited partners | Pixel-native via workspace's runtime (React + UI components) | `allow-scripts` + `allow-same-origin` + forms + popups |
| **sandboxed** | Third-party apps, customer-installed widgets, agent-generated code | Bring your own (any framework, any DOM) | `allow-scripts` only — no same-origin, no host cookies, no workspace runtime |

The shell renders both the same way (iframe in the viewport). The host's `guest_apps.isolation` column controls the sandbox attribute and which contract the iframe gets to use.

## Which one do you want?

- **"I want this app to look like a built-in workspace app, no manual styling work, and follow brand changes automatically."** → trusted. Use [`templates/guest-react/`](../../templates/guest-react/) or `create-guest-app` with no `--isolation` flag.
- **"This code is from a third party and shouldn't be able to read workspace cookies or share React with the host."** → sandboxed. Use [`templates/guest-sandboxed/`](../../templates/guest-sandboxed/) or `create-guest-app --isolation sandboxed`.

If you don't have a clear answer, default to **trusted** — it's the lower-friction option for apps you control.

---

## Architecture

```
Browser
  │
  ├── Loads /apps/<id> in the workspace shell
  │   ↓
  │   Shell renders <iframe src="/_ensemble/apps/<id>/">
  │
  └── Iframe content (HTML returned by the guest worker):
      ├── <link rel="stylesheet" href="/_ensemble/brand/css">     ← workspace tokens
      ├── <link rel="stylesheet" href="/_ensemble/runtime/v1/runtime.css">
      ├── <script src="/_ensemble/runtime/v1/runtime.js"></script> ← React + UI on window.Ensemble
      ├── inline <script> with the guest's bundled app code
      └── window.Ensemble.mount(window.__EnsembleApp)
```

Three things to internalize:

1. **The guest's bundle contains zero of React or workspace UI.** Both live in the workspace-served runtime, cached by the browser. Guest bundles are typically 1–5 KB.
2. **The guest declares intent, not layout.** You write `<Page title="...">` and the workspace renders the chrome.
3. **Discovery is D1, not config.** The workspace sidebar reads from `guest_apps` — you insert a row to make your app appear.

---

## Quick start

```bash
# In your monorepo, after installing @ensemble-edge/workspace:
node node_modules/@ensemble-edge/workspace/scripts/create-guest-app.mjs \
  ./apps/my-app \
  --name "My App" \
  --id my-app \
  --icon clipboard-list

cd apps/my-app
pnpm install
pnpm run build        # → dist/app.bundle.{js,css}
pnpm run dev          # wrangler dev on :8789
pnpm run deploy
```

Then register your app (one-time, per workspace):

1. **Workspace `wrangler.toml`** — add a service binding to your guest worker:
   ```toml
   [[services]]
   binding = "MY_APP"
   service = "my-app-guest"
   ```
2. **Redeploy the workspace worker.**
3. **Insert a `guest_apps` row** in the workspace's D1:
   ```bash
   wrangler d1 execute <workspace-db> --remote --command "
     INSERT INTO guest_apps (
       workspace_id, id, name, icon, category,
       connection_type, binding_name, enabled, required_role
     ) VALUES (
       '<YOUR_WORKSPACE_ID>', 'my-app', 'My App', 'clipboard-list', 'tool',
       'service_binding', 'MY_APP', 1, 'member'
     );
   "
   ```

Your app appears in the sidebar immediately.

### …or scaffold a sandboxed app

For untrusted code, add `--isolation sandboxed`:

```bash
node node_modules/@ensemble-edge/workspace/scripts/create-guest-app.mjs \
  ./apps/third-party-thing \
  --name "Third-Party Thing" \
  --id third-party-thing \
  --icon lock \
  --isolation sandboxed
```

This produces a template that uses [`@ensemble-edge/workspace/guest-sandbox`](../../packages/guest-sandbox/) instead of the runtime. The guest app brings its own UI (any framework, any DOM) and talks to the host through typed `postMessage`. When you insert the `guest_apps` row for it, set `isolation = 'sandboxed'` (see the template's generated README).

---

## What a guest app looks like

Just JSX. No React import, no UI import.

```tsx
// src/app.tsx
import type { EnsembleRuntime } from '@ensemble-edge/workspace/guest-runtime';

declare const Ensemble: EnsembleRuntime;
const { Page, Card, CardHeader, CardTitle, CardContent, Button } = Ensemble;

export default function MyApp() {
  return (
    <Page title="My App" description="Description goes here">
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

That compiles to ~1 KB of factory calls against `window.Ensemble`. The JSX `import { jsx } from '@ensemble-edge/workspace/guest-runtime/jsx-runtime'` resolves to a tiny shim that delegates to React on the host runtime.

---

## What you get from the runtime

The full `EnsembleRuntime` type lives in [`packages/guest-runtime/src/runtime.tsx`](../../packages/guest-runtime/src/runtime.tsx). The current v1 surface:

**Layout primitives** (these are where the magic happens — they read workspace settings)
- `Page` — title + description + content with workspace padding/fonts
- `Section` — subsection within a page
- `PageHeader` — header-only variant

**Common shadcn components** (all from `@ensemble-edge/ui`)
- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`
- `Button`, `Input`, `Label`, `Textarea`
- `Table` family
- `Tabs`, `Dialog`, `DropdownMenu`, `Popover`, `Tooltip`, `Select`
- `Checkbox`, `Switch`, `Badge`, `Separator`, `Skeleton`
- `Alert`, `Avatar`, `EmptyState`, `StatCard`, `DataRow`

**React essentials**
- `React`, `createElement`, `Fragment`
- All common hooks: `useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`, `useContext`, `useReducer`

**Utility**
- `cn` — the className composer

Need something not in this list? File feedback; we'll add it to v1 (additive changes only) or surface it in v2 if it requires breaking the contract.

---

## What a sandboxed guest app looks like

Plain DOM, no framework — but it's whatever you want. The only constraint is that the only way to talk to the host is `postMessage`, wrapped by [`@ensemble-edge/workspace/guest-sandbox`](../../packages/guest-sandbox/):

```ts
// src/app.ts (no JSX — bring your own UI if you want one)
import { connectToHost } from '@ensemble-edge/workspace/guest-sandbox';

const host = connectToHost();
host.ready();

host.onContext((ctx) => {
  console.log('host context:', ctx);
});

document.body.innerHTML = `
  <h1>My App</h1>
  <button id="x">Audit something</button>
`;
document.getElementById('x')!.addEventListener('click', () => {
  host.audit('clicked', { button: 'x' });
});
```

The full message protocol is in [`packages/guest-sandbox/src/protocol.ts`](../../packages/guest-sandbox/src/protocol.ts). v1 freezes these shapes; additive evolution only.

| Guest → Host | Host → Guest |
|---|---|
| `ready()` — guest is mounted | `onContext(cb)` — workspace pushes context (path, etc.) |
| `navigate(path)` — request host nav | `onThemeChange(cb)` — workspace tells guest mode changed |
| `audit(event, details)` — log to workspace audit trail | |
| `resize(heightPx)` — request iframe sizing | |

Sandboxed apps **don't** get workspace's React, `@ensemble-edge/workspace/ui`, or `window.Ensemble`. They get the iframe and a typed mailbox.

### What sandboxed apps lose

- No same-origin → can't read workspace cookies, can't fetch `/_ensemble/...` with auth (would need to relay through `postMessage`)
- No shared React → bigger bundle if you ship your own framework
- No automatic theme inheritance → if you want workspace's brand colors, fetch `/_ensemble/brand/css` and inline it yourself

### What sandboxed apps gain

- Browser-enforced isolation. A bug or malicious code in the guest can't touch the host.
- Freedom of framework. Vue, Svelte, htmx, vanilla DOM, Streamlit-embedded — all valid.
- Independent deployment cadence. The host's runtime contract (v1, v2, …) doesn't matter to sandboxed apps; they only depend on the postMessage protocol version.

---

## What follows workspace settings automatically

When an operator changes any of these in workspace settings, every installed guest app picks up the change on next iframe render — no guest redeploy:

| Setting | How it flows |
|---|---|
| Brand colors | `/_ensemble/brand/css` ships shadcn tokens (`--background`, `--primary`, etc.); workspace components reference them via Tailwind utility classes |
| Heading + body fonts | Same endpoint; `Page` sets `font-family: var(--font-heading)` on h1, `var(--font-body)` on container |
| Content padding | `Page` reads `var(--content-padding, 1.5rem)` |
| Card padding | `Card` reads `var(--card-padding, 1.5rem)` |
| Border radius | shadcn components reference `var(--radius)` |
| Light / dark mode | Body class injected by workspace; tokens swap |

Workspace pushes new components to the runtime in future versions — your guest doesn't redeploy to receive them, just refresh.

---

## Versioning contract

The runtime URL is `/_ensemble/runtime/v1/runtime.js`. v1 is a frozen contract:
- New components and types **CAN** be added within v1.
- Existing components, their props, or the `mount()` signature **CANNOT** change within v1.
- Breaking changes ship as `/v2/runtime.js`. The `@ensemble-edge/workspace/guest-runtime` package version gates which one your scaffold targets.

So a v0.1.5 guest app keeps working when workspace is at v0.2.0, v0.3.0, v0.9.0 — until workspace cuts a v2 runtime. At that point, guest apps update by bumping their `@ensemble-edge/workspace` pin.

---

## Bundle profile (verified per release by the preflight)

| Asset | Size | Gzipped |
|---|---|---|
| Guest app JS bundle | ~2 KB | **~1 KB** |
| Guest app CSS bundle | ~57 KB | **~9 KB** |
| Workspace runtime JS (cached) | ~404 KB | **~125 KB** |
| Workspace runtime CSS (cached) | ~57 KB | **~9 KB** |

For N guest apps in a workspace, the browser downloads the runtime once (~135 KB gzipped total) and ~1 KB per app. Was previously ~135 KB **per app**.

---

## Debugging order, if your app doesn't render

Work through these in order — most likely causes first.

1. **No sidebar entry.** `SELECT * FROM guest_apps WHERE id='<your-id>'`. Confirm `enabled=1`.
2. **Sidebar → 502 "App not found".** Service binding misconfigured; the workspace worker hasn't been redeployed after adding the `[[services]]` block.
3. **Iframe blank, console error "Ensemble runtime not loaded".** The `<script src="/_ensemble/runtime/v1/runtime.js">` tag is missing or didn't load. Check the iframe's Network tab.
4. **Iframe renders with default Tailwind colors (not the workspace's).** `/_ensemble/brand/css` link tag is missing. Add it as the first stylesheet in your HTML shell.
5. **Components render but look wrong (wrong spacing, wrong font).** Make sure you used `Page` from the runtime, not a hand-rolled `<div>` wrapper. The `Page` primitive is where workspace settings are applied.
6. **Layout/hover/focus broken.** You probably used `class=` instead of `className=`. This is React.

---

## What workspace owes guests in future versions

Tracked in [`docs/curalisto-feedback.md`](../curalisto-feedback.md). Notably:

- A real `wrangler ensemble app install` command so the `guest_apps` INSERT isn't a manual step
- Local-dev gateway so `pnpm dev` boots a workspace shell + your guest worker behind a single dev server
- `postMessage`-based iframe ↔ shell communication for URL sync, modals over the whole viewport, etc.

These are quality-of-life improvements. The current pattern works end-to-end.
