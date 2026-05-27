import { type BrandColorsDoc, type Theme, type ThemeBindings } from './schema';
/**
 * Per-binding warning. Returned alongside the generated theme so
 * the UI can render warning icons next to the bindings that
 * couldn't preserve their light-theme contrast within the gap
 * threshold.
 */
export interface BindingWarning {
    binding: keyof ThemeBindings;
    /** APCA Lc against the light canvas — signed (positive when text
     *  darker than canvas, negative when lighter). */
    lightRatio: number;
    /** APCA Lc against the dark canvas — best the algorithm achieved
     *  for this palette/role. */
    darkRatio: number;
    /** Absolute Lc gap (|actual − target| in APCA units). */
    gap: number;
}
export interface GenerateResult {
    theme: Theme;
    warnings: BindingWarning[];
}
/**
 * Generate a Dark theme from the current document's Light theme +
 * resolved palettes.
 *
 * Deterministic — same inputs always produce the same outputs.
 */
export declare function generateDarkTheme(doc: BrandColorsDoc): GenerateResult;
/**
 * Pick a foreground hex for an arbitrary canvas. Convenience for
 * the Logo Builder's freeform-hex background path — if an operator
 * picks #BD0FFF as a context, we APCA-pick black or near-white
 * with hue bias to match.
 *
 * Exported because the logo renderer needs the same logic.
 */
export declare function autoForeground(canvasHex: string): string;
/**
 * Generate a Light theme from a Dark theme. Symmetric to the
 * forward direction — flip the canvas, preserve contrast for
 * brand bindings, preserve "auto" for foregrounds. Provided for
 * completeness; the UI only exposes the forward direction.
 */
export declare function generateLightFromDark(doc: BrandColorsDoc): GenerateResult | null;
//# sourceMappingURL=generate-dark.d.ts.map