import type { Env } from '../types';
import type { CompositionId, FinishId, LogoPolicy } from './brand-policy';
/**
 * Resolve the wordmark to SVG markup. Returns null when neither
 * upload nor styled-text source is configured.
 *
 * - If `logo_wordmark` token points at an R2-served SVG, fetch + return it.
 * - Otherwise compile `wordmark_text` + wordmark typography tokens to SVG.
 *   Approximate text width from char count × emWidth heuristic; the
 *   resulting viewBox is generous but the rendered text aligns to its
 *   own bounding box thanks to text-anchor / dominant-baseline.
 */
export declare function getWordmarkSvg(env: Env, workspaceId: string): Promise<string | null>;
/**
 * Resolve the icon mark to SVG. Returns null when no SVG icon is set.
 */
export declare function getIconSvg(env: Env, workspaceId: string): Promise<string | null>;
/**
 * Parse an SVG's viewBox into [x, y, width, height]. Defaults to
 * [0, 0, 100, 100] when no viewBox is present.
 */
export declare function parseViewBox(svg: string): [number, number, number, number];
/**
 * Strip the outer <svg> wrapper so the contents can be embedded in
 * a parent SVG (used by composeLockup to nest wordmark + icon).
 */
export declare function svgInner(svg: string): string;
/**
 * Apply a finish to an SVG by rewriting fill values. The finish's
 * fillOverride says what to replace fills WITH:
 *   - null              → no change (full-color)
 *   - hex (e.g. '#000') → replace every fill with this hex
 *   - 'var(--brand-primary)' → resolve to actual brand primary, swap
 *
 * Targets:
 *   - currentColor      → swapped (the canonical theme-aware fill)
 *   - fill="#hex"       → swapped (explicit colors)
 *   - fill="rgb(...)"   → swapped
 *   - class="brand-*"   → swapped via @style block injection
 */
export declare function applyFinish(svg: string, finishId: FinishId, policy: LogoPolicy, brandColors: {
    bgLight: string;
    bgDark: string;
    primary: string;
    secondary?: string;
    accent?: string;
}): string;
/**
 * Wrap the SVG in a background rect. 'transparent' bg returns the
 * SVG unchanged. Hex or var() backgrounds inject a full-bleed rect
 * behind the existing content.
 */
export declare function compositeOnBackground(svg: string, backgroundColor: string): string;
/**
 * Compose icon + wordmark into a stacked or horizontal lockup. The
 * iconScale config controls icon size relative to wordmark height;
 * spacing controls the gap between them (em-relative to wordmark
 * height, NOT viewBox units).
 *
 * Stacked: icon above wordmark, centered. Spacing is the vertical gap.
 * Horizontal: icon left of wordmark, vertically aligned by cap-height.
 *
 * Both inputs must be SVG strings with viewBoxes — getWordmarkSvg
 * and getIconSvg both return valid viewBox-bearing SVGs.
 */
export declare function composeLockup(iconSvg: string, wordmarkSvg: string, composition: CompositionId, config: LogoPolicy['compositions'][CompositionId]): string;
export interface RenderRequest {
    composition: CompositionId;
    finish: FinishId;
    backgroundId: string;
}
export interface RenderContext {
    workspaceId: string;
    env: Env;
    policy: LogoPolicy;
    brandColors: {
        bgLight: string;
        bgDark: string;
        primary: string;
    };
}
/**
 * Render a brand asset variant as an SVG string. Returns null when
 * the requested variant is banned or the source SVGs aren't available.
 */
export declare function renderBrandAsset(req: RenderRequest, ctx: RenderContext): Promise<string | null>;
//# sourceMappingURL=brand-assets.d.ts.map