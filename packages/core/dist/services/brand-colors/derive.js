/**
 * Color derivation math — OkLCh rung generation + APCA contrast.
 *
 * v0.1.55. The five-rung ladder (Dark / Main / Bright / Pastel /
 * Faded) is derived from the operator's Main hex by fixed OkLCh
 * offsets:
 *
 *   Dark    = Main with L -= 0.18, chroma × 0.85
 *   Main    = exact operator input
 *   Bright  = Main with L += 0.10, chroma × 1.08 (clamped)
 *   Pastel  = Main with L += 0.28, chroma × 0.50
 *   Faded   = Main with L += 0.40, chroma × 0.22
 *
 * OkLCh is the perceptual color space — equal L steps look like
 * equal lightness steps. The chroma curve flattens at the lighter
 * end so Pastel and Faded feel like washes rather than just dim
 * versions of Main. Same offsets work across hues — operators don't
 * need to retune for warm vs cool brands.
 *
 * APCA helpers wrap culori's APCA implementation. APCA-W3 is the
 * successor to WCAG 2.x contrast and is what the brand card uses
 * for the on-color foreground decision and the dark-theme generator.
 */
import { oklch, formatHex, parse, wcagContrast } from 'culori';
const RUNG_OFFSETS = {
    dark: { dL: -0.18, cMul: 0.85 },
    bright: { dL: 0.10, cMul: 1.08 },
    pastel: { dL: 0.28, cMul: 0.50 },
    faded: { dL: 0.40, cMul: 0.22 },
};
/**
 * Derive a rung hex from a Main hex.
 *
 * Operator typed Main → we convert to OkLCh, apply the rung's
 * offset, convert back to sRGB hex. L gets clamped to [0.05, 0.97]
 * so we don't produce pure black or pure white accidentally.
 */
export function deriveRung(mainHex, rung) {
    const parsed = oklch(mainHex);
    if (!parsed)
        return mainHex;
    const offset = RUNG_OFFSETS[rung];
    const nextL = clamp((parsed.l ?? 0.5) + offset.dL, 0.05, 0.97);
    const nextC = Math.max(0, (parsed.c ?? 0) * offset.cMul);
    const nextHex = formatHex({
        mode: 'oklch',
        l: nextL,
        c: nextC,
        h: parsed.h ?? 0,
    });
    // formatHex can return null when the OkLCh point is out of sRGB
    // gamut. Fall back to the Main hex in that case — a rare edge
    // case that mostly happens with extremely saturated brand colors.
    return nextHex ?? mainHex;
}
/**
 * Derive all four non-main rungs at once. Returns a record keyed by
 * rung name. The operator's overrides aren't consulted here — that's
 * the resolver's job; this is pure math from Main.
 */
export function deriveRungs(mainHex) {
    return {
        dark: deriveRung(mainHex, 'dark'),
        bright: deriveRung(mainHex, 'bright'),
        pastel: deriveRung(mainHex, 'pastel'),
        faded: deriveRung(mainHex, 'faded'),
    };
}
/* ──────────────────────────────────────────────────────────────
 * Neutral hue presets
 * ──────────────────────────────────────────────────────────── */
/**
 * For Neutral palette in hueMode 'branded', the Main hex is computed
 * from primary at resolve time using primary's hue but very low
 * chroma. Preset modes (warm/cool/true) override with fixed hues.
 *
 * Returned hex is in OkLCh L ≈ 0.45 — a mid-grey that anchors the
 * five-rung ladder for surfaces, borders, and muted text.
 */
export function neutralMainFromHueMode(hueMode, primaryMainHex) {
    if (hueMode === 'true')
        return '#737373'; // pure achromatic
    // 'custom' is technically operator-driven; resolver consults the
    // stored .main field directly and only falls through to here when
    // it's missing. Treat as 'branded' fallback.
    if (hueMode === 'custom')
        hueMode = 'branded';
    // Hue lookup for the non-'true' modes. 'true' returns a literal
    // achromatic grey above.
    const presetHue = {
        branded: null, // use primary's hue
        warm: 60, // amber/sand
        cool: 240, // blue-grey
    };
    const hue = presetHue[hueMode];
    let h = 0;
    if (hue !== null) {
        h = hue;
    }
    else {
        const p = oklch(primaryMainHex);
        h = p?.h ?? 0;
    }
    const result = formatHex({ mode: 'oklch', l: 0.45, c: 0.012, h });
    return result ?? '#737373';
}
/* ──────────────────────────────────────────────────────────────
 * APCA-W3 contrast (direct implementation)
 *
 * culori 4.x does not ship apcaContrast — we implement APCA-W3
 * directly. The algorithm is the SAPC-APCA "0.0.98G-4g-base"
 * variant per https://github.com/Myndex/apca-w3
 *
 * Returns APCA Lc — range roughly -108..+106, absolute value
 * indicates contrast strength. Spec calls out Lc 60 as the
 * on-color foreground threshold (our pickHigherContrast / Faded
 * fallback consult this).
 *
 * `wcagContrast` from culori is also exposed for the few legacy
 * call sites that haven't been migrated yet.
 * ──────────────────────────────────────────────────────────── */
/** APCA-W3 constants (0.0.98G-4g-base) */
const APCA_SA98G = {
    mainTRC: 2.4,
    Rco: 0.2126729,
    Gco: 0.7151522,
    Bco: 0.0721750,
    normBG: 0.56,
    normTXT: 0.57,
    revTXT: 0.62,
    revBG: 0.65,
    blkThrs: 0.022,
    blkClmp: 1.414,
    loClip: 0.1,
    deltaYmin: 0.0005,
    scaleBoW: 1.14,
    scaleWoB: 1.14,
    loBoWoffset: 0.027,
    loWoBoffset: 0.027,
};
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
/** Screen luminance per APCA-W3 (NOT the WCAG 2.x formula). */
function apcaY(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb)
        return 0;
    const { r, g, b } = rgb;
    const Y = APCA_SA98G.Rco * Math.pow(r, APCA_SA98G.mainTRC) +
        APCA_SA98G.Gco * Math.pow(g, APCA_SA98G.mainTRC) +
        APCA_SA98G.Bco * Math.pow(b, APCA_SA98G.mainTRC);
    return Y < APCA_SA98G.blkThrs
        ? Y + Math.pow(APCA_SA98G.blkThrs - Y, APCA_SA98G.blkClmp)
        : Y;
}
/**
 * APCA-W3 Lc — perceptual contrast in the range roughly [-108, 106].
 * Positive when text is darker than background, negative when
 * lighter; absolute value indicates strength.
 *
 *   |Lc| ≥ 90 → max contrast (display text)
 *   |Lc| ≥ 75 → body text minimum
 *   |Lc| ≥ 60 → on-color foreground / accessible UI minimum
 *   |Lc| ≥ 45 → large text minimum
 *   |Lc| ≥ 30 → non-text UI minimum
 */
export function apcaContrast(textHex, bgHex) {
    const Ytxt = apcaY(textHex);
    const Ybg = apcaY(bgHex);
    if (Math.abs(Ytxt - Ybg) < APCA_SA98G.deltaYmin)
        return 0;
    let SAPC = 0;
    let outputContrast = 0;
    if (Ybg > Ytxt) {
        // Normal (dark text on light bg)
        SAPC = (Math.pow(Ybg, APCA_SA98G.normBG) - Math.pow(Ytxt, APCA_SA98G.normTXT)) * APCA_SA98G.scaleBoW;
        outputContrast = SAPC < APCA_SA98G.loClip ? 0 : SAPC - APCA_SA98G.loBoWoffset;
    }
    else {
        // Reverse (light text on dark bg)
        SAPC = (Math.pow(Ybg, APCA_SA98G.revBG) - Math.pow(Ytxt, APCA_SA98G.revTXT)) * APCA_SA98G.scaleWoB;
        outputContrast = SAPC > -APCA_SA98G.loClip ? 0 : SAPC + APCA_SA98G.loWoBoffset;
    }
    return outputContrast * 100;
}
/**
 * Backwards-compatible name. Returns WCAG 2.x ratio (1..21) using
 * culori. Kept for code that still wants WCAG for legacy reasons.
 * New code should prefer apcaContrast() which is what the v0.1.55
 * spec asked for.
 */
export function contrastRatio(fg, bg) {
    try {
        const ratio = wcagContrast(fg, bg);
        return typeof ratio === 'number' ? ratio : 1;
    }
    catch {
        return 1;
    }
}
/**
 * Pick the rung from a palette whose APCA contrast against the
 * target background is closest to the desired target Lc. Used by
 * the dark-theme generator to preserve relative contrast across
 * themes: if primary-main hits Lc 75 on light canvas, picking the
 * rung that also hits ~Lc 75 on dark canvas keeps the brand
 * feeling the "same level of prominent" in both modes.
 *
 * Compares ABSOLUTE Lc — direction (positive vs negative) flips
 * naturally between light and dark canvases, so abs-comparison
 * keeps the intent ("75 contrast in either direction") stable.
 */
export function pickRungByTargetContrast(rungHexes, bgHex, targetLc) {
    const rungs = Object.keys(rungHexes);
    let bestRung = 'main';
    let bestGap = Infinity;
    let bestLc = 0;
    const target = Math.abs(targetLc);
    for (const r of rungs) {
        const lc = apcaContrast(rungHexes[r], bgHex);
        const gap = Math.abs(Math.abs(lc) - target);
        if (gap < bestGap) {
            bestGap = gap;
            bestRung = r;
            bestLc = lc;
        }
    }
    return { rung: bestRung, lc: bestLc, gap: bestGap };
}
/**
 * Pick the higher-contrast of two foreground candidates against a
 * background. Used for "is white or black more readable here?"
 * decisions on Faded fallback.
 */
export function pickHigherContrast(bgHex, candidateA, candidateB) {
    const rA = contrastRatio(candidateA, bgHex);
    const rB = contrastRatio(candidateB, bgHex);
    return rA >= rB ? candidateA : candidateB;
}
/* ──────────────────────────────────────────────────────────────
 * Hue-biased foreground (for "warm-text-on-warm-dark" effect)
 * ──────────────────────────────────────────────────────────── */
/**
 * Compute a near-white or near-black foreground that picks up a
 * subtle hint of the background's hue, so the foreground doesn't
 * feel sterile. Used by the dark theme generator's text-primary
 * "auto" resolution.
 *
 * Algorithm: take the background's OkLCh hue, build a color at
 * target L = 0.97 (near-white) or 0.10 (near-black) depending on
 * which gives higher contrast, with very low chroma (~0.015) so
 * the tint is barely perceptible but the foreground feels in-family.
 */
export function hueBiasedForeground(bgHex, prefer) {
    const p = oklch(bgHex);
    if (!p)
        return prefer === 'light' ? '#FAFAFA' : '#0A0A0A';
    const targetL = prefer === 'light' ? 0.97 : 0.10;
    const result = formatHex({ mode: 'oklch', l: targetL, c: 0.015, h: p.h ?? 0 });
    return result ?? (prefer === 'light' ? '#FAFAFA' : '#0A0A0A');
}
/* ──────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────── */
function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
}
/**
 * Normalize a hex input to '#rrggbb' lowercase. Accepts '#abc',
 * 'abc', '#aabbcc', 'aabbcc'. Returns the input unchanged when it
 * doesn't look like a hex (caller validates before storage).
 */
export function normalizeHex(input) {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(input.trim());
    if (!m)
        return input;
    let h = m[1].toLowerCase();
    if (h.length === 3)
        h = h.split('').map((c) => c + c).join('');
    return `#${h}`;
}
/**
 * Convert any culori-parseable color (named, hsl, rgb, etc.) to hex.
 * Used when reading external inputs that might not already be hex.
 */
export function toHex(input) {
    try {
        const parsed = parse(input);
        if (!parsed)
            return null;
        return formatHex(parsed);
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=derive.js.map