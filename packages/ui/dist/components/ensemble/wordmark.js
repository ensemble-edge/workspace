import { jsx as _jsx } from "react/jsx-runtime";
import * as React from "react";
import { cn } from "../../lib/utils";
export const Wordmark = React.forwardRef(({ segments, imageUrl, name, alt, imageHeight = 32, className, ...rest }, ref) => {
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
        return (_jsx("span", { ref: ref, className: cn("inline-flex items-baseline", className), style: wrapStyle, "aria-label": name, ...rest, children: segments.map((s, i) => (_jsx("span", { style: s.color ? { color: s.color } : undefined, children: s.text }, i))) }));
    }
    if (imageUrl) {
        return (_jsx("span", { ref: ref, className: cn("inline-flex items-center", className), ...rest, children: _jsx("img", { src: imageUrl, alt: alt ?? name, style: { maxHeight: `${imageHeight}px`, maxWidth: "100%", display: "block" } }) }));
    }
    return (_jsx("span", { ref: ref, className: cn("inline-flex items-baseline font-semibold tracking-tight", className), ...rest, children: name }));
});
Wordmark.displayName = "Wordmark";
//# sourceMappingURL=wordmark.js.map