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

/* APCA-W3 contrast helpers (kept local — copying ~30 lines is
 * cheaper than pulling a UI-package dep into the brand-colors
 * service. Same algorithm as services/brand-colors/derive.ts.) */

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

function apcaY(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const Y = 0.2126729 * Math.pow(rgb.r, 2.4) + 0.7151522 * Math.pow(rgb.g, 2.4) + 0.0721750 * Math.pow(rgb.b, 2.4);
  return Y < 0.022 ? Y + Math.pow(0.022 - Y, 1.414) : Y;
}

function apcaLc(textHex: string, bgHex: string): number {
  const Ytxt = apcaY(textHex);
  const Ybg = apcaY(bgHex);
  if (Math.abs(Ytxt - Ybg) < 0.0005) return 0;
  let SAPC = 0;
  let out = 0;
  if (Ybg > Ytxt) {
    SAPC = (Math.pow(Ybg, 0.56) - Math.pow(Ytxt, 0.57)) * 1.14;
    out = SAPC < 0.1 ? 0 : SAPC - 0.027;
  } else {
    SAPC = (Math.pow(Ybg, 0.65) - Math.pow(Ytxt, 0.62)) * 1.14;
    out = SAPC > -0.1 ? 0 : SAPC + 0.027;
  }
  return out * 100;
}

/** Threshold below which a wordmark segment is considered illegible
 *  on its surface. Lc 45 is APCA's "large text minimum" — wordmarks
 *  are large display text so this is the right floor. */
const WORDMARK_APCA_MIN = 45;

/** Pick a high-contrast fallback for a segment that fails APCA
 *  against the surface. Returns the brighter of near-white or
 *  near-black per APCA, biased toward the surface's hue. */
function fallbackForeground(surfaceHex: string): string {
  const lightLc = Math.abs(apcaLc('#FAFAFA', surfaceHex));
  const darkLc = Math.abs(apcaLc('#0A0A0A', surfaceHex));
  return lightLc >= darkLc ? '#FAFAFA' : '#0A0A0A';
}

/** Resolve a stored segment color to render-ready CSS properties.
 *  v0.1.60. Mirrors the WordmarkEditor preview logic. */
function resolveSegmentColor(
  raw: string | undefined,
  palettes: WordmarkResolvedPalettes | undefined,
  gradients: ReadonlyArray<WordmarkGradient> | undefined,
): React.CSSProperties {
  if (!raw) return {};
  const t = raw.trim();
  // Gradient ref → background-clip:text
  if (/^gradient-[a-z0-9-]+$/.test(t)) {
    const slug = t.replace(/^gradient-/, '');
    const g = gradients?.find((x) => x.slug === slug);
    if (g) {
      return {
        background: g.css,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        WebkitTextFillColor: 'transparent',
      };
    }
    return {};
  }
  // Palette rung ref
  const m = /^(primary|secondary|accent|neutral)-(dark|main|bright|pastel|faded)$/.exec(t);
  if (m && palettes) {
    const role = m[1] as keyof WordmarkResolvedPalettes;
    const rung = m[2] as keyof WordmarkResolvedPalettes[typeof role];
    return { color: palettes[role][rung] };
  }
  // Literal hex
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(t)) return { color: t };
  return {};
}

export const Wordmark = React.forwardRef<HTMLSpanElement, WordmarkProps>(
  ({ segments, imageUrl, name, alt, imageHeight = 32, surfaceColor, palettes, gradients, className, ...rest }, ref) => {
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
        textTransform: "var(--font-wordmark-text-transform, none)" as React.CSSProperties["textTransform"],
      };
      // Cached fallback foreground so we only compute it once per
      // render even if multiple segments fail APCA.
      let cachedFallback: string | null = null;
      const fallbackFor = (): string => {
        if (cachedFallback === null && surfaceColor) {
          cachedFallback = fallbackForeground(surfaceColor);
        }
        return cachedFallback ?? '#0a0a0a';
      };
      return (
        <span
          ref={ref}
          className={cn("inline-flex items-baseline", className)}
          style={wrapStyle}
          aria-label={name}
          {...rest}
        >
          {segments.map((s, i) => {
            // v0.1.60: resolve segment color through palettes +
            // gradients. Gradient refs render via background-clip:text;
            // palette refs resolve to hex; literal hex passes through.
            const resolved = resolveSegmentColor(s.color, palettes, gradients);
            // v0.1.59 APCA fallback: when the segment is a FLAT color
            // (gradient refs are excluded — clipping a gradient to
            // text on a low-contrast surface is the operator's
            // intentional choice and shouldn't be overridden), check
            // APCA against the surface and fall back if needed.
            const isGradientSegment = !!resolved.background;
            let finalStyle: React.CSSProperties = resolved;
            if (!isGradientSegment && resolved.color && surfaceColor) {
              if (Math.abs(apcaLc(resolved.color, surfaceColor)) < WORDMARK_APCA_MIN) {
                finalStyle = { color: fallbackFor() };
              }
            }
            return (
              <span key={i} style={Object.keys(finalStyle).length ? finalStyle : undefined}>
                {s.text}
              </span>
            );
          })}
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
