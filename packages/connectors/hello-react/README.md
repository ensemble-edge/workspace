# `@ensemble-edge/connector-hello-react`

The reference guest app. **Read this file before writing your own.** Everything here is verified to build, deploy, and serve a valid HTML response — but pixel-native rendering inside the host shell only happens when this is installed in a running workspace.

## What it demonstrates

- Cloudflare Worker that registers as a guest app via `@ensemble-edge/guest` + `@ensemble-edge/guest-cloudflare`
- Iframe content is a **React app** built with esbuild
- Components imported directly from `@ensemble-edge/ui` (Card, Table, Button)
- Tailwind v4 entry that pulls workspace's design tokens
- Bundle inlined into the worker via wrangler's Text loader rules
- Live theme: links `/_ensemble/brand/css` so brand changes propagate without redeploy

## Verified bundle profile

- JS: 404 KB minified / **125 KB gzipped**
- CSS: 56 KB / **9 KB gzipped**
- Single copy of React + React-DOM (measured via esbuild metafile)

## How it's built

```
src/styles.css      → tailwindcss → dist/app.bundle.css   (links workspace tokens)
src/app.tsx         → esbuild     → dist/app.bundle.js    (React + workspace UI + your code)
src/index.ts                                              (worker entry; imports bundles as text)
```

`wrangler.toml` has a `[[rules]]` block declaring `**/*.bundle.{js,css}` as Text modules — so `import bundleJs from '../dist/app.bundle.js'` resolves to a string at deploy time.

## Running locally

```bash
pnpm install         # workspace install
pnpm run build       # builds dist/app.bundle.{js,css}
pnpm run dev         # wrangler dev on :8789
```

A bare GET will return 400 `MISSING_CONTEXT` — that's correct. The worker rejects requests without `X-Ensemble-*` headers (which the workspace gateway injects). Test with the headers manually:

```bash
curl -i http://127.0.0.1:8789/ \
  -H "X-Ensemble-Workspace-Id: ws_test" \
  -H "X-Ensemble-User-Id: usr_test" \
  -H "X-Ensemble-User-Email: test@example.com" \
  -H "X-Ensemble-App-Id: hello-react" \
  -H "X-Ensemble-Capability-Token: dev" \
  -H "X-Ensemble-Request-Id: 00000000-0000-0000-0000-000000000000"
```

Should return `HTTP 200`, `Content-Type: text/html`, with a full HTML page containing inlined React + Tailwind.

## Installing into a workspace

After `wrangler deploy`, install it as a guest app in your workspace:

1. Add a service binding in your **workspace** worker's `wrangler.toml`:

   ```toml
   [[services]]
   binding = "HELLO_REACT"
   service = "hello-react-connector"
   ```

2. Redeploy the workspace worker.

3. Insert a `guest_apps` row in the workspace's D1:

   ```bash
   wrangler d1 execute <workspace-db> --remote --command "
     INSERT INTO guest_apps (
       workspace_id, id, name, icon, category,
       connection_type, binding_name, enabled, required_role
     ) VALUES (
       'YOUR_WORKSPACE_ID', 'hello-react', 'Hello, React', 'sparkles', 'tool',
       'service_binding', 'HELLO_REACT', 1, 'member'
     );
   "
   ```

4. Open the workspace. Sidebar should show **Hello, React**. Clicking it loads the iframe → React app renders.

## Debugging order, if it doesn't render

Work through these in order — most likely causes first.

1. **Sidebar entry missing.** Verify the `guest_apps` row exists: `SELECT * FROM guest_apps WHERE id='hello-react'`. Confirm `enabled = 1`.
2. **Sidebar entry present but click → 502 or "App not found".** The service binding isn't routing. Check workspace's `wrangler.toml` `[[services]]` block matches the worker name. Redeploy workspace worker.
3. **Iframe loads but blank page.** Browser DevTools → Console. Most common: React duplication (Radix throws an internal error). Measure: `grep -oE 'react@[0-9.]+' dist/app.bundle.js | sort -u | wc -l` (must be 1). If 2+, add `pnpm.overrides` at your repo root pinning react/react-dom.
4. **Iframe renders but no styles.** Browser DevTools → Network. Is `/_ensemble/brand/css` returning 200? Is the inline `<style>` block in the HTML present? View source the iframe.
5. **Components render but look weird (default Tailwind colors instead of workspace's).** Workspace tokens aren't propagating. Check `src/styles.css`: the FIRST line MUST be `@import '@ensemble-edge/ui/globals.css';`. Order matters.
6. **Layout is broken or class hover/focus states don't work.** You probably used `class=` instead of `className=`. This is React — `className` only.

## Sharp edges to know

- **Text rules require the file to exist at build time.** `wrangler deploy` fails if `dist/app.bundle.js` doesn't exist. The `predeploy` script in `package.json` ensures the build runs first.
- **CSS class strings must be string literals.** Tailwind v4 can't extract dynamically-constructed classes. `className={\`bg-\${color}\`}` won't generate the utility class. Use `className={cn(color === 'primary' ? 'bg-primary' : 'bg-secondary')}` instead.
- **Server-side `process.env` is not available.** Workers runtime has no `process`. Use `env.*` from the worker's `fetch(request, env, ctx)` signature.
- **The HTML shell is served for ALL paths.** That's intentional. Routing inside the iframe is the React app's job (React Router or similar). The worker doesn't differentiate routes.

## File map

```
hello-react/
├── package.json         scripts: build:js, build:css, build, dev, deploy, predeploy
├── wrangler.toml        Text rules for inlining bundles
├── tsconfig.json        React + Workers types
├── src/
│   ├── index.ts         worker entry; serves HTML shell on every path
│   ├── app.tsx          React app; imports from @ensemble-edge/ui
│   └── styles.css       Tailwind v4 entry
└── dist/                gitignored; built before deploy
    ├── app.bundle.js
    └── app.bundle.css
```
