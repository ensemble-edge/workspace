# SVG Image Generator — Brand Asset System

> **Status**: active plan, phased across v0.1.31 → v0.1.35
> **Owner**: brand subsystem
> **Goal**: SVG-master-of-truth brand assets with deterministic on-demand
> generation of every approved variant (composition × finish × background × format × size).

## Why

Most brand-management tools force operators to upload every variant by hand
— light logo, dark logo, 64px favicon, 512px social avatar, 1200×630 OG
image, transparent PNG, white-background PNG, etc. Twelve files per logo,
and they drift over time as one gets updated and the others don't.

This plan flips the model: **operators upload only SVG masters** (or
configure styled-text wordmarks). Every other variant — format, size,
theme, background, composition — is generated deterministically from
those masters at request time, cached in R2, and served via the
workspace's CDN. The brand guide page becomes both *brand asset
distribution* and *brand policy enforcement* in one surface.

The constraint becomes the feature: a brand system that lets operators
do anything is a graphics editor, not a brand system. The generator
produces only approved combinations.

## Design principles

1. **SVG is the source of truth.** All marks are vector. Rasters are
   outputs, never inputs (except for legitimately raster-native slots
   like uploaded user avatars).
2. **One pipeline, two entry points.** The wordmark can come from an
   uploaded SVG **or** from styled text + typography tokens. The
   downstream composition + rasterization engine doesn't care which —
   it operates on SVG either way.
3. **Constraints are first-class.** Operators declare which
   compositions, finishes, and backgrounds their brand allows. The
   generator cannot produce banned combinations. The brand guide
   shows both approved uses AND banned uses.
4. **Self-describing storage.** Filenames carry meaning (workspace
   slug, role, variant, resolution, version) so a downloaded asset
   stays interpretable outside the workspace.
5. **Theme-aware by structure.** Required `brand.background.light` +
   `brand.background.dark` tokens. Dark-mode logo generation is gated
   on these being set — operators see explicit guidance, not silent
   failure.

## The three independent axes

Every rendered logo is the product of three orthogonal choices:

| Axis | Values | Source |
|---|---|---|
| **Composition** | `wordmark-only` / `icon-only` / `stacked` / `horizontal` | Composition policy + per-cell config |
| **Finish** | `full-color` / `mono-black` / `mono-white` / `mono-brand` | Finish policy |
| **Background** | `transparent` / `light` / `dark` / declared custom | Background policy |

Banned pairs (e.g. `mono-white × light` — illegible) are auto-detected
via WCAG contrast and explicitly banned with reason. Operators can
override.

## Storage shape

Brand tokens (D1, `brand_tokens` table):
- `logo_wordmark_svg` — R2 key for uploaded wordmark SVG (optional;
  styled-text wordmark is the alternative)
- `logo_icon_mark_svg` — R2 key for uploaded icon SVG
- `wordmark_text` — JSON segments (existing) for styled-text wordmark
- `wordmark_*` typography tokens (existing) — family/weight/size/etc
- `brand_background_light` / `brand_background_dark` (new) — required
- `brand_foreground_light` / `brand_foreground_dark` (new) —
  auto-derived from backgrounds, operator-overridable
- `logo_policy` (new) — JSON blob with the full LogoCompositionPolicy

R2 keys:
- Masters: `brand/<workspace-slug>/<role>/<workspace-slug>-<role>-<variant>-master-v<n>-<hash>.svg`
- Generated: `brand/<workspace-slug>/generated/<sha-of-request-signature>.<ext>`
- Fonts cache: `brand/fonts/<family>-<weight>-<style>.woff2`

## File naming strategy

```
brand/<workspace-slug>/<role>/<workspace-slug>-<role>-<variant>-<resolution>-v<n>-<short-hash>.<ext>
```

Examples:
- `brand/cl-workspace/wordmark/cl-workspace-wordmark-primary-master-v1-a8f2d3.svg`
- `brand/cl-workspace/icon_mark/cl-workspace-icon_mark-primary-master-v2-7c1b9e.svg`

Self-describing (designer who downloads it knows what they have),
sortable (related variants group alphabetically), versionable
(re-uploads bump `v`), URL-safe, and still non-guessable due to the
6-char hash.

Downloaded filename via `Content-Disposition` strips the hash and
version: `cl-workspace-wordmark-primary-dark-512.png` — clean for
designer use.

## Composition policy

```ts
interface LogoCompositionPolicy {
  stacked: {
    allowed: boolean;
    iconScale: number;          // 0.5–2× wordmark cap-height
    spacing: number;            // em-relative spacing
    alignment: 'left' | 'center' | 'right';
  };
  horizontal: {
    allowed: boolean;
    iconScale: number;
    spacing: number;
    alignment: 'top' | 'middle' | 'bottom';  // vs wordmark cap-height
  };
  wordmarkOnly: { allowed: boolean };
  iconOnly: { allowed: boolean };

  finishes: LogoFinish[];
  backgrounds: LogoBackgroundOption[];
  bannedPairs: Array<{ finishId: string; backgroundId: string; reason?: string }>;
}
```

Fresh-workspace defaults: all compositions allowed, all canonical
finishes except `mono-brand` allowed (operator opts in), all backgrounds
allowed, auto-banned pairs based on WCAG contrast 4.5:1.

## Dimensional awareness for text-based wordmarks

Text-as-SVG has different metrics than vector-as-SVG. The runtime
uses `opentype.js` (lazy-loaded, ~50KB gzip) to parse the configured
wordmark font and compute:

- Per-glyph horizontal advance → exact text width
- Cap-height → used for stacked icon alignment
- Ascender/descender → used for tight viewBox computation
- Letter-spacing compensation → trailing letter-space subtracted from width

When stacking, alignment is **cap-height-based**, not bounding-box-based
— matches how designers actually think about lockups.

When the same wordmark text is rendered through different families,
the resulting widths differ; the compositor measures each render
and lays out based on actual rendered dimensions, never font-size
heuristics.

## SVG author guidelines

Displayed in upload tooltips on each SVG-required slot:

> **Upload an SVG master**
>
> - **Use your brand colors as authored** — we'll generate mono-black,
>   mono-white, and mono-brand finishes from this source, so the SVG
>   should reflect how the mark looks in its full-color form
> - Use `currentColor` for the primary mark fill so it can be
>   theme-swapped automatically
> - For accent fills, use CSS class names: `brand-primary`,
>   `brand-secondary`, `brand-accent` — these will swap to match
>   the active brand palette
> - ViewBox should be tight (no excess whitespace) — we'll add
>   safe-area padding when needed
> - No embedded raster images or external font references (convert
>   text to paths)
> - Minimum 64×64 viewBox; recommended 512×512 or 1024×1024

## Generator engine

**Stack**: `resvg-wasm` for SVG → raster (lazy-loaded, ~3MB WASM,
~50ms cold start). `opentype.js` for text metrics. R2 for source
storage AND generated cache. Cloudflare CDN for delivery via standard
cache headers. Cloudflare Images is NOT used — it can't manipulate
SVG source the way we need (color swap, compose lockups, render
text-as-SVG with brand fonts).

**Helpers**:
- `renderWordmarkAsSvg(workspaceId) → SVGString` — unified entry
  point; resolves either uploaded SVG or styled-text source
- `composeLockup(iconSvg, wordmarkSvg, policy) → SVGString` —
  produces stacked or horizontal composition with proper alignment
- `applyFinish(svg, finish, brandColors) → SVGString` — color swap
- `compositeOnBackground(svg, background) → SVGString` — wraps in
  background rect (or returns unchanged for `transparent`)
- `rasterize(svg, format, size) → Buffer` — final render

**Endpoint**:
```
GET /_ensemble/brand/asset/<role>/<format>/<size>
  ?finish=full-color|mono-black|mono-white|mono-brand
  &bg=transparent|light|dark|<hex>
  &composition=wordmark-only|icon-only|stacked|horizontal
```

Cache key = SHA of `(workspace_id, role, format, size, finish, bg, composition, source_version)`. Cache lives in R2. Cache invalidation = source version bump (new SVG upload increments `v`, invalidates the prefix).

## Favicon suite (generated, not uploaded)

The favicon slot is **removed from upload UI** entirely. The full
canonical suite is generated from the icon SVG:

| File | Size | Purpose |
|---|---|---|
| `favicon.ico` | 16+32+48 multi-res | Legacy browser tab |
| `favicon.svg` | vector | Modern browsers |
| `favicon-16x16.png` | 16×16 | High-DPI tab fallback |
| `favicon-32x32.png` | 32×32 | High-DPI tab |
| `apple-touch-icon.png` | 180×180 | iOS home screen |
| `icon-192.png` | 192×192 | Android home screen |
| `icon-512.png` | 512×512 | Android splash, PWA |
| `mstile-150x150.png` | 150×150 | Windows pinned tile |
| `site.webmanifest` | JSON | PWA manifest |
| `browserconfig.xml` | XML | Microsoft tile config |

Fallback when no icon SVG is set: monogrammed favicon from wordmark's
first character at the wordmark's typography on a `brand.accent`
background.

## Brand Overview: variants matrix + downloads

New full-width section on the Brand Overview tab. Renders the
**Composition × Finish × Background matrix** with only the operator's
approved cells filled in. Banned pairs render as a separate "Don't
do this" gallery.

Each approved cell exposes:
- **Copy SVG** to clipboard (inline HTML use)
- **Copy URL** to clipboard (deck/email embed via CDN)
- **Download SVG**
- **Download PNG** (default 1024px, transparent if cell allows)
- **"More formats"** overflow → JPG, WebP, alternate sizes

Top of the section: a prominent **Download brand kit** button that
produces a zip of every approved variant (SVG + PNG@1024 + PNG@512 +
the full favicon suite). One click, brand consumer has everything.

## Brand guide page (public)

Renders the same matrix, plus the banned uses gallery with red X
overlay + reason. This is the pedagogical payoff — partners,
designers, and external collaborators learn the rules by seeing
both the approved and banned uses side by side.

## Phasing

### v0.1.31 — Foundations
- Logos tab: autosave on upload (no more "uploaded but not saved")
- New self-describing filename strategy applied to all uploads
- Wordmark + icon_mark slots: **SVG-only** with author-guideline
  tooltip per spec above
- **Favicon slot removed from upload UI** — placeholder explains
  it's generated from the icon mark
- Social avatar + OG image slots: continue to accept raster (these
  are legitimately output-only, no benefit from vector source)
- Existing raster uploads stay valid; only new uploads enforce SVG

### v0.1.32 — Color foundation for theme-aware logos
- Colors tab: required `brand.background.light` + `brand.background.dark`
- Auto-derived `brand.foreground.light` + `brand.foreground.dark`
  (operator-overridable)
- Inline guidance on Logos tab when backgrounds aren't set

### v0.1.33 — Composition policy
- `logo_policy` JSON token + new "Composition" subtab under Logos
- Per-composition toggles + configurators (iconScale, spacing,
  alignment)
- Finish + background policy toggles
- WCAG-contrast-based auto-banned pairs with operator override
- Live policy preview matrix
- Brand guide renders approved compositions AND banned uses

### v0.1.34 — Generation engine
- Bundle `resvg-wasm` + `opentype.js`
- Font cache (R2 + KV)
- `renderWordmarkAsSvg`, `composeLockup`, `applyFinish`,
  `compositeOnBackground`, `rasterize` helpers
- `GET /_ensemble/brand/asset/<role>/<format>/<size>` endpoint
- R2-backed generated-output cache
- Favicon-suite endpoint

### v0.1.35 — Brand Overview variants matrix + downloads
- Variants matrix card on Brand Overview
- Per-cell copy/download actions
- "Download brand kit" zip generator
- Brand guide page integration (approved + banned galleries)

## Out of scope (deferred)

- **Multi-line wordmarks** — `wordmark_text` is single-line for now
- **Variable-font axes** beyond weight/italic — defer
- **OpenType feature toggles** (small caps, alternates, etc.) — defer
- **Gradient finishes** — defer (would need gradient definitions)
- **Outline/stroke finishes** — defer
- **Embossed/print-only finishes** — out of scope (digital brand
  system only)
- **Custom-color backgrounds beyond brand-declared** — by design,
  the brand system narrows choice; no escape hatch

## Open questions tracked here

None currently. All design calls confirmed (composition vocab,
finish set, axis separation, favicon generation, text-vs-SVG unified
pipeline).

## Key files (when implemented)

- `packages/core/src/services/brand-assets.ts` — generation helpers
- `packages/core/src/services/brand-fonts.ts` — font fetch + cache
- `packages/core/src/services/brand-policy.ts` — policy CRUD +
  validation
- `packages/core/src/apps/core/brand/routes.ts` — generator endpoint
- `packages/shell/src/apps/core/brand/LogosTab.tsx` — autosave
  (v0.1.31) + composition subtab (v0.1.33)
- `packages/shell/src/apps/core/brand/CompositionTab.tsx` — new in
  v0.1.33
- `packages/shell/src/apps/core/brand/OverviewTab.tsx` — variants
  matrix (v0.1.35)
- `packages/core/src/services/brand-guide.ts` — banned-uses gallery
  (v0.1.33)
