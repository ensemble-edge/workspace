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
                tokens: { type: 'string', format: 'uri' },
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