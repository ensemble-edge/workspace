/**
 * Dark theme generator — deterministic light → dark synthesis.
 *
 * v0.1.55. When the operator clicks "Generate from light" on the
 * Dark theme card, this module computes every dark-theme binding
 * from the light theme + palette inputs. Pure math, no AI, fully
 * auditable, no API calls.
 *
 * Three transformation phases (per spec):
 *
 *   1. Canvas inversion via OkLCh
 *      Flip canvas L around the midpoint with a bias toward a dark
 *      plateau (target L ≈ 0.14). Preserve hue exactly. Reduce
 *      chroma to ~0.7× to avoid muddy warm darks. Surface lifts
 *      +0.05 L from canvas.
 *
 *   2. Brand binding via contrast preservation
 *      For each binding in the light theme that references a
 *      palette, compute the APCA contrast against the light canvas,
 *      then pick the rung from the same palette whose contrast
 *      against the dark canvas is closest to that target. Same
 *      "level of prominent" feeling carries across themes.
 *
 *   3. Foreground via APCA max-contrast + hue bias
 *      For "auto" bindings (text-primary / text-muted), pick the
 *      near-white or near-black with most contrast against the dark
 *      canvas, with a subtle hue-bias toward the canvas hue so the
 *      foreground doesn't feel sterile.
 */
import { oklch, formatHex } from 'culori';
import { contrastRatio, pickRungByTargetContrast, pickHigherContrast, hueBiasedForeground, } from './derive.js';
import { resolvePalettes, resolveBindingValue, } from './resolver.js';
import { isPaletteRungRef, parseRungRef, } from './schema.js';
/** Threshold for the "binding warning" — if no rung lands within
 *  ±10% of the target contrast, the operator sees a warning icon
 *  on that binding in the Dark theme card. */
const CONTRAST_GAP_THRESHOLD = 0.10;
/** Target L for the dark canvas plateau. Roughly matches Zinc-950
 *  / a neutral mid-dark. Brand colors layered over this read well
 *  without the canvas itself feeling too aggressive. */
const DARK_CANVAS_TARGET_L = 0.14;
/** Surface L lift above canvas — the small step that makes cards
 *  pop above the canvas without breaking the dark mood. */
const SURFACE_L_LIFT = 0.05;
/** Chroma multiplier applied to canvas during inversion. Reduces
 *  saturation so a warm-tinted light canvas (e.g. #FAF8F4) doesn't
 *  produce a muddy warm-brown dark canvas. */
const CANVAS_CHROMA_DAMP = 0.70;
/**
 * Generate a Dark theme from the current document's Light theme +
 * resolved palettes.
 *
 * Deterministic — same inputs always produce the same outputs.
 */
export function generateDarkTheme(doc) {
    const palettes = resolvePalettes(doc);
    const light = doc.themes.light.bindings;
    // ── Phase 1: canvas + surface ──
    const lightCanvasHex = resolveBindingValue(light.canvas, palettes);
    const darkCanvasHex = invertCanvasToDark(lightCanvasHex);
    const darkSurfaceHex = liftLuminance(darkCanvasHex, SURFACE_L_LIFT);
    // ── Phase 2: brand-affecting bindings via contrast preservation ──
    // For each binding whose light value references a palette, find
    // the rung in that palette whose contrast against the dark canvas
    // best matches the contrast the light value had against the
    // light canvas.
    const warnings = [];
    const brandResult = preserveContrast(light.brand, palettes, lightCanvasHex, darkCanvasHex);
    if (brandResult.warning)
        warnings.push({ binding: 'brand', ...brandResult.warning });
    const brandBgResult = preserveContrast(light['brand-bg'], palettes, lightCanvasHex, darkCanvasHex);
    if (brandBgResult.warning)
        warnings.push({ binding: 'brand-bg', ...brandBgResult.warning });
    const borderResult = preserveContrast(light.border, palettes, lightCanvasHex, darkCanvasHex);
    if (borderResult.warning)
        warnings.push({ binding: 'border', ...borderResult.warning });
    // ── Phase 3: foreground bindings ──
    // text-primary and text-muted typically use "auto" on light; we
    // generate them as "auto" on dark too — the resolver handles
    // APCA max-contrast at render time, which gives the right
    // behavior automatically. Same goes for the surface binding when
    // light has it as a hex (we use the computed surface hex).
    const dark = {
        canvas: darkCanvasHex,
        surface: darkSurfaceHex,
        // "auto" carries over — the resolver picks max-contrast against
        // the dark canvas at render time, which produces the hue-biased
        // near-white foreground per the resolver's hueBiasedForeground.
        'text-primary': 'auto',
        'text-muted': 'auto',
        brand: brandResult.value,
        'brand-bg': brandBgResult.value,
        border: borderResult.value,
    };
    return {
        theme: { bindings: dark },
        warnings,
    };
}
/* ──────────────────────────────────────────────────────────────
 * Phase 1 — canvas inversion
 * ──────────────────────────────────────────────────────────── */
/**
 * Invert a light canvas hex to a dark canvas hex via OkLCh.
 * Preserves hue exactly, dampens chroma, targets L ≈ 0.14.
 */
function invertCanvasToDark(lightHex) {
    const p = oklch(lightHex);
    if (!p)
        return '#0A0A0A';
    const next = formatHex({
        mode: 'oklch',
        l: DARK_CANVAS_TARGET_L,
        c: (p.c ?? 0) * CANVAS_CHROMA_DAMP,
        h: p.h ?? 0,
    });
    return next ?? '#0A0A0A';
}
/**
 * Add or subtract L from a hex in OkLCh, preserving chroma + hue.
 * Used to compute surface (canvas + lift).
 */
function liftLuminance(hex, dL) {
    const p = oklch(hex);
    if (!p)
        return hex;
    const nextL = Math.min(0.97, Math.max(0.05, (p.l ?? 0.5) + dL));
    const next = formatHex({
        mode: 'oklch',
        l: nextL,
        c: p.c ?? 0,
        h: p.h ?? 0,
    });
    return next ?? hex;
}
/**
 * Given a binding value from the light theme, produce the equivalent
 * dark-theme binding by preserving APCA contrast against the canvas.
 *
 * Behavior depends on the input value's shape:
 *   - Palette rung ref ("primary-main"): pick a rung from the SAME
 *     palette whose dark-canvas contrast best matches the light's.
 *   - Hex: use as-is (we can't know which palette it belongs to).
 *   - "auto": preserved as "auto".
 */
function preserveContrast(lightValue, palettes, lightCanvasHex, darkCanvasHex) {
    if (lightValue === 'auto')
        return { value: 'auto' };
    if (!isPaletteRungRef(lightValue))
        return { value: lightValue };
    const ref = parseRungRef(lightValue);
    const palette = palettes[ref.role];
    // Light-canvas contrast of the original binding.
    const originalHex = palette[ref.rung];
    const lightRatio = contrastRatio(originalHex, lightCanvasHex);
    // Find the rung in the same palette whose dark-canvas contrast
    // best matches lightRatio.
    const pick = pickRungByTargetContrast(palette, darkCanvasHex, lightRatio);
    // Compute gap as fraction of target — "within 10%" means
    // |actual - target| / target ≤ 0.10.
    const gapFraction = lightRatio > 0 ? pick.gap / lightRatio : pick.gap;
    const warning = gapFraction > CONTRAST_GAP_THRESHOLD ? {
        lightRatio,
        darkRatio: pick.ratio,
        gap: pick.gap,
    } : undefined;
    return {
        value: `${ref.role}-${pick.rung}`,
        warning,
    };
}
/* ──────────────────────────────────────────────────────────────
 * Unused-but-handy: foreground for a custom canvas
 * ──────────────────────────────────────────────────────────── */
/**
 * Pick a foreground hex for an arbitrary canvas. Convenience for
 * the Logo Builder's freeform-hex background path — if an operator
 * picks #BD0FFF as a context, we APCA-pick black or near-white
 * with hue bias to match.
 *
 * Exported because the logo renderer needs the same logic.
 */
export function autoForeground(canvasHex) {
    const light = hueBiasedForeground(canvasHex, 'light');
    const dark = hueBiasedForeground(canvasHex, 'dark');
    return pickHigherContrast(canvasHex, light, dark);
}
/* ──────────────────────────────────────────────────────────────
 * Direction: light from dark (reverse)
 * ──────────────────────────────────────────────────────────── */
/**
 * Generate a Light theme from a Dark theme. Symmetric to the
 * forward direction — flip the canvas, preserve contrast for
 * brand bindings, preserve "auto" for foregrounds. Provided for
 * completeness; the UI only exposes the forward direction.
 */
export function generateLightFromDark(doc) {
    if (!doc.themes.dark)
        return null;
    const palettes = resolvePalettes(doc);
    const dark = doc.themes.dark.bindings;
    const darkCanvasHex = resolveBindingValue(dark.canvas, palettes);
    // Symmetric: target L 0.97 (near-white plateau), restore chroma.
    const p = oklch(darkCanvasHex);
    const lightCanvasHex = p
        ? (formatHex({ mode: 'oklch', l: 0.97, c: (p.c ?? 0) / CANVAS_CHROMA_DAMP, h: p.h ?? 0 }) ?? '#FFFFFF')
        : '#FFFFFF';
    const lightSurfaceHex = liftLuminance(lightCanvasHex, -0.02);
    const warnings = [];
    const brand = preserveContrast(dark.brand, palettes, darkCanvasHex, lightCanvasHex);
    const brandBg = preserveContrast(dark['brand-bg'], palettes, darkCanvasHex, lightCanvasHex);
    const border = preserveContrast(dark.border, palettes, darkCanvasHex, lightCanvasHex);
    if (brand.warning)
        warnings.push({ binding: 'brand', ...brand.warning });
    if (brandBg.warning)
        warnings.push({ binding: 'brand-bg', ...brandBg.warning });
    if (border.warning)
        warnings.push({ binding: 'border', ...border.warning });
    return {
        theme: {
            bindings: {
                canvas: lightCanvasHex,
                surface: lightSurfaceHex,
                'text-primary': 'auto',
                'text-muted': 'auto',
                brand: brand.value,
                'brand-bg': brandBg.value,
                border: border.value,
            },
        },
        warnings,
    };
}
//# sourceMappingURL=generate-dark.js.map