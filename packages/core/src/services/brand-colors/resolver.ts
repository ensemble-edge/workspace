/**
 * Brand-colors resolver — turn a stored value (rung ref, hex, or
 * "auto") into a concrete hex at any given render time.
 *
 * v0.1.55. This module is the boundary between "what the operator
 * authored" (BrandColorsDoc) and "what consumers want" (a flat map
 * of token → hex strings). Everything downstream — the brand-css
 * endpoint, the logo render pipeline, the BrandCard preview math —
 * funnels through here so the resolution logic lives in exactly
 * one place.
 */
import { deriveRung, deriveRungs, neutralMainFromHueMode, hueBiasedForeground, pickHigherContrast, contrastRatio } from './derive';
import {
  isPaletteRungRef, isHex, parseRungRef,
  type BrandColorsDoc, type Palette, type NeutralPalette,
  type PaletteRole, type PaletteRungRef, type RungName,
  type ThemeBindingValue, type GradientStopValue,
} from './schema';

/* ──────────────────────────────────────────────────────────────
 * Palette resolution — every rung of every palette → concrete hex
 * ──────────────────────────────────────────────────────────── */

/**
 * Resolve every rung of every palette to a concrete hex. This is
 * the foundational lookup — once you have the resolved palettes,
 * everything else (themes, gradients, on-color foregrounds) is a
 * second-pass lookup against this map.
 *
 * Operator overrides take priority: a Pastel hex the operator
 * explicitly tuned via the inspect affordance wins over the
 * OkLCh-derived value.
 */
export type ResolvedPalette = Record<RungName, string>;
export type ResolvedPalettes = Record<PaletteRole, ResolvedPalette>;

export function resolvePalettes(doc: BrandColorsDoc): ResolvedPalettes {
  const primaryMain = doc.palettes.primary.main;
  return {
    primary:   resolvePalette(doc.palettes.primary),
    secondary: resolvePalette(doc.palettes.secondary),
    accent:    resolvePalette(doc.palettes.accent),
    neutral:   resolveNeutral(doc.palettes.neutral, primaryMain),
  };
}

function resolvePalette(p: Palette): ResolvedPalette {
  const derived = deriveRungs(p.main);
  return {
    dark:   p.overrides?.dark   ?? derived.dark,
    main:   p.main,
    bright: p.overrides?.bright ?? derived.bright,
    pastel: p.overrides?.pastel ?? derived.pastel,
    faded:  p.overrides?.faded  ?? derived.faded,
  };
}

function resolveNeutral(n: NeutralPalette, primaryMainHex: string): ResolvedPalette {
  // For the "branded" hueMode the Main hex is computed from
  // primary's hue; for preset modes it falls back to the operator's
  // stored main if they manually overrode it, otherwise to the
  // preset-derived value.
  const computedMain = neutralMainFromHueMode(n.hueMode, primaryMainHex);
  const effectiveMain = n.hueMode === 'branded' ? computedMain : (n.main || computedMain);
  const derived = deriveRungs(effectiveMain);
  return {
    dark:   n.overrides?.dark   ?? derived.dark,
    main:   effectiveMain,
    bright: n.overrides?.bright ?? derived.bright,
    pastel: n.overrides?.pastel ?? derived.pastel,
    faded:  n.overrides?.faded  ?? derived.faded,
  };
}

/* ──────────────────────────────────────────────────────────────
 * Value resolution — turn a stored ThemeBindingValue or
 * GradientStopValue into a hex
 * ──────────────────────────────────────────────────────────── */

/**
 * Resolve a stored theme-binding value to a hex. Accepts:
 *   - A palette-rung ref like "primary-main" → look up resolved palettes
 *   - A literal hex like "#FAF8F4" → return as-is (normalized)
 *   - The string "auto" with `autoContext` → APCA-pick foreground vs canvas
 *
 * For "auto", the caller passes the canvas hex (the surface the
 * foreground will sit on) and we return a hue-biased near-white
 * or near-black based on which has higher contrast.
 */
export function resolveBindingValue(
  value: ThemeBindingValue,
  palettes: ResolvedPalettes,
  autoContext?: { against: string },
): string {
  if (value === 'auto') {
    if (!autoContext) return '#0a0a0a';
    // Pick whichever near-white or near-black has more APCA contrast
    // against the target background, with hue-bias toward the bg.
    const light = hueBiasedForeground(autoContext.against, 'light');
    const dark  = hueBiasedForeground(autoContext.against, 'dark');
    return pickHigherContrast(autoContext.against, light, dark);
  }
  if (isHex(value)) return value;
  if (isPaletteRungRef(value)) {
    const ref = parseRungRef(value)!;
    return palettes[ref.role][ref.rung];
  }
  // Unknown shape — return a sensible default rather than throwing
  // so an operator typo doesn't crash the render pipeline.
  return '#0a0a0a';
}

/**
 * Resolve a gradient stop value. Same as binding but with the two
 * extra system tokens 'white' and 'black' (per spec, gradient stops
 * do NOT accept arbitrary hex — token-only).
 */
export function resolveStopValue(
  value: GradientStopValue,
  palettes: ResolvedPalettes,
): string {
  if (value === 'white') return '#ffffff';
  if (value === 'black') return '#000000';
  if (isPaletteRungRef(value)) {
    const ref = parseRungRef(value)!;
    return palettes[ref.role][ref.rung];
  }
  return '#0a0a0a';
}

/* ──────────────────────────────────────────────────────────────
 * Display labels — for the UI "show name vs hex" rule
 * ──────────────────────────────────────────────────────────── */

/**
 * Given a stored value, return what the UI should display:
 *   - If it's a rung ref, the ref string ("primary-main")
 *   - If it's a hex AND it happens to exactly equal a rung's resolved
 *     hex, the rung ref (token reference takes display priority)
 *   - Otherwise the hex string
 *
 * The strict-equality branch handles the case where the operator
 * pastes a hex that happens to match a rung — we prefer the
 * semantically richer label. Per Q4 the primary case is reference-
 * resolution (the value WAS stored as a ref); equality is a bonus.
 */
export function displayLabel(
  value: string,
  palettes: ResolvedPalettes,
): { label: string; isToken: boolean; hex: string } {
  if (value === 'auto') return { label: 'auto', isToken: false, hex: '' };
  if (isPaletteRungRef(value)) {
    const ref = parseRungRef(value)!;
    return { label: value, isToken: true, hex: palettes[ref.role][ref.rung] };
  }
  if (isHex(value)) {
    // Bonus: check if this hex matches a known rung.
    const matchingRung = findRungByHex(value, palettes);
    if (matchingRung) {
      return { label: matchingRung, isToken: true, hex: value };
    }
    return { label: value.toUpperCase(), isToken: false, hex: value };
  }
  return { label: value, isToken: false, hex: value };
}

/**
 * Reverse lookup: given a hex, find the palette rung whose resolved
 * hex matches (case-insensitive). Used by displayLabel to upgrade
 * literal-hex storage to its token label when there's a match.
 */
export function findRungByHex(
  hex: string,
  palettes: ResolvedPalettes,
): PaletteRungRef | null {
  const target = hex.toLowerCase();
  const roles: PaletteRole[] = ['primary', 'secondary', 'accent', 'neutral'];
  const rungs: RungName[] = ['dark', 'main', 'bright', 'pastel', 'faded'];
  for (const role of roles) {
    for (const rung of rungs) {
      if (palettes[role][rung].toLowerCase() === target) {
        return `${role}-${rung}` as PaletteRungRef;
      }
    }
  }
  return null;
}

/* ──────────────────────────────────────────────────────────────
 * Full theme resolution — every binding → concrete hex
 * ──────────────────────────────────────────────────────────── */

export interface ResolvedTheme {
  canvas: string;
  surface: string;
  'text-primary': string;
  'text-muted': string;
  brand: string;
  'brand-bg': string;
  border: string;
}

/**
 * Resolve every binding of a theme to a hex. "auto" values are
 * resolved against the canvas (which itself is resolved first,
 * since text-primary/text-muted may depend on it).
 *
 * When the theme is undefined (no dark theme configured), returns
 * null. Consumers branch on null and skip dark-bg variants.
 */
export function resolveTheme(
  bindings: BrandColorsDoc['themes']['light']['bindings'],
  palettes: ResolvedPalettes,
): ResolvedTheme {
  // Resolve canvas + surface first; they don't depend on others.
  const canvas = resolveBindingValue(bindings.canvas, palettes);
  const surface = resolveBindingValue(bindings.surface, palettes);
  // text-primary and text-muted MAY be "auto" — resolve against canvas.
  return {
    canvas,
    surface,
    'text-primary': resolveBindingValue(bindings['text-primary'], palettes, { against: canvas }),
    'text-muted':   resolveBindingValue(bindings['text-muted'],   palettes, { against: canvas }),
    brand:          resolveBindingValue(bindings.brand,           palettes),
    'brand-bg':     resolveBindingValue(bindings['brand-bg'],     palettes),
    border:         resolveBindingValue(bindings.border,          palettes),
  };
}

/* ──────────────────────────────────────────────────────────────
 * On-color foreground for palette Main / gradient banners
 * ──────────────────────────────────────────────────────────── */

/**
 * Pick the right foreground color for text on a palette Main face.
 * Default rule: that palette's own Faded rung. Fallback: if Faded
 * has APCA contrast < 60 against Main, use APCA-max white or black.
 *
 * Returns both the hex and a flag indicating fallback was used —
 * the BrandCard can surface a warning in edit mode when the
 * fallback triggers, signaling "your Faded rung needs adjustment."
 */
export function onColorForeground(
  paletteRole: PaletteRole,
  palettes: ResolvedPalettes,
): { hex: string; usedFallback: boolean } {
  const main = palettes[paletteRole].main;
  const faded = palettes[paletteRole].faded;
  const fadedRatio = contrastRatio(faded, main);
  // Threshold tuned to roughly correspond to APCA Lc 60 — WCAG 2.x
  // contrast around 3.5:1 is close enough for our purposes.
  if (fadedRatio >= 3.5) return { hex: faded, usedFallback: false };
  // Fallback: pick whichever of pure-white or near-black has more
  // contrast against the Main color.
  const fallback = pickHigherContrast(main, '#FAFAFA', '#0A0A0A');
  return { hex: fallback, usedFallback: true };
}

/**
 * Compute the on-color foreground for a gradient banner. Uses the
 * Faded rung of the FIRST stop's parent palette (when the stop is
 * a palette rung ref). If the first stop is white/black, falls
 * back to APCA-max-contrast against the midpoint of the gradient.
 */
export function gradientOnColor(
  firstStop: GradientStopValue,
  midColor: string,
  palettes: ResolvedPalettes,
): { hex: string; usedFallback: boolean } {
  if (isPaletteRungRef(firstStop)) {
    const ref = parseRungRef(firstStop)!;
    return onColorForeground(ref.role, palettes);
  }
  // white/black stops — use APCA-max-contrast against the midpoint.
  const fallback = pickHigherContrast(midColor, '#FAFAFA', '#0A0A0A');
  return { hex: fallback, usedFallback: true };
}
