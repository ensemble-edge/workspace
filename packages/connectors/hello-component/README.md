# `@ensemble-edge/connector-hello-component`

The reference **component-tier** guest app — runs directly in the host's React tree, no iframe. The primary way to build trusted guest apps in workspace v0.1.9+.

## Why component tier

In iframe-tier guest apps (v0.1.5–v0.1.8), the guest's UI lives in its own document. CSS variables, fonts, padding — everything has to be propagated across the iframe boundary to look identical to a core app.

In component tier, the guest's UI is just a React component the host renders. Same document, same `:root`, same React tree. There's no boundary, so there's nothing to propagate. Brand color changes? The host re-renders, the guest re-renders along with it. New design tokens added to workspace next month? The guest sees them on the next render, no code change.

## Bundle profile

- `dist/component.bundle.js`: ~500 bytes minified, ~400 bytes gzipped
- Contains: JSX factory calls only. No React, no Radix, no workspace UI — all of those live on `window.Ensemble` already supplied by the host shell.

## Install into a workspace

After `wrangler deploy`:

1. Workspace `wrangler.toml`:
   ```toml
   [[services]]
   binding = "HELLO_COMPONENT"
   service = "hello-component-connector"
   ```
2. Redeploy the workspace worker.
3. Register with `tier = 'component'`:
   ```bash
   wrangler d1 execute <workspace-db> --remote --command "
     INSERT INTO guest_apps (
       workspace_id, id, name, icon, category,
       connection_type, binding_name, enabled, required_role, tier
     ) VALUES (
       '<YOUR_WORKSPACE_ID>', 'hello-component', 'Hello, Component', 'layers', 'tool',
       'service_binding', 'HELLO_COMPONENT', 1, 'member', 'component'
     );
   "
   ```

The `tier = 'component'` column tells the shell to do dynamic `import()` instead of mounting an iframe.

## How it works

```
User clicks "Hello, Component" in sidebar
  ↓
Shell navigates to /apps/hello-component
  ↓
AppViewPage reads manifest, sees tier === 'component'
  ↓
import('/_ensemble/apps/hello-component/ui/component.js')
  ↓
Gateway proxies to your worker
  ↓
Worker returns the bundled component module (ES module text)
  ↓
Browser parses it; default export is a React component
  ↓
Shell renders <YourComponent /> inside its own <Viewport>
```

No iframe. The guest is now indistinguishable from a core app at the DOM level.

## Files

| File | What it is |
|---|---|
| `src/component.tsx` | The React component — pure JSX, no imports except types |
| `src/index.ts` | Worker entry; serves `/ui/component.js` |
| `build.js` | esbuild; produces `dist/component.bundle.js` as ESM |
| `wrangler.toml` | Text loader rule + worker config |
| `tsconfig.json` | `jsxImportSource: "@ensemble-edge/guest-runtime"` |

## Debugging

1. **Sidebar doesn't show the app** → check `SELECT * FROM guest_apps WHERE id = 'hello-component'`. Confirm `enabled = 1`, `tier = 'component'`.
2. **App loads but errors "Guest module did not export a default React component"** → your component module isn't `export default`-ing. Check `src/component.tsx`.
3. **App loads but components are unstyled** → workspace's `window.Ensemble` isn't installed. Verify the shell version is v0.1.9+ (`curl /_ensemble/version`).
4. **Build fails with "Cannot resolve @ensemble-edge/guest-runtime/jsx-runtime"** → run `pnpm install` from the workspace root so the package is linked.
