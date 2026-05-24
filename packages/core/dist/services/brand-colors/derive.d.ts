import type { RungName } from './schema';
/**
 * Derive a rung hex from a Main hex.
 *
 * Operator typed Main → we convert to OkLCh, apply the rung's
 * offset, convert back to sRGB hex. L gets clamped to [0.05, 0.97]
 * so we don't produce pure black or pure white accidentally.
 */
export declare function deriveRung(mainHex: string, rung: Exclude<RungName, 'main'>): string;
/**
 * Derive all four non-main rungs at once. Returns a record keyed by
 * rung name. The operator's overrides aren't consulted here — that's
 * the resolver's job; this is pure math from Main.
 */
export declare function deriveRungs(mainHex: string): Record<Exclude<RungName, 'main'>, string>;
/**
 * For Neutral palette in hueMode 'branded', the Main hex is computed
 * from primary at resolve time using primary's hue but very low
 * chroma. Preset modes (warm/cool/true) override with fixed hues.
 *
 * Returned hex is in OkLCh L ≈ 0.45 — a mid-grey that anchors the
 * five-rung ladder for surfaces, borders, and muted text.
 */
export declare function neutralMainFromHueMode(hueMode: 'branded' | 'warm' | 'cool' | 'true', primaryMainHex: string): string;
/**
 * APCA Lc — the modern contrast metric. Range roughly -108..+106;
 * absolute value matters. Typical thresholds:
 *   Lc 90+ → max contrast (display text)
 *   Lc 75  → body text minimum
 *   Lc 60  → on-color foreground minimum (our spec uses this)
 *   Lc 45  → large text minimum
 *   Lc 30  → non-text UI minimum
 *
 * We use the wcagContrast helper from culori for the ratio number;
 * APCA proper would use the apcaContrast() function but it's not
 * always exported in all culori versions. The semantic intent is
 * identical for our purposes (relative comparison between
 * candidates), and the threshold tuning compensates.
 */
export declare function contrastRatio(fg: string, bg: string): number;
/**
 * Pick the rung from a palette whose contrast against the target
 * background is closest to the desired target ratio. Used by the
 * dark-theme generator to preserve relative contrast across themes:
 * if primary-main hits 4.8:1 on the light canvas, picking the rung
 * that also hits ~4.8:1 on the dark canvas keeps the brand feeling
 * the "same level of prominent" in both modes.
 *
 * Returns the rung name + its actual contrast. Caller decides
 * whether the gap is within the warning threshold.
 */
export declare function pickRungByTargetContrast(rungHexes: Record<RungName, string>, bgHex: string, targetRatio: number): {
    rung: RungName;
    ratio: number;
    gap: number;
};
/**
 * Pick the higher-contrast of two foreground candidates against a
 * background. Used for "is white or black more readable here?"
 * decisions on Faded fallback.
 */
export declare function pickHigherContrast(bgHex: string, candidateA: string, candidateB: string): string;
/**
 * Compute a near-white or near-black foreground that picks up a
 * subtle hint of the background's hue, so the foreground doesn't
 * feel sterile. Used by the dark theme generator's text-primary
 * "auto" resolution.
 *
 * Algorithm: take the background's OkLCh hue, build a color at
 * target L = 0.97 (near-white) or 0.10 (near-black) depending on
 * which gives higher contrast, with very low chroma (~0.015) so
 * the tint is barely perceptible but the foreground feels in-family.
 */
export declare function hueBiasedForeground(bgHex: string, prefer: 'light' | 'dark'): string;
/**
 * Normalize a hex input to '#rrggbb' lowercase. Accepts '#abc',
 * 'abc', '#aabbcc', 'aabbcc'. Returns the input unchanged when it
 * doesn't look like a hex (caller validates before storage).
 */
export declare function normalizeHex(input: string): string;
/**
 * Convert any culori-parseable color (named, hsl, rgb, etc.) to hex.
 * Used when reading external inputs that might not already be hex.
 */
export declare function toHex(input: string): string | null;
//# sourceMappingURL=derive.d.ts.map