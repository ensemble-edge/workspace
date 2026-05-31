/**
 * Load BrandColorsDoc from brand_tokens.
 *
 * v0.1.55. The doc is a single JSON blob stored at:
 *   category='colors', key='brand_colors_v1', locale=''
 *
 * On miss, returns defaultBrandColors() so a fresh workspace
 * still renders sensibly.
 */
import type { D1Database } from '@cloudflare/workers-types';
import { defaultBrandColors, type BrandColorsDoc } from './schema';

export async function loadBrandColors(db: D1Database, workspaceId: string): Promise<BrandColorsDoc> {
  try {
    const row = await db
      .prepare(`SELECT value FROM brand_tokens WHERE workspace_id = ? AND category = 'colors' AND key = 'brand_colors_v1' AND locale = ''`)
      .bind(workspaceId)
      .first<{ value: string }>();
    if (!row?.value) return defaultBrandColors();
    const parsed = JSON.parse(row.value) as Partial<BrandColorsDoc>;
    // Merge with defaults so a doc missing newer fields still works
    // — defensive against future schema additions. version: 1
    // forced because that's what loaders below assume.
    const def = defaultBrandColors();
    return {
      version: 1,
      palettes: {
        primary:   { ...def.palettes.primary,   ...(parsed.palettes?.primary   ?? {}) },
        secondary: { ...def.palettes.secondary, ...(parsed.palettes?.secondary ?? {}) },
        accent:    { ...def.palettes.accent,    ...(parsed.palettes?.accent    ?? {}) },
        // v0.1.100: load up to 3 additional accents. Clamp at 3 in
        // case a corrupted doc somehow has more; downstream UI also
        // enforces the cap on save.
        ...(Array.isArray(parsed.palettes?.accentExtras) && parsed.palettes!.accentExtras!.length > 0
          ? { accentExtras: parsed.palettes!.accentExtras!.slice(0, 3) }
          : {}),
        neutral:   { ...def.palettes.neutral,   ...(parsed.palettes?.neutral   ?? {}) },
      },
      gradients: parsed.gradients ?? def.gradients,
      themes: {
        light: parsed.themes?.light ?? def.themes.light,
        dark:  parsed.themes?.dark, // undefined is the correct "no dark theme" state
      },
      semantic: { ...def.semantic, ...(parsed.semantic ?? {}) },
    };
  } catch {
    return defaultBrandColors();
  }
}
