# Building a guest worker for Ensemble Workspace

> **For:** an agent or developer adding a custom app to their workspace.
> **Workspace version:** verified against v0.1.1.
> **Audience:** familiar with Cloudflare Workers + wrangler.

A guest worker is a separate Cloudflare Worker that shows up in your workspace's sidebar and renders inside an iframe in the shell's viewport. This is the **only consumer-extensible app path in v0.1.x** — see [the architecture overview](#architecture-at-a-glance) below for why.

This guide covers the end-to-end recipe: scaffold a worker → register it with workspace → see it in the sidebar → render UI → fetch workspace data.

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
