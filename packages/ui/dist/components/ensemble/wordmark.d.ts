import * as React from "react";
/**
 * Wordmark — render the workspace's brand wordmark.
 *
 * Operators configure the wordmark in Brand → Logos → Wordmark, picking
 * either "Styled text" (segments with per-segment colors) or "Image"
 * (uploaded raster/SVG). This component renders the right thing based
 * on the data it receives. Fallback chain:
 *
 *   1. segments (styled-text mode)
 *   2. imageUrl (raster/SVG image mode)
 *   3. plain workspace name as text
 *
 * Used by: Brand admin overview hero, sidebar logo, login screen,
 * email template headers (via the server-rendered helper).
 *
 * Pass either `segments` (parsed from `wordmark_text`) or `imageUrl`
 * (resolved from `logo_wordmark*`) — or both, in which case segments win.
 * If neither is set, falls back to rendering `name`.
 */
export interface WordmarkSegment {
    text: string;
    color?: string;
}
export interface WordmarkProps extends React.HTMLAttributes<HTMLSpanElement> {
    /** Styled-text segments. Highest precedence. */
    segments?: ReadonlyArray<WordmarkSegment>;
    /** Image URL (raster or SVG). Used when segments are absent. */
    imageUrl?: string | null;
    /** Plain workspace name. Used as text fallback. */
    name: string;
    /** Optional alt text override for image mode. Defaults to `name`. */
    alt?: string;
    /** Max-height for the rendered image, in pixels. */
    imageHeight?: number;
    /**
     * v0.1.59: hex color of the surface this wordmark sits on. When
     * provided, segment colors that fail APCA contrast (|Lc| < 45)
     * against this surface fall back to a high-contrast near-white
     * or near-black per segment. This is what fixes the
     * coral-wordmark-on-teal-sidebar contrast problem — the consumer
     * (e.g. AppSidebar) passes the sidebar bg, and segments that
     * would be illegible get auto-corrected.
     *
     * When omitted, segment colors render exactly as the operator
     * configured them — that's the right default for the workspace
     * canvas where the operator's choices are intentional.
     */
    surfaceColor?: string;
}
export declare const Wordmark: React.ForwardRefExoticComponent<WordmarkProps & React.RefAttributes<HTMLSpanElement>>;
//# sourceMappingURL=wordmark.d.ts.map