/**
 * Font helpers for the brand admin tabs (TypographyTab, LogosTab).
 *
 * v0.1.17 changes the storage shape from a closed enum of slugs
 * (`'inter'`, `'dm-sans'`, etc.) to free-form Google Fonts family names
 * (`'Inter'`, `'DM Sans'`). This module:
 *
 *   1. Migrates legacy slugs on read (one-time mapping).
 *   2. Normalizes role-default weights (display=700, heading=600,
 *      body=400, mono=400) when only a legacy `display_font='inter'`
 *      style token exists with no companion weight.
 *   3. Provides system-stack metadata that pins above Google Fonts in
 *      the FontCombobox.
 */

export type FontRole =
  | 'wordmark'
  | 'display'
  | 'heading'
  | 'subheading'
  | 'body'
  | 'eyebrow'
  | 'label'
  | 'caption'
  | 'mono';

export type TextTransform = 'none' | 'uppercase' | 'lowercase';

export const TEXT_TRANSFORM_OPTIONS: Array<{ value: TextTransform; label: string }> = [
  { value: 'none',      label: 'As written' },
  { value: 'uppercase', label: 'UPPERCASE' },
  { value: 'lowercase', label: 'lowercase' },
];

/** Pinned system defaults — render instantly, no Google network load. */
export const SYSTEM_FONTS: Array<{
  family: string;
  label: string;
  stack: string;
  category: 'system-sans' | 'system-serif' | 'system-mono';
}> = [
  {
    family: 'System Sans',
    label: 'System Sans',
    stack: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    category: 'system-sans',
  },
  {
    family: 'System Serif',
    label: 'System Serif',
    stack: 'Georgia, "Times New Roman", Times, serif',
    category: 'system-serif',
  },
  {
    family: 'System Mono',
    label: 'System Mono',
    stack: 'ui-monospace, SFMono-Regular, Menlo, Monaco, "Cascadia Mono", "Roboto Mono", monospace',
    category: 'system-mono',
  },
];

const SYSTEM_FAMILY_SET = new Set(SYSTEM_FONTS.map((s) => s.family));

export function isSystemFont(family: string): boolean {
  return SYSTEM_FAMILY_SET.has(family);
}

/** Resolve a family to its CSS font-family stack. */
export function resolveFamilyStack(family: string): string {
  const sys = SYSTEM_FONTS.find((s) => s.family === family);
  if (sys) return sys.stack;
  // Google Font: quote the family name, fall back to a category-ish default.
  return `"${family}", sans-serif`;
}

/**
 * Legacy slug → Google Fonts family mapping. Used to migrate the
 * pre-v0.1.17 enum-based typography tokens on first read. After save,
 * the new family-name form replaces the slug.
 */
export const LEGACY_SLUG_TO_FAMILY: Record<string, string> = {
  system: 'System Sans',
  'dm-sans': 'DM Sans',
  inter: 'Inter',
  manrope: 'Manrope',
  spectral: 'Spectral',
  gloock: 'Gloock',
  playfair: 'Playfair Display',
  geist: 'Geist',
  roboto: 'Roboto',
  'jetbrains-mono': 'JetBrains Mono',
  'fira-code': 'Fira Code',
};

export function migrateLegacyFontValue(raw: string): string {
  return LEGACY_SLUG_TO_FAMILY[raw] ?? raw;
}

/** Sensible per-role default weight. */
export const DEFAULT_WEIGHT_FOR_ROLE: Record<FontRole, string> = {
  wordmark:   '700',
  display:    '700',
  heading:    '600',
  subheading: '500',
  body:       '400',
  eyebrow:    '600',
  label:      '500',
  caption:    '400',
  mono:       '400',
};

/**
 * Per-role default letter-spacing. Eyebrows are wide-tracked all-caps
 * labels and conventionally want extra spacing; labels get a hint of
 * tracking for clarity at small sizes; everything else defaults to
 * neutral.
 */
export const DEFAULT_LETTER_SPACING_FOR_ROLE: Record<FontRole, string> = {
  wordmark:   '0em',
  display:    '0em',
  heading:    '0em',
  subheading: '0em',
  body:       '0em',
  eyebrow:    '0.1em',
  label:      '0.01em',
  caption:    '0em',
  mono:       '0em',
};

/** Per-role default text-transform. Eyebrows are conventionally caps. */
export const DEFAULT_TEXT_TRANSFORM_FOR_ROLE: Record<FontRole, TextTransform> = {
  wordmark:   'none',
  display:    'none',
  heading:    'none',
  subheading: 'none',
  body:       'none',
  eyebrow:    'uppercase',
  label:      'none',
  caption:    'none',
  mono:       'none',
};

/**
 * Per-role display label + usage description. The label is what the
 * admin UI titles each card; the usage text is shown beneath the
 * label AND exposed via /_ensemble/core/brand/fonts/active for a
 * brand-guide readout to render verbatim. Edit these here and both
 * surfaces update together.
 */
export interface RoleMeta {
  label: string;
  usage: string;
}

export const ROLE_META: Record<FontRole, RoleMeta> = {
  wordmark: {
    label: 'Wordmark',
    usage:
      'Reserved exclusively for the brand lockup — appears nowhere else in the UI so the mark stays ownable.',
  },
  display: {
    label: 'Display',
    usage:
      'Hero sections, full-screen landing moments, and any headline where maximum visual impact is the primary goal.',
  },
  heading: {
    label: 'Heading (H1–H3)',
    usage:
      'Primary page and section titles that structure the main content hierarchy and guide the reader through the experience.',
  },
  subheading: {
    label: 'Subheading (H4–H6)',
    usage:
      'Secondary and tertiary groupings such as card titles, sidebar headers, modal titles, and nested section labels.',
  },
  body: {
    label: 'Body',
    usage:
      'All paragraph text, article content, product descriptions, and any prose that requires sustained reading comfort.',
  },
  eyebrow: {
    label: 'Eyebrow',
    usage:
      'Small all-caps label placed above a heading to signal category, content type, or platform context before the main title.',
  },
  label: {
    label: 'Label',
    usage:
      'Buttons, navigation items, form field labels, tags, and all interactive UI elements where clarity at small sizes matters.',
  },
  caption: {
    label: 'Caption',
    usage:
      'Image credits, footnotes, legal disclaimers, timestamps, and supporting detail that sits beneath primary content.',
  },
  mono: {
    label: 'Monospace',
    usage:
      'Clinical data, patient IDs, dosage figures, API responses, and any content requiring precise fixed-width character alignment.',
  },
};

export interface RoleTokens {
  family: string;
  weight: string;
  style: 'normal' | 'italic';
  letterSpacing: string;
  textTransform: TextTransform;
}

/**
 * Pull a role's typography out of a token map. Handles three shapes:
 *
 *   New (v0.1.17+):
 *     typography_<role>_family / _weight / _style
 *
 *   Legacy:
 *     <role>_font (slug — e.g. 'inter')
 *
 *   Wordmark (Logos tab):
 *     wordmark_family / wordmark_weight / wordmark_style
 *
 * Returns null if no relevant token exists (caller may treat as
 * "use inherited default").
 */
export function readRoleTokens(
  role: FontRole,
  tokens: Record<string, string>,
): RoleTokens | null {
  const newPrefix = role === 'wordmark' ? 'wordmark_' : `typography_${role}_`;
  const family = tokens[`${newPrefix}family`];
  const weight = tokens[`${newPrefix}weight`];
  const style = tokens[`${newPrefix}style`] as 'normal' | 'italic' | undefined;
  const letterSpacing = tokens[`${newPrefix}letter_spacing`];
  const textTransform = tokens[`${newPrefix}text_transform`] as TextTransform | undefined;

  if (family) {
    return {
      family,
      weight: weight || DEFAULT_WEIGHT_FOR_ROLE[role],
      style: style ?? 'normal',
      letterSpacing: letterSpacing || DEFAULT_LETTER_SPACING_FOR_ROLE[role],
      textTransform: textTransform || DEFAULT_TEXT_TRANSFORM_FOR_ROLE[role],
    };
  }

  // Roles that inherit from another when unset: wordmark → display,
  // subheading → heading. The caller is responsible for resolving the
  // inheritance (we just return null here so they know to fall through).
  if (role === 'wordmark' || role === 'subheading') return null;

  // Legacy `<role>_font = 'inter'` style.
  const legacyKey = `${role}_font`;
  const legacy = tokens[legacyKey];
  if (legacy) {
    return {
      family: migrateLegacyFontValue(legacy),
      weight: DEFAULT_WEIGHT_FOR_ROLE[role],
      style: 'normal',
      letterSpacing: DEFAULT_LETTER_SPACING_FOR_ROLE[role],
      textTransform: DEFAULT_TEXT_TRANSFORM_FOR_ROLE[role],
    };
  }
  return null;
}

/** Write a role's tokens to a save-shape map (new keys only). */
export function writeRoleTokens(
  role: FontRole,
  rt: RoleTokens,
): Record<string, string> {
  const prefix = role === 'wordmark' ? 'wordmark_' : `typography_${role}_`;
  return {
    [`${prefix}family`]: rt.family,
    [`${prefix}weight`]: rt.weight,
    [`${prefix}style`]: rt.style,
    [`${prefix}letter_spacing`]: rt.letterSpacing,
    [`${prefix}text_transform`]: rt.textTransform,
  };
}

/**
 * Parse a Google Fonts variant key into a structured shape.
 *
 * Google's metadata-endpoint shape uses keys like:
 *   '400'   → regular weight 400
 *   '400i'  → italic weight 400
 *   '700'   → bold
 *   '700i'  → bold italic
 *
 * Older shapes (still seen in other Google APIs):
 *   'regular' | 'italic' | '700italic'
 *
 * All forms are handled.
 */
export function parseVariant(v: string): { weight: string; italic: boolean } {
  if (v === 'regular') return { weight: '400', italic: false };
  if (v === 'italic') return { weight: '400', italic: true };

  // Old shape: '<digits>italic'
  if (v.endsWith('italic')) {
    const numeric = v.slice(0, -'italic'.length);
    return { weight: numeric || '400', italic: true };
  }

  // New shape: '<digits>i' (e.g. '400i', '700i')
  if (/^\d+i$/.test(v)) {
    return { weight: v.slice(0, -1), italic: true };
  }

  // Plain numeric: '400', '700'
  if (/^\d+$/.test(v)) return { weight: v, italic: false };

  // Anything else (variable axis tuples, etc.) — fall back to 400 regular.
  return { weight: '400', italic: false };
}

/**
 * Letter-spacing presets used by every typography role and the wordmark.
 * Values are em-based so they scale with font size — what brand guides
 * conventionally publish. Ordered tightest → widest with `0em` (the
 * default) sitting in the middle for muscle-memory parity with a Style
 * dropdown.
 */
export const LETTER_SPACING_PRESETS: Array<{ value: string; label: string }> = [
  { value: '-0.075em', label: 'Tightest (-0.075em)' },
  { value: '-0.05em',  label: 'Tighter (-0.05em)' },
  { value: '-0.025em', label: 'Tight (-0.025em)' },
  { value: '-0.01em',  label: 'Slightly tight (-0.01em)' },
  { value: '0em',      label: 'Normal (0em)' },
  { value: '0.025em',  label: 'Slightly loose (0.025em)' },
  { value: '0.05em',   label: 'Loose (0.05em)' },
  { value: '0.1em',    label: 'Wide (0.1em)' },
  { value: '0.2em',    label: 'Widest (0.2em)' },
];

export const DEFAULT_LETTER_SPACING = '0em';

/** Human-readable weight name for UI display. */
export const WEIGHT_LABELS: Record<string, string> = {
  '100': 'Thin',
  '200': 'Extra Light',
  '300': 'Light',
  '400': 'Regular',
  '500': 'Medium',
  '600': 'Semi Bold',
  '700': 'Bold',
  '800': 'Extra Bold',
  '900': 'Black',
};

/**
 * The full standard CSS weight axis. Used for system fonts (which on
 * every modern OS expose the whole range) and for any family with no
 * known variant list — better to offer the operator a real choice than
 * lock them to 400.
 */
const STANDARD_WEIGHTS = ['100', '200', '300', '400', '500', '600', '700', '800', '900'];

/** Extract the distinct numeric weights a family supports (sorted ascending). */
export function weightsForFamily(variants: string[] | undefined): string[] {
  // No variant info — could be a system font or an as-yet-unloaded
  // Google font. Expose the full standard weight axis so the operator
  // sees a real picker instead of a one-item dropdown.
  if (!variants || variants.length === 0) return [...STANDARD_WEIGHTS];
  const set = new Set<string>();
  for (const v of variants) {
    const { weight } = parseVariant(v);
    set.add(weight);
  }
  if (set.size === 0) return [...STANDARD_WEIGHTS];
  return Array.from(set).sort((a, b) => Number(a) - Number(b));
}

/** Whether a family has italic variants. */
export function familySupportsItalic(variants: string[] | undefined): boolean {
  if (!variants) return true; // System fonts always support italic
  return variants.some((v) => /italic|i$/.test(v));
}
