/**
 * Brand asset render orchestrator.
 *
 * v0.1.51. Replaces the old `renderBrandAsset` in brand-assets.ts.
 * This is the single entry point for "give me the SVG (or PNG) for
 * `<slug>-<comp>-<finish>-<bg>[.<ext>]`".
 *
 * Pipeline
 * ────────
 *   1. Load policy + brand tokens + brand colors (D1).
 *   2. Resolve source SVGs (wordmark + icon) via brand-assets-src.
 *   3. Build the cache key (snapshot of inputs that affect output).
 *   4. getOrGenerate(): three-tier cache; on miss, produce:
 *      a. Load required fonts (R2 + Cache API). Install if missing.
 *      b. Apply finish to wordmark inputs + icon SVG.
 *      c. composeLockup() → JSX element tree.
 *      d. If backgrounded, wrapInBackground().
 *      e. Satori → SVG. (Or PNG via resvg.)
 *   5. Return Response with cache-friendly headers.
 *
 * The URL grammar (`-bg-` prefix for backgrounded variants, etc.)
 * is parsed in routes/credentials.ts before this is called — by the
 * time we're here, every input is already a typed CompositionId /
 * FinishId / etc.
 */
import type { Env } from '../../types';
import { type CompositionId, type FinishId } from '../brand-policy';
export interface RenderRequest {
    workspaceId: string;
    workspaceSlug: string;
    env: Env;
    composition: CompositionId;
    finish: FinishId;
    backgroundId: string;
    /** When true, wrap in brand-background tile. */
    backgrounded?: boolean;
    /** Output format. Default 'svg'. */
    format?: 'svg' | 'png';
    /**
     * v0.1.53: when set, override the canvas/render dimensions to a
     * specific pixel size. Used by the favicon suite endpoints which
     * need the icon rendered at exactly 32/180/192/512px regardless
     * of the default composition canvas. Square output — width and
     * height both set to this value, content centered.
     */
    faviconSize?: number;
    /**
     * Live-preview overrides (Logos editor). When present, bypass the
     * pair-allowed check and force composition.allowed=true so the
     * operator can preview an as-yet-banned composition.
     */
    overrides?: Partial<{
        iconScale: number;
        spacing: number;
        iconSide: 'left' | 'right';
        iconPosition: 'top' | 'bottom';
        crossAlign: number;
        backgroundedPadding: number;
        /** v0.1.63: live-preview tile color overrides. */
        lightTile: string;
        darkTile: string;
    }>;
}
export interface RenderResult {
    body: ArrayBuffer;
    contentType: string;
    /** True when overrides forced the render — caller should disable cache. */
    editorial: boolean;
}
export declare function renderBrandAssetV2(req: RenderRequest): Promise<RenderResult | null>;
//# sourceMappingURL=render.d.ts.map