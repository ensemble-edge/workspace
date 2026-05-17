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

export type FontRole = 'display' | 'heading' | 'body' | 'mono' | 'wordmark';

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

/** Sensible per-role default weight when only a legacy slug existed. */
export const DEFAULT_WEIGHT_FOR_ROLE: Record<FontRole, string> = {
  display: '700',
  heading: '600',
  body:    '400',
  mono:    '400',
  wordmark: '700',
};

export interface RoleTokens {
  family: string;
  weight: string;
  style: 'normal' | 'italic';
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

  if (family) {
    return {
      family,
      weight: weight || DEFAULT_WEIGHT_FOR_ROLE[role],
      style: style ?? 'normal',
    };
  }

  // Wordmark has no legacy form — return null and let the caller
  // fall back to display.
  if (role === 'wordmark') return null;

  // Legacy `<role>_font = 'inter'` style.
  const legacyKey = `${role}_font`;
  const legacy = tokens[legacyKey];
  if (legacy) {
    return {
      family: migrateLegacyFontValue(legacy),
      weight: DEFAULT_WEIGHT_FOR_ROLE[role],
      style: 'normal',
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
  };
}

/**
 * Parse a Google Fonts variant string into a structured shape.
 * Examples: '400' → {weight:'400', italic:false}; '700italic' → {weight:'700', italic:true};
 * 'regular' → {weight:'400', italic:false}; 'italic' → {weight:'400', italic:true}.
 */
export function parseVariant(v: string): { weight: string; italic: boolean } {
  const italic = v.endsWith('italic') || v === 'italic';
  const numeric = v.replace(/italic/, '').trim();
  if (!numeric || numeric === 'regular') return { weight: '400', italic };
  return { weight: numeric, italic };
}

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

/** Extract the distinct numeric weights a family supports (sorted ascending). */
export function weightsForFamily(variants: string[] | undefined): string[] {
  if (!variants || variants.length === 0) return ['400'];
  const set = new Set<string>();
  for (const v of variants) {
    const { weight } = parseVariant(v);
    set.add(weight);
  }
  // System families don't ship variant lists from Google — accept any weight.
  if (set.size === 0) return ['400'];
  return Array.from(set).sort((a, b) => Number(a) - Number(b));
}

/** Whether a family has italic variants. */
export function familySupportsItalic(variants: string[] | undefined): boolean {
  if (!variants) return true; // System fonts always support italic
  return variants.some((v) => v.includes('italic'));
}
