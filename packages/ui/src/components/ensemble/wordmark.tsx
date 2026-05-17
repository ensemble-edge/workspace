import * as React from "react";
import { cn } from "../../lib/utils";

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
}

export const Wordmark = React.forwardRef<HTMLSpanElement, WordmarkProps>(
  ({ segments, imageUrl, name, alt, imageHeight = 32, className, ...rest }, ref) => {
    // Segments win when present.
    if (segments && segments.length > 0) {
      // v0.1.17: read --font-wordmark CSS variables (with display
      // fallback baked in) so the wordmark renders in the operator's
      // chosen typeface, weight, and style. When the operator hasn't
      // configured wordmark typography, --font-wordmark falls back to
      // --font-display via the brand CSS layer.
      const wrapStyle: React.CSSProperties = {
        fontFamily: "var(--font-wordmark, var(--font-display, inherit))",
        fontWeight: "var(--font-wordmark-weight, var(--font-display-weight, 700))" as React.CSSProperties["fontWeight"],
        fontStyle: "var(--font-wordmark-style, normal)",
        letterSpacing: "var(--font-wordmark-letter-spacing, var(--font-display-letter-spacing, normal))",
      };
      return (
        <span
          ref={ref}
          className={cn("inline-flex items-baseline", className)}
          style={wrapStyle}
          aria-label={name}
          {...rest}
        >
          {segments.map((s, i) => (
            <span key={i} style={s.color ? { color: s.color } : undefined}>
              {s.text}
            </span>
          ))}
        </span>
      );
    }

    if (imageUrl) {
      return (
        <span
          ref={ref}
          className={cn("inline-flex items-center", className)}
          {...rest}
        >
          <img
            src={imageUrl}
            alt={alt ?? name}
            style={{ maxHeight: `${imageHeight}px`, maxWidth: "100%", display: "block" }}
          />
        </span>
      );
    }

    return (
      <span
        ref={ref}
        className={cn("inline-flex items-baseline font-semibold tracking-tight", className)}
        {...rest}
      >
        {name}
      </span>
    );
  },
);
Wordmark.displayName = "Wordmark";
