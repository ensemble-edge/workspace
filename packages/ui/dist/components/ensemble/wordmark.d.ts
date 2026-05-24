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
    /** Text content of this segment. */
    text: string;
    /**
     * v0.1.60: color reference. Can be:
     *   - Literal hex: "#137774"
     *   - Palette rung ref: "primary-main", "neutral-faded"
     *   - Gradient ref: "gradient-sunrise" (rendered via background-clip:text)
     * Resolved via the optional `palettes`/`gradients` props on Wordmark.
     * When unresolvable (no palettes/gradients passed or unknown ref),
     * falls through to undefined (inherits parent color).
     */
    color?: string;
}
/** Palette type used by Wordmark for resolving rung refs. */
export interface WordmarkResolvedPalettes {
    primary: Record<'dark' | 'main' | 'bright' | 'pastel' | 'faded', string>;
    secondary: Record<'dark' | 'main' | 'bright' | 'pastel' | 'faded', string>;
    accent: Record<'dark' | 'main' | 'bright' | 'pastel' | 'faded', string>;
    neutral: Record<'dark' | 'main' | 'bright' | 'pastel' | 'faded', string>;
}
/** v0.1.60: gradient definitions for segment color resolution. */
export interface WordmarkGradient {
    slug: string;
    /** Resolved CSS gradient string ("linear-gradient(...)" or "radial-gradient(...)"). */
    css: string;
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
     * or near-black per segment.
     */
    surfaceColor?: string;
    /**
     * v0.1.60: resolved palettes for palette-rung-ref segments
     * ("primary-main" etc.). When unset, palette refs in segments
     * render as if uncolored (segment falls back to inherit). Pass
     * this whenever any segment color might be a palette ref.
     */
    palettes?: WordmarkResolvedPalettes;
    /**
     * v0.1.60: gradient defs for gradient-ref segments
     * ("gradient-sunrise"). When a segment color is a gradient ref,
     * we apply background-clip:text technique to render the gradient
     * on the text. When unset, gradient refs render as inherited
     * color.
     */
    gradients?: ReadonlyArray<WordmarkGradient>;
}
export declare const Wordmark: React.ForwardRefExoticComponent<WordmarkProps & React.RefAttributes<HTMLSpanElement>>;
//# sourceMappingURL=wordmark.d.ts.map