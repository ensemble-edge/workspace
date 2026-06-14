# App Manager — Implementation Plan (Phase 1 + Domain Mapping)

> **Status:** plan, awaiting green light for the App Manager itself.
> **Layer A SHIPPED (v0.1.108):** `workspace_domains` table,
> `resolveByDomain`, the `brandDomain` request context, `absoluteUrl`,
> the Domains API (`/_ensemble/domains`) + Settings→Domains UI, and the
> legal renderer's brand-domain canonical/hreflang/noindex. See
> `docs/plan/brand-domain.md`. The App Manager (below) builds on it.
> **Scope (approved):** app registry + enable/disable (Phase 1) AND
> per-app mount config (Phase 2 / Layer B), in one effort.
> **Design rationale:** see `docs/backlog/app-manager.md`. This doc is the
> build-ready step list grounded in actual files/seams.
> **Decision locked:** app-level `enabled` and `published` are DISTINCT
> axes. `enabled` = installed + in nav (App Manager owns it). `published`
> = public surface live (app-specific, e.g. `legal_public_enabled`). An
> app can be enabled-but-unpublished.
> **Folds in (this revision):** the "routing convention" concern — instead
> of a prose convention doc tenants hand-copy, the App Manager owns the
> per-app mount map + emits the recommended CF routes block (§3a). Only
> the irreducible "gateway is auth-only" fact stays a short doc.

---

## The two layers (do not conflate)

**Layer A — request reaches the worker (infra/resolver).** For
`curalisto.com/legal` to work at all, CF routes `curalisto.com/*` → the
workspace worker, and the resolver maps `Host: curalisto.com` → tenant.
This is `workspace_domains` + `resolveByDomain()` + a CF route. Shared by
every app; set up once per tenant.

**Layer B — is this app allowed on this (host, path)? (app config).** Once
the request arrives, a single per-request gate reads the app's mount
config and 404s if the app is disabled or not mounted on this host. This
is where enable/disable AND domain-mapping live — as DATA in
`installed_apps`, read by ONE middleware. No per-app hand-coding.

Routes still register globally and unconditionally (no dynamic route
surgery). The gate runs before app handlers and rejects per-request. This
is the same shape as today's `legal_public_enabled` 404 — generalized.

---

## Data model

### `installed_apps` (exists, dormant — start using it)

```sql
-- from 001_initial.ts, already present:
installed_apps(workspace_id, app_id, manifest_json, settings_json,
               status CHECK IN ('active','inactive','needs_config'),
               installed_at, installed_by, PK(workspace_id, app_id))
```

- `status` → the **enabled** axis. `active` = on, `inactive` = off.
- `settings_json` → per-app config blob, including **mounts** and
  app-specific settings (e.g. legal's `published`).

Proposed `settings_json` shape:

```ts
{
  mounts: [
    { host: '*',                path: '/legal' },  // '*' = the workspace's own host(s); always allowed
    { host: 'curalisto.com',    path: '/legal' },  // operator-added, must be a verified workspace_domain
  ],
  // app-specific settings migrated in (legal example):
  published: false,   // was legal_public_enabled
}
```

`host: '*'` means "the workspace's canonical host(s)" so the default
behavior (serve on `workspace.curalisto.com`) needs no config and nothing
breaks for existing workspaces.

### `workspace_domains` (Layer A) — **owned by `docs/plan/brand-domain.md`**

> **Reconciled:** the `workspace_domains` table + `resolveByDomain()` +
> render-time host awareness are specified and shipped by the standalone
> **Tenant Brand Domains** plan (`docs/plan/brand-domain.md`), which is
> Layer A and lands first. The App Manager does NOT re-create this table
> or the resolver work — it **builds on** it. See that plan for the
> canonical schema (`PRIMARY KEY (domain)`, `verified` defaulting to
> trusted-on-write, per-isolate cache, the `absoluteUrl` helper).

What the App Manager adds on top of Layer A: a mount may only reference a
domain that exists in `workspace_domains` for this workspace — the
brand-domain plan guarantees the domain is real + tenant-owned; the App
Manager decides *which apps* serve on it (Layer B mount config).

---

## App registry (the unifying read)

Core apps come from `getCoreAppManifests()` (already exists,
`apps/core/index.ts`); guest apps from `guest_apps`. Layer each app's
`installed_apps` row on top for status + config. New service:

`services/app-registry.ts`:
```ts
listApps(env, workspaceId): Promise<AppEntry[]>
// AppEntry { id, tier:'core'|'guest', name, icon, basePath,
//            status:'active'|'inactive', mounts, governable, settings }
```

- `governable:false` for load-bearing apps (Brand admin, People,
  Settings, App Manager itself) — they can't be disabled (UI hides the
  toggle; server rejects an attempt). Prevents bricking the nav.
- `basePath` from the manifest (`nav.path` / the route prefix the app
  owns, e.g. `/legal`).

Seed an `installed_apps` row per core app at bootstrap (`status:'active'`,
default mounts `[{host:'*', path: basePath}]`).

---

## Build steps

### 1. Migrations
- `installed_apps` backfill — an `installed_apps` row for each core app
  in every existing workspace (`INSERT … SELECT id FROM workspaces`,
  `ON CONFLICT DO NOTHING`, status `active`, default mounts). Mirrors the
  migration-003 per-workspace backfill pattern.
- Bootstrap (`routes/bootstrap.ts`) seeds the same rows for new workspaces.
- *(The `workspace_domains` table + its migration are NOT here — they
  ship in `docs/plan/brand-domain.md` (Layer A), which lands first. The
  App Manager reuses that table.)*

### 2. Layer A — resolver
- **Done by `docs/plan/brand-domain.md`**: `resolveByDomain()`
  implementation, the per-isolate host cache, the `absoluteUrl` helper,
  and the CF route are all in the brand-domain plan. The App Manager
  depends on that work being in place; it adds no resolver code of its
  own. Layer B (below) reads the `brandDomain` context the resolver sets.

### 3. Layer B — the mount gate (the core new mechanism)
New middleware `middleware/app-mount.ts`, registered AFTER
`workspaceResolver` (line 135) and BEFORE `registerCoreApps` (line 256):

```
for the request's (host, path):
  find the app whose basePath prefixes the path   (registry lookup, cached)
  if none → next()                                 (not an app-owned path)
  if app.status !== 'active' → 404
  if no mount matches (host, path) → 404
  else next()
```

- `host: '*'` matches the workspace's canonical host(s).
- Only gates **app-owned public paths** (`/legal/*`, `/brand/*`, guest
  mounts). Leaves `/_ensemble/*`, shell, auth untouched.
- Registry is cached per-isolate (KV or in-memory w/ short TTL) so the
  gate doesn't hit D1 every request — same posture as bootstrap check.

This single gate replaces the hand-rolled `legal_public_enabled` /
`public_brand_guide_enabled` 404 checks for the *enabled* + *mounted*
axes. (The *published* axis stays app-specific — see §5.)

### 3a. Routing model — convention as DATA, not a doc

> **Why this section exists:** a recurring tenant pain is "which surface
> lives in which worker / what CF zone routes do I need," and the
> tempting fix is a prose "routing convention" doc that tenants hand-copy
> into wrangler.toml. That doc is *unenforced state* — it rots into the
> "brittle zone-route configs" it was meant to prevent. The App Manager's
> job is to make the convention **data the platform reads + emits**, so
> the tenant doesn't reinvent the split. This folds in the routing-doc
> proposal: most of it becomes mount config; only the irreducible facts
> below stay documentation.

**The surface taxonomy (the load-bearing distinction).** Every public
path falls into one of three buckets, and the bucket determines the
worker — this is what the App Manager encodes per app:

| Surface | Auth | Where it runs | App Manager role |
|---|---|---|---|
| Operator tool (guest app) | workspace session / API key | guest worker, proxied via the gateway `/_ensemble/apps/:id/*` | lists it, enable/disable, but its mount is the FIXED gateway path |
| CMS-authored public page (`/legal`, `/brand`) | anonymous + crawlers | tenant-host worker (SDK core apps) | owns the mount: host + path (Layer B) |
| Consumer UI/API (quiz, signup, webhooks) | anonymous + third parties | a separate customer-facing worker | NOT App-Manager-managed — it's tenant code on its own worker |

**Irreducible fact #1 — the gateway is auth-only (keep as a short doc).**
`/_ensemble/apps/*` is fronted by `auth()`; it injects workspace session
+ context + audit. Anonymous consumer endpoints (a patient API, a Stripe/
Twilio webhook) **cannot** proxy through it — they'd 401. This is by
design, not a gap the App Manager closes. So consumer surfaces live on
their own worker, full stop. This single fact is the only part of the
routing-convention prompt that should remain prose — a ~1-page note,
cross-linked, not a 1200-word convention bible.

**Irreducible fact #2 — CF zone routes are deploy-time infra.** A worker
only receives traffic Cloudflare routes to it (`wrangler.toml [[routes]]`).
The platform can't fully generate these at runtime. BUT the set is small
and stable — one `/*`-ish block per worker, not per-feature. So:

- The App Manager owns the **intra-worker mount map**: which app answers
  `/legal`, `/brand`, `/foo` *within the tenant-host worker* (the mount
  gate in §3 enforces it).
- It does NOT own the consumer worker's internal routes (that's tenant
  code), but it can **emit the recommended zone-route block** a tenant
  needs — turning "reinvent the split" into "the platform shows you the
  exact `[[routes]]` to paste." A read-only, copyable artifact in the
  App Manager UI / a `GET /_ensemble/core/apps/routes-hint` endpoint.

**What this kills:** per-feature route sprawl and the hand-maintained
convention table. An app declares its mount (host + path) once in the App
Manager; the gate enforces it; the routes-hint tells the operator the one
infra block to set. No tenant re-derives the taxonomy from a doc.

### 3b. Making mounts real — "register an app, configure its routing in one place"

> **The goal, in the operator's words:** *"register a guest app and
> configure ALL routing in the UI. One place. Period."* The mount map
> (§3a) is the **single route registry** — there is NO separate
> `workspace_routes` table; an app's mount IS its route. This section is
> only about *how a declared mount becomes a live route*. Two mechanisms;
> we lead with the one that actually delivers "one place."

**Track B — gateway dispatch (primary; the "one place" answer).**
The workspace worker claims a broad zone route (`<brand>.com/*`) and, per
request, dispatches to the right target based on the App Manager mount
map in D1:
- core-app paths (`/legal`, `/brand`) → handled in-process (already are).
- guest-app mounts → forwarded to the guest worker via **service
  binding** (CF Worker→Worker), the same privileged-proxy the gateway
  (`/_ensemble/apps/:id/*`) already uses — just at an operator-chosen
  public path instead of the fixed gateway path.
- unmatched → fall through (404 or the catch-all SPA, as today).

Why this is the right primary now, not a far-future option:
- **The workspace is already on this path.** v0.1.108 made it the host
  resolver for the whole tenant domain (`resolveByDomain` +
  `brandDomain`), and it already serves `/legal/*`, `/brand/*`,
  `/_ensemble/*`. Claiming `<brand>.com/*` and dispatching is the natural
  extension — the "workspace becomes a hot path" cost is *already partly
  paid*, not a new architectural burden.
- **Route changes are instant** — edit a mount in the UI, it's live; no
  redeploy, no CLI, no CI drift check. That is "one place, period."
- Cost, named honestly: ~1–3ms per-request hop for dispatched guests, and
  the workspace worker is now critical-path for matched public traffic.
  Acceptable given it already resolves the domain; revisit if a tenant
  has latency-critical anonymous volume.

**Track A — codegen (fallback, for what Track B can't reach).**
Service bindings are CF-Worker→Worker only — they can't dispatch to a
Pages project, an external HTTP service, or a non-CF worker. For those
*tenant-owned* surfaces, the App Manager can't be the runtime router. So
for them it falls back to **emitting** the recommended `[[routes]]` block
(the §3a routes-hint) the tenant pastes into that worker's wrangler.toml.
Same registry (the mount map); different realization. This is the honest
edge of "one place": the workspace runtime-routes everything it can
service-bind to; for everything else it *tells you* the one routes block.

**Migration story (existing tenants with hand-written routes).** A
one-time `import-routes` step reads each worker's wrangler.toml, populates
the App Manager mount map, and shows the operator a review before they
delete the wrangler entries. Same "operator-managed in UI, code follows"
philosophy as the brand-domain + gateway work this builds on.

**Why this is NOT a separate RFC / table.** The routing-RFC proposal's
`workspace_routes` table is the App Manager's `mounts` config under
another name — building both would create two parallel route systems. The
mount map is the registry; Track A/B are how it's realized. The only
genuinely-prose residue is the "gateway is auth-only" fact (§3a).

### 4. App Manager API + UI
Server (`apps/core/apps/routes.ts` — currently an empty stub):
- `GET  /_ensemble/core/apps` → `listApps()` (built-in + guest).
- `PATCH /_ensemble/core/apps/:id` → set `status`, edit `mounts`, edit
  app settings. Rejects disabling a `governable:false` app. Rejects a
  mount whose host isn't a registered `workspace_domain`.
- `GET  /_ensemble/core/apps/routes-hint` → the recommended `[[routes]]`
  wrangler blocks the tenant should set, derived from the app mount map +
  the surface taxonomy (§3a). Read-only, copyable. This is the artifact
  that replaces the hand-maintained routing-convention table.
- Domains management already shipped in v0.1.108 at **`/_ensemble/domains`**
  (`GET`/`POST`/`DELETE`) — the App Manager UI reuses it; no new domains
  endpoint. (Verification, if added later, extends that route group.)

Client (`shell/src/apps/core/apps/AppsPage.tsx` — today lists guest only):
- List ALL apps (core + guest) with tier badge, status, base path, and
  surface kind (operator tool / public page / consumer — §3a taxonomy).
- Per-app row: **Enabled** switch (hidden when `governable:false`); a
  **Mounts** editor (host+path; host dropdown = the workspace's
  registered brand domains, already at `/_ensemble/domains`); app-specific
  settings (e.g. legal's Publish toggle).
- A **"Routing setup"** panel surfacing `routes-hint` — the copyable
  `[[routes]]` block — so a tenant configures CF zone routes once from
  what the platform tells them, instead of re-deriving a convention.
- (Domains themselves are managed in Settings → Domains, shipped already.)

### 5. Migrate the scattered toggles in
- **Legal:** move the publish toggle out of `LegalPage.tsx`'s PublishCard
  into the App Manager's Legal entry as the `published` setting. The
  public-route gate reads `published` from `installed_apps.settings_json`
  instead of the `legal_public_enabled` workspace setting. Keep a
  thin shim or migrate the value (`legal_public_enabled` →
  `settings.published`) so existing workspaces don't lose their state.
  Distinct from `enabled` (locked decision): disabling Legal removes it
  from nav + 404s everything; unpublishing only 404s the public pages.
- **Brand:** same for `public_brand_guide_enabled` → Brand's `published`.
- Nav handler (`/_ensemble/nav`, `create-workspace.ts`): iterate the
  registry filtered by `status='active'` instead of the hand-listed core
  apps — so disabling an app drops it from the sidebar automatically.

### 6. Tests
- Registry: lists core+guest, layers status/mounts, marks governable.
- Mount gate (miniflare + real Hono): disabled app → 404; wrong host →
  404; `host:'*'` on canonical host → 200; verified custom host → 200.
- Resolver: `resolveByDomain` resolves a verified domain, ignores
  unverified.
- Migration 017/018 apply; 018 idempotent + backfills existing workspaces.
- Toggle migration: `legal_public_enabled` value carries into
  `settings.published`.

### 7. SDK docs (REQUIRED — ships with the feature, not after)

The App Manager changes the **guest-app developer contract**, so
`docs/spec/05-guest-sdk.md` must be updated in the same change set — a
guest author can't adopt mounts without docs. Update:

- **New "App mounts & routing" section.** How a guest app declares where
  it serves: it no longer assumes only the fixed gateway path
  (`/_ensemble/apps/:id/*`); an operator can mount it at a public
  `host + path` via the App Manager, and (Track B) the workspace dispatches
  there by service binding. Document what the guest can rely on:
  request path/prefix it receives, that the gateway still injects
  workspace context + auth headers, and that mounts are operator-managed
  (the guest declares a *suggested* mount in its manifest; the operator
  confirms in the UI).
- **The auth-boundary fact** (the only prose residue from §3a): the
  gateway is for authenticated operator tools; anonymous consumer
  surfaces need their own worker — link, don't re-explain.
- **Enable/disable semantics** for guests: a disabled app 404s its mount
  and drops from nav; reuse the publish vs. enabled distinction.
- **Cross-link** the already-shipped `publicDomain` section (v0.1.108) —
  mounts + brand domain compose (a guest mounted at `<brand>.com/foo`
  should build shareable URLs via `publicDomain`).
- Add a **manifest field** if the design introduces one (e.g.
  `mount: { path, host? }` as a *suggestion* the operator accepts) — and
  document it in the manifest reference within the same file.

This step is a checklist gate on the feature being "done," same as the
brand-domain release added the `publicDomain` SDK section.

---

## Surfaces touched (review checklist)

| File | Change |
|------|--------|
| `db/migrations/*_seed_installed_apps.ts` | backfill core-app rows |
| `middleware/app-mount.ts` | NEW — the per-request mount/enable gate |
| `create-workspace.ts` | register gate (after resolver, before core apps); nav handler reads registry |
| `services/app-registry.ts` | NEW — unify core+guest+installed_apps |
| `apps/core/apps/routes.ts` | NEW — App Manager API (was empty stub) |
| `apps/core/legal/public-routes.ts` | publish gate reads `settings.published` |
| `apps/core/brand/routes.ts` | guide gate reads `settings.published` |
| `routes/bootstrap.ts` | seed installed_apps for new workspaces |
| `shell/src/apps/core/apps/AppsPage.tsx` | list all apps + mounts + routing-setup + domains UI |
| `shell/src/apps/core/legal/LegalPage.tsx` | remove PublishCard (moves to App Manager) |
| `docs/spec/05-guest-sdk.md` | **REQUIRED** — new "App mounts & routing" section + manifest field; ships WITH the feature (§7) |
| — | `workspace_domains` table, `resolveByDomain`, CF route, `absoluteUrl`: see `docs/plan/brand-domain.md` (Layer A, ships first) |

---

## Risks / open questions for the morning

1. **CF route + DNS** (Layer A step 2) is the one piece outside the
   codebase — needs zone/cert coordination. Everything else is code.
2. **Domain verification** mechanism — DNS TXT vs ACME. Plan assumes a
   `verify_token` + a manual/automated check; needs a decision.
3. **Mount-gate performance** — must be cached; confirm KV vs in-memory.
4. **Path-prefix collisions** — if two apps could claim overlapping base
   paths, the registry needs a precedence rule (longest-prefix wins).
   Today paths are distinct, but the gate should be explicit about it.
5. **`published` migration** — one-time copy of `legal_public_enabled` /
   `public_brand_guide_enabled` into `settings.published`, then retire
   the old keys (or keep as read-through shim for a release).
6. **Gateway dispatch (Track B) blast radius** — claiming `<brand>.com/*`
   makes the workspace worker critical-path for matched public traffic.
   Acceptable (it already resolves the domain), but: error-isolation (a
   guest worker down shouldn't 500 the whole zone), and a clear "which
   worker served this" debug header.
7. **Service-binding limit** — Track B dispatch only reaches CF
   Worker→Worker targets. Pages projects / external HTTP / non-CF workers
   fall to Track A (emitted routes-hint). The UI must make clear which
   apps are runtime-routable vs. routes-hint-only.
8. **Env-specific routes (prod vs preview)** — does a mount apply to all
   envs, or per-env? (Track A codegen would need per-env blocks.)
9. **Pre-existing external CF routes** — a tenant's Pages project already
   on the zone must not be shadowed by the workspace's `<brand>.com/*`;
   dispatch must fall through cleanly for paths no app claims.

## Suggested sequencing (when greenlit)

> Layer A (`workspace_domains`, `resolveByDomain`, `absoluteUrl`, Domains
> API + UI) **shipped in v0.1.108** — steps below are what remains.

1. Registry service + read-only App Manager list (built-in + guest, with
   status + surface kind) — no behavior change; immediately shows all apps.
2. `installed_apps` seeding + enable/disable gate + nav reads registry.
3. Migrate legal/brand toggles (`published`) into the App Manager.
4. Per-app **mount config** (host+path) + the mount gate (§3) reading it.
5. **Track A** routes-hint (`/routes-hint` endpoint + "Routing setup" UI)
   — safe, no runtime change; gives "the platform tells you the routes."
6. **Track B** gateway dispatch (claim `<brand>.com/*`, service-binding
   forward by mount map) — the "one place, period" payoff; do last, with
   the error-isolation + debug-header guards from the risks above.

**SDK docs (§7) update with the step that introduces the contract change**
they describe — mounts/manifest docs land with step 4 (mount config), not
deferred to the end. A guest author shouldn't see the feature before its
docs.
