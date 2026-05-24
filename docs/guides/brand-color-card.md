# Brand card component

The Brand card is the unified display unit that showcases a workspace's complete brand color system in one compact, copy-friendly view. It is used in two contexts:

1. **Brand Overview tab** — the operator's at-a-glance summary inside the brand settings UI, sitting alongside Typography, Logos, and other identity facets.
2. **Dynamic brand guide** at `/brand` — the public-facing, shareable view consumed by guest apps, embedded in documentation, and used as a reference by external collaborators.

Same component, same data source, two contexts. The card is responsive — it scales from roughly 680px (overview tab) to the full container width (standalone brand guide) without restructuring.

## Composition

The Brand card contains four sections in a fixed order, separated by section headers and subtle dividers:

1. **Brand palettes** — a 3-up grid of palette cards (Primary, Secondary, Accent)
2. **Neutral** — a single horizontal strip showing the five-rung neutral scale
3. **Gradients** — named gradient banners stacked vertically (up to five)
4. **Semantic** — a 4-up grid of state-color pairs (Success, Info, Warning, Error)

Every swatch surface in every section is clickable and copies its hex to clipboard via the Ensemble UI Toast notification system.

## Section 1 — Brand palettes

Three palette cards in a `repeat(3, 1fr)` grid with 14px gap. Each card has two stacked regions.

### Top region — Main face

Aspect-ratio 16:11, padded 18px, filled with the Main color. Contents:

- Top-left: color name in **display** typography (e.g. "Ownly Coral") with the role label (`primary` / `secondary` / `accent`) in **eyebrow** typography directly below
- Bottom-left: token reference `primary-main` in **monospace**
- Bottom-right: Main hex `#E97659` in **monospace**
- All foreground text uses the palette's own Faded rung as text color (see On-color foreground below)
- Entire face is clickable; click copies the Main hex

### Bottom region — Rung strip

Four equal columns on the card's neutral surface (not the colored Main), showing the four derived rungs Dark / Bright / Pastel / Faded. Each column:

- 24px-tall chip with the rung color, 5px border-radius, 0.5px hairline border
- Tier label below in **label** typography
- Hex below in **monospace** at ~9.5px
- Each rung individually clickable; click copies that rung's hex

The Main rung does not appear in the strip — it's already the dominant face above.

## Section 2 — Neutral

Single horizontal card. Two-column layout — a ~180px meta column on the left (palette name in display typography, descriptive subtitle in body typography, derivation note in monospace) and a five-column rung grid on the right. The Neutral palette shows all five tiers (Dark, Main, Bright, Pastel, Faded) in equal columns since there's no separate "face" — the strip itself is the entire neutral display. The Main rung is visually emphasized with a 1.5px outline ring in the workspace's primary text color.

## Section 3 — Gradients

Stacked list of gradient cards. Each gradient card has:

- A 90px-tall banner with the gradient applied as `background`. The gradient name renders in display typography (~32px) inside the banner, padded 18-22px from edges. Text color is set to an in-family on-color foreground (typically the Faded rung of the first stop's parent palette).
- A slim metadata footer below the banner showing the gradient's token name on the left, the stop chain on the right (small palette dots with token names), and the angle indicator at the far right (`linear · 90°` or `radial`).
- The entire banner is clickable; click copies the resolved CSS gradient string (e.g., `linear-gradient(90deg, #FFD4C5 0%, #FF9776 100%)`).

Empty state: if the workspace has no gradients defined, this section hides entirely — including its header. Do not render an empty placeholder.

## Section 4 — Semantic

4-up grid of compact cards. Each card contains:

- A pair of swatches at the top (Main + Light) in a `2fr 1fr` layout that visually emphasizes the Main
- The semantic role name in **body** typography below (`Success`, `Info`, `Warning`, `Error`)
- The hex pair in **monospace** at the bottom

Both swatches in each card are individually clickable.

## Typography tokens

Pull all font families from the workspace's typography settings; do not hardcode font families.

| Element | Token |
|---|---|
| Color names (palette names, neutral name, gradient names) | display |
| Role labels (`primary`, `secondary`, `accent`) | eyebrow |
| Section headers (`Brand palettes`, `Neutral`, `Gradients`, `Semantic`) | eyebrow |
| Token references (`primary-main`, etc.) | monospace |
| Hex codes (`#E97659`) | monospace |
| Tier labels (Dark / Bright / Pastel / Faded) | label |
| Semantic role names (Success / Info / Warning / Error) | body |
| Descriptive subtitle text | body |

If the workspace hasn't configured a Display token, fall back to body at increased size.

## On-color foreground

Text painted on a colored surface (palette Main faces, gradient banners) uses an in-family color rather than generic white. Default rule:

- On a palette Main: use that palette's own Faded rung (e.g. text on Ownly Coral renders in `primary-faded` `#FFF1EB`, not `#FFFFFF`)
- On a gradient banner: use the Faded rung of whichever parent palette dominates the first stop; if both stops belong to different palettes, use the lighter of the two Faded rungs, or fall back to APCA-max-contrast pick

Run APCA contrast check at render time. If the chosen in-family color falls below APCA Lc 60 against the surface, fall back to high-contrast white or black per APCA pick. Surface a contrast warning in edit mode if this fallback triggers — usually a sign that the Faded rung needs adjustment.

## Click-to-copy

Every swatch in the card copies its hex to clipboard on click and shows confirmation via the existing Ensemble UI Toast component. Do not implement a custom toast — call the workspace's existing toast API (e.g., `toast.success('Copied ' + hex)` or whatever the existing API surface is).

Gradient banners are an exception: clicking the banner copies the resolved CSS `linear-gradient(...)` or `radial-gradient(...)` string rather than a single hex. The toast message should reflect this — e.g., `Copied gradient-sunrise`.

Hover affordances:

- Main faces and gradient banners: `filter: brightness(0.97)` on hover
- Rung chips and semantic swatches: `transform: translateY(-1px)` on hover
- Cursor: `pointer` on every clickable surface
- Keyboard: Enter and Space on focused swatches trigger the copy action

Accessibility: every clickable surface needs `role="button"`, `tabindex="0"`, and `aria-label="Copy hex {value}"` (or `aria-label="Copy gradient {name}"` for banners).

## Variants

### Mode

- **`display`** (default): all swatches click-to-copy, no inputs, no inspect affordances. Used in the Overview tab and the dynamic brand guide.
- **`edit`**: color name and gradient name become inline-editable inputs via Ensemble UI `Input` (styled inline, not as full form inputs). Clicking Main faces or rung swatches opens the color picker via Ensemble UI `Popover` wrapping `ColorPicker`. Rung swatches show an "override" pencil affordance on hover. Adding a gradient surfaces an `+ Add gradient` button under the Gradients section. Used in the Brand Colors editor tab.

### Size

- **`default`**: 220px-wide palette cards in a 3-up grid, full-height (90px) gradient banners, 4-up semantic grid.
- **`compact`**: Palette cards collapse to horizontal strips (60px tall, no rung strip — only Main color + name + hex). Gradients collapse to single-line previews (40px tall). Semantic grid collapses to a single row of small swatches without surrounding cards. Used in sidebar previews or dense dashboards.

## Brand palette count — decision

**Hard-capped at three brand palettes: Primary, Secondary, Accent.** Operators can name each (display alias) but cannot add a fourth role.

Rationale: every well-known brand identity system fits within three brand colors, often two. The cap forces operators to make brand decisions instead of accumulating palettes. If an operator feels they need a fourth color, the right answers are: (a) override a rung on an existing palette, (b) compose a gradient from existing palettes, (c) use the Neutral palette, or (d) reach for the Semantic colors. Editorial sectional palettes (e.g. Telegraph's News / Opinion / Sport / Culture / Lifestyle pattern) are a separate concept — a future feature, not an expansion of the core brand identity model.

Code token slots are stable (`primary`, `secondary`, `accent`); operator-facing display names are aliases for display only. Renaming a palette does not change its code references.

## Implementation notes

- Use Ensemble UI primitives throughout: `Card` for containers, `Input` and `Popover` for edit mode, `Toast` for clipboard feedback, `Tooltip` for any auxiliary metadata.
- Structural CSS should reference Ensemble design tokens for radii, borders, spacing, and surface colors rather than hardcoded values.
- The reference HTML uses local CSS variables (`--font-display`, etc.) as placeholders — substitute with Ensemble typography tokens in production.
- The Brand card must subscribe to `brand.tokens.changed` and re-render when any underlying palette, gradient, or semantic color changes (renames, hex updates, rung overrides, gradient stop changes, etc.).
- The dynamic brand guide variant is publicly accessible — exclude any edit-mode controls and any draft / unsaved values from rendering. Brand guide reads only published tokens.
- Avoid layout shift when hex codes vary in length — always allocate space for a 7-character hex even when the value is shorter.
- Section headers and dividers should suppress for empty sections (e.g. a workspace with no gradients defined hides the Gradients section entirely).