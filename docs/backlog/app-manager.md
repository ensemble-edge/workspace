# App Manager — unified app governance (built-in + guest)

> **Status:** proposal / backlog. Not yet active.
> **Author:** drafted from the Legal-app work (v0.1.105 era).
> **Audience:** workspace platform team.
> **One-line:** make `core:apps` the single surface that lists every app
> — built-in (core) and guest — and governs each app's **on/off state,
> configuration, and mount location** through the dormant `installed_apps`
> table, instead of the per-app, hardcoded approach we have today.

## Why now

Two unrelated-looking requests converged on the same missing capability:

1. **"Can the Legal app's public pages serve off `curalisto.com` instead
   of `workspace.curalisto.com`?"** — i.e. an app's *mount hostname*
   should be configurable, not hardcoded to the workspace subdomain.
2. **"Shouldn't the App Manager show all apps (built-in or not) and
   govern on/off and things like this?"** — i.e. app lifecycle should be
   centralized.

Both want the same thing: **per-app configuration owned by a registry**,
covering enabled-state, settings, and where the app mounts. Today none of
that is centralized.

## What exists today (the seams already in place)

The platform is ~half-built toward this. The pieces exist but aren't wired
together:

| Piece | State | Location |
|-------|-------|----------|
| `core:apps` "App Manager" app | **Stub** — empty `registerRoutes`, comment says "Phase 2 will add /_ensemble/core/apps/* install/uninstall admin UI" | `apps/core/apps/index.ts` |
| `AppsPage.tsx` (client) | Lists **guest apps only** (`GET /_ensemble/apps`); unaware of core apps | `shell/src/apps/core/apps/AppsPage.tsx` |
| `installed_apps` table | **Dormant** — schema exists, nothing reads/writes it | `db/migrations/001_initial.ts` |
| `getCoreAppManifests()` | Returns every built-in manifest — but the nav handler doesn't use it (core apps are hand-listed) | `apps/core/index.ts` |
| `guest_apps` table | Live — has `enabled`, `required_role`, `endpoint_url`, etc. | `db/migrations/002_guest_apps.ts` |
| Per-app toggles | **Scattered**: `public_brand_guide_enabled` (in Brand), `legal_public_enabled` (in Legal), `guest_apps.enabled` (per guest) — each invented ad hoc | `services/workspace-settings.ts`, etc. |
| Nav (`/_ensemble/nav`) | Hand-lists core apps inline; appends guest apps from `guest_apps` | `create-workspace.ts` |
| Custom-domain resolver | **Stub** — `resolveByDomain()` always returns `null`; comment: "workspace_domains table (future feature)" | `middleware/workspace-resolver.ts` |

The dormant `installed_apps` schema is telling — it was clearly designed
for exactly this:

```sql
CREATE TABLE installed_apps (
  workspace_id  TEXT NOT NULL,
  app_id        TEXT NOT NULL,           -- 'core:legal', 'core:brand', guest ids
  manifest_json TEXT NOT NULL,
  settings_json TEXT DEFAULT '{}',       -- per-app config
  status        TEXT DEFAULT 'active'    -- 'active' | 'inactive' | 'needs_config'
                CHECK (status IN ('active','inactive','needs_config')),
  installed_at  TEXT, installed_by TEXT,
  PRIMARY KEY (workspace_id, app_id)
);
```

It already models on/off (`status`) and per-app config (`settings_json`).
It just needs a writer (the App Manager) and readers (nav, route gating).

## Proposed model

### 1. A single app registry the App Manager reads

`GET /_ensemble/core/apps` returns the unified list:

```ts
{
  apps: [
    { id: 'core:brand',  tier: 'core',  name: 'Brand Manager', status: 'active',   mount: {...}, governable: false },
    { id: 'core:legal',  tier: 'core',  name: 'Legal Center',  status: 'active',   mount: {...}, governable: true  },
    { id: 'guest:quiz',  tier: 'guest', name: 'Quiz CMS',      status: 'inactive', mount: {...}, governable: true  },
  ]
}
```

Built from `getCoreAppManifests()` (core) ∪ `guest_apps` (guest), with
each app's row in `installed_apps` layered on top for status + settings.

- `governable: false` for apps that can't be turned off (Brand, People,
  Settings are load-bearing). Prevents an operator bricking their nav.
- `tier` distinguishes core (ships with platform) from guest (installed).

### 2. `installed_apps` becomes the source of truth for status + config

- On bootstrap, seed an `installed_apps` row per core app (`status:
  'active'`).
- The App Manager flips `status` (active ↔ inactive) and edits
  `settings_json`.
- **Nav** (`/_ensemble/nav`) reads `installed_apps.status` — an inactive
  app drops out of the sidebar automatically. (Today nav hand-lists core
  apps; it would instead iterate the registry filtered by status.)
- **Route gating**: a thin middleware (or per-app check) returns 404 for
  an inactive app's routes — generalizing what `legal_public_enabled`
  and `public_brand_guide_enabled` do by hand today. Those two settings
  fold into `installed_apps.settings_json` as app-specific config.

### 3. Mount configuration (the domain question)

Add a `mount` concept to each app's config — **this is what solves
"serve Legal off curalisto.com."**

```ts
mount: {
  path: '/legal',                         // already implicit today
  hostnames: ['workspace.curalisto.com',  // the workspace subdomain
              'curalisto.com'],           // + the tenant brand domain
}
```

For this to work end-to-end, the workspace team must implement the
**already-stubbed** custom-domain resolver:

- Create the `workspace_domains` table the resolver comment references
  (`domain TEXT → workspace_id`).
- Implement `resolveByDomain()` (currently `return null`) to look up the
  Host there.
- Add the brand domain(s) to the worker's Cloudflare routes
  (`curalisto.com/legal/*` → workspace worker).

Then a request to `curalisto.com/legal/privacidad` resolves the tenant by
hostname, the Legal app's routes match `/legal/*`, and the page renders —
natively, no proxy. Because the Legal pages already `<link>` `/brand/css`,
they pick up the brand-domain's tokens automatically.

This replaces the **tenant-side proxy workaround** (a landing-worker that
fetches `workspace.curalisto.com/legal/*` and forwards bytes — works, but
fiddly with relative `/brand/css` + inter-page links, and papers over the
missing platform feature).

## Why the app can't own this (and the App Manager must)

A built-in app advertises its **paths** into the workspace worker; it has
no say over which **hostnames** route to that worker. Hostname→worker
binding is Cloudflare-route + resolver territory — one layer above any
app. So "serve Legal off the brand domain" is intrinsically a platform
concern. The App Manager is the right home: it's the layer that already
knows about every app and can hold each app's mount config as data.

## Phasing

1. **Read-only registry** — `GET /_ensemble/core/apps` (core ∪ guest);
   `AppsPage` lists all apps with their status. No behavior change. Small,
   shippable, immediately useful (you can finally *see* every app).
2. **Governance** — `installed_apps` seeded + read by nav and route
   gating; App Manager toggles status; migrate `legal_public_enabled` /
   `public_brand_guide_enabled` into `settings_json`.
3. **Mount config + domains** — `workspace_domains` table, implement
   `resolveByDomain()`, brand-domain CF routes, `mount.hostnames` per app.
   This is the piece that unblocks Legal on `curalisto.com`.

Phase 1 is a core-team-only change. Phase 3 needs Cloudflare route + DNS
coordination (zones, certs) and is the largest.

## Open questions

1. **Which apps are `governable: false`?** Proposed: Brand, People,
   Settings, App Manager itself. Everything else toggleable.
2. **Per-app settings schema** — does each app declare its settings shape
   in its manifest (so the App Manager can render a generic config form),
   or stay bespoke per app?
3. **Domain verification** — `workspace_domains` likely needs a
   verification step (TXT record / ACME) before a tenant can claim a
   hostname. Out of scope for the model, but required for production.
4. **Publish-gate semantics under mount config** — `legal_public_enabled`
   is "are the public pages live." If mount config governs *where* an app
   serves, is "published" a separate axis from "mounted"? (Probably yes:
   an app can be mounted-but-unpublished.)

## Relationship to current code

- `legal_public_enabled` (shipped v0.1.104) and `public_brand_guide_enabled`
  are the prototypes of per-app governance — Phase 2 generalizes them.
- The nav handler's hand-listed core apps (`create-workspace.ts`) is the
  thing Phase 1/2 replaces with a registry iteration.
- Nothing here changes the Legal app's own behavior; it becomes a
  *managed* app rather than a self-governing one.
