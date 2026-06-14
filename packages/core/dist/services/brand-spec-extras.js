/**
 * Brand spec extras (v0.1.89) — constant tables that enrich the
 * `/_ensemble/brand/spec` response so a downstream agent can build
 * pixel-on-brand without out-of-band knowledge.
 *
 * Why a separate file: these are presentation-layer constants (usage
 * prose, default `examples` arrays, JSON Schema). Keeping them here
 * means spec.ts stays a thin assembler and the docs/strings stay
 * editable without touching the type definitions.
 *
 * All strings here are English-only in v0.1.89; future i18n would
 * lift this into a locale-keyed loader.
 */
// ─────────────────────────────────────────────────────────────
// Typography role examples
// ─────────────────────────────────────────────────────────────
/**
 * Per-role concrete examples ("where would I see this in a UI?").
 * The `usage` prose comes from ROLE_USAGE in font-roles.ts; this
 * adds the where-do-I-use-it list that ROLE_USAGE doesn't carry.
 */
export const ROLE_EXAMPLES = {
    wordmark: ['logo lockups', 'brand watermarks'],
    display: ['landing hero', 'marketing banners', 'oversized statements'],
    heading: ['page H1', 'section H2', 'section H3'],
    subheading: ['card titles', 'modal titles', 'H4', 'H5', 'H6'],
    body: ['article body', 'product descriptions', 'long-form prose'],
    eyebrow: ['section category labels', 'breadcrumb prefixes', 'tag pills above headings'],
    label: ['button labels', 'navigation items', 'form field labels', 'tags', 'chip labels'],
    caption: ['image credits', 'footnotes', 'legal disclaimers', 'timestamps', 'fine print'],
    mono: ['code blocks', 'data tables', 'IDs', 'API responses', 'console output'],
};
export const PALETTE_USAGE = {
    primary: {
        usage: 'Brand-defining primary actions, calls-to-action, and key interactive surfaces.',
        examples: ['primary buttons', 'active nav state', 'links', 'progress fills', 'selection highlights'],
    },
    secondary: {
        usage: 'Supportive accents, secondary actions, lower-emphasis interactive elements.',
        examples: ['secondary buttons', 'badge backgrounds', 'tab indicators'],
    },
    accent: {
        usage: 'Highlight moments and decorative emphasis. Use sparingly — small surfaces only.',
        examples: ['marketing accent strips', 'feature highlights', 'gradient stops'],
    },
    neutral: {
        usage: 'Text, borders, backgrounds, and the bulk of UI chrome.',
        examples: ['body text', 'borders', 'backgrounds', 'disabled states', 'placeholder text'],
    },
};
export const SEMANTIC_USAGE = {
    success: 'Confirmation messages, completed states, positive feedback.',
    info: 'Informational tooltips, notes, neutral context messages.',
    warning: 'Non-critical alerts, attention-needed states, approaching limits.',
    error: 'Destructive actions, validation errors, failure states.',
};
// ─────────────────────────────────────────────────────────────
// Spatial / component defaults
// ─────────────────────────────────────────────────────────────
/**
 * Default radius scale (rem). Operators can override any rung via
 * brand_tokens (category='spatial', key='radius_<rung>'). The default
 * matches common shadcn defaults so guest apps that already use shadcn
 * primitives feel native.
 */
export const DEFAULT_RADIUS = {
    sm: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    full: '9999px',
};
export const DEFAULT_SHADOW = {
    sm: '0 1px 2px 0 rgba(0,0,0,0.05)',
    md: '0 4px 6px -1px rgba(0,0,0,0.10), 0 2px 4px -2px rgba(0,0,0,0.05)',
    lg: '0 10px 15px -3px rgba(0,0,0,0.10), 0 4px 6px -4px rgba(0,0,0,0.05)',
    xl: '0 20px 25px -5px rgba(0,0,0,0.10), 0 8px 10px -6px rgba(0,0,0,0.05)',
};
/**
 * Per-component spatial recommendations. The agent reads `components.button`
 * and applies `radius_ref: 'md'` + `padding_x_ref: 4` (= 4 × spacing_unit)
 * to render a button visually consistent with the workspace shell.
 */
export const COMPONENT_DEFAULTS = {
    button: { radius_ref: 'md', padding_x_ref: 4, padding_y_ref: 2, gap_ref: 2 },
    card: { radius_ref: 'lg', padding_ref: 6, shadow_ref: 'sm' },
    input: { radius_ref: 'md', padding_x_ref: 3, padding_y_ref: 2 },
    modal: { radius_ref: 'xl', padding_ref: 8, shadow_ref: 'xl' },
    badge: { radius_ref: 'sm', padding_x_ref: 2, padding_y_ref: 1 },
};
/** Per-composition guidance — applies regardless of finish/background. */
export const COMPOSITION_USAGE = {
    'wordmark-only': {
        usage: 'The brand name set as a typographic lockup, no icon. The default mark for headers, footers, business communications, and any context where the company name needs to read clearly.',
        examples: ['website header', 'email footer', 'press releases', 'invoice header', 'business cards'],
    },
    'icon-only': {
        usage: 'The bug/symbol alone, no wordmark. Use when space is constrained, the brand is already established in context, or square dimensions are required.',
        examples: ['favicon', 'app icon', 'social media avatar', 'browser tab', 'mobile launcher'],
    },
    stacked: {
        usage: 'Icon above (or below) the wordmark, vertically arranged. Use when the available space is taller than wide — sidebar, business card front, vertical banner.',
        examples: ['sidebar lockup', 'vertical banner', 'business card centerpiece', 'mobile splash screen'],
    },
    horizontal: {
        usage: 'Icon beside the wordmark, horizontally arranged. The most balanced lockup for general use when both a recognisable symbol and the company name are needed.',
        examples: ['marketing landing pages', 'partner co-brand strips', 'conference banners', 'GitHub README header'],
    },
};
/** Per-finish guidance — what visual treatment, what to use it for. */
export const FINISH_USAGE = {
    'full-color': {
        usage: 'The mark in its primary brand colors. Use whenever the background and surrounding context permit full color — most marketing surfaces, product UI, photography overlays with sufficient contrast.',
        examples: ['marketing site', 'product UI', 'documentation', 'social posts'],
    },
    'mono-black': {
        usage: 'A single-color black version. Use on light backgrounds where full color would clash, in single-color print, or anywhere the surrounding palette is restricted.',
        examples: ['single-color print', 'newspaper ads', 'embossing', 'minimal layouts'],
    },
    'mono-white': {
        usage: 'A single-color white version. Use on dark photographic backgrounds, dark UI surfaces, or any deep-color background where a colored mark would lose legibility.',
        examples: ['dark photography hero', 'dark mode UI', 'video bumpers', 'event signage on dark backdrops'],
    },
    'mono-brand': {
        usage: 'A single-color version using a brand color (typically the primary). Use for tonal compositions where you want brand presence without the full-color mark.',
        examples: ['tonal hero illustrations', 'subtle watermarks', 'monochrome marketing campaigns'],
    },
};
/** Per-background guidance — what the variant is sized to sit on. */
export const BACKGROUND_USAGE = {
    transparent: {
        usage: 'No baked-in background — the mark sits cleanly on whatever surface it is placed onto. The most flexible variant; prefer this for composition into other layouts.',
        examples: ['composition into custom layouts', 'photography overlays (with care for contrast)', 'flexible embeds'],
    },
    light: {
        usage: 'Optimized for a workspace-defined light background. Pair with light-tone surfaces in the brand palette for a cohesive look.',
        examples: ['light-theme website hero', 'light-mode app UI', 'printed brochures on white paper'],
    },
    dark: {
        usage: 'Optimized for a workspace-defined dark background. Pair with dark-tone surfaces in the brand palette.',
        examples: ['dark-theme website hero', 'dark-mode app UI', 'evening-event materials'],
    },
    'true-white': {
        usage: 'Optimized for pure #FFFFFF backgrounds. Use when the surface is genuinely white (printed paper, true-white digital surfaces) rather than the workspace neutral.',
        examples: ['printed business cards', 'press kit cover pages', 'invoices'],
    },
    'true-black': {
        usage: 'Optimized for pure #0A0A0A backgrounds. Use when the surface is genuinely near-black.',
        examples: ['high-contrast presentation slides', 'video bumpers', 'OLED-optimized splash screens'],
    },
    'brand-primary': {
        usage: 'Optimized for sitting on the brand primary color as a background. Use sparingly — only when the surrounding design language is heavily brand-toned.',
        examples: ['hero strips in primary color', 'event signage', 'merchandise tags'],
    },
};
/**
 * Per-format guidance — when to reach for SVG vs PNG vs ICO.
 * Format choice usually follows the target rendering surface; this
 * layer codifies "when to pick which file."
 */
export const FORMAT_USAGE = {
    svg: 'Vector — infinitely scalable. The default for web, app UI, and anywhere DPI varies. Always prefer SVG when the rendering target supports it.',
    png: 'Raster — fixed pixel dimensions. Use when SVG is not supported (email clients, certain CMS image fields, OS-level icon slots).',
    ico: 'Multi-resolution favicon container. Use only for legacy <link rel="shortcut icon"> compatibility.',
};
/**
 * Where to use a variant by `use` hint (set by the assembler on
 * favicon-class entries). Lets an Android manifest builder pick the
 * right entry without parsing dimensions.
 */
export const USE_HINT_GUIDANCE = {
    favicon: 'Browser favicon — referenced from <link rel="icon" sizes="...">.',
    'android-chrome': 'Android Chrome home-screen icon — referenced from your web manifest with sizes="192x192".',
    'android-chrome-maskable': 'Android adaptive icon, safe-zone masked — referenced from your web manifest with purpose="maskable".',
    'apple-touch': 'Apple touch icon — referenced from <link rel="apple-touch-icon">.',
    'og-card': 'Open Graph social card — referenced from <meta property="og:image">. Recommended size 1200×630.',
};
// ─────────────────────────────────────────────────────────────
// Logo clearspace defaults
// ─────────────────────────────────────────────────────────────
/**
 * How much breathing room to leave around each logo role.
 *   wordmark: 1.0 × x-height (the height of a lowercase 'x' in the
 *             wordmark — a typographic convention for logo clearspace)
 *   icon_mark: 0.25 × icon-width
 *
 * Operators can override via brand_tokens later (no UI in v0.1.89;
 * populate via JSON spec import).
 */
export const DEFAULT_CLEARSPACE = {
    wordmark: { unit: 'x-height', multiplier: 1.0 },
    icon_mark: { unit: 'icon-width', multiplier: 0.25 },
};
// ─────────────────────────────────────────────────────────────
// Light/dark mode token defaults
// ─────────────────────────────────────────────────────────────
/**
 * The four "chrome" colors per mode — what the agent uses to paint
 * page backgrounds, body text, surfaces, and borders consistent with
 * the workspace. These are NOT brand colors; they're the neutral
 * frame around brand colors. The actual values come from
 * brand_tokens at category='colors', keys='brand-background-light',
 * 'brand-foreground-light', etc. — these constants are fallbacks
 * only.
 */
export const DEFAULT_MODES = {
    light: { background: '#ffffff', foreground: '#0a0a0a', surface: '#f5f5f5', border: '#e5e5e5' },
    dark: { background: '#0a0a0a', foreground: '#fafafa', surface: '#1a1a1a', border: '#262626' },
};
/**
 * Default instructions baked into every spec response. Operator-
 * editable extensions land later via a future admin field.
 */
export const BRAND_SPEC_INSTRUCTIONS = {
    summary: 'This is the canonical brand spec for this workspace. If you are building anything that should look or sound like this brand — UI, marketing site, social card, AI-generated content, partner documentation — read this whole document and follow the rules below before producing output. The values in this spec take precedence over your defaults; the brand voice in `messaging` takes precedence over your general copy instincts.',
    rules: [
        {
            id: 'use-endpoints',
            rule: 'Every URL you need is under `endpoints.*` as an absolute string. Use those — do not construct URLs from path patterns or workspace slug.',
            why: 'Path conventions can change between releases; `endpoints` is the stable, versioned contract.',
        },
        {
            id: 'reference-css-vars',
            rule: 'When emitting CSS, reference the CSS custom properties named in `*.css_var` (e.g. `var(--brand-primary-main)`, `var(--font-heading)`), not the literal hex codes or font families.',
            why: 'Operators re-theme workspaces in real time. Output that references CSS variables adapts automatically; hardcoded hexes go stale the moment the operator picks a new primary.',
        },
        {
            id: 'load-stylesheet',
            rule: 'Include `<link rel="stylesheet" href="{endpoints.css}">` in any HTML you generate. The stylesheet imports the brand fonts AND defines every CSS variable in one file.',
            why: 'One link tag is the complete setup. No need to load fonts separately or define your own tokens.',
        },
        {
            id: 'pick-logo-by-context',
            rule: 'Pick a logo from `assets.variants[]` by matching `role` + `background` + `format` + (when relevant) `size_px` to your render context. Do not crop, recolor, skew, or otherwise modify the renders.',
            why: 'Every variant is policy-approved and contrast-verified by the workspace. Modifying a variant means you have left the brand and an operator update will not be able to correct you.',
        },
        {
            id: 'follow-typography-roles',
            rule: 'Use the font role that matches your content — `roles.heading` for page titles, `roles.subheading` for card/modal/section titles, `roles.body` for paragraphs, `roles.label` for buttons and nav items. Each role has `usage` and `examples` to disambiguate.',
            why: 'The roles encode the operator\'s typographic system. Mixing them or substituting your own picks produces visibly off-brand output even when individual font choices look "professional."',
        },
        {
            id: 'respect-voice',
            rule: 'When generating any prose, follow `messaging.tone.voice_guidelines` and `messaging.tone.descriptors`. Avoid words or phrases listed under `messaging.tone.avoid`. When `messaging.voice_examples[]` is present, treat the `do` / `avoid` pairs as concrete patterns to match.',
            why: 'Brand voice is the part of brand that does not survive screenshots — it has to be carried explicitly into every prompt and copy task.',
        },
        {
            id: 'respect-spacing-system',
            rule: 'Reference `spatial.radius_scale`, `spatial.spacing.scale`, and the per-component recommendations in `spatial.components` rather than picking arbitrary radius / padding values.',
            why: 'The spacing system is what makes a set of components feel like one brand. Arbitrary values produce a fragmented, generic feel even when individual pieces are on-brand.',
        },
        {
            id: 'freshness',
            rule: 'Cache this response for at most 5 minutes (matching the Cache-Control header). Re-fetch when the `etag` field changes or when starting a new agent session.',
            why: 'Operators edit brand values in real time. Output should reflect the current brand, not a snapshot from yesterday.',
        },
        {
            id: 'license-respect',
            rule: 'Read `license.type` and `license.usage_restrictions` before using marks externally. If license is `all-rights-reserved` and you are not a sanctioned user of these marks, do not ship.',
            why: 'Brand assets are intellectual property. The workspace operator decides who may use them.',
        },
    ],
    anti_patterns: [
        'Constructing URLs from `workspace.slug` + a guessed path pattern (use `endpoints.*` instead — every URL you need is there).',
        'Hardcoding hex colors from `palettes.*.main` directly into your output (reference the CSS variable so brand re-themes propagate).',
        'Picking the first logo from `assets.variants[]` regardless of background (match `background` to your render surface).',
        'Substituting your own typography because the spec\'s choice "feels wrong" — the choice IS the brand.',
        'Ignoring `messaging.tone.avoid` because the words feel fine in context — they are listed for a reason the operator considers binding.',
        'Treating an empty / undefined field as license to insert your default. Empty means "the operator has not set this"; ask or omit, do not invent.',
    ],
    for_ai_agents: 'If you are an AI agent (Claude, GPT, Gemini, etc.) being handed this spec: treat it as part of your system prompt for any work involving this workspace. Re-fetch at the start of any new session — brand state may have changed. When your training data suggests one design choice and this spec specifies another, prefer the spec — it is the workspace\'s chosen ground truth. When you finish a task, your output should be able to be diffed against this spec and show consistent reference to its values; if you can see places where you departed, flag them rather than hide them.',
};
// ─────────────────────────────────────────────────────────────
// JSON Schema for /brand/spec
// ─────────────────────────────────────────────────────────────
/**
 * JSON Schema (Draft 2020-12) describing the v1.1 brand spec response.
 * Served at /_ensemble/brand/spec/schema.json so external tools can
 * validate spec responses or generate typed bindings.
 *
 * Kept intentionally permissive (additionalProperties: true) so future
 * fields don't invalidate older consumers.
 */
export const BRAND_SPEC_SCHEMA = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://ensemble-edge.com/schemas/brand-spec-1.1.json',
    title: 'EnsembleBrandSpec',
    description: 'Canonical brand spec format. One source of truth, multiple renderings.',
    type: 'object',
    required: ['ensemble_brand', 'updated_at', 'identity', 'colors', 'typography', 'logos', 'messaging'],
    properties: {
        ensemble_brand: { type: 'string', const: '1.1' },
        schema_version: { type: 'string' },
        spec_url: { type: 'string', format: 'uri' },
        workspace: {
            type: 'object',
            properties: {
                id: { type: 'string' },
                slug: { type: 'string' },
                display_name: { type: 'string' },
                public_url: { type: 'string', format: 'uri' },
            },
        },
        updated_at: { type: 'string', format: 'date-time' },
        generated_at: { type: 'string', format: 'date-time' },
        etag: { type: 'string' },
        license: {
            type: 'object',
            properties: {
                type: { type: ['string', 'null'] },
                usage_restrictions: { type: 'string' },
            },
        },
        identity: { type: 'object' },
        colors: {
            type: 'object',
            properties: {
                palettes: { type: 'object' },
                semantic: { type: 'object' },
                gradients: { type: 'array' },
                modes: { type: 'object' },
                groups: { type: 'array' },
            },
        },
        typography: {
            type: 'object',
            properties: {
                font_sources: { type: 'array' },
                stylesheet_url: { type: 'string', format: 'uri' },
                roles: { type: 'object' },
            },
        },
        logos: {
            type: 'object',
            properties: {
                masters: { type: 'object' },
                variants: { type: 'array' },
                banned: { type: 'array' },
                clearspace: { type: 'object' },
            },
        },
        messaging: {
            type: 'object',
            properties: {
                tagline: { type: 'string' },
                elevator_pitch: { type: 'string' },
                mission: { type: 'string' },
                tone: { type: 'object' },
                voice_examples: { type: 'array' },
                audiences: { type: 'array' },
            },
        },
        spatial: { type: 'object' },
        gradients: { type: 'object' },
        endpoints: {
            type: 'object',
            description: 'Every consumable URL the agent might need. Absolute strings, no pattern-guessing.',
            properties: {
                spec: { type: 'string', format: 'uri' },
                css: { type: 'string', format: 'uri' },
                context: { type: 'string', format: 'uri' },
                brand_guide: { type: 'string', format: 'uri' },
                variant_index: { type: 'string', format: 'uri' },
                font_stylesheet: { type: 'string', format: 'uri' },
                schema: { type: 'string', format: 'uri' },
                changelog: { type: 'string', format: 'uri' },
                preview_card: { type: 'string', format: 'uri' },
            },
        },
    },
    additionalProperties: true,
};
// ─────────────────────────────────────────────────────────────
// ?for= preset shapes
// ─────────────────────────────────────────────────────────────
/**
 * Curated subsets for `/brand/spec?for=<preset>`. Each preset is a
 * list of top-level keys to retain (plus their entire subtrees).
 * The meta block (ensemble_brand, workspace, etag, endpoints, etc.)
 * is always kept.
 *
 * Default (no `?for=`) returns everything. `for=admin-import` is
 * explicitly the full payload (alias for "no preset"); included so
 * import flows can be explicit.
 */
export const SPEC_PRESETS = {
    'marketing-site': ['identity', 'colors', 'typography', 'logos', 'messaging', 'spatial'],
    'ai-prompt': ['identity', 'colors', 'typography', 'messaging'],
    'admin-import': ['identity', 'colors', 'typography', 'logos', 'messaging', 'spatial', 'gradients'],
};
//# sourceMappingURL=brand-spec-extras.js.map