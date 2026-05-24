/**
 * Save BrandColorsDoc + compute the changed-keys diff for the
 * brand.tokens.changed event payload (per spec Q10).
 *
 * v0.1.55. Writes the doc as a single JSON blob to brand_tokens
 * under category='colors', key='brand_colors_v1'. Atomic — either
 * the row updates or it doesn't; no half-written state.
 *
 * The diff payload lets downstream subscribers re-render only what
 * actually changed. Examples:
 *   - Operator renamed a palette → no rerender needed for variants
 *     matrix (token refs are stable; names are display-only).
 *   - Operator changed primary.main → re-render all variants whose
 *     finish or background resolves through primary.
 *   - Operator added a gradient → only the BrandCard's Gradients
 *     section needs to re-render.
 */
import type { D1Database } from '@cloudflare/workers-types';
import type { BrandColorsDoc } from './schema';

export async function saveBrandColors(
  db: D1Database,
  workspaceId: string,
  doc: BrandColorsDoc,
): Promise<void> {
  await db.prepare(
    `INSERT INTO brand_tokens (workspace_id, category, key, value, type, locale, updated_at)
     VALUES (?, 'colors', 'brand_colors_v1', ?, 'text', '', datetime('now'))
     ON CONFLICT (workspace_id, category, key, locale)
     DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
  ).bind(workspaceId, JSON.stringify(doc)).run();
}

/* ──────────────────────────────────────────────────────────────
 * Diff computation — for brand.tokens.changed payload
 * ──────────────────────────────────────────────────────────── */

/**
 * Compare two BrandColorsDoc snapshots and return a structured
 * description of what changed. Returned shape becomes the
 * `data` payload of the brand.tokens.changed event.
 *
 * Granular enough that subscribers can:
 *   - Match "did anything that affects render output change?"
 *     (palettes, themes, semantic — yes; just gradient names — no)
 *   - Render only what actually changed.
 *
 * Returned shape is intentionally JSON-serializable for the
 * event bus / iframe postMessage path.
 */
export interface BrandColorsDiff {
  palettes: Array<'primary' | 'secondary' | 'accent' | 'neutral'>;
  /** True when light theme bindings changed. */
  themeLight: boolean;
  /** True when dark theme bindings changed (or dark theme was
   *  added/removed). */
  themeDark: boolean;
  /** Gradient slugs that were added, removed, or changed. */
  gradients: string[];
  /** Semantic role names that changed. */
  semantic: Array<'success' | 'info' | 'warning' | 'error'>;
}

export function diffBrandColors(prev: BrandColorsDoc, next: BrandColorsDoc): BrandColorsDiff {
  const out: BrandColorsDiff = {
    palettes: [],
    themeLight: false,
    themeDark: false,
    gradients: [],
    semantic: [],
  };

  const roles = ['primary', 'secondary', 'accent', 'neutral'] as const;
  for (const role of roles) {
    if (JSON.stringify(prev.palettes[role]) !== JSON.stringify(next.palettes[role])) {
      out.palettes.push(role);
    }
  }

  if (JSON.stringify(prev.themes.light) !== JSON.stringify(next.themes.light)) {
    out.themeLight = true;
  }
  if (JSON.stringify(prev.themes.dark ?? null) !== JSON.stringify(next.themes.dark ?? null)) {
    out.themeDark = true;
  }

  // Gradient diff: compare by slug.
  const prevSlugs = new Map(prev.gradients.map((g) => [g.slug, g]));
  const nextSlugs = new Map(next.gradients.map((g) => [g.slug, g]));
  const allSlugs = new Set([...prevSlugs.keys(), ...nextSlugs.keys()]);
  for (const slug of allSlugs) {
    const p = prevSlugs.get(slug);
    const n = nextSlugs.get(slug);
    if (!p || !n || JSON.stringify(p) !== JSON.stringify(n)) {
      out.gradients.push(slug);
    }
  }

  const sems = ['success', 'info', 'warning', 'error'] as const;
  for (const s of sems) {
    if (JSON.stringify(prev.semantic[s]) !== JSON.stringify(next.semantic[s])) {
      out.semantic.push(s);
    }
  }

  return out;
}

/**
 * True when the diff would change any rendered output (palettes,
 * themes, semantic). Gradient changes that don't affect output —
 * like a name-only edit — are excluded. Used by the brand-css
 * endpoint to know when to bump its ETag.
 */
export function diffAffectsRender(diff: BrandColorsDiff): boolean {
  return (
    diff.palettes.length > 0 ||
    diff.themeLight ||
    diff.themeDark ||
    diff.gradients.length > 0 ||
    diff.semantic.length > 0
  );
}
