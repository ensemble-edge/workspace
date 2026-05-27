# Brand URL Namespace

> **Status**: stable as of v0.1.98
> **TL;DR**: `/brand/*` is the canonical public surface for everything
> the workspace exposes about its brand. `/_ensemble/admin/brand/*` is
> the canonical admin API. `/_ensemble/brand/*` is back-compat only.

## The single rule

> **If a consumer ever reads it, the URL starts with `/brand/`.
> If an admin writes it, the URL starts with `/_ensemble/admin/brand/`.
> Everything under `/_ensemble/brand/` is back-compat and shouldn't be
> referenced in new code.**

## Public surface (canonical: `/brand/*`)

Gated on `public_brand_guide_enabled` for spec-family endpoints; always
public for the shell-dependent chrome (`css`, `theme`).

| Path | Returns | Gate |
|---|---|---|
| `/brand` | HTML guide | Public toggle |
| `/brand/spec` | JSON spec (v1.1) | Public toggle |
| `/brand/spec/schema.json` | JSON Schema | Public toggle |
| `/brand/variants` | Logo variant matrix | Public toggle |
| `/brand/context` | Markdown for AI | Public toggle |
| `/brand/changelog` | Audit log (brand.*) | Public toggle |
| `/brand/troubleshoot` | Diagnostic HTML page | Public toggle |
| `/brand/css` | CSS variables + fonts | Always public |
| `/brand/theme` | Legacy theme JSON (shell chrome) | Always public |
| `/brand/render/<file>` | Generated logo variant | Always public |
| `/brand/favicon-N.png` | Favicon at N px | Always public |
| `/brand/favicon.svg` | Favicon vector | Always public |
| `/brand/favicon.ico` | Favicon legacy | Always public |
| `/brand/asset/<r2-key>` | R2-stored brand asset | Always public |
| `/brand/og.png` | 404 JSON (no OG handler yet) | n/a |

The `endpoints.*` block in every spec response advertises these paths
as absolute URLs — consumer code should always fetch URLs from
`endpoints.*` rather than constructing paths.

## Admin surface (canonical: `/_ensemble/admin/brand/*`)

Auth-required. The shell's Brand admin tabs PUT to these to mutate
brand_tokens.

| Path | Method | Purpose |
|---|---|---|
| `/_ensemble/admin/brand/tokens` | PUT | Token CRUD |
| `/_ensemble/admin/brand/upload` | POST | Asset upload (R2) |

## Operator alias (optional, public)

Workspace operators can set `asset_public_alias_path` (e.g. `'assets'`)
to expose the public surface under a vanity prefix:

```
/<alias>/brand/*  →  internal rewrite to  /brand/*
```

Example: `/assets/brand/css`, `/assets/brand/render/...`. The SPA
catch-all re-dispatches these to the canonical handler.

When the alias is set, the `endpoints.*` block in the spec response
emits the aliased form for asset-distribution URLs (`css`,
`font_stylesheet`, `preview_card`) and variant URLs. Spec-family
endpoints (`spec`, `variants`, `schema`, `context`, `changelog`,
`brand_guide`, `troubleshoot`) stay at the canonical `/brand/*` form
because they're navigation, not distribution.

## Back-compat surface (`/_ensemble/brand/*`)

These paths existed before v0.1.98 and are kept for back-compat with
external consumers that hot-linked them. Every one of them works the
same as in earlier releases — same handler body, same response.

| Path | Status |
|---|---|
| `/_ensemble/brand/css` | Back-compat alias |
| `/_ensemble/brand/theme` | Back-compat alias |
| `/_ensemble/brand/render/*` | Back-compat alias |
| `/_ensemble/brand/favicon-*` | Back-compat alias |
| `/_ensemble/brand/favicon.svg` | Back-compat alias |
| `/_ensemble/brand/favicon.ico` | Back-compat alias |
| `/_ensemble/brand/asset/*` | Back-compat alias |
| `/_ensemble/brand/og.png` | JSON 404 (no consumer ever needed it) |
| `/_ensemble/brand/tokens` | Admin PUT alias + GET returns 405 JSON |
| `/_ensemble/brand/upload` | Admin POST alias |
| `/_ensemble/brand/spec` and 4 siblings | JSON 410 with `canonical_url` pointer |

**Don't reference these in new code.** They're kept working so older
operator scripts and external consumer hot-links don't break, but
every spec response advertises only canonical `/brand/*` paths.

## Why the cleanup

Pre-v0.1.98 the workspace had three overlapping URL conventions for
brand assets:

- `/_ensemble/brand/*` (shell-internal API by historical convention,
  but also publicly hot-linked by external sites for CSS / renders)
- `/brand/*` (only existed for `/brand` HTML guide pre-v0.1.92)
- `/<alias>/brand/*` (operator's pretty alias rewrite)

Spec responses mixed `/_ensemble/brand/...` and `/brand/...` paths in
the same `endpoints.*` block. External developers reading the spec
asked the obvious "why are some URLs prefixed and some aren't?"
question. The answer was "historical accident."

v0.1.98 settles it: **consumer-facing → `/brand/*`. Admin-facing →
`/_ensemble/admin/brand/*`. Everything else is back-compat.**
