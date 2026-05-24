/**
 * Brand colors — typed schema for the v0.1.55 redesign.
 *
 * Replaces the sprawling category='colors' tokens with a structured
 * model: 3 brand palettes + 1 neutral palette + named gradients +
 * light/dark themes + semantic state colors.
 *
 * Storage model
 * ─────────────
 * Stored as ONE JSON blob in brand_tokens under category='colors',
 * key='brand_colors_v1'. Single-document write means atomic saves
 * and trivial migrations between schema versions. Older sparse
 * tokens (brand-primary, brand-background-light, etc.) are NOT
 * read at all — per operator decision (Q1) we accept a one-time
 * reset on the single installed workspace.
 *
 * The brand-css endpoint and render pipeline read THIS shape via
 * load.ts → resolver.ts and emit the CSS variables + resolved hex
 * values downstream consumers expect.
 *
 * Token references
 * ────────────────
 * Theme bindings and gradient stops can be either:
 *   - a palette-rung reference string like "primary-main" or
 *     "neutral-faded" or "secondary-bright"
 *   - a literal hex string like "#FAF8F4"
 *   - the special string "auto" (only valid for theme.text-primary
 *     and text-muted; means APCA-pick at render time)
 *
 * Detection: anything matching /^(primary|secondary|accent|neutral)-
 * (dark|main|bright|pastel|faded)$/ is a rung reference; anything
 * starting with '#' is a hex; "auto" is literal.
 */
/* ──────────────────────────────────────────────────────────────
 * Defaults — used on fresh workspace (no doc yet) and as the
 * starting point for the operator. Conservative neutral choices
 * so a brand new workspace renders sensibly before any input.
 * ──────────────────────────────────────────────────────────── */
export function defaultBrandColors() {
    return {
        version: 1,
        palettes: {
            primary: { name: 'Primary', main: '#3B82F6' },
            secondary: { name: 'Secondary', main: '#64748B' },
            accent: { name: 'Accent', main: '#F59E0B' },
            neutral: { name: 'Neutral', main: '#71717A', hueMode: 'branded' },
        },
        gradients: [],
        themes: {
            light: {
                bindings: {
                    canvas: '#FFFFFF',
                    surface: '#FFFFFF',
                    'text-primary': 'auto',
                    'text-muted': 'auto',
                    brand: 'primary-main',
                    'brand-bg': 'primary-faded',
                    border: 'neutral-pastel',
                },
            },
            // Dark intentionally omitted — operator opts in via the
            // "Generate from light" action or by manually filling bindings.
        },
        semantic: {
            success: { main: '#16A34A', light: '#DCFCE7' },
            info: { main: '#3B82F6', light: '#DBEAFE' },
            warning: { main: '#F59E0B', light: '#FEF3C7' },
            error: { main: '#DC2626', light: '#FEE2E2' },
        },
    };
}
/* ──────────────────────────────────────────────────────────────
 * Detection / parsing helpers
 * ──────────────────────────────────────────────────────────── */
const RUNG_REF_RE = /^(primary|secondary|accent|neutral)-(dark|main|bright|pastel|faded)$/;
export function isPaletteRungRef(value) {
    return RUNG_REF_RE.test(value);
}
export function isHex(value) {
    return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}
export function parseRungRef(ref) {
    const m = RUNG_REF_RE.exec(ref);
    if (!m)
        return null;
    return { role: m[1], rung: m[2] };
}
//# sourceMappingURL=schema.js.map