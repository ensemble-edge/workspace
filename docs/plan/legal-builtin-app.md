# Legal Center — Built-in (Core) App Implementation Plan

> **Status**: active implementation (started 2026-06-07).
> **Supersedes the framing of**: `docs/plan/legal-guest-app.md`. That
> doc describes the feature as an Ensemble **guest app** ported from a
> Cloudflare/Astro prototype in `maycotte/curalisto-app`. In *this*
> repo the right home is a **core (built-in) app** that sits alongside
> Brand — same tier, same wiring, in-process in the workspace Worker.
> This plan is the authoritative re-cut for that architecture.

## Guest app → built-in app: the translation

The original spec says "guest app" ~20 times. In Ensemble those words
mean a sandboxed iframe / separate Worker. We are building a **core
app** instead — the Brand shape. The mapping:

| Spec (guest framing)                                  | This repo (core-app reality)                                                        |
|-------------------------------------------------------|-------------------------------------------------------------------------------------|
| New guest app `legal-cms` at `/legal-cms`             | `core:legal` manifest, `nav.path: '/legal'`, registered in `apps/core/index.ts`     |
| Guest's own Hono worker                               | `registerLegalRoutes(app)` mounted into the main Hono app                           |
| Guest's own D1                                        | Shared workspace D1 (`c.env.DB`)                                                     |
| `quiz_cms_settings.legal.*`                           | `workspace-settings` service keys `legal.*` (added to `SettingKey` union)           |
| Astro `/legal/:slug` + `LegalLayout.astro`            | Hono `c.html(...)` page, same pattern as the public `/brand` guide page             |
| `?lang=` / native-locale slug resolution              | `legal_doc_slugs` junction + `locales` service (`getDefaultLocale`, `listLocales`)  |
| `/api/legal/*` on the guest                           | Public routes on the workspace Worker, gated by the same `publicCors()` posture     |
| Consent linkage / CareValidate payload (§5, §5.4)     | **Out of scope** — belongs to the consuming quiz app, not Ensemble                  |

## What this repo already gives us (don't reinvent)

- **Core-app contract** — `CoreAppDefinition { manifest, registerRoutes }`
  in `apps/types.ts`. Brand is the reference implementation.
- **Migrations** — TypeScript `{ name, sql }` objects in
  `db/migrations/`, registered in order in `db/migrations/index.ts`.
  Next number is **015**.
- **Settings** — `getSetting` / `setSetting` in
  `services/workspace-settings.ts`, with a typed `SettingKey` union and
  `DEFAULT_SETTINGS` map.
- **Locales** — `getDefaultLocale(env, wsId)` and `listLocales(...)` in
  `services/locales.ts`. Gives us the default locale and the enabled
  set for `LocalizedString` fallback.
- **Public-read auth pattern** — brand uses
  `app.use('/_ensemble/core/brand/*', auth({ required: false }))` then
  decides per-request with a `canReadBrand(c)` helper. Legal mirrors
  this.
- **Public HTML** — the `/brand` guide page (`create-workspace.ts`)
  proves a core route can serve crawlable HTML via `c.html(...)`. No
  Astro needed.
- **Caching** — the conventional public header is
  `public, max-age=300, stale-while-revalidate=86400` (brand assets).
  Reuse verbatim for the public legal surfaces.

## Build order (each layer verifiable before the next)

1. **Migration 015** — `legal_docs`, `legal_doc_slugs`,
   `legal_docs_versions`; seed 5 `legal.*` settings; seed 6 docs
   (es+en). Authored fresh (prototype SQL is not accessible in this
   repo). **Legal copy is unreviewed placeholder content** — flagged
   in the migration, per the spec's own counsel caveat.
2. **Placeholder resolver** — `services/legal-placeholders.ts`. Tokens,
   empty-erasure, `[COMPANY NAME CONTACT]` before `[COMPANY NAME]`,
   locale-formatted `[DATE]`. Pure, unit-tested.
3. **CMS routes** — `/_ensemble/core/legal/*`: list, detail, PUT upsert
   (snapshot → upsert → rebuild junction in a `db.batch`), versions,
   PATCH status, soft-delete. + settings GET/PUT.
4. **Public JSON API** — `/api/legal/:slug`, `/api/legal/active`,
   `/api/legal/active-versions`. Edge-cached.
5. **Public HTML** — `/legal` (bare → redirect) and `/legal/:slug`
   (Centro Legal ToC sidebar + rendered markdown + language switcher).
6. **Wiring** — `publicCors()` for `/legal/*` + `/api/legal/*`;
   `auth({ required: false })` for `/_ensemble/core/legal/*`; register
   `legalApp` in `apps/core/index.ts`.
7. **Client** — `packages/shell/src/apps/core/legal/LegalPage.tsx`
   (doc list, lazy editor, Legal Copy settings card, snippet card) +
   `registerPage`. Imported for side-effect from `Viewport.tsx`.

## Out of scope (consuming app's side of the contract)

§5 (consent linkage) and §5.4 (CareValidate `consentDocuments` payload)
live in the quiz app. The Legal app only exposes
`/api/legal/active-versions` so a consumer can capture the agreed
version. We build that endpoint; we do not build the consent question
or the CV payload.

## Markdown rendering

The spec uses `marked`. Check whether it's already a dependency; if not,
either add it or use a tiny in-repo markdown→HTML pass. Content is
authored by operators (trusted), so the spec says no sanitization — but
we will still escape inside code spans defensively.
