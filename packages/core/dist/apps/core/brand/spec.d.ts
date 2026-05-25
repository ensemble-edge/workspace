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
    /** Format version — tools check this to know how to parse */
    ensemble_brand: '1.0';
    /** When this spec was last modified */
    updated_at: string;
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
        /** Named color groups (e.g., "Slate", "Gold", "Vermillion") */
        groups: ColorGroup[];
        /** Semantic colors for UI states */
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
    };
    /** Typography system */
    typography: {
        display?: FontSpec;
        heading?: FontSpec;
        body?: FontSpec;
        mono?: FontSpec;
        /** Custom font URLs (Google Fonts, etc.) */
        font_urls?: string[];
    };
    /** Logo assets */
    logos: {
        wordmark?: string;
        wordmark_dark?: string;
        icon_mark?: string;
        icon_mark_dark?: string;
        favicon?: string;
        social_avatar?: string;
        og_image?: string;
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
    };
    /** Spatial/layout tokens */
    spatial?: {
        radius?: string;
        radius_lg?: string;
        spacing_unit?: string;
    };
    /** Gradient definitions */
    gradients?: Record<string, string>;
    /** URLs for consuming this brand */
    endpoints?: {
        spec?: string;
        css?: string;
        context?: string;
        tokens?: string;
    };
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