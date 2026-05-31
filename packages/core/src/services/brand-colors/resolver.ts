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
import { deriveRung, deriveRungs, deriveNeutralRungs, neutralMainFromHueMode, hueBiasedForeground, pickHigherContrast, contrastRatio, apcaContrast } from './derive';
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
/**
 * v0.1.100: the four canonical role keys (primary/secondary/accent/
 * neutral) PLUS an optional `accentExtras` array carrying 0..3
 * additional accents. The `accent` key always holds accent #1
 * (back-compat). `accentExtras[0]` is accent #2, [1] is #3, [2] is #4.
 *
 * Consumers that don't care about extras (the vast majority — CSS
 * variable lookup by role+rung name, theme binding resolution, etc.)
 * keep working unchanged. Consumers that DO need extras read
 * `accentExtras[i]` directly.
 */
export type ResolvedPalettes = Record<PaletteRole, ResolvedPalette> & {
  accentExtras?: ResolvedPalette[];
};

export function resolvePalettes(doc: BrandColorsDoc): ResolvedPalettes {
  const primaryMain = doc.palettes.primary.main;
  const extras = (doc.palettes.accentExtras ?? []).slice(0, 3).map(resolvePalette);
  return {
    primary:   resolvePalette(doc.palettes.primary),
    secondary: resolvePalette(doc.palettes.secondary),
    accent:    resolvePalette(doc.palettes.accent),
    neutral:   resolveNeutral(doc.palettes.neutral, primaryMain),
    ...(extras.length > 0 ? { accentExtras: extras } : {}),
  };
}

/**
 * v0.1.100: central rung lookup. Handles the accent-index case
 * uniformly so every consumer goes through one helper. Bare
 * `accent-main` resolves to accent #1 (palettes.accent). Indexed
 * `accent-2-main` resolves to palettes.accentExtras[0]. Out-of-range
 * indices (e.g. `accent-5-main` if it somehow gets through, or
 * `accent-3-main` when only 1 extra is configured) fall back to
 * accent #1 so the render pipeline degrades gracefully instead of
 * emitting blank CSS values.
 */
export function lookupRung(
  ref: { role: PaletteRole; rung: RungName; accentIndex: number | null },
  palettes: ResolvedPalettes,
): string {
  if (ref.role === 'accent' && ref.accentIndex && ref.accentIndex > 1) {
    const extrasIdx = ref.accentIndex - 2; // accent-2 → index 0, accent-3 → 1, accent-4 → 2
    const extra = palettes.accentExtras?.[extrasIdx];
    if (extra) return extra[ref.rung];
    // Graceful fallback to accent #1 if requested extra not present.
    return palettes.accent[ref.rung];
  }
  return palettes[ref.role][ref.rung];
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
  // Main hex resolution per hueMode:
  //   custom  → operator's stored `main` field, used as-is
  //   else    → computed from hueMode + primary's hue (for 'branded')
  //
  // v0.1.58: rungs derive via deriveNeutralRungs (NOT the brand-
  // palette deriveRungs). Neutrals need fixed L anchors at the
  // extremes — Faded at L=0.97, Dark at L=0.14 — so canvas
  // backgrounds and near-black text actually reach those values.
  // The previous brand-rule derivation produced Faded ≈ L 0.87
  // (visibly gray instead of near-white) and Dark ≈ L 0.21
  // (charcoal instead of near-black).
  let effectiveMain: string;
  if (n.hueMode === 'custom') {
    effectiveMain = n.main || neutralMainFromHueMode('branded', primaryMainHex);
  } else {
    effectiveMain = neutralMainFromHueMode(n.hueMode, primaryMainHex);
  }
  const derived = deriveNeutralRungs(effectiveMain);
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
    return lookupRung(ref, palettes);
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
    return lookupRung(ref, palettes);
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
    return { label: value, isToken: true, hex: lookupRung(ref, palettes) };
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
  // v0.1.100: also check accentExtras (accents 2-4). Match returns
  // the indexed form (accent-2-main, etc.).
  if (palettes.accentExtras) {
    for (let i = 0; i < palettes.accentExtras.length; i++) {
      const p = palettes.accentExtras[i]!;
      for (const rung of rungs) {
        if (p[rung].toLowerCase() === target) {
          return `accent-${i + 2}-${rung}` as PaletteRungRef;
        }
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
  /**
   * v0.1.100: for accent role, optionally pick a specific accent (1-4).
   * accentIndex=1 (the default) → palettes.accent (back-compat).
   * accentIndex=2..4 → palettes.accentExtras[i-2].
   * Other roles ignore this parameter.
   */
  accentIndex?: number,
): { hex: string; usedFallback: boolean } {
  // Resolve which palette object to pair against — accent extras path
  // for accent-N references, normal role lookup for everything else.
  let p: ResolvedPalette;
  if (paletteRole === 'accent' && accentIndex && accentIndex >= 2) {
    p = palettes.accentExtras?.[accentIndex - 2] ?? palettes.accent;
  } else {
    p = palettes[paletteRole];
  }
  const main = p.main;
  const faded = p.faded;
  // APCA Lc 60 — the spec's on-color foreground threshold. |Lc|
  // because the sign indicates direction (light-on-dark vs dark-on-
  // light) and we just need adequate magnitude.
  const fadedLc = Math.abs(apcaContrast(faded, main));
  if (fadedLc >= 60) return { hex: faded, usedFallback: false };
  // Fallback: pick whichever of near-white or near-black has higher
  // APCA contrast against the Main color.
  const whiteLc = Math.abs(apcaContrast('#FAFAFA', main));
  const blackLc = Math.abs(apcaContrast('#0A0A0A', main));
  const fallback = whiteLc >= blackLc ? '#FAFAFA' : '#0A0A0A';
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
    return onColorForeground(ref.role, palettes, ref.accentIndex ?? undefined);
  }
  // white/black stops — use APCA-max-contrast against the midpoint.
  const fallback = pickHigherContrast(midColor, '#FAFAFA', '#0A0A0A');
  return { hex: fallback, usedFallback: true };
}
