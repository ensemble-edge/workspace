/**
 * Brand lockup JSX components — extrinsic-sized flex layouts.
 *
 * v0.1.51. The components return Satori-compatible JSX (flexbox only,
 * no viewBox, no Tailwind). Satori reads the explicit width/height
 * on the root container and uses real font metrics from the loaded
 * TTFs to compute glyph positions exactly — replacing the heuristic
 * em-width table in the old composeLockup.
 *
 * Why no className / no shadcn / no Tailwind
 * ──────────────────────────────────────────
 * Satori implements a subset of CSS (no cascade, no class selectors,
 * no media queries — only inline style objects with flexbox + a
 * curated property set). Every style is inline. Components produce
 * "elements" via a hand-written `el()` helper that mirrors React's
 * createElement signature without pulling in React. This keeps the
 * render path zero-runtime-dependency on React DOM.
 *
 * What each function returns
 * ──────────────────────────
 *   composeLockup({...}) → a Satori-renderable element tree
 *   (renderToSvg() in engine.ts turns that tree into SVG bytes.)
 */
import type { CompositionConfig } from '../brand-policy';
interface SatoriElement {
    type: string;
    props: Record<string, unknown> & {
        children?: unknown;
    };
}
/**
 * Canonical wordmark font-size used by every lockup. The icon size
 * is derived as `iconScale * WORDMARK_SIZE_PX` (so iconScale=1.0
 * means "icon visually equal to one em of the wordmark"). Spacing
 * is also in em units — `spacingEm * WORDMARK_SIZE_PX`.
 *
 * Picking a "base" size for the lockup canvas is necessary because
 * Satori requires explicit width/height. Consumers scale the
 * resulting SVG via the <img> width/CSS — Satori's job is to
 * compute the correct *proportions*, not the final display size.
 *
 * 128px is large enough that anti-aliased glyph edges look crisp
 * when scaled DOWN to favicon sizes, and not so large that the
 * intermediate SVG is huge.
 */
declare const WORDMARK_SIZE_PX = 128;
export interface WordmarkSegment {
    text: string;
    color?: string;
}
export interface WordmarkInputs {
    /** When provided, render as styled text (segment array). */
    segments?: WordmarkSegment[];
    /** When provided, render as embedded SVG (uploaded master). */
    svgString?: string;
    /** Resolved CSS font-family for text mode. Picked weight + style
     *  are applied via inline style; Satori uses the font's real
     *  metrics from the loaded FontData. */
    fontFamily?: string;
    fontWeight?: number;
    fontStyle?: 'normal' | 'italic';
    /** em-relative letter-spacing as a number (e.g. -0.02 = -0.02em). */
    letterSpacingEm?: number;
    textTransform?: 'none' | 'uppercase' | 'lowercase';
    /** Applied to every segment that doesn't specify its own color. */
    defaultFill?: string;
}
export interface IconInputs {
    svgString: string;
    /** Width in lockup units. Height derives from the icon's intrinsic
     *  aspect ratio so the icon never distorts. */
    width: number;
}
export type CompositionId = 'wordmark-only' | 'icon-only' | 'stacked' | 'horizontal';
export interface ComposeInputs {
    composition: CompositionId;
    wordmark: WordmarkInputs;
    icon?: IconInputs;
    /** Composition config from policy (iconScale, spacing, etc.). */
    config?: CompositionConfig;
}
/**
 * Build the lockup element tree. Returns a single root <div> with
 * children laid out by flexbox according to the composition.
 *
 * Math
 * ────
 * Icon target width = WORDMARK_SIZE_PX × iconScale (icon "size" is
 * relative to one em of the wordmark, same convention as before).
 *
 * Spacing converts em → px: spacingEm * WORDMARK_SIZE_PX.
 *
 * crossAlign in [-1, 1]: passed through to flexbox align-self via a
 * margin trick — the alignment becomes "where in the cross-axis
 * does the SHORTER element sit." For horizontal: shorter element's
 * vertical position. For stacked: narrower element's horizontal
 * position.
 *
 * For the cross-axis math we use `alignItems: flex-start` on the
 * container and apply `marginTop` (horizontal) / `marginLeft`
 * (stacked) as a fraction of the container slack. This produces
 * the same offset as the legacy slack-fraction math but driven by
 * real Satori-computed dimensions instead of estimated.
 *
 * Actually simpler: we don't know exact element heights/widths at
 * JSX construction time (Satori computes them at render time). So
 * we lean on flexbox: alignItems controls cross-axis. We translate
 * crossAlign into either flex-start / center / flex-end (snap to
 * discrete edges when |crossAlign| ≥ 0.5) OR center + a percentage
 * marginTop on the smaller element.
 *
 * For v0.1.51 we use the discrete snap version — produces 3 clean
 * positions per axis. Smooth offset is a v0.1.52 refinement once
 * we measure that operators want the in-between values.
 */
export declare function composeLockup(inputs: ComposeInputs): SatoriElement;
export interface BackgroundedInputs {
    /** Inner lockup element to wrap. */
    inner: SatoriElement;
    /** Tile background color (resolved hex from brand tokens). */
    tileColor: string;
    /** Outer padding as a fraction of wordmark size (em). */
    paddingEm: number;
}
/**
 * Wrap a composition in a brand-color tile. Flex-centered inside the
 * tile so the lockup is naturally centered both axes regardless of
 * inner dimensions.
 */
export declare function wrapInBackground(inputs: BackgroundedInputs): SatoriElement;
/**
 * Apply a finish color override to the wordmark inputs. Returns a
 * new WordmarkInputs with `defaultFill` set to the override color
 * and per-segment colors removed (mono finishes flatten all
 * segments to one color).
 *
 * For full-color (no override), the inputs pass through unchanged
 * so multi-color wordmarks render with their segment colors intact.
 */
export declare function applyFinishToWordmark(inputs: WordmarkInputs, finishColor: string | null): WordmarkInputs;
/**
 * Apply finish to icon SVG by rewriting fills/strokes. Lifted from
 * brand-assets.ts applyFinish but trimmed to the icon-only case:
 *   - currentColor → swap
 *   - fill="..." → swap
 *   - class="brand-*" → swap via injected <style>
 */
export declare function applyFinishToIconSvg(svg: string, finishColor: string | null): string;
/**
 * Estimate the canvas dimensions for a composition. Satori needs
 * explicit width/height; if we pass too small a value, content
 * clips. Too large is wasteful but renders correctly.
 *
 * Heuristic: 8 × WORDMARK_SIZE_PX wide is enough for ~14 wordmark
 * characters at proportional widths. Tall depends on composition.
 *
 * For v0.1.51 we err generous (12× wide, 4× tall) — wasted pixels
 * are cheap. A future refinement could measure the wordmark string
 * length and dial this down.
 */
export declare function canvasSize(composition: CompositionId): {
    width: number;
    height: number;
};
export { WORDMARK_SIZE_PX };
export type { SatoriElement };
//# sourceMappingURL=lockup.d.ts.map