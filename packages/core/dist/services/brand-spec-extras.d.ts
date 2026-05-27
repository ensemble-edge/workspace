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
import type { FontRole } from './font-roles';
/**
 * Per-role concrete examples ("where would I see this in a UI?").
 * The `usage` prose comes from ROLE_USAGE in font-roles.ts; this
 * adds the where-do-I-use-it list that ROLE_USAGE doesn't carry.
 */
export declare const ROLE_EXAMPLES: Record<FontRole, string[]>;
export type PaletteRole = 'primary' | 'secondary' | 'accent' | 'neutral';
export declare const PALETTE_USAGE: Record<PaletteRole, {
    usage: string;
    examples: string[];
}>;
export type SemanticRole = 'success' | 'info' | 'warning' | 'error';
export declare const SEMANTIC_USAGE: Record<SemanticRole, string>;
/**
 * Default radius scale (rem). Operators can override any rung via
 * brand_tokens (category='spatial', key='radius_<rung>'). The default
 * matches common shadcn defaults so guest apps that already use shadcn
 * primitives feel native.
 */
export declare const DEFAULT_RADIUS: Record<'sm' | 'md' | 'lg' | 'xl' | 'full', string>;
export declare const DEFAULT_SHADOW: Record<'sm' | 'md' | 'lg' | 'xl', string>;
/**
 * Per-component spatial recommendations. The agent reads `components.button`
 * and applies `radius_ref: 'md'` + `padding_x_ref: 4` (= 4 × spacing_unit)
 * to render a button visually consistent with the workspace shell.
 */
export declare const COMPONENT_DEFAULTS: {
    button: {
        radius_ref: "md";
        padding_x_ref: number;
        padding_y_ref: number;
        gap_ref: number;
    };
    card: {
        radius_ref: "lg";
        padding_ref: number;
        shadow_ref: "sm";
    };
    input: {
        radius_ref: "md";
        padding_x_ref: number;
        padding_y_ref: number;
    };
    modal: {
        radius_ref: "xl";
        padding_ref: number;
        shadow_ref: "xl";
    };
    badge: {
        radius_ref: "sm";
        padding_x_ref: number;
        padding_y_ref: number;
    };
};
export type CompositionId = 'wordmark-only' | 'icon-only' | 'stacked' | 'horizontal';
export type FinishId = 'full-color' | 'mono-black' | 'mono-white' | 'mono-brand';
export type BackgroundId = 'transparent' | 'light' | 'dark' | 'true-white' | 'true-black' | 'brand-primary';
/** Per-composition guidance — applies regardless of finish/background. */
export declare const COMPOSITION_USAGE: Record<CompositionId, {
    usage: string;
    examples: string[];
}>;
/** Per-finish guidance — what visual treatment, what to use it for. */
export declare const FINISH_USAGE: Record<FinishId, {
    usage: string;
    examples: string[];
}>;
/** Per-background guidance — what the variant is sized to sit on. */
export declare const BACKGROUND_USAGE: Record<BackgroundId, {
    usage: string;
    examples: string[];
}>;
/**
 * Per-format guidance — when to reach for SVG vs PNG vs ICO.
 * Format choice usually follows the target rendering surface; this
 * layer codifies "when to pick which file."
 */
export declare const FORMAT_USAGE: Record<string, string>;
/**
 * Where to use a variant by `use` hint (set by the assembler on
 * favicon-class entries). Lets an Android manifest builder pick the
 * right entry without parsing dimensions.
 */
export declare const USE_HINT_GUIDANCE: Record<string, string>;
/**
 * How much breathing room to leave around each logo role.
 *   wordmark: 1.0 × x-height (the height of a lowercase 'x' in the
 *             wordmark — a typographic convention for logo clearspace)
 *   icon_mark: 0.25 × icon-width
 *
 * Operators can override via brand_tokens later (no UI in v0.1.89;
 * populate via JSON spec import).
 */
export declare const DEFAULT_CLEARSPACE: {
    wordmark: {
        unit: "x-height";
        multiplier: number;
    };
    icon_mark: {
        unit: "icon-width";
        multiplier: number;
    };
};
/**
 * The four "chrome" colors per mode — what the agent uses to paint
 * page backgrounds, body text, surfaces, and borders consistent with
 * the workspace. These are NOT brand colors; they're the neutral
 * frame around brand colors. The actual values come from
 * brand_tokens at category='colors', keys='brand-background-light',
 * 'brand-foreground-light', etc. — these constants are fallbacks
 * only.
 */
export declare const DEFAULT_MODES: {
    light: {
        background: string;
        foreground: string;
        surface: string;
        border: string;
    };
    dark: {
        background: string;
        foreground: string;
        surface: string;
        border: string;
    };
};
export interface SpecInstruction {
    id: string;
    rule: string;
    why: string;
}
export interface SpecInstructions {
    summary: string;
    rules: SpecInstruction[];
    anti_patterns: string[];
    for_ai_agents: string;
}
/**
 * Default instructions baked into every spec response. Operator-
 * editable extensions land later via a future admin field.
 */
export declare const BRAND_SPEC_INSTRUCTIONS: SpecInstructions;
/**
 * JSON Schema (Draft 2020-12) describing the v1.1 brand spec response.
 * Served at /_ensemble/brand/spec/schema.json so external tools can
 * validate spec responses or generate typed bindings.
 *
 * Kept intentionally permissive (additionalProperties: true) so future
 * fields don't invalidate older consumers.
 */
export declare const BRAND_SPEC_SCHEMA: {
    readonly $schema: "https://json-schema.org/draft/2020-12/schema";
    readonly $id: "https://ensemble-edge.com/schemas/brand-spec-1.1.json";
    readonly title: "EnsembleBrandSpec";
    readonly description: "Canonical brand spec format. One source of truth, multiple renderings.";
    readonly type: "object";
    readonly required: readonly ["ensemble_brand", "updated_at", "identity", "colors", "typography", "logos", "messaging"];
    readonly properties: {
        readonly ensemble_brand: {
            readonly type: "string";
            readonly const: "1.1";
        };
        readonly schema_version: {
            readonly type: "string";
        };
        readonly spec_url: {
            readonly type: "string";
            readonly format: "uri";
        };
        readonly workspace: {
            readonly type: "object";
            readonly properties: {
                readonly id: {
                    readonly type: "string";
                };
                readonly slug: {
                    readonly type: "string";
                };
                readonly display_name: {
                    readonly type: "string";
                };
                readonly public_url: {
                    readonly type: "string";
                    readonly format: "uri";
                };
            };
        };
        readonly updated_at: {
            readonly type: "string";
            readonly format: "date-time";
        };
        readonly generated_at: {
            readonly type: "string";
            readonly format: "date-time";
        };
        readonly etag: {
            readonly type: "string";
        };
        readonly license: {
            readonly type: "object";
            readonly properties: {
                readonly type: {
                    readonly type: readonly ["string", "null"];
                };
                readonly usage_restrictions: {
                    readonly type: "string";
                };
            };
        };
        readonly identity: {
            readonly type: "object";
        };
        readonly colors: {
            readonly type: "object";
            readonly properties: {
                readonly palettes: {
                    readonly type: "object";
                };
                readonly semantic: {
                    readonly type: "object";
                };
                readonly gradients: {
                    readonly type: "array";
                };
                readonly modes: {
                    readonly type: "object";
                };
                readonly groups: {
                    readonly type: "array";
                };
            };
        };
        readonly typography: {
            readonly type: "object";
            readonly properties: {
                readonly font_sources: {
                    readonly type: "array";
                };
                readonly stylesheet_url: {
                    readonly type: "string";
                    readonly format: "uri";
                };
                readonly roles: {
                    readonly type: "object";
                };
            };
        };
        readonly logos: {
            readonly type: "object";
            readonly properties: {
                readonly masters: {
                    readonly type: "object";
                };
                readonly variants: {
                    readonly type: "array";
                };
                readonly banned: {
                    readonly type: "array";
                };
                readonly clearspace: {
                    readonly type: "object";
                };
            };
        };
        readonly messaging: {
            readonly type: "object";
            readonly properties: {
                readonly tagline: {
                    readonly type: "string";
                };
                readonly elevator_pitch: {
                    readonly type: "string";
                };
                readonly mission: {
                    readonly type: "string";
                };
                readonly tone: {
                    readonly type: "object";
                };
                readonly voice_examples: {
                    readonly type: "array";
                };
                readonly audiences: {
                    readonly type: "array";
                };
            };
        };
        readonly spatial: {
            readonly type: "object";
        };
        readonly gradients: {
            readonly type: "object";
        };
        readonly endpoints: {
            readonly type: "object";
            readonly description: "Every consumable URL the agent might need. Absolute strings, no pattern-guessing.";
            readonly properties: {
                readonly spec: {
                    readonly type: "string";
                    readonly format: "uri";
                };
                readonly css: {
                    readonly type: "string";
                    readonly format: "uri";
                };
                readonly context: {
                    readonly type: "string";
                    readonly format: "uri";
                };
                readonly tokens: {
                    readonly type: "string";
                    readonly format: "uri";
                };
                readonly brand_guide: {
                    readonly type: "string";
                    readonly format: "uri";
                };
                readonly variant_index: {
                    readonly type: "string";
                    readonly format: "uri";
                };
                readonly font_stylesheet: {
                    readonly type: "string";
                    readonly format: "uri";
                };
                readonly schema: {
                    readonly type: "string";
                    readonly format: "uri";
                };
                readonly changelog: {
                    readonly type: "string";
                    readonly format: "uri";
                };
                readonly preview_card: {
                    readonly type: "string";
                    readonly format: "uri";
                };
            };
        };
    };
    readonly additionalProperties: true;
};
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
export declare const SPEC_PRESETS: Record<string, string[]>;
//# sourceMappingURL=brand-spec-extras.d.ts.map