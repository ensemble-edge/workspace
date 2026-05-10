# Building a guest worker for Ensemble Workspace

> **For:** an agent or developer adding a custom app to their workspace.
> **Workspace version:** verified against v0.1.1+ (React-native recipe verified 2026-05-10 in a /tmp sandbox).
> **Audience:** familiar with Cloudflare Workers + wrangler.

A guest worker is a separate Cloudflare Worker that shows up in your workspace's sidebar and renders inside an iframe in the shell's viewport. This is the **only consumer-extensible app path in v0.1.x** — see [the architecture overview](#architecture-at-a-glance) below for why.

This guide covers the end-to-end recipe: scaffold a worker → register it with workspace → see it in the sidebar → render UI → fetch workspace data.

## Which pattern to use

**Two valid patterns** — pick based on UI complexity, not preference:

| Pattern | When | Look-and-feel | Bundle cost |
|---|---|---|---|
| **React-native** (recommended for any real UI) | Tables, forms, interactive views, anything you'd reach for `@ensemble-edge/workspace/ui` components for | Pixel-native — same React components the shell uses against the same theme tokens | ~125KB gzipped JS + ~11KB gzipped CSS |
| **HTML strings** (fallback for trivial cases) | JSON-returning connectors with no UI, or apps so simple they render <50 lines of HTML | On-brand colors via `/_ensemble/brand/css`, but you hand-roll layout | Zero JS, ~5KB CSS |

**For anything customer-facing or operator-facing, use React-native.** The HTML-string pattern is for connectors and trivial admin views.

Both patterns live in this guide. The [React-native section](#react-native-guest-app-recommended) is the primary recipe; [HTML-string](#html-string-guest-app-fallback) is preserved for the cases where it's the right call.

---

## Architecture at a glance

```
   Browser ──▶ Workspace shell (cl-workspace Worker)
                   │
                   ├── Sidebar reads /_ensemble/nav (D1: guest_apps table)
                   │
                   └── Click "Quiz CMS" → shell navigates to /apps/quiz-cms
                            │
                            ▼
                       AppViewPage mounts an iframe with src=/_ensemble/apps/quiz-cms/
                            │
                            ▼
                       Workspace's gateway (/_ensemble/apps/*) proxies the request
                            │
                            ├── Looks up the guest_apps row
                            ├── Injects context headers (workspace, user, capability token)
                            └── Forwards via service binding OR HTTP
                                     │
                                     ▼
                              Your guest worker — returns full HTML page
                                     (rendered inside the iframe)
```

Three things to internalize:

1. **The shell is a sealed React SPA.** You cannot inject components into it. Your UI lives inside an iframe and is whatever HTML your worker returns.
2. **Discovery is D1, not config.** Workspace's sidebar reads from the `guest_apps` table. To make your app appear, you insert a row.
3. **Communication is via context headers.** The gateway injects `X-Ensemble-Workspace-Id`, `X-Ensemble-User-Id`, etc. on every proxied request. Your worker reads them to know who's asking.

---

## React-native guest app (recommended)

This is the primary recipe. Your worker serves a small HTML shell that boots a React app inside the iframe. The React app imports `@ensemble-edge/workspace/ui` and renders the same components the workspace shell uses — same `<Card>`, `<Button>`, `<Table>`, `<PageHeader>` — against the same theme tokens. The result is pixel-native and inherits any future workspace theme changes automatically.

### Verified bundle profile (2026-05-10)

A minimal `<Card>` + `<Table>` + `<Button>` page bundled with esbuild + Tailwind v4:

- **JS bundle: ~125KB gzipped** (404KB minified; React 18 + Radix UI + workspace `/ui` + your app)
- **CSS bundle: ~11KB gzipped** (workspace's design tokens + utility classes you reference)
- Both well under CF Workers' 1MB compressed limit. Plenty of headroom for app code.

### File layout

```
workers/guests/quiz-cms/
├── wrangler.toml
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
├── src/
│   ├── index.ts           ← worker entry; defineGuestApp + asset serving
│   ├── app.tsx            ← React root; renders into <div id="root">
│   ├── pages/
│   │   ├── SchemaList.tsx
│   │   └── SchemaDetail.tsx
│   ├── shared/
│   │   └── index.html.ts  ← HTML shell served by worker (links bundle.js + bundle.css)
│   └── styles.css         ← Tailwind v4 entry; @import '@ensemble-edge/workspace/ui/globals.css'
└── dist/
    ├── bundle.js          ← built by esbuild (committed or built in CI; embedded as string)
    └── bundle.css         ← built by Tailwind v4
```

### Step 1 — `package.json`

```json
{
  "name": "cl-quiz-cms",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "build:js": "esbuild src/app.tsx --bundle --platform=browser --format=esm --outfile=dist/bundle.js --minify --tree-shaking=true",
    "build:css": "tailwindcss -i ./src/styles.css -o ./dist/bundle.css --minify",
    "build": "pnpm run build:js && pnpm run build:css",
    "deploy": "pnpm run build && wrangler deploy"
  },
  "dependencies": {
    "@ensemble-edge/workspace": "github:ensemble-edge/workspace#v0.1.1",
    "hono": "^4.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.0.0",
    "@tailwindcss/cli": "^4.2.2",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "esbuild": "^0.27.4",
    "tailwindcss": "^4.2.2",
    "typescript": "^5.4.0",
    "wrangler": "^4.0.0"
  }
}
```

### Step 2 — Tailwind entry

`src/styles.css`:

```css
@import '@ensemble-edge/workspace/ui/globals.css';
@source './**/*.{ts,tsx}';
```

That's the whole file. The first line pulls workspace's design tokens + the source globs that walk workspace's compiled UI components. The second line tells Tailwind v4 to also scan your own source. **No `tailwind.config.ts` required.**

### Step 3 — React app

`src/app.tsx`:

```tsx
import { createRoot } from 'react-dom/client';
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
  Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@ensemble-edge/workspace/ui';

function App() {
  // Your real app: routing, state, data fetching from workspace API
  // For the stub, just demonstrate the components work natively.
  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Quiz CMS</h1>
        <p className="text-muted-foreground">Manage intake form schemas</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Form schemas</CardTitle>
          <CardDescription>Edit text, options, and visibility logic</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Version</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* your data */}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
```

Use `className`, not `class`. This is React, not Preact.

### Step 4 — HTML shell

`src/shared/index.html.ts`:

```ts
export function indexHtml(opts: { bundleJs: string; bundleCss: string; title: string }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(opts.title)}</title>
  <!-- Live workspace theme tokens, in order: workspace brand first, then app utilities. -->
  <link rel="stylesheet" href="/_ensemble/brand/css">
  <style>${opts.bundleCss}</style>
</head>
<body>
  <div id="root"></div>
  <script type="module">${opts.bundleJs}</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c] as string));
}
```

The bundle is **inlined as a string** rather than served as a separate asset. Reason: Cloudflare Workers can't serve static assets from `dist/` directly without Workers Sites. Inlining keeps the worker single-file and avoids that whole machinery for v0.0.1. For larger apps you'd move to Workers Static Assets or R2.

### Step 5 — Worker entry

`src/index.ts`:

```ts
import { defineGuestApp } from '@ensemble-edge/workspace/guest';
import { createGuestWorker } from '@ensemble-edge/workspace/guest/cloudflare';
import { Hono } from 'hono';
import { indexHtml } from './shared/index.html.js';

// Inline the built bundles. esbuild's --loader:.js=text would also work;
// this just imports them as strings at build time.
// @ts-ignore — virtual modules
import bundleJs from '../dist/bundle.js?raw';
// @ts-ignore
import bundleCss from '../dist/bundle.css?raw';

const router = new Hono();

router.get('*', (c) => {
  return c.html(indexHtml({
    bundleJs,
    bundleCss,
    title: 'Quiz CMS',
  }));
});

const app = defineGuestApp({
  manifest: {
    id: 'quiz-cms',
    name: 'Quiz CMS',
    version: '0.0.1',
    icon: 'clipboard-list',
    category: 'tool',
    permissions: ['read:user', 'read:workspace'],
    entry: '/',
  },
  fetch: (request) => router.fetch(request),
});

export default createGuestWorker(app);
```

The `?raw` import suffix is esbuild's text-loader convention. If your build setup doesn't recognize it, use this alternative pattern:

```ts
// Read bundle contents at build time and inline as a string
const bundleJs = await import('fs').then(fs => fs.readFileSync('./dist/bundle.js', 'utf8'));
```

The router serves the same HTML shell for **every path** (`router.get('*', ...)`). React Router (or similar) inside the iframe handles deep-linking — `/apps/quiz-cms/schemas/:id` proxies to `/schemas/:id` at the worker, which still returns the same shell, which then renders the right page client-side.

### Step 6 — `wrangler.toml`

```toml
name = "cl-quiz-cms"
main = "src/index.ts"
compatibility_date = "2026-05-01"

# No public routes — gateway-only access.
# Workspace's [[services]] binding handles routing.

[vars]
WORKSPACE_ORIGIN = "https://workspace.example.com"
```

In `cl-workspace`'s `wrangler.toml`:

```toml
[[services]]
binding = "QUIZ_CMS"
service = "cl-quiz-cms"
```

### Step 7 — Build + deploy

```bash
cd workers/guests/quiz-cms
pnpm install
pnpm run build       # builds dist/bundle.js + dist/bundle.css
wrangler deploy
```

Then redeploy `cl-workspace` to activate the binding, and insert the `guest_apps` row (see [§ Register the app](#step-5--register-the-app-in-guest_apps) further down for the SQL).

### Verifying it looks native

Once deployed and visible in the sidebar:

1. **Open a core app first** (e.g., Brand Manager). Note the page padding, card border, table style, button look.
2. **Open Quiz CMS**. The header, card, table, and buttons should look pixel-identical.
3. **Change the workspace's brand color** in Brand Manager → Save. Refresh Quiz CMS. The card border, button color, accents should all shift to match the new brand. **This is the "lives in multiple workspaces, inherits the host theme" property working.**

If something looks off:

| Symptom | Likely cause |
|---|---|
| No styles at all | `bundle.css` didn't build, or HTML shell isn't loading it |
| Colors look like default Tailwind, not workspace's | `/_ensemble/brand/css` link in HTML shell is missing or wrong |
| Components render but layout is broken | Tailwind v4 `@source` not finding workspace UI sources — verify `@import '@ensemble-edge/workspace/ui/globals.css'` is the FIRST line |
| Hydration error in console | React 18 strict mode + Radix mismatch — try removing `<React.StrictMode>` for now and report it |

### Sharp edges to know about

These are real and tested; they bit me building this recipe.

1. **The `?raw` import suffix only works if your build tool recognizes it.** esbuild's default doesn't, but `esbuild --loader:.js=text --loader:.css=text` does. If neither works, fall back to `readFileSync` at worker startup OR use a build script that produces a `bundle-inline.ts` file that exports the strings.

2. **`globals.css` MUST be the first thing in your Tailwind entry.** Workspace's design tokens have to land before any utility classes Tailwind generates, or the variable references in utilities resolve to undefined.

3. **Don't mix `class` and `className`.** Workspace's UI is React; using `class` (Preact-style) silently fails to apply styles. If a component looks unstyled, this is almost always why.

4. **React duplication is the most expensive bug you can hit.** Your worker imports React; workspace's UI peer-depends on React. If the consumer-side React and workspace-side React end up as two copies in the bundle, Radix's hooks break. Confirm with `grep -c '"react/jsx-runtime"' dist/bundle.js` — should be exactly 1. If it's 2+, see [§ Force a single React](#force-a-single-react).

5. **Tailwind v4's `@source` is silent on misses.** A typo or wrong path produces zero output, not an error. If your custom classes don't generate, check `@source` first.

### Force a single React

If you hit React duplication, add to your esbuild command:

```bash
esbuild ... --alias:react=./node_modules/react --alias:react-dom=./node_modules/react-dom
```

Or in `package.json`'s `pnpm.overrides`:

```json
{
  "pnpm": {
    "overrides": {
      "react": "$react",
      "react-dom": "$react-dom"
    }
  }
}
```

The `$name` syntax pins to whatever your top-level `dependencies.react` resolves to.

### Calling workspace's API from your React app

Inside the iframe, your React code can `fetch('/_ensemble/...')` and the gateway routes it through workspace's auth middleware automatically — the iframe is same-origin with the shell. You don't need to forward capability tokens for browser-originated calls (those are for *worker-to-workspace* calls from your guest worker's fetch handler).

```tsx
function useSchemas() {
  const [schemas, setSchemas] = useState([]);
  useEffect(() => {
    fetch('/_ensemble/apps/quiz-cms/api/schemas')  // your own worker's API
      .then(r => r.json())
      .then(setSchemas);
  }, []);
  return schemas;
}
```

Note: `/apps/quiz-cms/api/schemas` (browser URL) → `/api/schemas` (proxied to your worker) — the gateway strips the `/_ensemble/apps/<id>` prefix.

---

## HTML-string guest app (fallback)

The original HTML-string pattern, preserved for JSON-only connectors or trivial admin views where shipping a React bundle is overkill. The architecture/registration/deployment steps are identical; only the response shape differs.

## File layout

Suggested (mirrors what other Ensemble guests look like — see [`packages/connectors/echo/`](../../packages/connectors/echo/) for a worked example):

```
your-monorepo/
└── workers/
    └── guests/
        └── quiz-cms/
            ├── wrangler.toml
            ├── package.json
            ├── tsconfig.json
            └── src/
                ├── index.ts          ← worker entry; defineGuestApp + createGuestWorker
                ├── pages/            ← server-rendered HTML for each route
                │   ├── list.ts
                │   └── detail.ts
                ├── routes.ts         ← Hono router (optional but recommended)
                └── shared/
                    └── layout.ts     ← HTML page chrome (reused across routes)
```

---

## Step 1 — Worker entry

`workers/guests/quiz-cms/src/index.ts`:

```ts
import { defineGuestApp } from '@ensemble-edge/workspace/guest';
import { createGuestWorker } from '@ensemble-edge/workspace/guest/cloudflare';
import { Hono } from 'hono';
import { listPage } from './pages/list';
import { detailPage } from './pages/detail';

const router = new Hono();
router.get('/', (c) => listPage(c.req.raw));
router.get('/schemas/:id', (c) => detailPage(c.req.raw, c.req.param('id')));

const app = defineGuestApp({
  manifest: {
    id: 'quiz-cms',
    name: 'Quiz CMS',
    version: '0.0.1',
    description: 'Manage intake form schemas',
    icon: 'clipboard-list',           // Lucide icon name
    category: 'tool',                  // 'tool' | 'connector' | 'agent' | 'panel'
    permissions: ['read:user', 'read:workspace'],
    entry: '/',
  },
  fetch: (request) => router.fetch(request),
});

export default createGuestWorker(app);
```

What `createGuestWorker` gives you for free:

- Manifest served at `/.well-known/ensemble-manifest.json` (the gateway fetches this when registering your app)
- Health check at `/health`
- Context-header validation — by default rejects requests that lack `X-Ensemble-Workspace-Id` (i.e. requests not coming through the gateway)
- Error handling that returns JSON `{error: {code, message}}` on uncaught exceptions

If you need to bypass the context check for local testing (`wrangler dev` outside workspace), pass `{ allowNoContext: true }`:

```ts
export default createGuestWorker(app, { allowNoContext: true });
```

---

## Step 2 — Server-rendered HTML pages

The iframe loads your route as a top-level document, so each page handler returns a **complete HTML document**, not a fragment.

`workers/guests/quiz-cms/src/shared/layout.ts`:

```ts
export function htmlPage(opts: {
  title: string;
  body: string;
  workspaceOrigin?: string;  // for fetching workspace theme CSS
}): Response {
  // Load workspace's brand tokens so your UI matches the host theme.
  // /_ensemble/brand/css returns CSS custom properties keyed off the
  // workspace's current brand config (colors, fonts, radius).
  const brandHref = opts.workspaceOrigin
    ? `${opts.workspaceOrigin}/_ensemble/brand/css`
    : '/_ensemble/brand/css';

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(opts.title)}</title>
  <link rel="stylesheet" href="${brandHref}">
  <style>
    /* Minimal page styling — extend as needed */
    body { font-family: system-ui, sans-serif; margin: 0; padding: 2rem;
           background: hsl(var(--background)); color: hsl(var(--foreground)); }
    a { color: hsl(var(--primary)); }
    table { border-collapse: collapse; width: 100%; }
    th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid hsl(var(--border)); }
    th { font-weight: 600; color: hsl(var(--muted-foreground)); }
  </style>
</head>
<body>
  ${opts.body}
</body>
</html>`;

  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c] as string));
}
```

`workers/guests/quiz-cms/src/pages/list.ts`:

```ts
import { htmlPage } from '../shared/layout';
import { getContext } from '@ensemble-edge/workspace/guest';

export async function listPage(request: Request): Promise<Response> {
  const ctx = getContext(request);
  // ctx.workspace.workspaceId, ctx.user?.userEmail, ctx.appId — see types.ts in guest pkg
  // ctx may be null if allowNoContext: true and request bypassed gateway

  const schemas = await loadSchemas(); // your own data fetch

  const body = `
    <h1>Form schemas</h1>
    <p style="color: hsl(var(--muted-foreground))">
      Workspace: ${ctx?.workspace.workspaceId ?? '(unknown)'}
    </p>
    <table>
      <thead><tr><th>Name</th><th>Version</th></tr></thead>
      <tbody>
        ${schemas.map((s) => `
          <tr>
            <td><a href="/schemas/${s.id}">${s.name}</a></td>
            <td>${s.version}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  return htmlPage({ title: 'Form schemas', body });
}

async function loadSchemas() {
  // Your data source — bundled JSON, D1, etc.
  return [];
}
```

---

## Step 3 — Talking to workspace's API from the guest worker

Your guest worker can call **workspace's** Hono API from inside its fetch handler. The gateway forwards a **capability token** in the `X-Ensemble-Capability-Token` header — proof that this request came from a real workspace user.

```ts
import { getContext } from '@ensemble-edge/workspace/guest';

async function fetchWorkspaceUserList(request: Request, workspaceOrigin: string) {
  const ctx = getContext(request);
  if (!ctx) throw new Error('No workspace context');

  const r = await fetch(`${workspaceOrigin}/_ensemble/core/people`, {
    headers: {
      'X-Ensemble-Capability-Token': ctx.capabilityToken,
      'X-Ensemble-Workspace-Id': ctx.workspace.workspaceId,
    },
  });
  return r.json();
}
```

The workspace origin can come from a `vars` entry in your `wrangler.toml`. Service-binding-connected workers can also call workspace directly via the binding instead of HTTP — see Step 5.

---

## Step 4 — `wrangler.toml`

`workers/guests/quiz-cms/wrangler.toml`:

```toml
name = "cl-quiz-cms"
main = "src/index.ts"
compatibility_date = "2026-05-01"

# Bindings YOUR worker owns. These are scoped to quiz-cms only.
# Add D1 / KV / R2 here as needed for the app's own state.
# [[d1_databases]]
# binding = "DB"
# database_name = "cl-quiz-cms-db"
# database_id = "REPLACE_WITH_D1_ID"

[vars]
# The workspace's public origin — used by the guest worker to call back
# into workspace's API (e.g. /_ensemble/core/people).
WORKSPACE_ORIGIN = "https://workspace.example.com"
```

Workspace's `wrangler.toml` (cl-workspace) needs a service binding pointing AT this worker:

```toml
[[services]]
binding = "QUIZ_CMS"          # uppercase, used by gateway to look up the binding
service = "cl-quiz-cms"        # must match `name` in the guest worker's wrangler.toml
```

The binding name (`QUIZ_CMS` here) is the value you put in `guest_apps.binding_name` (Step 5).

---

## Step 5 — Register the app in `guest_apps`

This is what makes the sidebar entry appear. There's currently **no CLI command for this** — you insert a row into D1 directly. (It's also a known feedback item; expect a `wrangler ensemble app install` command in a future workspace release.)

For each workspace you want the app installed in:

```bash
wrangler d1 execute <YOUR_WORKSPACE_DB> --remote --command "
  INSERT INTO guest_apps (
    workspace_id, id, name, icon, category,
    connection_type, binding_name, enabled, required_role
  ) VALUES (
    'YOUR_WORKSPACE_ID',
    'quiz-cms',
    'Quiz CMS',
    'clipboard-list',
    'tool',
    'service_binding',
    'QUIZ_CMS',
    1,
    'member'
  );
"
```

Replace `YOUR_WORKSPACE_DB` with your workspace's D1 binding name (often just `DB`) and `YOUR_WORKSPACE_ID` with the workspace ID (find it in your workspaces table, or `SELECT id FROM workspaces LIMIT 1` if you only have one).

If you'd rather connect via HTTP than a service binding (e.g. for a remote-hosted guest worker not in the same CF account):

```sql
INSERT INTO guest_apps (
  workspace_id, id, name, icon, category,
  connection_type, endpoint_url, enabled, required_role
) VALUES (
  'YOUR_WORKSPACE_ID', 'quiz-cms', 'Quiz CMS', 'clipboard-list', 'tool',
  'http', 'https://cl-quiz-cms.example.workers.dev', 1, 'member'
);
```

Use `service_binding` whenever possible — zero-latency, no public ingress.

---

## Step 6 — Deploy + verify

```bash
cd workers/guests/quiz-cms
wrangler deploy

# In a separate terminal, redeploy cl-workspace so its new [[services]] binding takes effect:
cd workers/workspace
wrangler deploy
```

Open your workspace in a browser. The sidebar should now have a "Quiz CMS" entry under the **Apps** section. Click it → the viewport shows an iframe loading `/_ensemble/apps/quiz-cms/` → your worker renders the schema list.

If nothing shows up:

| Symptom | Likely cause |
|---|---|
| No sidebar entry | `guest_apps` row not inserted, or `enabled=0`. Verify with `SELECT * FROM guest_apps WHERE workspace_id=?`. |
| Sidebar shows but click → "App not found" | Workspace can't reach your worker. If using `service_binding`, the binding isn't declared in workspace's `wrangler.toml`. If using `http`, the URL is wrong. |
| Iframe loads but content errors | Your worker is returning JSON `{error: MISSING_CONTEXT}`. The gateway should be injecting context headers — check your worker is actually behind `createGuestWorker` and not exporting `app` directly. |
| Theme looks wrong | Your HTML isn't loading `/_ensemble/brand/css`. See `shared/layout.ts` in Step 2. |

---

## Routing inside the iframe

The iframe loads `/_ensemble/apps/quiz-cms/` initially. Once loaded, the user clicking an `<a href="/schemas/abc">` inside the iframe navigates the iframe to `/_ensemble/apps/quiz-cms/schemas/abc`. The gateway forwards `/schemas/abc` to your worker; your Hono router handles it.

**Caveat (v0.1.1):** the URL bar of the parent shell doesn't reflect the iframe's internal navigation. The user sees `/apps/quiz-cms` in their address bar even when the iframe is showing `/schemas/abc`. Refresh works (the iframe state is gone), back button works (the iframe goes back). For a proper URL-bar-sync, the iframe would need to postMessage navigation events to the shell — not implemented today, tracked as v0.2.0.

If you need shareable deep links for now: have your worker render a "current path" in the page (e.g., a small breadcrumb showing `/schemas/abc`) so a user can manually navigate to it via the workspace URL `https://workspace.example.com/apps/quiz-cms/schemas/abc` — which DOES work because of the regex fix in v0.1.1.

---

## What `getContext()` gives you

```ts
import { getContext } from '@ensemble-edge/workspace/guest';

const ctx = getContext(request);
// {
//   workspace: { workspaceId: 'ws_abc123' },
//   user: { userId: 'usr_xyz', userEmail: 'alice@example.com', userRole: 'member' } | null,
//   appId: 'quiz-cms',
//   requestId: '<uuid>',          // for tracing in audit logs
//   capabilityToken: '<token>',   // forward this on callbacks to workspace's API
// }
```

If `getContext` returns `null`, the request didn't come through the gateway (or `allowNoContext: true` is set and a raw request hit your worker). Reject these in production.

---

## Useful workspace endpoints

Your guest worker can call these from its fetch handler (forwarding the capability token in `X-Ensemble-Capability-Token`):

| Endpoint | Purpose |
|---|---|
| `/_ensemble/brand/css` | Workspace's theme tokens as a stylesheet. Include in every page. |
| `/_ensemble/brand/spec` | Same data as JSON if you want to make programmatic UI decisions. |
| `/_ensemble/brand/context` | AI-readable markdown summary of the brand. Useful for LLM prompts. |
| `/_ensemble/me` | Current user info. |
| `/_ensemble/workspace` | Workspace identity (id, name, type). |
| `/_ensemble/nav` | The sidebar nav data — handy if you want to render breadcrumbs that match the shell. |

---

## Reference example

[`packages/connectors/echo/`](../../packages/connectors/echo/) in the workspace repo is the minimal-viable guest worker. It demonstrates manifest declaration, context extraction, a health endpoint, and a couple of API routes. **Read it before you write anything.** It's ~150 lines and answers most questions this guide doesn't.

[`packages/connectors/notes/`](../../packages/connectors/notes/), [`stripe/`](../../packages/connectors/stripe/), [`weather/`](../../packages/connectors/weather/) are more substantial examples if you want to see how scoped D1, external API calls, and AI tool definitions look in practice.

---

## Things this guide does NOT cover (and why)

- **AI panel integration** — your manifest can declare AI tools (see `GuestAppManifest.ai`), but that surface isn't wired up end-to-end in v0.1.1. Defer.
- **postMessage between iframe and shell** — not exposed in v0.1.1. Defer.
- **Custom dashboard widgets** — manifest supports `widgets` but the shell's dashboard renderer isn't generic over them yet. Defer.
- **OAuth flows for connector apps** — workspace has hooks for this (`connects_to` in manifest) but the gateway doesn't proxy OAuth callbacks today. Roll your own OAuth in the guest worker if you need it for v0.0.1.

When any of these become important for your app, file feedback in [`docs/curalisto-feedback.md`](../curalisto-feedback.md) and we'll prioritize against the v0.2.0 design list.
