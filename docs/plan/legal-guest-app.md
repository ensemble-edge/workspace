# Legal Center — Workspace Guest App Spec

> **Status**: spec, not yet implemented in workspace.
> **Author**: extracted from the prototype that briefly lived inside
> `curalisto-app/workers/guests/quiz-cms` (commits `4c2d01d` →
> `2eb25b7`). The prototype proves the model works end-to-end against
> real D1 + Astro + the existing Ensemble guest-app framework. This
> spec is the production-ready re-cut.
> **Last updated**: 2026-06-07
> **Target consumer**: a workspace engineer adding a Legal guest app.

## Why this isn't in the quiz CMS

The first cut put the Legal tab inside `quiz-cms-guest` because that
was the closest existing surface. But the docs (Privacy, Terms,
HIPAA notice, consumer rights, etc) are workspace-wide:

- Every guest app (today: quiz; tomorrow: scheduler, portal, billing)
  has reasons to link to them.
- The landing page renders them too.
- The settings (`legal.company_name`, `legal.support_email`, etc) are
  whole-workspace facts, not quiz facts.
- The placeholder resolver, the markdown renderer, the public render
  routes, the `/api/legal/active` enumeration endpoint — all of these
  belong at the workspace tier so any consumer can read.

Coupling them to the quiz CMS forced every other surface to reach
sideways into the quiz worker. That doesn't scale.

The right home is a `legal-guest-app` that:

1. Owns the D1 schema for legal docs.
2. Owns the CMS UI (a guest app that workspace surfaces under
   `workspace.curalisto.com/legal`).
3. Exposes a workspace-tier read API (`/_workspace/legal/*`) that
   every other guest app + the landing page can consume.
4. Optionally renders crawlable public HTML at `workspace.curalisto.com/legal/*`
   OR delegates that to a tenant-domain proxy (see "Public rendering"
   below).

## What "done" looks like

When the legal guest app ships, the curalisto-app team can:

1. Delete `db/migrations/0020_legal_docs.sql`,
   `0021_legal_docs_description_and_translations.sql`,
   `0022_legal_placeholders_settings.sql`,
   `0023_legal_notices_email_setting.sql`.
2. Delete the Legal tab + LegalView/LegalDocCard/LegalCopyCard
   components from `workers/guests/quiz-cms/src/component.tsx`.
3. Delete the legal-CRUD Hono routes from
   `workers/guests/quiz-cms/src/index.ts`.
4. Delete the `/legal/*` Astro routes + `LegalLayout.astro` +
   `legalPlaceholders.ts` from `workers/quiz`.
5. Drop the `curalisto.com/legal` and `curalisto.com/legal/*` wrangler
   routes from `workers/quiz/wrangler.toml`.
6. Replace the **`linkedLegalDocs`** flow on the quiz `consent`
   question with a workspace fetch (see "Consent linkage" below).

Everything that depended on the in-quiz prototype gets a clean
workspace-tier replacement.

---

# 1. Data model (D1)

The workspace D1 database (whatever it's called — assume
`workspace-db` — adjust to your naming) gets three tables.

These are direct ports of the prototype's tables (`0020` + `0021`).
They've already been exercised against real D1, including the
`json_patch` merge pattern used to layer in Spanish translations.

## 1.1 `legal_docs`

```sql
CREATE TABLE IF NOT EXISTS legal_docs (
  id                TEXT PRIMARY KEY,                  -- stable canonical id: 'privacy', 'terms', ...
  slugs_json        TEXT NOT NULL,                     -- LocalizedString of URL slugs, e.g. {"es":"privacidad","en":"privacy"}
  title_json        TEXT NOT NULL,                     -- LocalizedString of display titles
  description_json  TEXT,                              -- LocalizedString of one-line summaries (nullable)
  body_md_json      TEXT NOT NULL,                     -- LocalizedString of markdown bodies
  last_updated      TEXT NOT NULL,                     -- ISO date YYYY-MM-DD, NOT localized
  status            TEXT NOT NULL DEFAULT 'active',    -- 'active' | 'archived'
  sort_order        INTEGER NOT NULL DEFAULT 100,      -- ToC sort key
  created_by        TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by        TEXT,
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_legal_docs_status_sort
  ON legal_docs(status, sort_order);
```

`LocalizedString` is the standard shape used across the workspace:
`{ es: "...", en: "...", null }` — any key whose value is `null` or
missing means "no content for that locale, fall back".

## 1.2 `legal_doc_slugs` (junction)

```sql
CREATE TABLE IF NOT EXISTS legal_doc_slugs (
  slug    TEXT NOT NULL,
  locale  TEXT NOT NULL,
  doc_id  TEXT NOT NULL,
  PRIMARY KEY (slug, locale),
  FOREIGN KEY (doc_id) REFERENCES legal_docs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_legal_doc_slugs_doc ON legal_doc_slugs(doc_id);
```

**Why a junction**: the operator wants real localized URLs
(`/legal/privacidad` vs `/legal/privacy`), so `:slug` alone resolves
to a doc + locale. SQLite's JSON path indexes are awkward — a single
`SELECT doc_id, locale FROM legal_doc_slugs WHERE slug = ?` is the
cheapest path. The junction is **rebuilt on every save** (DELETE
WHERE doc_id=? then INSERT one row per non-empty locale slug).

## 1.3 `legal_docs_versions` (audit)

```sql
CREATE TABLE IF NOT EXISTS legal_docs_versions (
  version_id        INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id            TEXT NOT NULL,
  slugs_json        TEXT NOT NULL,
  title_json        TEXT NOT NULL,
  description_json  TEXT,
  body_md_json      TEXT NOT NULL,
  last_updated      TEXT NOT NULL,
  status            TEXT NOT NULL,
  saved_by          TEXT,
  saved_at          TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (doc_id) REFERENCES legal_docs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_legal_docs_versions_doc ON legal_docs_versions(doc_id);
```

Every save snapshots the **prior** row into this table before
mutating. The most recent `version_id` per `doc_id` is what we
capture on the patient's consent answer (see §5 Consent linkage).

> **FK gotcha from prototype**: when adding a new column to
> `legal_docs`, mirror it onto `legal_docs_versions` in the SAME
> migration so version rows can carry the new field. The prototype
> already does this with `description_json`.

## 1.4 Settings (placeholder values)

These live in the workspace's settings store — whatever you use
(`workspace_settings` key/value table is typical). Five keys:

| Key                       | Default                  | Purpose                                                 |
|---------------------------|--------------------------|---------------------------------------------------------|
| `legal.company_name`      | `'Curalisto'`            | Legal entity name. Substituted via `[COMPANY NAME]`.     |
| `legal.business_address`  | `''`                     | Mailing address. Substituted via `[LEGAL BUSINESS ADDRESS]`. |
| `legal.support_email`     | `'hello@curalisto.com'`  | Public support inbox. Substituted via `[EMAIL]`.         |
| `legal.support_phone`     | `''`                     | Public support phone. Substituted via `[PHONE]`.         |
| `legal.notices_email`     | `'legal@curalisto.com'`  | Legal-notice inbox (subpoenas, DMCA, privacy requests). Substituted via `[LEGAL NOTICES EMAIL]`. |

Seed all five via `INSERT OR IGNORE` so re-running the migration is
safe.

## 1.5 Seed data (the six docs)

The prototype ships with six docs in both `es` and `en`. Keep the
canonical English `id` values stable — they're what the consent
flow's `linkedLegalDocs` array carries.

| `id`                    | `slugs_json` (`{es, en}`)                                 | English title                  | Spanish title                   |
|-------------------------|-----------------------------------------------------------|--------------------------------|---------------------------------|
| `privacy`               | `{"es":"privacidad","en":"privacy"}`                      | Privacy                        | Privacidad                      |
| `terms`                 | `{"es":"terminos","en":"terms"}`                          | Terms & Conditions             | Términos                        |
| `telehealth-consent`    | `{"es":"consentimiento-medico","en":"telehealth-consent"}`| Telehealth Medical Consent     | Consentimiento médico           |
| `cancellation-refunds`  | `{"es":"cancelacion-reembolsos","en":"cancellation-refunds"}` | Cancellation & Refunds   | Cancelación y reembolsos        |
| `privacy-practices`     | `{"es":"practicas-de-privacidad","en":"privacy-practices"}`| Notice of Privacy Practices   | Prácticas de privacidad         |
| `consumer-rights`       | `{"es":"derechos-del-consumidor","en":"consumer-rights"}` | Consumer Rights                | Derechos del consumidor         |

**The full seeded bodies in English (Privacy / Terms / Telehealth
Consent / Privacy Practices) and Spanish + English (Cancellation &
Refunds / Consumer Rights) live in the prototype migrations**:

- `db/migrations/0020_legal_docs.sql` — English bodies for 4 docs +
  empty slots for the remaining 2.
- `db/migrations/0021_legal_docs_description_and_translations.sql` —
  uses `json_patch` to merge Spanish into existing rows, then fills
  the two empty docs with both languages.

Copy the SQL verbatim. The bodies still carry placeholders
(`[COMPANY NAME]`, `[DATE]`, `[EMAIL]`, `[PHONE]`,
`[LEGAL BUSINESS ADDRESS]`, `[LEGAL NOTICES EMAIL]`,
`[COMPANY NAME CONTACT]`) which the resolver substitutes at render
time. Don't pre-substitute in the seed — that defeats the whole
point.

The descriptions and Spanish translations were drafted by Claude and
**have not been reviewed by counsel**. Treat them as starting
content, not legal text.

---

# 2. CMS surface (the guest app proper)

A new Ensemble guest app, e.g. `legal-cms`, registered under the
workspace at `workspace.curalisto.com/legal-cms` (or wherever
guests mount).

## 2.1 Tab structure

Single-tab guest app. The home view is the doc list. There's no
need for tabs because everything fits cleanly on one screen:

```
┌──────────────────────────────────────────────────────────┐
│  Legal Center                                            │
│  ┌────────────────────────────────────────────────────┐  │
│  │ How to fetch legal copy  [snippet card]            │  │
│  │  One document        /api/legal/:slug              │  │
│  │  List all active     /api/legal/active             │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Legal copy [settings card: 5 fields]               │  │
│  │  Company name | Support email | Notices email      │  │
│  │  Support phone | Business address                  │  │
│  └────────────────────────────────────────────────────┘  │
│  Live legal documents. Edits autosave...  [□] Show archived
│  ┌────────────────────────────────────────────────────┐  │
│  │ Privacidad  [archived?]  privacy                   │  │
│  │ Última actualización 2026-06-07 · sort 10          │  │
│  │ /legal/privacidad ES   /legal/privacy EN           │  │
│  │ [Switch: Active]  [Close/Edit]                     │  │
│  └────────────────────────────────────────────────────┘  │
│  …5 more cards…                                          │
└──────────────────────────────────────────────────────────┘
```

If guests have a tabs convention, you can keep `legal` as a
single-tab app or just render the home view directly.

## 2.2 Snippet card (top)

Static read-only `<pre>` blocks. Operators copy-paste these into
landing-page footers, sidebars, etc. The default-locale code in the
snippets must be **dynamic** (driven by `useLocales().defaultLocale`)
so the example is correct for whatever workspace the operator runs in.

Two snippets:

**One document**:
```js
// Fetch rendered HTML (default)
const r = await fetch('https://curalisto.com/api/legal/privacy?lang=${DEFAULT_LOCALE}')
const { title, lastUpdated, content } = await r.json()
document.querySelector('#legal').innerHTML = content

// Or raw markdown
fetch('https://curalisto.com/api/legal/privacy?lang=${DEFAULT_LOCALE}&format=markdown')
```

**List all active docs** (e.g. a footer menu):
```js
// Per language: each entry has id, slug, title, description, lastUpdated.
// 'slug' is the localized URL fragment — link straight to /legal/${slug}.
const r = await fetch('https://curalisto.com/api/legal/active?lang=${DEFAULT_LOCALE}')
const { docs } = await r.json()
// → [{ id: 'privacy', slug: 'privacidad', title: 'Privacidad', description: '…', lastUpdated: '2026-06-07', sortOrder: 10 }, …]

// Render a footer menu:
const html = docs.map(d => `<a href="/legal/${d.slug}">${d.title}</a>`).join(' · ')

// Grouped by language (one fetch per locale):
const [es, en] = await Promise.all([
  fetch('https://curalisto.com/api/legal/active?lang=es').then(r => r.json()),
  fetch('https://curalisto.com/api/legal/active?lang=en').then(r => r.json()),
])
```

## 2.3 Legal Copy card (placeholder values)

Five `SettingField` rows in a `Card`. Each row autosaves on blur.
Order:

1. **Company name** — `legal.company_name`, placeholder `Curalisto`
2. **Support email** — `legal.support_email`, placeholder `hello@curalisto.com`
3. **Legal notices email** — `legal.notices_email`, placeholder `legal@curalisto.com`
4. **Support phone** — `legal.support_phone`, placeholder `+1 555-555-5555`
5. **Legal business address** — `legal.business_address`, placeholder `123 Main St, Austin, TX 78701`

Card description must enumerate every placeholder token an operator
can use:

> Values substituted into the legal documents at render time.
> Tokens: `[COMPANY NAME]`, `[EMAIL]`, `[LEGAL NOTICES EMAIL]`,
> `[PHONE]`, `[LEGAL BUSINESS ADDRESS]`. Empty fields render as
> nothing (the bracketed placeholder disappears entirely). `[DATE]`
> is handled automatically from each doc's "Last updated" date.

## 2.4 Doc list

`apiListLegalDocs(includeArchived)` fetches summaries. Render one
`<LegalDocCard>` per doc. The card has:

**Collapsed (header always visible)**:
- Title in default locale + `id` in dimmer text.
- Optional **"archived"** badge if `status !== 'active'`.
- Subtitle: `Última actualización ${lastUpdated} · sort ${sortOrder}`.
- **Per-locale URL chips** — small font-mono links for every locale
  with a non-empty slug:
  - Each chip displays `/legal/${slug}` + uppercase locale tag.
  - `target="_blank"` to `https://curalisto.com/legal/${slug}` (or
    your workspace's public domain).
  - `onClick={e => e.stopPropagation()}` so the chip doesn't toggle
    the card.
- Right side:
  - **Active** `<Switch>` (toggles `status` between `'active'` and
    `'archived'` via `PATCH /api/legal/docs/:id/status`).
  - "Close" / "Edit" button toggles expansion.

When archived: the whole card renders at `opacity-60`.

**Expanded (body, lazy-loaded)**:

Lazy-load: only fetch the full doc (`apiGetLegalDoc(id)`) when the
card expands. List view doesn't need the body markdown (could be 10s
of KB).

Editor sections in order:

1. **URL slug** — one `LocaleTextarea` per enabled locale.
   - Placeholder for default locale: `privacidad`. Others: `privacy`.
   - Server validates `/^[a-z0-9-]{1,80}$/`. Surfaces collision
     errors (409) through the SaveStatus chip.
2. **Title** — one `LocaleTextarea` per locale.
3. **Description** — one `LocaleTextarea` per locale.
   - Hint: "One-line summary. Surfaced in CMS list views and may
     appear next to the doc title in public ToC tooltips."
4. **Last updated** — single `<Input type="date">`, not localized.
5. **Body (markdown)** — one `LocaleTextarea rows={18}` per locale.
   - Hint: "Paste markdown directly. Headings, lists, links,
     bold/italic all supported. Rendered to HTML at request time."
6. **Sort order** — single number input.

All fields commit on blur (mirrors the Families pattern). The
LocaleTextarea component the prototype uses is the same one Quizzes
+ Families use — workspace probably has an equivalent.

**Status toggle is optimistic**: flip the UI immediately, call the
endpoint, revert + toast on error.

---

# 3. Backend handlers (workspace tier)

The CMS routes live on the workspace worker (or a worker the guest
app proxies to). All paths assume a `/_workspace/legal` prefix or
similar — adjust to whatever your guest-API convention is. The
prototype uses Hono; if workspace already uses something else, port
the handlers.

| Method  | Path                                              | Purpose                                                                                                |
|---------|---------------------------------------------------|--------------------------------------------------------------------------------------------------------|
| GET     | `/api/legal/docs[?include_archived=1]`            | List doc summaries.                                                                                    |
| GET     | `/api/legal/docs/:id`                             | Doc detail (incl. body).                                                                               |
| PUT     | `/api/legal/docs/:id`                             | UPSERT (snapshot to versions → update/insert → rebuild slug junction).                                 |
| GET     | `/api/legal/docs/:id/versions`                    | Version history.                                                                                       |
| PATCH   | `/api/legal/docs/:id/status`                      | Flip `active` ↔ `archived`. Body: `{ status }`.                                                        |
| DELETE  | `/api/legal/docs/:id`                             | Soft-delete (sets status to `archived`).                                                               |

## 3.1 PUT semantics (the load-bearing one)

Body shape:
```ts
{
  slugs: LocalizedString          // required
  title: LocalizedString          // required
  description?: LocalizedString | null  // optional; null clears, undefined preserves
  bodyMd: LocalizedString         // required
  lastUpdated: string             // required, YYYY-MM-DD
  status?: 'active' | 'archived'  // optional; preserves existing if absent
  sortOrder?: number              // optional; preserves existing if absent
}
```

Flow:

1. Validate `id` shape: `/^[a-z0-9-]{1,80}$/`.
2. Validate every non-empty `slugs[locale]` against the same regex.
3. For each `(slug, locale)` pair: check `legal_doc_slugs WHERE
   slug=? AND locale=? AND doc_id != ?`. If a hit, return
   `409 slug_in_use` with which doc owns the slug.
4. Read existing row (if any).
5. If existing: INSERT a snapshot into `legal_docs_versions` with the
   existing row's values (including `description_json` —
   prototype's mistake: don't forget this column when adding new
   fields).
6. UPSERT `legal_docs`. Honor:
   - `description = undefined` → keep existing `description_json`.
   - `description = null` → clear `description_json` to NULL.
   - `description = {...}` → JSON.stringify and store.
7. Rebuild `legal_doc_slugs` for this `doc_id`:
   - DELETE WHERE doc_id = ?
   - INSERT one row per `(slug, locale)` where `slug` is non-empty.
   - Wrap in `db.batch([...])` so concurrent saves see a consistent
     state.

## 3.2 PATCH `/:id/status`

```ts
// body
{ status: 'active' | 'archived' }
```

Validates `status` is one of the two enums, then runs:
```sql
UPDATE legal_docs
SET status = ?, updated_by = ?, updated_at = datetime('now')
WHERE id = ?
```

Returns `404 not_found` if no rows updated. This exists separately
from PUT because the operator often just wants to pause a doc
without rewriting it — no need to ship the entire body for that.

---

# 4. Public read endpoints (workspace tier)

These are the cross-app contracts. Every guest app + the landing
page consumes them. They're cached at the edge (5-minute
`Cache-Control: public, max-age=300`) so a busy site doesn't hammer
D1.

All paths assume mounting at `workspace.curalisto.com/api/legal/*`
OR a tenant-domain proxy (curalisto.com/api/legal/*) — see §6.

## 4.1 `GET /api/legal/:slug?lang=&format=`

Renders one legal doc by slug.

- `:slug` is the **localized** slug (`privacidad`, `privacy`).
- `?lang=` is optional — when omitted, the slug's native locale (the
  one stored in `legal_doc_slugs.locale`) is the render language.
  When provided, overrides (useful for preview tooling).
- `?format=html` (default) returns HTML. `?format=markdown` returns
  raw markdown. The placeholder resolver runs in BOTH cases so
  markdown consumers don't have to re-implement it.

Response:
```json
{
  "slug": "privacidad",
  "id": "privacy",
  "lang": "es",
  "title": "Privacidad",
  "lastUpdated": "2026-06-07",
  "format": "html",
  "content": "<h2>Introducción</h2><p><strong>Curalisto</strong>…</p>"
}
```

Resolution:
1. `SELECT doc_id, locale FROM legal_doc_slugs WHERE slug=? LIMIT 1`. None
   → 404.
2. `SELECT … FROM legal_docs WHERE id=? AND status='active'`. None
   → 404 (archived docs are inaccessible by direct URL).
3. Locale fallback (`loc()` helper): requested lang → slug's native
   locale → first non-empty value. Never throw, never return null.
4. Substitute placeholders (see §7).
5. If `format=html`, run `marked.parse(bodyMd)`. No sanitization
   needed — content is authored by us.

## 4.2 `GET /api/legal/active?lang=`

Returns every active doc, in the requested locale. Used by:

- Landing-page footer.
- Sitemap generators.
- Guest-app sidebars.
- The consent-question picker (see §5).

```json
{
  "lang": "es",
  "docs": [
    {
      "id": "privacy",
      "slug": "privacidad",
      "title": "Privacidad",
      "description": "Cómo recopilamos, usamos y protegemos su información personal.",
      "lastUpdated": "2026-06-07",
      "sortOrder": 10
    },
    …
  ]
}
```

Notes:
- `lang` defaults to `'es'` (or the workspace default locale — read
  from your settings store).
- Falls back gracefully: a doc missing a title in `lang` still
  appears, using the next-best translation.
- Archived docs are excluded.
- Sorted by `sort_order ASC, id ASC`.

## 4.3 `GET /api/legal/active-versions?ids=privacy,terms`

Returns `MAX(version_id)` per doc. Used at consent-submission time
to capture the exact version the patient agreed to (non-repudiation).

```json
{
  "versions": [
    { "id": "privacy", "versionId": 142 },
    { "id": "terms",   "versionId": 88 }
  ]
}
```

Implementation:
```sql
SELECT doc_id, MAX(version_id) AS version_id
FROM legal_docs_versions
WHERE doc_id IN (?,?,…)
GROUP BY doc_id
```

- Whitelist incoming `ids` against `/^[a-z0-9-]{1,80}$/`, cap at 50
  ids per request.
- Docs with no version row (never saved through CMS) won't appear in
  the response. The caller should treat absence as "no version
  recorded".
- Cached 60s, not 300s, because consent-submission accuracy matters
  more than CDN load for this endpoint.

---

# 5. Consent linkage (cross-app contract)

This is the only piece that bleeds into other guest apps. The quiz
needs to record exactly which legal doc versions a patient agreed
to. The legal app **doesn't own** the consent question or the
patient submission — it just exposes the data the quiz needs.

## 5.1 Schema contract

The quiz schema's `FormQuestion` (in `@curalisto/schema`) has an
optional field:

```ts
interface FormQuestion {
  …
  /** Only meaningful on `consent` questions. The list of legal_docs.id
   *  values the patient is agreeing to when they tick this consent. */
  linkedLegalDocs?: string[]
}
```

This field already exists in the prototype — it can stay where it
is. The legal app doesn't read or write the quiz schema.

## 5.2 CMS picker (lives in the quiz CMS)

The quiz CMS's consent-question editor renders a checklist of
**active legal docs** sourced from
`GET /api/legal/active?lang=${defaultLocale}`. The operator ticks
which docs the consent question covers. The selected ids are stored
on `FormQuestion.linkedLegalDocs`.

When this spec is implemented and the prototype's
in-quiz-CMS legal tab is deleted, the quiz CMS keeps its
`LinkedLegalDocsPicker` component but swaps the data source from the
in-app `apiListLegalDocs` helper to the workspace endpoint. One-line
change.

## 5.3 Patient flow (lives in the quiz worker)

When the patient hits Continue on a consent question with
`linkedLegalDocs.length > 0`, the renderer:

1. Calls `GET /api/legal/active-versions?ids=${linkedDocs.join(',')}`.
2. Writes a compound answer:
   ```ts
   {
     agreed: true,
     legalDocs: [
       { id: 'privacy', versionId: 142 },
       { id: 'terms',   versionId: 88 }
     ]
   }
   ```
3. Advances.

If the fetch fails (network blip), still advance with `{ agreed:
true, legalDocs: [] }`. Better to capture the patient's consent than
to block them on a metadata round-trip. The `cl_cases.saved_at`
timestamp + `legal_docs_versions.saved_at` lets you reconstruct the
versions later if needed.

## 5.4 Storage

The compound answer rides through both payload builders unchanged:

- **`buildClPayload`** (de-identified D1 storage): the
  `linkedLegalDocs` metadata passes through into
  `cl_case_answers.answers_json` because consent is `phi: false`. No
  builder change.
- **`buildCvPayload`** (CareValidate submission): walks every
  consent question, dedupes by `(id, max versionId)`, and emits a
  top-level `consentDocuments: [{ id, versionId }]` field on the CV
  request. The `STATEMENT`-typed `questions[]` entry stays as
  empty-string per CV docs.

The prototype's logic in `packages/cv-client/src/buildCvPayload.ts`
is correct and **does not need to change** when the legal app moves
to workspace — it reads from the answer shape, not from the legal
DB.

---

# 6. Public rendering (curalisto.com/legal/*)

The browsable HTML pages — the "Centro Legal" sidebar with ToC and
per-locale URLs — also belong at the workspace tier so the URL
strategy is consistent everywhere.

Two patterns to choose between:

## 6a. Workspace renders directly (simpler)

The workspace worker exposes `/legal/:slug` Astro routes (or
equivalent). The tenant landing page links straight to
`workspace.curalisto.com/legal/privacidad`.

**Pro**: one less hop, simpler routing.
**Con**: URL doesn't look like it belongs to the tenant brand.

## 6b. Tenant-domain proxy (better UX)

The tenant's quiz worker (or whatever owns `curalisto.com/*`) keeps a
small `/legal/*` route that fetches the rendered HTML from workspace
and proxies it through. Patient sees `curalisto.com/legal/privacidad`,
not `workspace.curalisto.com/legal/privacidad`.

The prototype implements 6b. The wrangler routes are:

```toml
[[routes]]
pattern = "curalisto.com/legal"
zone_name = "curalisto.com"

[[routes]]
pattern = "curalisto.com/legal/*"
zone_name = "curalisto.com"
```

When this spec ships, those two routes can either:
- Stay, and the quiz worker becomes a thin proxy to
  workspace's `/api/legal/:slug` endpoint that renders the same
  HTML, OR
- Move to whatever Cloudflare worker (`curalisto-tenant-shell` or
  similar) is the right brand-domain owner.

**Decision needed**: which pattern. My recommendation is 6b for SEO
+ shareability + cookie-domain reasons.

## 6.1 Page layout (regardless of which pattern)

```
┌────────────────────────────────────────────────────────────┐
│  [Brand logo]                       [language dropdown]    │
├──────────────────┬─────────────────────────────────────────┤
│ Centro Legal     │ Privacidad                              │
│                  │ Última actualización: 7 de junio 2026   │
│ ▸ Privacidad ●   │                                         │
│   Términos       │ ## Introducción                         │
│   Consentimiento │ Curalisto (...) valora su privacidad.   │
│   Cancelación    │                                         │
│   Prácticas      │ ...rendered markdown...                 │
│   Derechos       │                                         │
└──────────────────┴─────────────────────────────────────────┘
```

- **ToC sidebar**: header is localized via inline dictionary
  (`{es: 'Centro Legal', en: 'Legal Center'}`). 6 entries, each a
  real `<a href="/legal/${slug}">`. Active doc gets left-border +
  bold.
- **Main column**: title + `Last updated: …` (Intl-formatted per
  locale) + rendered HTML.
- **Language switcher**: `<select>` dropdown listing every locale
  this doc has a slug for. Click → navigate to that locale's slug.
  Dropdown is dynamic (driven by `slugs_json`), not hardcoded ES/EN
  — when the workspace adds `pt-BR`, the option appears
  automatically.
- **Crawlable**: no `noindex` meta. Add
  `<link rel="alternate" hreflang>` per locale.
- **404**: unknown or archived slug → render a small "No such
  document" page in Spanish (site default).

The prototype's `LegalLayout.astro` + `[slug].astro` are good
references. Self-contained CSS, no Tailwind — they can be lifted
into workspace and only need the brand-token stylesheet URL swapped.

## 6.2 URL strategy (slug = language)

The slug in the URL IS the language indicator. No `?lang=` query.

```
/legal/privacidad               → Privacy, in 'es'
/legal/privacy                  → Privacy, in 'en'
/legal/politica-de-privacidade  → Privacy, in 'pt-BR' (if enabled)
```

Resolution: single SQL lookup against `legal_doc_slugs`. Locale-
agnostic — works for N languages out of the box.

ToC entries always link to **the current locale's slug** of each
doc, so navigating between docs never crosses languages. The
language dropdown is the only way to switch — and it switches to the
SAME doc's slug in the target locale.

---

# 7. Placeholder resolver

The body markdown carries placeholder tokens that get substituted at
render time. This is workspace logic — every render path (`:slug`
JSON API, `:slug` HTML page) calls the same resolver.

## 7.1 Tokens

| Token                       | Source                                     | Default if empty |
|-----------------------------|--------------------------------------------|------------------|
| `[COMPANY NAME]`            | `quiz_cms_settings.legal.company_name`     | `''`             |
| `[LEGAL BUSINESS ADDRESS]`  | `quiz_cms_settings.legal.business_address` | `''`             |
| `[EMAIL]`                   | `quiz_cms_settings.legal.support_email`    | `''`             |
| `[LEGAL NOTICES EMAIL]`     | `quiz_cms_settings.legal.notices_email`    | `''`             |
| `[PHONE]`                   | `quiz_cms_settings.legal.support_phone`    | `''`             |
| `[DATE]`                    | `doc.last_updated`, Intl-formatted         | passthrough      |
| `[COMPANY NAME CONTACT]`    | composite: `Company (email)` if both       | best-effort      |

Important:
- **Empty string substitution erases the placeholder** — never
  render `[]` or `[EMPTY]`. The visitor sees a clean line with no
  trailing bracket.
- **`[COMPANY NAME CONTACT]` must be replaced BEFORE `[COMPANY
  NAME]`** so the longer key wins. Use string `.replaceAll`, not
  regex.
- **`[DATE]` formatting** uses
  `Intl.DateTimeFormat(locale, { year:'numeric', month:'long', day:'numeric', timeZone:'UTC' })`.
  Parse the ISO date as `${iso}T12:00:00Z` so it doesn't shift a day
  in negative-UTC locales. Wrap in try/catch — if the locale string
  is unknown, fall back to `'en-US'`. Never throw — render the raw
  ISO string if all else fails.

## 7.2 Reference implementation

The prototype's `workers/quiz/src/server/legalPlaceholders.ts` is
~80 lines, dependency-free, and copy-pasteable. Lift it as-is. The
test surface is small: round-trip every token, including empty
substitutions, plus the locale-formatted date.

---

# 8. Tasks for curalisto-app once workspace ships

When the legal guest app is live in workspace, the curalisto-app
team does the following teardown + replumbing PR:

## 8.1 Delete

```
db/migrations/0020_legal_docs.sql
db/migrations/0021_legal_docs_description_and_translations.sql
db/migrations/0022_legal_placeholders_settings.sql
db/migrations/0023_legal_notices_email_setting.sql

workers/quiz/src/layouts/LegalLayout.astro
workers/quiz/src/pages/legal/[slug].astro
workers/quiz/src/pages/legal/index.astro
workers/quiz/src/pages/api/legal/[slug].ts
workers/quiz/src/pages/api/legal/active.ts
workers/quiz/src/pages/api/legal/active-versions.ts
workers/quiz/src/server/legalPlaceholders.ts

workers/guests/quiz-cms/src/component.tsx → LegalView, LegalDocCard,
                                            LegalCopyCard, all helpers
workers/guests/quiz-cms/src/index.ts → /api/legal/* Hono routes
```

## 8.2 Modify

- `workers/quiz/wrangler.toml`: drop the two `/legal` route entries
  IF pattern 6a is chosen. If 6b, keep them but swap the page
  handlers to thin proxies.
- `workers/guests/quiz-cms/src/component.tsx`:
  - Remove `'legal'` from `HOME_TABS`.
  - Remove the `<LegalView>` `TabsContent`.
  - Keep the `<LinkedLegalDocsPicker>` component, but swap its
    `apiListLegalDocs(false)` call for
    `fetch('https://workspace.curalisto.com/api/legal/active?lang=…')`
    (or whatever the workspace endpoint is).
- `workers/quiz/src/components/quiz/renderers.tsx`:
  - Update the `ConsentRenderer` fetch URL for `active-versions`
    from `/api/legal/active-versions` (local quiz worker) to the
    workspace endpoint.
- `packages/cv-client/src/buildCvPayload.ts`: **no change**. The CV
  payload builder reads from answer shapes, not the legal DB.
- `packages/cv-client/src/__tests__/buildCvPayload.test.ts`: **no
  change**. Tests pass against the answer-shape contract.

## 8.3 D1 migration

A teardown migration (`db/migrations/00XX_drop_legal_docs.sql`) that:

1. DROPs `legal_docs_versions`, `legal_doc_slugs`, `legal_docs` (in
   that order — versions first because they FK to docs; junction
   second).
2. DELETEs `legal.*` keys from `quiz_cms_settings`.

Only ship this AFTER workspace has imported the data. Either:
- Run a one-shot export from curalisto-db → workspace-db, OR
- Re-seed in workspace from the same SQL the prototype used
  (acceptable if no operator edits have happened yet).

Decide which based on whether any production edits have been made by
the time the cutover happens. As of 2026-06-07, the seeded content
in curalisto-db has been edited zero times — re-seeding is safe.

---

# 9. Reference: prototype commit log

Everything in this spec was built and shipped in the
`maycotte/curalisto-app` repo. Read these commits in order to see
the full implementation:

| Commit    | What it built                                              |
|-----------|------------------------------------------------------------|
| `4c2d01d` | Initial Legal Center: schema 0020, CMS tab, snippet card, /api/legal/:slug, /legal/:slug Astro pages, ConsentRenderer wiring, CV payload changes. |
| `16937d9` | Description column (0021), active/archived toggle, /api/legal/active enumeration endpoint, Spanish translations of all 6 docs. |
| `afdfe0a` | Bare /legal redirect, placeholder resolver, 4 placeholder settings, Legal Copy card in Configuration, per-locale URL chips on each doc card. |
| `a319960` | /api/legal/active snippet next to the per-doc fetch example. |
| `2eb25b7` | [LEGAL NOTICES EMAIL] placeholder + setting; moved Legal Copy card from Configuration → Legal tab. |

Together they're ~2,500 lines of production-ready code,
typecheck-clean, with 36 vitest cases passing.

---

# 10. Open questions

1. **Where does the CMS guest app mount in workspace?** Need a route
   like `workspace.curalisto.com/guests/legal` or `/legal-cms`.
2. **Workspace D1 database identity** — is there a shared
   `workspace-db` or does each guest run its own? The prototype
   assumes shared because the consent linkage and the
   `quiz_cms_settings` are cross-app.
3. **Public render pattern: 6a vs 6b**. My recommendation is 6b
   (tenant-domain proxy) for SEO + UX. Workspace team to decide.
4. **Workspace-default-locale**: today the prototype hardcodes `'es'`
   as a fallback for index redirects. If workspace has a per-tenant
   default locale setting, the legal app should read it.
5. **Brand domain configurability** — the snippet card hardcodes
   `https://curalisto.com` today. If workspace serves multiple
   tenants, the snippet should pull the brand URL from the tenant
   config (e.g. `tenant.public_domain`).

---

# 11. Acceptance checklist

The legal guest app is ready when an operator can:

- [ ] Open the Legal Center guest app in workspace.
- [ ] See 6 seeded docs (or however many the tenant has) with
  per-locale URLs visible on each card.
- [ ] Edit any doc's title, description, body markdown, or per-
  locale URL slug. Autosave on blur, SaveStatus chip cycles.
- [ ] Toggle a doc's Active switch and watch it disappear from the
  public ToC, `/api/legal/active`, and the quiz consent picker.
- [ ] Edit Company name / emails / phone / address in the Legal
  copy card and watch the change reflect on `/legal/privacidad`
  within 5 minutes (CDN cache).
- [ ] Hit `GET /api/legal/active?lang=es` and `…?lang=en` and get
  the right localized output for every active doc.
- [ ] Navigate to `/legal` (bare path) and get redirected to the
  default-locale's first active doc.
- [ ] Navigate to `/legal/privacidad`, see the rendered HTML page
  with Centro Legal sidebar, click language switcher → land on
  `/legal/privacy`.
- [ ] Tick "Privacy" + "Terms" as linked legal docs on the quiz
  consent question, take the quiz with `?debug=1`, complete the
  consent step, and confirm the `cl` payload carries
  `{ agreed: true, legalDocs: [{id:'privacy',versionId:N},…] }`.
- [ ] Confirm the CV payload (debug overlay) carries a top-level
  `consentDocuments` field with the same `(id, versionId)` pairs.

When all checkboxes pass, the curalisto-app teardown PR (§8) can
ship in the same window.
