# Building an in-process app in cl-workspace

> **For:** the agent working on cl-workspace / curalisto's quiz-cms stub.
> **Status:** v0.1.0 — based on actual runtime, not aspirational spec.
> **Last verified:** 2026-05-10 against `@ensemble-edge/workspace@v0.1.0`.

This guide tells you how to add a custom "app" (rendered page + API routes + sidebar entry) to cl-workspace without spinning up a second Cloudflare Worker.

---

## Read this first: what the architecture actually looks like

You may have been told "guest apps are separate Workers connected via service bindings." That is **one** deployment shape. It is not the only one and not the right one for v0.0.1 of quiz-cms.

The workspace spec defines four app *types* (manifest field `type`):

| Type | What it is | Separate Worker? |
|---|---|---|
| `'component'` | A trusted UI module + route handlers running inside the workspace Worker | **No** |
| `'iframe'` | A sandboxed web page loaded into the shell's viewport via iframe | Optional |
| `'api-only'` | Pure backend, no UI | Usually yes |
| `'hybrid'` | UI + backend, often as a separate Worker | Often yes |

For quiz-cms v0.0.1 (read-only list of form schemas, render a table of questions, no fancy backend, single team using it), **type `'component'` is correct**. It lives inside cl-workspace's repo as a folder of TypeScript. One Worker. Zero service bindings.

Promote to `'hybrid'` later if quiz-cms ever needs its own D1, its own KV namespace, or independent deployment cadence.

### Honest gap: v0.1.0 doesn't ship a public "register your app" API yet

The workspace runtime auto-registers its own *core* apps (Brand, Admin, People, Apps, Audit) inside `createWorkspace()`. There is **no public hook in v0.1.0** for a consumer to say "also register my app and surface it in the sidebar."

What we'll do instead: wrap the workspace handler in a thin Hono app that mounts quiz-cms's API routes alongside. For the UI side, render quiz-cms's React pages and rely on a hardcoded sidebar link until workspace exposes a real extension point in a future release.

This is a **pragmatic v0.0.1 fix, not the long-term shape**. When workspace ships consumer-app extension points (tracked as a v0.2.0 design item), we migrate quiz-cms to use them. Make sure your code is structured so the migration is mostly mechanical — no business logic baked into the wrapping.

---

## File layout in cl-workspace

Recommend:

```
cl-workspace/                       ← the workspace Worker (one Worker)
├── wrangler.toml
├── package.json
├── src/
│   ├── worker.ts                   ← entry; wraps createWorkspace
│   ├── apps/                       ← consumer-defined apps live here
│   │   └── quiz-cms/
│   │       ├── manifest.ts         ← id, name, icon, nav config
│   │       ├── routes.ts           ← Hono routes (server)
│   │       ├── pages/              ← React pages (client)
│   │       │   ├── SchemaList.tsx
│   │       │   └── SchemaDetail.tsx
│   │       ├── components/         ← quiz-cms-internal components
│   │       └── index.ts            ← exports { manifest, registerRoutes, pages }
│   ├── client/                     ← shell mount + page routing
│   │   ├── entry.tsx
│   │   └── routes.tsx              ← maps /apps/quiz-cms/* → pages
│   └── styles.css                  ← Tailwind v4 entry (see below)
```

The `src/apps/<app-id>/` shape mirrors how workspace organizes its own core apps ([`packages/core/src/apps/core/brand/`](../../packages/core/src/apps/core/brand/)). Copying that shape now means migrating to workspace's eventual extension API is a rename, not a refactor.

---

## Step 1 — Manifest

`src/apps/quiz-cms/manifest.ts`:

```ts
// The CoreAppManifest type is the real, working contract in v0.1.0.
// When workspace ships a public "guest-component" manifest type, we'll
// swap the import. For now this works.
import type { CoreAppManifest } from '@ensemble-edge/workspace/core/types';

export const quizCmsManifest: CoreAppManifest = {
  id: 'cl:quiz-cms',          // namespaced — 'cl:' prefix avoids collision with core: apps
  name: 'Quiz CMS',
  icon: 'clipboard-list',     // Lucide icon name
  description: 'Manage intake form schemas',
  tier: 'core',               // v0.1.0 only supports 'core' | 'bundled'; treat as a label, not the eventual tier
  nav: {
    label: 'Quiz CMS',
    icon: 'clipboard-list',
    section: 'apps',          // 'apps' (third-party) or 'workspace' (settings-like)
    path: '/apps/quiz-cms',
  },
};
```

Two things flagged:

- `id: 'cl:quiz-cms'` — namespace your app IDs with a prefix so they don't collide with workspace's `core:*` apps if workspace ever does a manifest sync.
- `tier: 'core'` is the only value that compiles in v0.1.0. Treat it as a placeholder. When workspace's manifest type gains a `'guest'` value, change it.

---

## Step 2 — Server routes

`src/apps/quiz-cms/routes.ts`:

```ts
import type { Hono } from 'hono';

// Use the consumer's own Env / ContextVariables types here, NOT workspace's
// internal ones. Workspace doesn't currently export them via a stable subpath;
// you redefine the shape you need (the bindings you declare in wrangler.toml).
type Env = {
  DB: D1Database;
  JWT_SECRET: string;
  // ... other bindings cl-workspace declares
};

export function registerQuizCmsRoutes(app: Hono<{ Bindings: Env }>) {
  // Mount under /_ensemble/apps/cl/quiz-cms/* to mirror workspace's convention.
  // Workspace's own core apps live at /_ensemble/core/<app-id>/*.
  app.get('/_ensemble/apps/cl/quiz-cms/schemas', async (c) => {
    // For v0.0.1: read directly from your bundled @curalisto/schema package.
    // No D1 read yet — that's a later iteration.
    const schemas = await listSchemasFromBundle();
    return c.json({ schemas });
  });

  app.get('/_ensemble/apps/cl/quiz-cms/schemas/:id', async (c) => {
    const id = c.req.param('id');
    const schema = await getSchemaFromBundle(id);
    if (!schema) return c.json({ error: 'not found' }, 404);
    return c.json({ schema });
  });
}

async function listSchemasFromBundle() {
  // Import from your @curalisto/schema package at the top of the file in real code.
  // Stubbed here for clarity.
  return [];
}

async function getSchemaFromBundle(_id: string) {
  return null;
}
```

**Auth note:** workspace's middleware should already be running by the time these routes execute (because they're mounted on the same Hono app that `createWorkspace` returned). That means `c.get('user')` and friends from `@ensemble-edge/workspace/core/middleware/auth` should work. **Verify this before relying on it** — if `c.get('user')` is `undefined`, your route is running outside the auth middleware chain and you need to add `auth()` middleware explicitly.

---

## Step 3 — Wire routes into the workspace handler

`src/worker.ts`:

```ts
import { createWorkspace } from '@ensemble-edge/workspace/core';
import { Hono } from 'hono';
import { registerQuizCmsRoutes } from './apps/quiz-cms/routes';

const workspace = createWorkspace({
  workspace: { /* ...cl-workspace config */ },
  brand: { /* ...cl-workspace brand */ },
});

// Wrap workspace's handler in a Hono app that also serves our app's routes.
// The order matters: app-specific routes go BEFORE workspace's catch-all so
// they take precedence. Workspace's handler picks up anything we don't claim.
const app = new Hono();

registerQuizCmsRoutes(app);

// Delegate everything else to workspace.
app.all('*', (c) => workspace.fetch(c.req.raw, c.env, c.executionCtx));

export default app;
```

**Watch out:** if `createWorkspace` returns something with a `.fetch` method (Worker-shape object) the snippet above is correct. If it returns a Hono app directly, you can `app.route('*', workspace)` instead. Inspect the return type before committing — v0.1.0's `WorkspaceInstance` shape is in [`packages/core/src/create-workspace.ts`](../../packages/core/src/create-workspace.ts).

---

## Step 4 — Client pages

`src/apps/quiz-cms/pages/SchemaList.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@ensemble-edge/workspace/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@ensemble-edge/workspace/ui';

export function SchemaList() {
  const [schemas, setSchemas] = useState<Array<{ id: string; name: string; version: string }>>([]);

  useEffect(() => {
    fetch('/_ensemble/apps/cl/quiz-cms/schemas')
      .then((r) => r.json())
      .then((data) => setSchemas(data.schemas));
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Form schemas</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Version</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schemas.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <a href={`/apps/quiz-cms/schemas/${s.id}`} className="text-primary underline">{s.name}</a>
                </TableCell>
                <TableCell>{s.version}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
```

`src/apps/quiz-cms/pages/SchemaDetail.tsx` — same pattern; render question list as a table.

**Use workspace's UI components.** They're already themed correctly. Don't roll your own table styles.

---

## Step 5 — Client routing

`src/client/routes.tsx`:

```tsx
// Whatever client-side router cl-workspace uses (probably the shell's built-in
// Viewport routing). If you're rendering the shell yourself, you mount your
// app's pages here. Cross-reference workspace's shell implementation in
// packages/core/src/shell/components/Viewport.tsx for the current routing
// contract.

import { SchemaList } from '../apps/quiz-cms/pages/SchemaList';
import { SchemaDetail } from '../apps/quiz-cms/pages/SchemaDetail';

export const routes = [
  { path: '/apps/quiz-cms',                 element: <SchemaList /> },
  { path: '/apps/quiz-cms/schemas/:id',     element: <SchemaDetail /> },
];
```

**Open question to resolve while building:** does the workspace shell expose a mechanism for consumer-defined client routes? Read [`packages/core/src/shell/components/Viewport.tsx`](../../packages/core/src/shell/components/Viewport.tsx) before assuming. If not, you'll need to render the shell yourself in cl-workspace's client entry rather than using workspace's bundled shell. That's a meaningful scope expansion — flag it back to me if you hit that wall.

---

## Step 6 — Tailwind

`src/styles.css`:

```css
@import '@ensemble-edge/workspace/ui/globals.css';
@source './**/*.{ts,tsx}';
```

This pulls workspace's design tokens and component utility classes, and tells Tailwind v4 to also scan cl-workspace's own sources. Both parts are required — without the first, you get no theme; without the second, your custom classes won't appear.

---

## Step 7 — Sidebar entry (the open problem)

The workspace shell builds its sidebar from `getCoreAppManifests()` — workspace's own apps only. A consumer-defined app's manifest is currently invisible to the sidebar.

**Two workarounds, both honest about their costs:**

1. **Hardcode a sidebar link in your shell wrapper.** Fast, ugly, works today. Document it as temporary.
2. **Patch nav at runtime.** Workspace stores nav state in Preact signals ([`packages/core/src/shell/state/nav.ts`](../../packages/core/src/shell/state/nav.ts)). If those signals are exported (verify), you can `.value.push(quizCmsNavItem)` after mount. Less ugly, still temporary.

Either way, this is the cleanest indicator that we need a public "register your app" extension point in workspace v0.2.0. Don't paper over it with a complex abstraction — keep the workaround small and obvious so it's easy to delete later.

---

## Step 8 — Permissions

For v0.0.1 (read-only, no edits, no audit log), use workspace's auth middleware to require a logged-in user and call it done:

```ts
import { auth } from '@ensemble-edge/workspace/core/middleware/auth';

const protectedRoutes = new Hono<{ Bindings: Env }>();
protectedRoutes.use('*', auth());
registerQuizCmsRoutes(protectedRoutes);
app.route('/', protectedRoutes);
```

Real permission checks (read:user, read:workspace as the original brief mentioned) are a v0.0.2 concern. Don't gold-plate v0.0.1.

---

## v0.0.1 acceptance checklist

- [ ] `cl:quiz-cms` link appears in cl-workspace's sidebar (via whichever workaround you picked in Step 7)
- [ ] Clicking it navigates to `/apps/quiz-cms` and renders a table of form schemas
- [ ] Clicking a schema navigates to `/apps/quiz-cms/schemas/:id` and renders its 25 questions in a table
- [ ] Both pages use `@ensemble-edge/workspace/ui` components (Card, Table) — not hand-rolled HTML
- [ ] Tailwind v4 build produces theme-correct CSS (`bg-primary`, `text-foreground` etc. resolve)
- [ ] The API routes are auth-gated (anonymous requests return 401)
- [ ] No second Worker. No `[[services]]` binding in `wrangler.toml`.

---

## What NOT to build in v0.0.1

These are out of scope. Each is a real eventual need but each adds days of work; ship the read-only stub first.

- D1 override table for schema edits — defer until you actually need to edit schemas through the UI
- Audit log integration — workspace has an audit app already; integrate later
- Locale toggle (es/en) for question text — render in one locale first
- Form preview/render simulation — that's a v0.1.0 of quiz-cms, not v0.0.1
- Rich text editor for question text — yes, workspace ships one (`@ensemble-edge/workspace/ui` → `RichTextEditor`, once landed), use it in v0.0.2

---

## Things to confirm before you start writing code

Treat these as questions to answer by reading workspace source, not assumptions:

1. **Does workspace's shell support consumer client-side routes?** Read [`packages/core/src/shell/components/Viewport.tsx`](../../packages/core/src/shell/components/Viewport.tsx). If yes, use it. If no, you're rendering the shell yourself in cl-workspace — flag this as scope.
2. **What does `createWorkspace()` return?** Check [`packages/core/src/create-workspace.ts`](../../packages/core/src/create-workspace.ts). Determines whether Step 3's wrapping pattern works as written.
3. **Are nav signals exported?** Check [`packages/core/src/shell/state/nav.ts`](../../packages/core/src/shell/state/nav.ts). Determines which workaround in Step 7 is available.
4. **Is `c.get('user')` populated in routes you register after `createWorkspace`?** Smoke-test before designing around it. If no, wrap your routes in `auth()` middleware explicitly (Step 8 shows how).

If any of these turn out to be blockers, push back — don't build elaborate workarounds. The workspace project is responsive to "your v0.1.0 doesn't expose the thing I need" feedback (see `docs/curalisto-feedback.md`).

---

## When workspace ships the real extension point

Eventually `createWorkspace({ apps: [quizCmsApp, ...] })` will exist. When it does:

- Your manifest stays the same.
- Your `registerQuizCmsRoutes` becomes the `registerRoutes` field of a `CoreAppDefinition`-shaped object.
- Your hardcoded sidebar link / signal patch goes away.
- Your client routes plug into workspace's shell route map.

That's the goal. The v0.0.1 wrapping pattern in Step 3 is structured to make this migration mechanical — keep it that way.
