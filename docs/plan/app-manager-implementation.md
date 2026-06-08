# App Manager — Implementation Plan (Phase 1 + Domain Mapping)

> **Status:** plan, awaiting green light. No code yet.
> **Scope (approved):** full — app registry + enable/disable (Phase 1)
> AND mount/hostname mapping (Phase 2), in one effort.
> **Design rationale:** see `docs/backlog/app-manager.md`. This doc is the
> build-ready step list grounded in actual files/seams.
> **Decision locked:** app-level `enabled` and `published` are DISTINCT
> axes. `enabled` = installed + in nav (App Manager owns it). `published`
> = public surface live (app-specific, e.g. `legal_public_enabled`). An
> app can be enabled-but-unpublished.

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

### `workspace_domains` (NEW — Layer A)

```sql
CREATE TABLE workspace_domains (
  workspace_id TEXT NOT NULL,
  domain       TEXT NOT NULL,          -- 'curalisto.com'
  verified     INTEGER NOT NULL DEFAULT 0,
  verify_token TEXT,                   -- for DNS TXT / ACME verification
  created_at   TEXT DEFAULT (datetime('now')),
  created_by   TEXT,
  PRIMARY KEY (domain),                -- a domain maps to exactly one workspace
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
CREATE INDEX idx_workspace_domains_ws ON workspace_domains(workspace_id);
```

A mount may only reference a `verified` domain — prevents a tenant
claiming someone else's hostname.

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
- `017_workspace_domains.ts` — the table above.
- `018_seed_installed_apps` — backfill an `installed_apps` row for each
  core app in every existing workspace (`INSERT … SELECT id FROM
  workspaces`, `ON CONFLICT DO NOTHING`, status `active`, default mounts).
  Mirrors the migration-003 per-workspace backfill pattern.
- Bootstrap (`routes/bootstrap.ts`) seeds the same rows for new workspaces.

### 2. Layer A — resolver
- Implement `resolveByDomain()` (`middleware/workspace-resolver.ts:172`,
  currently `return null`): `SELECT workspace_id FROM workspace_domains
  WHERE domain=? AND verified=1`. (Strategy 3 already calls it.)
- CF route: add `curalisto.com/*` (or scoped `…/legal/*`, `…/brand/*`) to
  the workspace worker's `wrangler.toml`. **Infra step — needs DNS/zone
  coordination; document, don't assume.**

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

### 4. App Manager API + UI
Server (`apps/core/apps/routes.ts` — currently an empty stub):
- `GET  /_ensemble/core/apps` → `listApps()` (built-in + guest).
- `PATCH /_ensemble/core/apps/:id` → set `status`, edit `mounts`, edit
  app settings. Rejects disabling a `governable:false` app. Rejects a
  mount whose host isn't a verified `workspace_domain`.
- `GET  /_ensemble/core/domains` / `POST` (add) / `POST /:domain/verify`
  → manage `workspace_domains`.

Client (`shell/src/apps/core/apps/AppsPage.tsx` — today lists guest only):
- List ALL apps (core + guest) with tier badge, status, base path.
- Per-app row: **Enabled** switch (hidden when `governable:false`); a
  **Mounts** editor (list of host+path, "Add domain" → dropdown of
  verified domains); app-specific settings (e.g. legal's Publish toggle).
- A **Domains** section to add + verify tenant domains.

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

---

## Surfaces touched (review checklist)

| File | Change |
|------|--------|
| `db/migrations/017_workspace_domains.ts` | new table |
| `db/migrations/018_seed_installed_apps.ts` | backfill core-app rows |
| `middleware/workspace-resolver.ts` | implement `resolveByDomain` |
| `middleware/app-mount.ts` | NEW — the per-request mount/enable gate |
| `create-workspace.ts` | register gate (after resolver, before core apps); nav handler reads registry |
| `services/app-registry.ts` | NEW — unify core+guest+installed_apps |
| `apps/core/apps/routes.ts` | NEW — App Manager API (was empty stub) |
| `apps/core/legal/public-routes.ts` | publish gate reads `settings.published` |
| `apps/core/brand/routes.ts` | guide gate reads `settings.published` |
| `routes/bootstrap.ts` | seed installed_apps for new workspaces |
| `shell/src/apps/core/apps/AppsPage.tsx` | list all apps + mounts + domains UI |
| `shell/src/apps/core/legal/LegalPage.tsx` | remove PublishCard (moves to App Manager) |
| `wrangler.toml` (tenant) | CF route for brand domain — infra |

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

## Suggested sequencing (when greenlit)

1. Registry service + read-only App Manager list (no behavior change) —
   safe, immediately shows all apps.
2. `installed_apps` seeding + enable/disable gate + nav reads registry.
3. Migrate legal/brand toggles into the App Manager.
4. `workspace_domains` + `resolveByDomain` + mount config + mount gate.
5. CF route + domain verification (infra, last).
