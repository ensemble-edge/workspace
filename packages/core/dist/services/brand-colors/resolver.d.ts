import { type BrandColorsDoc, type PaletteRole, type PaletteRungRef, type RungName, type ThemeBindingValue, type GradientStopValue } from './schema';
/**
 * Resolve every rung of every palette to a concrete hex. This is
 * the foundational lookup — once you have the resolved palettes,
 * everything else (themes, gradients, on-color foregrounds) is a
 * second-pass lookup against this map.
 *
 * Operator overrides take priority: a Pastel hex the operator
 * explicitly tuned via the inspect affordance wins over the
 * OkLCh-derived value.
 */
export type ResolvedPalette = Record<RungName, string>;
export type ResolvedPalettes = Record<PaletteRole, ResolvedPalette>;
export declare function resolvePalettes(doc: BrandColorsDoc): ResolvedPalettes;
/**
 * Resolve a stored theme-binding value to a hex. Accepts:
 *   - A palette-rung ref like "primary-main" → look up resolved palettes
 *   - A literal hex like "#FAF8F4" → return as-is (normalized)
 *   - The string "auto" with `autoContext` → APCA-pick foreground vs canvas
 *
 * For "auto", the caller passes the canvas hex (the surface the
 * foreground will sit on) and we return a hue-biased near-white
 * or near-black based on which has higher contrast.
 */
export declare function resolveBindingValue(value: ThemeBindingValue, palettes: ResolvedPalettes, autoContext?: {
    against: string;
}): string;
/**
 * Resolve a gradient stop value. Same as binding but with the two
 * extra system tokens 'white' and 'black' (per spec, gradient stops
 * do NOT accept arbitrary hex — token-only).
 */
export declare function resolveStopValue(value: GradientStopValue, palettes: ResolvedPalettes): string;
/**
 * Given a stored value, return what the UI should display:
 *   - If it's a rung ref, the ref string ("primary-main")
 *   - If it's a hex AND it happens to exactly equal a rung's resolved
 *     hex, the rung ref (token reference takes display priority)
 *   - Otherwise the hex string
 *
 * The strict-equality branch handles the case where the operator
 * pastes a hex that happens to match a rung — we prefer the
 * semantically richer label. Per Q4 the primary case is reference-
 * resolution (the value WAS stored as a ref); equality is a bonus.
 */
export declare function displayLabel(value: string, palettes: ResolvedPalettes): {
    label: string;
    isToken: boolean;
    hex: string;
};
/**
 * Reverse lookup: given a hex, find the palette rung whose resolved
 * hex matches (case-insensitive). Used by displayLabel to upgrade
 * literal-hex storage to its token label when there's a match.
 */
export declare function findRungByHex(hex: string, palettes: ResolvedPalettes): PaletteRungRef | null;
export interface ResolvedTheme {
    canvas: string;
    surface: string;
    'text-primary': string;
    'text-muted': string;
    brand: string;
    'brand-bg': string;
    border: string;
}
/**
 * Resolve every binding of a theme to a hex. "auto" values are
 * resolved against the canvas (which itself is resolved first,
 * since text-primary/text-muted may depend on it).
 *
 * When the theme is undefined (no dark theme configured), returns
 * null. Consumers branch on null and skip dark-bg variants.
 */
export declare function resolveTheme(bindings: BrandColorsDoc['themes']['light']['bindings'], palettes: ResolvedPalettes): ResolvedTheme;
/**
 * Pick the right foreground color for text on a palette Main face.
 * Default rule: that palette's own Faded rung. Fallback: if Faded
 * has APCA contrast < 60 against Main, use APCA-max white or black.
 *
 * Returns both the hex and a flag indicating fallback was used —
 * the BrandCard can surface a warning in edit mode when the
 * fallback triggers, signaling "your Faded rung needs adjustment."
 */
export declare function onColorForeground(paletteRole: PaletteRole, palettes: ResolvedPalettes): {
    hex: string;
    usedFallback: boolean;
};
/**
 * Compute the on-color foreground for a gradient banner. Uses the
 * Faded rung of the FIRST stop's parent palette (when the stop is
 * a palette rung ref). If the first stop is white/black, falls
 * back to APCA-max-contrast against the midpoint of the gradient.
 */
export declare function gradientOnColor(firstStop: GradientStopValue, midColor: string, palettes: ResolvedPalettes): {
    hex: string;
    usedFallback: boolean;
};
//# sourceMappingURL=resolver.d.ts.map