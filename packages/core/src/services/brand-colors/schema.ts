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
 *  gradient stops.
 *
 *  v0.1.100: accent supports an optional numeric suffix (1-4). Bare
 *  "accent-faded" still resolves to accent #1 (the back-compat
 *  palettes.accent slot); "accent-2-faded" resolves to the second
 *  accent in palettes.accentExtras. */
export type PaletteRungRef =
  | `primary-${RungName}`
  | `secondary-${RungName}`
  | `accent-${RungName}`
  | `accent-${1 | 2 | 3 | 4}-${RungName}`
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

/** Neutral has the same shape as a brand palette PLUS a hue mode.
 *
 *   'branded' → derive Main from primary's hue + low chroma
 *   'warm'    → fixed amber/sand hue
 *   'cool'    → fixed blue-grey hue
 *   'true'    → pure achromatic
 *   'custom'  → operator's typed `main` hex used directly
 *
 * For 'branded'/'warm'/'cool'/'true', Main is computed at resolve
 * time and the stored `main` field is ignored. For 'custom', the
 * stored `main` field is used as-is — operator typed it.
 */
export interface NeutralPalette extends Palette {
  hueMode: 'branded' | 'warm' | 'cool' | 'true' | 'custom';
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
    /**
     * Primary accent (= "accent 1"). Back-compat slot — every CSS
     * variable named `--brand-accent-<rung>` (no number) resolves
     * from this palette. v0.1.100: additional accents live in
     * `accentExtras` below.
     */
    accent: Palette;
    /**
     * v0.1.100: optional additional accents (2, 3, 4). Hard-capped
     * at 3 entries (so total accents incl. `accent` is ≤ 4). Each
     * entry has the same shape as `accent` (5-rung scale generated
     * the same way). CSS variables emit as
     * `--brand-accent-2-<rung>`, `--brand-accent-3-<rung>`,
     * `--brand-accent-4-<rung>`.
     */
    accentExtras?: Palette[];
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
      // accentExtras: undefined by default — operator adds 0..3 more
      // accents via the Brand → Colors tab. Omitted from defaults so
      // workspaces upgrading from <v0.1.100 see no change.
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

// v0.1.100: accent supports optional numeric suffix 1-4. Matches:
//   primary-main, secondary-faded, accent-dark, accent-2-faded, accent-3-main, etc.
// Group 1: role (primary|secondary|accent|neutral)
// Group 2: accent index ("1".."4") — only present when role === "accent" and a suffix exists
// Group 3: rung name
const RUNG_REF_RE = /^(primary|secondary|accent|neutral)(?:-([1-4]))?-(dark|main|bright|pastel|faded)$/;

export function isPaletteRungRef(value: string): value is PaletteRungRef {
  return RUNG_REF_RE.test(value);
}

export function isHex(value: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

/**
 * Parse a rung reference into its parts.
 * v0.1.100: extended return shape — `accentIndex` is set when the
 * reference includes an explicit accent number (e.g. accent-2-main).
 * A bare `accent-main` resolves to accentIndex=1 (the back-compat
 * `palettes.accent` slot). Non-accent references have accentIndex=null.
 */
export function parseRungRef(
  ref: string,
): { role: PaletteRole; rung: RungName; accentIndex: number | null } | null {
  const m = RUNG_REF_RE.exec(ref);
  if (!m) return null;
  const role = m[1] as PaletteRole;
  const accentIndex = role === 'accent'
    ? (m[2] ? parseInt(m[2], 10) : 1)
    : null;
  return { role, rung: m[3] as RungName, accentIndex };
}
