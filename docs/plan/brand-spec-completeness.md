# Brand Spec — Completeness for External Builders

> **Status**: active, target v0.1.89 (single release)
> **Owner**: brand subsystem
> **Goal**: Make `/_ensemble/brand/spec` fully self-sufficient. Anything
> the workspace knows about its own brand is reachable from the spec —
> inline, or via a typed URL in `endpoints` — so an external agent can
> build pixel-on-brand work without scraping, URL-guessing, or asking
> questions.

## Why

The current spec response carries identity, color groups, four font
roles (family + category), seven logo URLs, messaging, and a couple of
spatial tokens. A downstream agent who wanted to build a marketing
site on Curalisto's brand would be unable to discover, from the spec
alone:

- Where to use each font (no usage prose; only 4 of 9 roles emitted)
- Which logo variant to pick on a dark photo (no variant matrix)
- The 192px favicon URL for an Android manifest (no size catalog)
- Foreground color when sitting on `primary.main` (no `on` color)
- Whether the brand is licensed for external use (no license field)
- Where the human-readable brand guide lives (not in `endpoints`)

The workspace **already has** all of this internally (font-roles
service, BrandColorsDoc, brand-policy, render-route URL scheme,
audit log). This release is mostly emit-side glue: surface what we
already know.

## Design principles

1. **Self-describing.** Every consumable URL is in `endpoints` as an
   absolute string. No URL pattern requires out-of-band knowledge.
2. **Backward compatible.** Existing fields stay. New fields are
   additive. `ensemble_brand: '1.0' → '1.1'`.
3. **Single source of truth.** Don't duplicate data the consumer can
   compute. The spec lists rendered variant URLs (which require
   knowing the policy *plus* the URL pattern); it doesn't restate the
   raw token values.
4. **Operator-discovered, agent-actionable.** Every typography role,
   every color palette, every logo variant carries a `usage` string
   explaining *where* to use it. Free-form, but always present.
5. **Selectable.** `?for=marketing-site|ai-prompt|...` returns a
   curated subset; `?include=logos,colors.palettes.primary` returns
   an explicit allowlist. Default response is everything.

## Spec schema v1.1

### Top-level meta

```ts
{
  ensemble_brand: '1.1',
  schema_version: '1.1.0',
  spec_url: 'https://workspace.curalisto.com/_ensemble/brand/spec',
  workspace: { id, slug, display_name, public_url },
  updated_at: '2026-05-26T...',   // most-recent brand token edit
  generated_at: '2026-05-27T...', // when THIS response was assembled
  etag: 'W/"a1b2..."',            // for client caching
  license: {
    type: 'all-rights-reserved' | 'cc-by-4.0' | 'cc-by-sa-4.0' | 'custom' | null,
    usage_restrictions: '...optional human-readable rules...'
  },
  endpoints: {
    spec, css, context, tokens,           // existing
    brand_guide,                          // .../brand (HTML)
    variant_index,                        // .../_ensemble/brand/variants
    font_stylesheet,                      // .../_ensemble/brand/fonts.css (concatenated @import)
    schema,                               // .../_ensemble/brand/spec/schema.json
    changelog,                            // .../_ensemble/brand/changelog
    preview_card                          // .../_ensemble/brand/og.png
  }
}
```

### Typography — 9 roles + usage + sources

```ts
typography: {
  font_sources: [{
    family: 'Gloock',
    source: 'google' | 'upload' | 'system',
    url: 'https://fonts.googleapis.com/css2?family=Gloock&display=swap',
    weights: [400],
    has_italic: false
  }, ...],

  /** Single concatenated @import URL — the easiest way for a consumer
   *  to load every weight/style this brand uses. */
  stylesheet_url: 'https://workspace.curalisto.com/_ensemble/brand/fonts.css',

  roles: {
    wordmark: {
      family, weight, style,
      letter_spacing, text_transform, font_size,
      stack: '"Gloock", Georgia, serif',
      css_var: '--font-wordmark',
      label: 'Wordmark',
      usage: 'Reserved exclusively for the brand lockup — appears nowhere else in the UI so the mark stays ownable.',
      examples: ['logo lockups', 'brand watermarks']
    },
    display:    { ..., usage: 'Hero sections, full-screen landing moments...', examples: ['landing hero', 'marketing banners'] },
    heading:    { ..., usage: 'Primary page and section titles...',           examples: ['H1', 'H2', 'H3'] },
    subheading: { ..., usage: 'Secondary and tertiary groupings...',          examples: ['card titles', 'modal titles', 'H4', 'H5', 'H6'] },
    body:       { ..., usage: 'All paragraph text, article content...',       examples: ['article body', 'long-form prose'] },
    eyebrow:    { ..., usage: 'Small all-caps label above a heading...',      examples: ['section category labels'] },
    label:      { ..., usage: 'Buttons, navigation items, form labels...',    examples: ['button labels', 'nav', 'form labels', 'tags'] },
    caption:    { ..., usage: 'Image credits, footnotes, timestamps...',      examples: ['captions', 'fine print'] },
    mono:       { ..., usage: 'Code, data tables, IDs, API responses...',     examples: ['code blocks', 'data tables', 'IDs'] }
  }
}
```

**Data sources:** existing `loadAndResolveRoles()` + `ROLE_USAGE` in
[packages/core/src/services/font-roles.ts](../../packages/core/src/services/font-roles.ts).
`examples` is new — seeded from constants per role, operator-editable
later via JSON spec import (no UI in this release).

### Logos — masters + variant matrix + clearspace

```ts
logos: {
  masters: {
    wordmark:        { url, role: 'wordmark', format: 'svg', minimum_size_px: 120 },
    wordmark_dark:   { url, role: 'wordmark', format: 'svg', minimum_size_px: 120 },
    icon_mark:       { url, role: 'icon', format: 'svg', minimum_size_px: 24 },
    icon_mark_dark:  { url, role: 'icon', format: 'svg', minimum_size_px: 24 },
    favicon:         { url, role: 'favicon', format: 'svg' | 'png' | 'ico' },
    social_avatar:   { url, role: 'avatar', format: 'png', size_px: 1024 },
    og_image:        { url, role: 'og', format: 'png', size_px: 1200 }
  },

  variants: [
    {
      role: 'wordmark' | 'icon' | 'favicon' | 'avatar' | 'og',
      composition: 'wordmark-only' | 'icon-only' | 'stacked' | 'horizontal',
      finish: 'full-color' | 'mono-black' | 'mono-white' | 'mono-brand',
      background: 'transparent' | 'light' | 'dark' | 'brand-primary' | ...,
      format: 'svg' | 'png' | 'ico',
      size_px: number | null,    // null for SVG
      url: 'https://workspace.curalisto.com/_ensemble/brand/render/curalisto-wordmark-full-color-transparent.svg',
      approved: true,
      use?: 'favicon' | 'android-chrome' | 'apple-touch' | 'og-card'
    },
    ...
  ],

  banned: [
    { composition, finish, background, reason: 'Mono-white on light is too low contrast.' }
  ],

  clearspace: {
    wordmark: { unit: 'x-height', multiplier: 1.0 },
    icon_mark: { unit: 'icon-width', multiplier: 0.25 }
  }
}
```

**Data sources:** `applyAssetAlias()` for masters URLs;
`loadEffectivePolicy() + effectiveBannedPairs()` for the matrix;
`/_ensemble/brand/render/<slug>-<comp>-<finish>-<bg>.<fmt>` URL pattern
already in production. `clearspace` is new — seeded with sensible
defaults (1.0 x-height for wordmarks, 0.25 icon-width for icon marks),
operator-editable later.

### Colors v2 — palettes + modes

```ts
colors: {
  palettes: {
    primary: {
      name: 'Curalisto Blue',
      dark, main, bright, pastel, faded,
      on: '#ffffff',                              // foreground when on this palette
      css_vars: {
        dark: '--brand-primary-dark',
        main: '--brand-primary-main',
        bright: '--brand-primary-bright',
        pastel: '--brand-primary-pastel',
        faded: '--brand-primary-faded'
      },
      usage: 'Brand-defining primary actions, calls-to-action.',
      examples: ['primary buttons', 'active nav state', 'links']
    },
    secondary, accent, neutral
  },

  semantic: {
    success: { main, light, on, css_var: '--brand-semantic-success', usage: 'Confirmation, completed states.' },
    info, warning, error
  },

  gradients: [{
    slug, name, value, css_var,
    stops: [{ color_ref: 'primary.main' }, ...],
    usage: 'Hero backgrounds, marketing banners.'
  }],

  modes: {
    light: { background: '#ffffff', foreground: '#0a0a0a', surface: '#f5f5f5', border: '#e5e5e5' },
    dark:  { background: '#0a0a0a', foreground: '#fafafa', surface: '#1a1a1a', border: '#262626' }
  },

  // Existing v1.0 fields retained for back-compat:
  groups: [...],  // unchanged shape
}
```

**Data sources:** `BrandColorsDoc` via `loadBrandColors()` already has
palettes + rungs + gradients. `on` color, `usage`, `examples` are
seeded from per-role defaults.

### Spatial v2 — scales + per-component

```ts
spatial: {
  radius: { sm, md, lg, xl, full, css_vars: { sm: '--radius-sm', ... } },
  spacing: { unit: '0.25rem', scale: [0,1,2,3,4,6,8,12,16,24,32,48,64] },
  shadow: { sm, md, lg, xl, css_vars: {...} },
  components: {
    button: { radius_ref: 'md', padding_x_ref: 4, padding_y_ref: 2, gap_ref: 2 },
    card:   { radius_ref: 'lg', padding_ref: 6, shadow_ref: 'sm' },
    input:  { radius_ref: 'md', padding_x_ref: 3, padding_y_ref: 2 },
    modal:  { radius_ref: 'xl', padding_ref: 8 }
  }
}
```

### Messaging additions

```ts
messaging: {
  // ... existing fields preserved ...
  voice_examples: [{                              // new, optional, schema-slot
    context: 'marketing headline',
    do: 'Connect care across every clinic.',
    avoid: 'Industry-leading healthcare connectivity solutions.',
    reason: 'Concrete + active; avoids buzzwords.'
  }],
  audiences: [{                                   // new, optional, schema-slot
    name: 'clinic admin',
    description: 'Practice managers, not technical.'
  }]
}
```

These are operator-populated via JSON spec import. UI to edit them
arrives in a later release; the schema slots ship in v0.1.89 so
operators with a long-form brand voice can preserve it during
import/export.

## New endpoints

| URL | Returns | Caching |
|---|---|---|
| `GET /_ensemble/brand/variants` | JSON array of every approved logo variant + URL | `public, max-age=300, swr=86400` |
| `GET /_ensemble/brand/spec/schema.json` | JSON Schema (Draft 2020-12) describing the spec response | `public, max-age=3600` |
| `GET /_ensemble/brand/changelog` | JSON list of brand-* audit log entries (last 100) | `private, no-store` |

**No separate `/brand/fonts.css`.** The existing `/brand/css` already
includes the Google Fonts `@import` at the top alongside CSS variables,
so `endpoints.font_stylesheet` points at `/brand/css` — the same
stylesheet drives both the fonts and the variable tokens. Agents that
want only the structured font source URL can read
`typography.font_sources[].url` from the spec JSON.

The existing `GET /brand` (human guide), `/brand/css`, `/brand/context`,
`/brand/tokens` stay unchanged.

## Query parameters on `/brand/spec`

```
?for=marketing-site      curated subset for marketing-site builders
?for=ai-prompt           high-signal subset for LLM system prompts
?for=admin-import        full output identical to default (for import/export)

?include=logos,colors.palettes.primary,typography.roles.heading
                         explicit allowlist of paths. Comma-separated dotted paths.

?lang=en                 reserved for future i18n; ignored in v0.1.89.
```

`for` is a preset; `include` is an allowlist. They compose: `for`
chooses the base, `include` further narrows. Default (no param) is
everything.

## Files touched

- `packages/core/src/apps/core/brand/spec.ts` — type expansion + assembler
- `packages/core/src/apps/core/brand/routes.ts` — `/variants`, `/spec/schema.json`, `/changelog`, `/fonts.css`, query params on `/spec`
- `packages/core/src/services/brand-spec-extras.ts` — new, holds the constant tables (per-role usage examples, palette usage examples, component-spatial defaults, JSON Schema)
- `packages/core/src/routes/credentials.ts` — fingerprint v0.1.89

## Acceptance

- `curl https://workspace.curalisto.com/_ensemble/brand/spec` returns
  all 9 typography roles with `usage`, `css_var`, `stack`, and
  `examples`.
- The response includes `endpoints.variant_index`; following it returns
  an array where every entry has an absolute `url` to an actual logo
  render that 200s.
- `?for=ai-prompt` returns a smaller payload without logos.variants[]
  and without spatial.components.
- `?include=typography.roles.heading,colors.palettes.primary` returns
  only those two subtrees plus the top-level meta.
- The schema endpoint validates the spec response (round-trip
  validation passes for a real Curalisto workspace).
- Existing consumers (the brand guide HTML, the CSS endpoint, guest
  apps using `Ensemble.useFonts()`) continue to work unchanged — all
  new fields are additive.

## Out of scope for v0.1.89 (deferred to v0.1.90)

- Admin UI for editing `voice_examples`, `audiences`, per-role `examples`,
  logo `clearspace`. Operators populate via JSON spec import meanwhile.
- License-picker UI (the schema slot is there; operators set via JSON
  import or a future Settings → Brand → License page).
- Custom OG image generator endpoint at `/_ensemble/brand/og.png` (the
  field is reserved; the existing OG image asset is what `preview_card`
  points to for now).
- i18n: `?lang=` is reserved but ignored.
