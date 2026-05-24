/**
 * Brand colors — typed schema for the v0.1.55 redesign.
 *
 * Replaces the sprawling category='colors' tokens with a structured
 * model: 3 brand palettes + 1 neutral palette + named gradients +
 * light/dark themes + semantic state colors.
 *
 * Storage model
 * ─────────────
 * Stored as ONE JSON blob in brand_tokens under category='colors',
 * key='brand_colors_v1'. Single-document write means atomic saves
 * and trivial migrations between schema versions. Older sparse
 * tokens (brand-primary, brand-background-light, etc.) are NOT
 * read at all — per operator decision (Q1) we accept a one-time
 * reset on the single installed workspace.
 *
 * The brand-css endpoint and render pipeline read THIS shape via
 * load.ts → resolver.ts and emit the CSS variables + resolved hex
 * values downstream consumers expect.
 *
 * Token references
 * ────────────────
 * Theme bindings and gradient stops can be either:
 *   - a palette-rung reference string like "primary-main" or
 *     "neutral-faded" or "secondary-bright"
 *   - a literal hex string like "#FAF8F4"
 *   - the special string "auto" (only valid for theme.text-primary
 *     and text-muted; means APCA-pick at render time)
 *
 * Detection: anything matching /^(primary|secondary|accent|neutral)-
 * (dark|main|bright|pastel|faded)$/ is a rung reference; anything
 * starting with '#' is a hex; "auto" is literal.
 */
/** Five rungs per palette — operator types Main, four derive in OkLCh. */
export type RungName = 'dark' | 'main' | 'bright' | 'pastel' | 'faded';
/** Stable code slots for the three brand palettes + neutral. Operator
 *  can RENAME (display alias) but cannot add a fourth role. */
export type PaletteRole = 'primary' | 'secondary' | 'accent' | 'neutral';
/** Palette-rung reference like "primary-main". The fully-qualified
 *  identifier used in CSS (--primary-main) and in theme bindings /
 *  gradient stops. */
export type PaletteRungRef = `primary-${RungName}` | `secondary-${RungName}` | `accent-${RungName}` | `neutral-${RungName}`;
/** A theme-binding value: a palette-rung ref, a literal hex, or
 *  "auto" (text-primary/text-muted only — APCA-pick at render). */
export type ThemeBindingValue = PaletteRungRef | string;
/** A gradient stop value: rung ref OR the two system tokens. Hex
 *  is NOT allowed in gradient stops by spec — token-only. */
export type GradientStopValue = PaletteRungRef | 'white' | 'black';
export interface Palette {
    /** Operator-facing display name like "Ownly Coral" or "Sandstone". */
    name: string;
    /** Operator-typed Main hex (no '#' optional; canonicalized on save). */
    main: string;
    /**
     * Optional per-rung overrides. Keys are rung names; values are
     * literal hex. Missing keys derive from `main` via the OkLCh
     * offsets in derive.ts. Present keys take priority — the
     * operator's "inspect" affordance writes here.
     */
    overrides?: Partial<Record<Exclude<RungName, 'main'>, string>>;
}
/** Neutral has the same shape as a brand palette PLUS a hue mode.
 *
 *   'branded' → derive Main from primary's hue + low chroma
 *   'warm'    → fixed amber/sand hue
 *   'cool'    → fixed blue-grey hue
 *   'true'    → pure achromatic
 *   'custom'  → operator's typed `main` hex used directly
 *
 * For 'branded'/'warm'/'cool'/'true', Main is computed at resolve
 * time and the stored `main` field is ignored. For 'custom', the
 * stored `main` field is used as-is — operator typed it.
 */
export interface NeutralPalette extends Palette {
    hueMode: 'branded' | 'warm' | 'cool' | 'true' | 'custom';
}
export type GradientAngle = 0 | 45 | 90 | 135 | 180;
export type GradientMode = 'linear' | 'radial';
export interface Gradient {
    /** Stable slug derived from name at save time; used in CSS var
     *  (--gradient-sunrise) and code references. */
    slug: string;
    /** Operator-facing display name like "Sunrise". */
    name: string;
    /** 2..4 stops, in order. */
    stops: GradientStopValue[];
    /** Direction. Radial mode ignores angle. */
    mode: GradientMode;
    /** One of the five preset angles. Ignored when mode === 'radial'. */
    angle: GradientAngle;
}
/** Seven role-named token slots per theme — see spec §2.
 *  All slots accept palette-rung refs OR literal hex.
 *  text-primary and text-muted additionally accept "auto". */
export interface ThemeBindings {
    canvas: ThemeBindingValue;
    surface: ThemeBindingValue;
    'text-primary': ThemeBindingValue;
    'text-muted': ThemeBindingValue;
    brand: ThemeBindingValue;
    'brand-bg': ThemeBindingValue;
    border: ThemeBindingValue;
}
export interface Theme {
    bindings: ThemeBindings;
}
export interface SemanticPair {
    main: string;
    light: string;
}
export interface SemanticColors {
    success: SemanticPair;
    info: SemanticPair;
    warning: SemanticPair;
    error: SemanticPair;
}
export interface BrandColorsDoc {
    version: 1;
    palettes: {
        primary: Palette;
        secondary: Palette;
        accent: Palette;
        neutral: NeutralPalette;
    };
    /** Gradients in operator-defined order. Hard-capped at 5. */
    gradients: Gradient[];
    themes: {
        light: Theme;
        /** Dark is OPTIONAL. When undefined, dark-bg logo lockups don't
         *  render — variants matrix shows "Add a dark theme" placeholder. */
        dark?: Theme;
    };
    semantic: SemanticColors;
}
export declare function defaultBrandColors(): BrandColorsDoc;
export declare function isPaletteRungRef(value: string): value is PaletteRungRef;
export declare function isHex(value: string): boolean;
export declare function parseRungRef(ref: string): {
    role: PaletteRole;
    rung: RungName;
} | null;
//# sourceMappingURL=schema.d.ts.map