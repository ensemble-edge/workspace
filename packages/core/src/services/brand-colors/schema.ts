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

/** Five rungs per palette — operator types Main, four derive in OkLCh. */
export type RungName = 'dark' | 'main' | 'bright' | 'pastel' | 'faded';

/** Stable code slots for the three brand palettes + neutral. Operator
 *  can RENAME (display alias) but cannot add a fourth role. */
export type PaletteRole = 'primary' | 'secondary' | 'accent' | 'neutral';

/** Palette-rung reference like "primary-main". The fully-qualified
 *  identifier used in CSS (--primary-main) and in theme bindings /
 *  gradient stops. */
export type PaletteRungRef =
  | `primary-${RungName}`
  | `secondary-${RungName}`
  | `accent-${RungName}`
  | `neutral-${RungName}`;

/** A theme-binding value: a palette-rung ref, a literal hex, or
 *  "auto" (text-primary/text-muted only — APCA-pick at render). */
export type ThemeBindingValue = PaletteRungRef | string;

/** A gradient stop value: rung ref OR the two system tokens. Hex
 *  is NOT allowed in gradient stops by spec — token-only. */
export type GradientStopValue = PaletteRungRef | 'white' | 'black';

/* ──────────────────────────────────────────────────────────────
 * Palette shape
 * ──────────────────────────────────────────────────────────── */

export interface Palette {
  /** Operator-facing display name like "Ownly Coral" or "Sandstone". */
  name: string;
  /** Operator-typed Main hex (no '#' optional; canonicalized on save). */
  main: string;
  /**
   * Optional per-rung overrides. Keys are rung names; values are
   * literal hex. Missing keys derive from `main` via the OkLCh
   * offsets in derive.ts. Present keys take priority — the
   * operator's "inspect" affordance writes here.
   */
  overrides?: Partial<Record<Exclude<RungName, 'main'>, string>>;
}

/** Neutral has the same shape as a brand palette PLUS a hue mode
 *  ("branded" = derive from primary, "warm"/"cool"/"true" = preset
 *  hue overrides). When mode is "branded" the operator hasn't
 *  picked a main hex — it's computed from primary at resolve time. */
export interface NeutralPalette extends Palette {
  hueMode: 'branded' | 'warm' | 'cool' | 'true';
}

/* ──────────────────────────────────────────────────────────────
 * Gradient
 * ──────────────────────────────────────────────────────────── */

export type GradientAngle = 0 | 45 | 90 | 135 | 180;
export type GradientMode = 'linear' | 'radial';

export interface Gradient {
  /** Stable slug derived from name at save time; used in CSS var
   *  (--gradient-sunrise) and code references. */
  slug: string;
  /** Operator-facing display name like "Sunrise". */
  name: string;
  /** 2..4 stops, in order. */
  stops: GradientStopValue[];
  /** Direction. Radial mode ignores angle. */
  mode: GradientMode;
  /** One of the five preset angles. Ignored when mode === 'radial'. */
  angle: GradientAngle;
}

/* ──────────────────────────────────────────────────────────────
 * Theme
 * ──────────────────────────────────────────────────────────── */

/** Seven role-named token slots per theme — see spec §2.
 *  All slots accept palette-rung refs OR literal hex.
 *  text-primary and text-muted additionally accept "auto". */
export interface ThemeBindings {
  canvas: ThemeBindingValue;
  surface: ThemeBindingValue;
  'text-primary': ThemeBindingValue;
  'text-muted': ThemeBindingValue;
  brand: ThemeBindingValue;
  'brand-bg': ThemeBindingValue;
  border: ThemeBindingValue;
}

export interface Theme {
  bindings: ThemeBindings;
}

/* ──────────────────────────────────────────────────────────────
 * Semantic colors (unchanged from v0.1.54 — Main + Light pairs)
 * ──────────────────────────────────────────────────────────── */

export interface SemanticPair {
  main: string;
  light: string;
}

export interface SemanticColors {
  success: SemanticPair;
  info: SemanticPair;
  warning: SemanticPair;
  error: SemanticPair;
}

/* ──────────────────────────────────────────────────────────────
 * Top-level document
 * ──────────────────────────────────────────────────────────── */

export interface BrandColorsDoc {
  version: 1;
  palettes: {
    primary: Palette;
    secondary: Palette;
    accent: Palette;
    neutral: NeutralPalette;
  };
  /** Gradients in operator-defined order. Hard-capped at 5. */
  gradients: Gradient[];
  themes: {
    light: Theme;
    /** Dark is OPTIONAL. When undefined, dark-bg logo lockups don't
     *  render — variants matrix shows "Add a dark theme" placeholder. */
    dark?: Theme;
  };
  semantic: SemanticColors;
}

/* ──────────────────────────────────────────────────────────────
 * Defaults — used on fresh workspace (no doc yet) and as the
 * starting point for the operator. Conservative neutral choices
 * so a brand new workspace renders sensibly before any input.
 * ──────────────────────────────────────────────────────────── */

export function defaultBrandColors(): BrandColorsDoc {
  return {
    version: 1,
    palettes: {
      primary:   { name: 'Primary',   main: '#3B82F6' },
      secondary: { name: 'Secondary', main: '#64748B' },
      accent:    { name: 'Accent',    main: '#F59E0B' },
      neutral:   { name: 'Neutral',   main: '#71717A', hueMode: 'branded' },
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
      info:    { main: '#3B82F6', light: '#DBEAFE' },
      warning: { main: '#F59E0B', light: '#FEF3C7' },
      error:   { main: '#DC2626', light: '#FEE2E2' },
    },
  };
}

/* ──────────────────────────────────────────────────────────────
 * Detection / parsing helpers
 * ──────────────────────────────────────────────────────────── */

const RUNG_REF_RE = /^(primary|secondary|accent|neutral)-(dark|main|bright|pastel|faded)$/;

export function isPaletteRungRef(value: string): value is PaletteRungRef {
  return RUNG_REF_RE.test(value);
}

export function isHex(value: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

export function parseRungRef(ref: string): { role: PaletteRole; rung: RungName } | null {
  const m = RUNG_REF_RE.exec(ref);
  if (!m) return null;
  return { role: m[1] as PaletteRole, rung: m[2] as RungName };
}
