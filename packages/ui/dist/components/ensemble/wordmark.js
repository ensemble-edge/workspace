import { jsx as _jsx } from "react/jsx-runtime";
import * as React from "react";
import { cn } from "../../lib/utils.js";
/* APCA-W3 contrast helpers (kept local — copying ~30 lines is
 * cheaper than pulling a UI-package dep into the brand-colors
 * service. Same algorithm as services/brand-colors/derive.ts.) */
function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
    if (!m)
        return null;
    let h = m[1];
    if (h.length === 3)
        h = h.split('').map((c) => c + c).join('');
    return {
        r: parseInt(h.slice(0, 2), 16) / 255,
        g: parseInt(h.slice(2, 4), 16) / 255,
        b: parseInt(h.slice(4, 6), 16) / 255,
    };
}
function apcaY(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb)
        return 0;
    const Y = 0.2126729 * Math.pow(rgb.r, 2.4) + 0.7151522 * Math.pow(rgb.g, 2.4) + 0.0721750 * Math.pow(rgb.b, 2.4);
    return Y < 0.022 ? Y + Math.pow(0.022 - Y, 1.414) : Y;
}
function apcaLc(textHex, bgHex) {
    const Ytxt = apcaY(textHex);
    const Ybg = apcaY(bgHex);
    if (Math.abs(Ytxt - Ybg) < 0.0005)
        return 0;
    let SAPC = 0;
    let out = 0;
    if (Ybg > Ytxt) {
        SAPC = (Math.pow(Ybg, 0.56) - Math.pow(Ytxt, 0.57)) * 1.14;
        out = SAPC < 0.1 ? 0 : SAPC - 0.027;
    }
    else {
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
function fallbackForeground(surfaceHex) {
    const lightLc = Math.abs(apcaLc('#FAFAFA', surfaceHex));
    const darkLc = Math.abs(apcaLc('#0A0A0A', surfaceHex));
    return lightLc >= darkLc ? '#FAFAFA' : '#0A0A0A';
}
export const Wordmark = React.forwardRef(({ segments, imageUrl, name, alt, imageHeight = 32, surfaceColor, className, ...rest }, ref) => {
    // Segments win when present.
    if (segments && segments.length > 0) {
        // v0.1.17: read --font-wordmark CSS variables (with display
        // fallback baked in) so the wordmark renders in the operator's
        // chosen typeface, weight, and style. When the operator hasn't
        // configured wordmark typography, --font-wordmark falls back to
        // --font-display via the brand CSS layer.
        const wrapStyle = {
            fontFamily: "var(--font-wordmark, var(--font-display, inherit))",
            fontWeight: "var(--font-wordmark-weight, var(--font-display-weight, 700))",
            fontStyle: "var(--font-wordmark-style, normal)",
            letterSpacing: "var(--font-wordmark-letter-spacing, var(--font-display-letter-spacing, normal))",
            textTransform: "var(--font-wordmark-text-transform, none)",
        };
        // Cached fallback foreground so we only compute it once per
        // render even if multiple segments fail APCA.
        let cachedFallback = null;
        const fallbackFor = () => {
            if (cachedFallback === null && surfaceColor) {
                cachedFallback = fallbackForeground(surfaceColor);
            }
            return cachedFallback ?? '#0a0a0a';
        };
        return (_jsx("span", { ref: ref, className: cn("inline-flex items-baseline", className), style: wrapStyle, "aria-label": name, ...rest, children: segments.map((s, i) => {
                // v0.1.59: when a surfaceColor is provided and the
                // segment's operator-configured color fails APCA against
                // it, swap to a high-contrast fallback. The operator's
                // intent (the segment color) is preserved everywhere
                // surfaceColor isn't provided — i.e. the workspace
                // canvas where the operator's choices are intentional.
                let effective = s.color;
                if (s.color && surfaceColor) {
                    if (Math.abs(apcaLc(s.color, surfaceColor)) < WORDMARK_APCA_MIN) {
                        effective = fallbackFor();
                    }
                }
                return (_jsx("span", { style: effective ? { color: effective } : undefined, children: s.text }, i));
            }) }));
    }
    if (imageUrl) {
        return (_jsx("span", { ref: ref, className: cn("inline-flex items-center", className), ...rest, children: _jsx("img", { src: imageUrl, alt: alt ?? name, style: { maxHeight: `${imageHeight}px`, maxWidth: "100%", display: "block" } }) }));
    }
    return (_jsx("span", { ref: ref, className: cn("inline-flex items-baseline font-semibold tracking-tight", className), ...rest, children: name }));
});
Wordmark.displayName = "Wordmark";
//# sourceMappingURL=wordmark.js.map