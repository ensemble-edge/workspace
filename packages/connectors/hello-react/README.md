# `@ensemble-edge/connector-hello-react`

The canonical reference guest app. **Read this file before writing your own.**

> To start a NEW guest app, don't copy this directory — run the scaffold:
>
> ```bash
> node node_modules/@ensemble-edge/workspace/scripts/create-guest-app.mjs \
>   ./apps/my-app --name "My App" --id my-app --icon clipboard-list
> ```
>
> The scaffold uses [`templates/guest-react/`](../../../templates/guest-react/) — same code, parameterized. The hello-react connector here is the **reference** (verified by every release); the scaffold is the **starter** (you customize it).

## What this demonstrates

The Ensemble guest-app architecture:

- A Cloudflare Worker that registers as a guest app
- An iframe-side React app that imports nothing — it pulls React, Radix UI, and workspace UI primitives from `window.Ensemble` at runtime
- The runtime is served by the host workspace at `/_ensemble/runtime/v1/runtime.js` and cached forever
- **Guest worker bundle: ~1 KB gzipped** (just this app's JSX factory calls)
- Brand color, font, spacing, radius — all inherited from the host workspace automatically, even after the guest is deployed

## How the pieces fit

```
Browser
  │
  ├── Loads /apps/hello-react in the shell
  │   ↓
  │   Shell renders <iframe src="/_ensemble/apps/hello-react/">
  │
  └── Iframe content:
      ├── 1. Loads /_ensemble/brand/css        ← workspace tokens
      ├── 2. Loads /_ensemble/runtime/v1/runtime.css ← utility classes
      ├── 3. Loads /_ensemble/runtime/v1/runtime.js  ← React + UI on window.Ensemble
      ├── 4. Loads this app's tiny app.bundle.js     ← assigns window.__EnsembleApp
      └── 5. Calls window.Ensemble.mount(window.__EnsembleApp)
            ↓
          Same React. Same components. Same theme tokens.
          Identical chrome to any core app in the workspace.
```

## Files

| File | What it is |
|---|---|
| `src/app.tsx` | The React app — pure JSX, no imports except types |
| `src/index.ts` | The worker entry — serves the HTML shell + the bundled app |
| `src/styles.css` | Tailwind v4 entry (tiny — most utilities already in the runtime) |
| `build.js` | esbuild + tailwind. Emits `dist/app.bundle.{js,css}`. |
| `wrangler.toml` | Includes `[[rules]] type = "Text"` to inline `dist/app.bundle.js` as a string at deploy time |
| `tsconfig.json` | `jsxImportSource: "@ensemble-edge/guest-runtime"` — JSX compiles against the shim, not React |

## Build + run

```bash
pnpm install
pnpm run build         # builds dist/app.bundle.{js,css} — about 1 second
pnpm run dev           # wrangler dev on :8789
```

A bare GET returns `HTTP 400 MISSING_CONTEXT` — correct, the worker rejects requests without the gateway's headers. Smoke test:

```bash
curl -i http://127.0.0.1:8789/ \
  -H "X-Ensemble-Workspace-Id: ws_test" \
  -H "X-Ensemble-User-Id: usr_test" \
  -H "X-Ensemble-User-Email: t@x.com" \
  -H "X-Ensemble-App-Id: hello-react" \
  -H "X-Ensemble-Capability-Token: dev" \
  -H "X-Ensemble-Request-Id: 00000000-0000-0000-0000-000000000000"
```

Returns `HTTP 200`, `Content-Type: text/html`, ~2.6 KB. The HTML includes the inlined app bundle and the three `/_ensemble/*` link/script tags.

## Install into a workspace

After `wrangler deploy`:

1. Workspace `wrangler.toml`:
   ```toml
   [[services]]
   binding = "HELLO_REACT"
   service = "hello-react-connector"
   ```
2. Redeploy the workspace worker.
3. Register in the workspace's D1:
   ```bash
   wrangler d1 execute <workspace-db> --remote --command "
     INSERT INTO guest_apps (
       workspace_id, id, name, icon, category,
       connection_type, binding_name, enabled, required_role
     ) VALUES (
       '<YOUR_WORKSPACE_ID>', 'hello-react', 'Hello, React', 'sparkles', 'tool',
       'service_binding', 'HELLO_REACT', 1, 'member'
     );
   "
   ```
4. Open the workspace. "Hello, React" appears in the sidebar.

## Bundle profile

Measured after a fresh `pnpm run build`:

| Asset | Size | Gzipped |
|---|---|---|
| `dist/app.bundle.js` | ~2 KB | **~1 KB** |
| `dist/app.bundle.css` | ~57 KB | **~9 KB** |

The runtime served by workspace is ~125 KB gzipped JS + ~9 KB gzipped CSS. The browser caches it once per workspace; every additional guest app load is ~1 KB.

## What workspace settings flow through automatically

Once installed, change any of these in workspace settings and refresh the iframe — no redeploy:

- Brand colors (the entire shadcn token set: background, foreground, primary, accent, border, etc.)
- Typography (heading font, body font)
- Radius
- Content padding / card padding (read by `EnsemblePage` and `Card`)
- Light/dark mode

You inherit them because the iframe loads `/_ensemble/brand/css` on every page load — that endpoint is regenerated per request from the host's D1.

## Debugging order, if your app doesn't render

1. **No sidebar entry.** Verify `guest_apps` row: `SELECT * FROM guest_apps WHERE id='hello-react'`. Confirm `enabled = 1`.
2. **Sidebar entry → "App not found" / 502.** Service binding misconfigured. Check the workspace's `wrangler.toml` has the `[[services]]` block and that the workspace was redeployed.
3. **Iframe loads, blank page.** Open browser DevTools console. Most likely cause: a runtime script load failure. Check Network for `/_ensemble/runtime/v1/runtime.js` returning 200.
4. **Iframe loads, error "Ensemble runtime not loaded".** The `<script>` tag for `runtime.js` is missing from your HTML shell, or it failed to execute. Check `src/index.ts`.
5. **Iframe renders, but with default Tailwind colors not workspace's brand.** `/_ensemble/brand/css` link is missing in your HTML shell. Should be the first stylesheet.
6. **Looks weird, layout broken.** You probably used `class=` instead of `className=`. This is React — `className` only.

## Sharp edges to know

- **The runtime version is in the URL** (`/v1/`). Workspace can ship v2 in the future; v1 keeps working forever. Bump your scaffold to v2 when you opt in.
- **The HTML shell is identical across all guest apps.** Don't customize it. If you need to load extra `<script>`s, do it INSIDE your React app.
- **`window.Ensemble` is a global.** Treat it as the API surface. Don't poke at React internals through it.
- **CSS class strings must be string literals** for Tailwind to extract them. `cn('bg-primary')` works; `cn(\`bg-\${color}\`)` doesn't.

## Versioning

Workspace's runtime is versioned (`/v1/`, `/v2/`, ...). The `EnsembleRuntime` type from `@ensemble-edge/workspace/guest-runtime` defines what's in v1. New components can be added; existing API surface won't change within v1.
