/**
 * Ensemble Brand Spec — The canonical brand format.
 *
 * One spec, multiple renderings:
 *   /_ensemble/brand/spec     → JSON (machine consumption, import/export)
 *   /_ensemble/brand/css      → CSS custom properties (websites)
 *   /_ensemble/brand/context  → Markdown (AI system prompts)
 *   /_ensemble/brand/page     → HTML (human-readable brand page)
 *
 * The spec is the single source of truth. Everything else is derived from it.
 */
export interface EnsembleBrandSpec {
    /**
     * Format version — tools check this to know how to parse.
     * v1.1 (v0.1.89): adds typography.roles (9 roles), logos.variants,
     * colors.palettes, colors.modes, spatial.components, expanded
     * endpoints. All additions are non-breaking — v1.0 consumers see
     * the new fields as `unknown` and continue working.
     */
    ensemble_brand: '1.0' | '1.1';
    /** v1.1: machine-readable schema version (semver). */
    schema_version?: string;
    /** v1.1: self-reference URL — the canonical address of THIS spec. */
    spec_url?: string;
    /** v1.1: workspace identity block — separate from the brand identity. */
    workspace?: {
        id: string;
        slug: string;
        display_name: string;
        public_url: string;
    };
    /** When this spec was last modified */
    updated_at: string;
    /** v1.1: when this RESPONSE was assembled (≠ updated_at). */
    generated_at?: string;
    /** v1.1: opaque hash for client cache validation. */
    etag?: string;
    /** v1.1: brand asset license info — does the external agent have permission to use these marks? */
    license?: {
        type: string | null;
        usage_restrictions?: string;
    };
    /**
     * v0.1.93: usage instructions for consumers (especially AI agents)
     * reading this spec. Tells them HOW to use the data, not just the
     * structure. Read this first; treat as part of your system prompt.
     *
     * Structured as { summary, rules[], anti_patterns[], for_ai_agents }
     * so individual rules can be referenced by stable id and so tools
     * can enumerate / surface specific rules in a UI.
     */
    instructions?: {
        summary: string;
        rules: Array<{
            id: string;
            rule: string;
            why: string;
        }>;
        anti_patterns: string[];
        for_ai_agents: string;
    };
    /** Company identity */
    identity: {
        display_name: string;
        legal_name?: string;
        founding_year?: string;
        headquarters?: string;
        website?: string;
        industry?: string;
        /** User-defined custom fields */
        custom?: Record<string, CustomField>;
    };
    /** Color system */
    colors: {
        /** Named color groups (e.g., "Slate", "Gold", "Vermillion") — v1.0 */
        groups: ColorGroup[];
        /** Semantic colors for UI states — v1.0 */
        semantic: {
            success: string;
            'success-light'?: string;
            info: string;
            'info-light'?: string;
            warning: string;
            'warning-light'?: string;
            error: string;
            'error-light'?: string;
        };
        /**
         * Brand palettes (primary/secondary/accent/neutral) with full rung
         * metadata: `on` foreground for accessibility, `css_vars` for
         * stylesheet references, `usage` prose, and concrete `examples`.
         */
        palettes?: Record<string, ColorPaletteSpec>;
        /** Semantic colors with `on` + `usage` for v1.1 consumers. */
        semantic_v2?: Record<string, SemanticColorSpec>;
        /** Light/dark mode chrome colors (background, foreground, surface, border). */
        modes?: {
            light: ColorModeSpec;
            dark: ColorModeSpec;
        };
    };
    /** Typography system */
    typography: {
        display?: FontSpec;
        heading?: FontSpec;
        body?: FontSpec;
        mono?: FontSpec;
        /** Custom font URLs (Google Fonts, etc.) */
        font_urls?: string[];
        /** External font stylesheets (Google Fonts URL, or uploaded WOFF URLs). */
        font_sources?: Array<{
            family: string;
            source: 'google' | 'upload' | 'system';
            url?: string;
            weights?: number[];
            has_italic?: boolean;
        }>;
        /**
         * One-stop CSS @import URL that loads every weight/style this brand
         * uses. The easiest way for a consumer to install the fonts.
         */
        stylesheet_url?: string;
        /**
         * All nine typographic roles with usage prose, CSS variable names,
         * resolved family stacks, and concrete examples of where each
         * role applies.
         */
        roles?: Record<string, FontRoleSpec>;
    };
    /**
     * Logo assets — v1.0 shape unchanged. Values are URLs (or undefined).
     * Shell admin UI reads from this and assumes every value is a string,
     * so v1.1 additions (masters, variants, banned, clearspace) live in
     * `assets` as a sibling top-level field instead.
     */
    logos: {
        wordmark?: string;
        wordmark_dark?: string;
        icon_mark?: string;
        icon_mark_dark?: string;
        favicon?: string;
        social_avatar?: string;
        og_image?: string;
    };
    /**
     * v1.1: typed asset metadata (masters + rendered variants + banned +
     * clearspace). Sibling to `logos` so v1.0 consumers iterating over
     * `Object.entries(spec.logos)` still see only string-valued URLs.
     */
    assets?: {
        /** Master files keyed by slot, each with role + format metadata. */
        masters?: Record<string, LogoMasterSpec>;
        /**
         * Every approved logo render. Each entry has an absolute URL plus
         * its composition × finish × background × format × size_px so an
         * external agent picks the right one by context, not by URL pattern.
         */
        variants?: LogoVariantSpec[];
        /** Minimum padding around each lockup, in role-specific units. */
        clearspace?: Record<string, ClearspaceSpec>;
    };
    /** Brand messaging and voice */
    messaging: {
        tagline?: string;
        elevator_pitch?: string;
        mission?: string;
        boilerplate?: string;
        legal_footer?: string;
        value_props?: Array<{
            headline: string;
            description: string;
        }>;
        tone?: {
            descriptors?: string[];
            avoid?: string[];
            voice_guidelines?: string;
        };
        /** User-defined custom fields */
        custom?: Record<string, CustomField>;
        /** Concrete do/avoid voice examples per context. */
        voice_examples?: Array<{
            context: string;
            do: string;
            avoid: string;
            reason?: string;
        }>;
        /** Audience personas the brand voice targets. */
        audiences?: Array<{
            name: string;
            description: string;
        }>;
    };
    /** Spatial/layout tokens */
    spatial?: {
        radius?: string;
        radius_lg?: string;
        spacing_unit?: string;
        /** Full radius scale with CSS variable references. */
        radius_scale?: Record<string, string>;
        /** Spacing scale with unit + scale array. */
        spacing?: {
            unit: string;
            scale: number[];
            css_vars?: Record<string, string>;
        };
        /** Shadow scale. */
        shadow?: Record<string, string>;
        /** Per-component spatial recommendations. */
        components?: Record<string, ComponentSpatialSpec>;
    };
    /** Gradient definitions */
    gradients?: Record<string, string>;
    /**
     * URLs for consuming this brand. v1.1 makes this the central
     * discovery surface — every consumable resource is reachable from
     * here as an absolute URL, so an external agent given only the
     * spec response can find everything else.
     */
    endpoints?: {
        spec?: string;
        css?: string;
        context?: string;
        tokens?: string;
        brand_guide?: string;
        variant_index?: string;
        font_stylesheet?: string;
        schema?: string;
        changelog?: string;
        preview_card?: string;
    };
}
export interface FontRoleSpec {
    family: string;
    weight: string;
    style: 'normal' | 'italic';
    letter_spacing: string;
    text_transform: string;
    font_size: string;
    /** Resolved CSS font-family stack including system fallbacks. */
    stack: string;
    /** The CSS variable name consumers reference (e.g. '--font-heading'). */
    css_var: string;
    /** Human-readable role label ('Heading (H1–H3)'). */
    label: string;
    /** Where to use this role — full prose. */
    usage: string;
    /** Concrete examples ('button labels', 'form fields'). */
    examples: string[];
    /** True if this role uses a system font stack (no external load). */
    is_system: boolean;
}
export interface LogoMasterSpec {
    url: string;
    role: 'wordmark' | 'icon' | 'favicon' | 'avatar' | 'og';
    format: 'svg' | 'png' | 'ico';
    size_px?: number;
    minimum_size_px?: number;
}
export interface LogoVariantSpec {
    role: 'wordmark' | 'icon' | 'favicon' | 'avatar' | 'og';
    composition: 'wordmark-only' | 'icon-only' | 'stacked' | 'horizontal';
    finish: 'full-color' | 'mono-black' | 'mono-white' | 'mono-brand';
    background: 'transparent' | 'light' | 'dark' | string;
    format: 'svg' | 'png' | 'ico';
    size_px: number | null;
    url: string;
    approved: boolean;
    /** Optional hint about where this variant is most useful. */
    use?: string;
    /** Combined usage prose — when to reach for this specific variant. */
    usage?: string;
    /** Concrete examples ("dark hero banner", "Android home-screen icon"). */
    examples?: string[];
    /** Render contexts this variant is sized + tuned for. */
    recommended_for?: string[];
}
export interface ClearspaceSpec {
    unit: 'x-height' | 'icon-width' | 'px' | 'em';
    multiplier: number;
}
export interface ColorPaletteSpec {
    name: string;
    dark: string;
    main: string;
    bright: string;
    pastel: string;
    faded: string;
    /** Foreground color when text sits on this palette. */
    on?: string;
    css_vars: Record<string, string>;
    usage: string;
    examples: string[];
}
export interface SemanticColorSpec {
    main: string;
    light?: string;
    on?: string;
    css_var: string;
    usage: string;
}
export interface ColorModeSpec {
    background: string;
    foreground: string;
    surface: string;
    border: string;
}
export interface ComponentSpatialSpec {
    radius_ref?: string;
    padding_ref?: number;
    padding_x_ref?: number;
    padding_y_ref?: number;
    gap_ref?: number;
    shadow_ref?: string;
}
export interface ColorGroup {
    slug: string;
    label: string;
    shades: Record<string, string>;
}
export interface FontSpec {
    family: string;
    weight?: string;
    category?: 'serif' | 'sans-serif' | 'monospace' | 'display';
}
export interface CustomField {
    value: string;
    type: 'text' | 'color' | 'url' | 'number' | 'rich_text';
    label: string;
    description?: string;
}
/**
 * Assemble a complete EnsembleBrandSpec from D1 database tokens.
 */
export declare function assembleBrandSpec(db: D1Database, workspaceId: string, baseUrl?: string, 
/**
 * Operator-configured pretty alias path (e.g. 'assets'). When set,
 * canonical /_ensemble/brand/asset/<key> URLs are rewritten to
 * /<aliasPath>/<key>. Stored brand_tokens remain canonical —
 * transforming on read keeps the data layer stable.
 */
assetAliasPath?: string): Promise<EnsembleBrandSpec>;
/**
 * Generate CSS custom properties from a brand spec.
 */
export declare function generateCssFromSpec(spec: EnsembleBrandSpec): string;
/**
 * Generate a human/AI-readable markdown brand context from a spec.
 */
export declare function generateContextFromSpec(spec: EnsembleBrandSpec): string;
/**
 * Import a brand spec into a workspace, merging with existing data.
 * Custom fields in identity and messaging are created automatically.
 */
export declare function importBrandSpec(db: D1Database, workspaceId: string, spec: EnsembleBrandSpec, overwrite?: boolean): Promise<{
    created: number;
    updated: number;
    skipped: number;
}>;
//# sourceMappingURL=spec.d.ts.map