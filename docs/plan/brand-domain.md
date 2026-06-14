# Tenant Brand Domains — Implementation Plan

> **Status:** plan, ready to build on green light.
> **Goal:** workspace-rendered public surfaces (legal pages, brand guide,
> future public pages) appear under each tenant's own domain
> (`curalisto.com/legal/privacy`) instead of `workspace.curalisto.com/...`,
> with correct canonical + hreflang for SEO.
> **Relationship to App Manager:** this is **Layer A** of
> `docs/plan/app-manager-implementation.md` (tenant resolution by domain).
> It ships standalone and first; the App Manager's per-app *mount config*
> (which apps serve on which domain/path) layers on top later without
> rework. This plan delivers "all public surfaces inherit the brand
> domain automatically"; the App Manager later adds per-app override.

## Verified starting state (checked against code)

- **Resolver seam exists.** `middleware/workspace-resolver.ts` already has
  Strategy 3: `resolveByDomain(db, host)` — currently a `return null`
  stub with the comment "workspace_domains table (future feature)." We
  implement exactly that.
- **No canonical link today.** `apps/core/legal/render.ts` emits
  `hreflang` as **path-relative** (`href="/legal/${slug}"`) and emits
  **no `<link rel="canonical">` at all.** So this is *add canonical* +
  *qualify hreflang*, not "qualify existing canonical."
- **Path-relative links already work** under whatever host serves the
  page (ToC, language switcher, `/brand/css`). Those stay untouched.
- **No `brand_domain` setting or `workspace_domains` table exists yet.**
- **Workspace has no stored canonical-host field** — host is derived
  from slug/config. So fully-qualified URLs use `brand_domain ?? request
  Host` directly; we never need to compute a canonical host for the
  common path.

## Design decision: a table, not a settings key

Store brand domains in a dedicated **`workspace_domains`** table, NOT as a
`workspace_settings` value. Rationale (this is the elegance lever):

- The lookup the resolver needs is **reverse**: `host → workspace_id`. A
  settings key forces `WHERE key='brand_domain' AND value=?` — query by
  unindexed value, semantically backwards for a `(workspace_id,key)→value`
  store. A table with `PRIMARY KEY (domain)` makes it a **PK hit**.
- **One-domain-one-tenant becomes a structural invariant** (PK), not a
  hope. A settings key lets two tenants both store `curalisto.com` and
  makes resolution ambiguous; the table rejects it at write time.
- It matches the resolver's existing `resolveByDomain` seam and the
  App Manager plan's Layer A. No divergence.
- The PK lookup + a short per-isolate cache makes the prompt's
  "performance / caching" concern essentially moot.

```sql
CREATE TABLE IF NOT EXISTS workspace_domains (
  domain        TEXT PRIMARY KEY,        -- 'curalisto.com' (host only: no proto/path/slash)
  workspace_id  TEXT NOT NULL,
  proto         TEXT NOT NULL DEFAULT 'https',  -- override only for local dev
  verified      INTEGER NOT NULL DEFAULT 1,     -- see "verification" below
  created_at    TEXT DEFAULT (datetime('now')),
  created_by    TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_workspace_domains_ws ON workspace_domains(workspace_id);
```

A workspace may have **multiple** domains (apex + www, or staging); each
row points at one workspace. The first one (or a `primary` flag, if we
want one later) is the canonical for SEO.

**Verification, deferred but seamed:** the `verified` column exists, but
ships **defaulting to 1 (trusted)** for operator-set domains — a
workspace operator setting a tenant's domain is already a trusted action.
Real DNS-TXT/ACME self-serve verification flips the default to 0 + adds a
verify flow later, when this opens beyond operator-set. No schema change
needed then.

## The render-time core: `absoluteUrl`

The one idea that keeps this small. A helper that fully-qualifies a path
against the tenant's brand domain when set, else the request host:

```ts
// services/brand-domain.ts
function originForRequest(c): string {
  const brand = c.get('brandDomain');           // set by resolver, see below
  if (brand) return `${brand.proto}://${brand.domain}`;
  const url = new URL(c.req.url);
  return `${url.protocol}//${url.host}`;          // fall back to request host
}
export function absoluteUrl(c, path: string): string {
  return `${originForRequest(c)}${path}`;
}
```

**The asymmetry that makes it elegant:** only **SEO metadata** needs to be
absolute (canonical, hreflang, and later `og:url`). Everything else —
ToC links, language switcher, `/brand/css`, asset paths — stays
**path-relative** and resolves correctly under whichever host served the
page. So the change surface is tiny: a handful of `<link>` tags, not
every URL in the document.

## Indexing control (noindex toggle)

Most workspace public pages should NOT be indexed by search engines —
operators want them reachable (linked from a footer, shared) without
showing up in Google. Today the posture is hardcoded and inconsistent:
the brand guide is noindex (both `<meta name="robots">` in
`services/brand-guide.ts:152` AND an `X-Robots-Tag` header), while legal
pages are deliberately crawlable. Replace the hardcoding with one
operator toggle.

**Granularity: per-app, default noindex.** One setting per public app
(start with legal): `legal_allow_indexing` (workspace_settings, default
`'false'`). When false → emit noindex; when true → crawlable. Default
noindex means nothing gets indexed by accident; the operator opts the
app in when they're ready (e.g. once Privacy/Terms are counsel-reviewed
and final). Same shape as `legal_public_enabled`; in the App Manager
model it becomes app-level config (`settings.allowIndexing`).

**Enforcement: belt-and-suspenders, matching the brand guide.** When
noindex:
- `<meta name="robots" content="noindex, nofollow">` in the page `<head>`.
- `X-Robots-Tag: noindex, nofollow` HTTP header (catches the JSON API +
  any non-HTML response a crawler might reach; harder to miss than meta).

**Interaction with canonical/hreflang (important — don't send mixed
signals):** a noindex page should NOT also advertise canonical/hreflang
that invite indexing of an alternate URL. Rule:
- noindex (allowIndexing = false) → emit the robots noindex; **omit
  canonical + hreflang** (or they contradict the noindex).
- indexable (allowIndexing = true) → omit robots; **emit** the absolute
  canonical + hreflang (the brand-domain work above).

So `allowIndexing` is the switch that turns BOTH the noindex tags AND the
SEO metadata on/off, inversely. One toggle, internally consistent.

**Interaction with the 301 redirect (item 5):** unaffected — the redirect
is about *which host* serves public traffic; noindex is about *whether
the page is indexed at all*. They compose: a noindexed page that 301s to
the brand domain simply isn't indexed under either host.

## Build steps

### 1. Migration `017_workspace_domains.ts`
The table above. (Plus, if the App Manager ships after, it reuses this
exact table — no second migration.)

### 2. Resolver: implement `resolveByDomain` + expose brand origin
- `resolveByDomain(db, host)`: `SELECT workspace_id, proto FROM
  workspace_domains WHERE domain = ? AND verified = 1`. Strategy 3 already
  calls it; now it returns a workspace instead of null.
- When a workspace is resolved **via** a brand domain, set
  `c.set('brandDomain', { domain, proto })` so `absoluteUrl` and the
  redirect logic can read it. When resolved via the workspace host, also
  look up that workspace's **primary** brand domain (if any) and set it —
  because canonical must point at the brand domain even when an admin
  views the page on `workspace.curalisto.com` (acceptance item 7).
- Cache `host → {workspace_id, proto}` per isolate, ~5 min TTL. Rarely
  changes; keeps the lookup off D1 on the hot path.

### 3. CF routing
Wildcard-style route so the worker receives brand-domain traffic without
per-tenant CF dashboard work: declare the worker on a pattern that
catches brand hosts (workspace-side call — pick what fits the existing
route setup). Adding a tenant is then **one `workspace_domains` row +
their DNS/CF custom-hostname binding** — no workspace redeploy.
*(This is the one external/infra step; document a tenant setup guide.)*

### 4. core:legal renderer (`render.ts` + `public-routes.ts`)
Driven by `allowIndexing` (read once in the handler, passed into the pure
renderer like `faviconHtml`):
- **If indexable:** add `<link rel="canonical" href="${absoluteUrl(c,
  '/legal/'+slug)}">` (net-new — doesn't exist today) and **qualify
  hreflang** to absolute URLs.
- **If noindex (default):** emit `<meta name="robots" content="noindex,
  nofollow">` and OMIT canonical + hreflang (no mixed signals). Set the
  `X-Robots-Tag: noindex, nofollow` response header in the handler too.
- Leave ToC, language switcher, `/brand/css`, favicon **path-relative**
  regardless — they're correct as-is.
- `renderLegalPage` stays pure: add `allowIndexing: boolean` +
  `canonicalUrl`/`hreflang` (already-absolute) to `LegalPageData`; the
  handler computes them via `absoluteUrl(c, …)` and the setting.
- Remove the hardcoded "deliberately crawlable / no noindex" comments —
  posture is now operator-controlled.

### 5. Optional 301: workspace host → brand domain (SEO)
In the `/legal/*` (and `/brand` guide) handlers: if the request Host is
the workspace host AND the tenant has a brand domain AND there's **no
session cookie** (public traffic), `301` to the brand-domain equivalent.
Authenticated workspace admins viewing from inside the app are NOT
redirected (they keep working on `workspace.curalisto.com`), but the page
they see still emits brand-domain canonicals. Three cheap conditions, no
new machinery.

### 6. Settings UI
- A "Brand domain" field in the workspace Settings area (near
  `legal_public_enabled`): list/add/remove `workspace_domains` rows.
  Validate host format on write (no proto, no path, no trailing slash;
  reject a domain already owned by another workspace — the PK does this,
  surface it as a friendly 409).
- An **"Allow search indexing"** switch for the Legal app (default off),
  alongside the publish toggle. Off = noindex; on = crawlable + canonical.

### 7. Tests
- Resolver: `resolveByDomain` resolves a row; unverified/unknown → null;
  duplicate-domain insert rejected by PK.
- `absoluteUrl`: brand set → brand origin; unset → request host.
- Renderer (indexable): canonical present + absolute; hreflang absolute;
  no robots meta; ToC/css still relative.
- Renderer (noindex, default): robots meta + `X-Robots-Tag` header
  present; canonical + hreflang ABSENT.
- Toggle: `legal_allow_indexing` flips the renderer between the two
  states.
- Redirect: public + workspace-host + brand-set → 301; with session
  cookie → no redirect; brand-host → no redirect.
- Existing tenant (no domain row) → zero behavior change (canonical
  falls back to request host).

## Acceptance (Curalisto)
1. Operator adds `workspace_domains` row: `curalisto.com → ws_…`.
2. Curalisto points DNS / CF custom hostname at the workspace worker.
3. `https://curalisto.com/legal/privacidad` renders identically, URL bar
   shows `curalisto.com`, `canonical` + `hreflang` are
   `https://curalisto.com/legal/...`, `/brand/css` loads from
   `curalisto.com/brand/css`.
4. `https://workspace.curalisto.com/legal/privacidad` (no session) → 301
   to the brand domain.
5. Same URL, signed in → renders on workspace host, canonical still
   points at `curalisto.com`.

Curalisto's side: ~one `workspace_domains` row + one DNS/CF binding.

## Open questions
1. **CF route pattern** — wildcard vs per-tenant. Workspace-side call;
   wildcard + DB lookup means adding a tenant needs no CF dashboard work.
2. **TLS** — handled by CF custom hostnames; workspace doesn't manage
   certs. Confirm the custom-hostname binding flow for tenants.
3. **Primary domain** — if a workspace has multiple domains, which is
   canonical? Add a `primary` flag, or "first verified wins"? (Defer; one
   domain per tenant initially.)

## Reconciliation with App Manager
This plan = the App Manager's **Layer A** (does the request reach the
worker + which tenant). The App Manager later adds **Layer B** (per-app
mount config: which apps serve on which (host, path), + enable/disable),
reading the *same* `workspace_domains` table. Nothing here is throwaway;
the App Manager builds on it. The `app-manager-implementation.md` doc is
updated to reference this plan as its Layer A dependency.
