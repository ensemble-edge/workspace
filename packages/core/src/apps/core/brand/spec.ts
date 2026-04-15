/**
 * Ensemble Brand Spec — The canonical brand format.
 *
 * One spec, multiple renderings:
 *   /_ensemble/brand/spec     → JSON (machine consumption, import/export)
 *   /_ensemble/brand/css      → CSS custom properties (websites)
 *   /_ensemble/brand/context  → Markdown (AI system prompts)
 *   /_ensemble/brand/page     → HTML (human-readable brand page)
 *
 * The spec is the single source of truth. Everything else is derived from it.
 */

// ============================================================================
// Brand Spec Type
// ============================================================================

export interface EnsembleBrandSpec {
  /** Format version — tools check this to know how to parse */
  ensemble_brand: '1.0';

  /** When this spec was last modified */
  updated_at: string;

  /** Company identity */
  identity: {
    display_name: string;
    legal_name?: string;
    founding_year?: string;
    headquarters?: string;
    website?: string;
    industry?: string;
    /** User-defined custom fields */
    custom?: Record<string, CustomField>;
  };

  /** Color system */
  colors: {
    /** Named color groups (e.g., "Slate", "Gold", "Vermillion") */
    groups: ColorGroup[];
    /** Semantic colors for UI states */
    semantic: {
      success: string;
      'success-light'?: string;
      info: string;
      'info-light'?: string;
      warning: string;
      'warning-light'?: string;
      error: string;
      'error-light'?: string;
    };
  };

  /** Typography system */
  typography: {
    display?: FontSpec;
    heading?: FontSpec;
    body?: FontSpec;
    mono?: FontSpec;
    /** Custom font URLs (Google Fonts, etc.) */
    font_urls?: string[];
  };

  /** Logo assets */
  logos: {
    wordmark?: string;
    wordmark_dark?: string;
    icon_mark?: string;
    icon_mark_dark?: string;
    favicon?: string;
    social_avatar?: string;
    og_image?: string;
  };

  /** Brand messaging and voice */
  messaging: {
    tagline?: string;
    elevator_pitch?: string;
    mission?: string;
    boilerplate?: string;
    legal_footer?: string;
    value_props?: Array<{ headline: string; description: string }>;
    tone?: {
      descriptors?: string[];
      avoid?: string[];
      voice_guidelines?: string;
    };
    /** User-defined custom fields */
    custom?: Record<string, CustomField>;
  };

  /** Spatial/layout tokens */
  spatial?: {
    radius?: string;
    radius_lg?: string;
    spacing_unit?: string;
  };

  /** Gradient definitions */
  gradients?: Record<string, string>;

  /** URLs for consuming this brand */
  endpoints?: {
    spec?: string;
    css?: string;
    context?: string;
    tokens?: string;
  };
}

export interface ColorGroup {
  slug: string;
  label: string;
  shades: Record<string, string>;
}

export interface FontSpec {
  family: string;
  weight?: string;
  category?: 'serif' | 'sans-serif' | 'monospace' | 'display';
}

export interface CustomField {
  value: string;
  type: 'text' | 'color' | 'url' | 'number' | 'rich_text';
  label: string;
  description?: string;
}

// ============================================================================
// Assemble Spec from DB
// ============================================================================

interface DbToken {
  category: string;
  key: string;
  value: string;
  type: string;
  label: string | null;
  description: string | null;
  group_slug: string | null;
}

interface DbGroup {
  slug: string;
  label: string;
  category: string;
}

/**
 * Assemble a complete EnsembleBrandSpec from D1 database tokens.
 */
export async function assembleBrandSpec(
  db: D1Database,
  workspaceId: string,
  baseUrl?: string,
): Promise<EnsembleBrandSpec> {
  // Fetch all tokens and groups in parallel
  const [tokensResult, groupsResult] = await Promise.all([
    db.prepare(
      `SELECT category, key, value, type, label, description, group_slug
       FROM brand_tokens WHERE workspace_id = ? AND locale = ''
       ORDER BY category, sort_order, key`
    ).bind(workspaceId).all<DbToken>(),
    db.prepare(
      `SELECT slug, label, category FROM brand_token_groups
       WHERE workspace_id = ? ORDER BY sort_order, label`
    ).bind(workspaceId).all<DbGroup>(),
  ]);

  const tokens = tokensResult.results || [];
  const groups = groupsResult.results || [];

  // Index tokens by category
  const byCategory = new Map<string, DbToken[]>();
  for (const t of tokens) {
    if (!byCategory.has(t.category)) byCategory.set(t.category, []);
    byCategory.get(t.category)!.push(t);
  }

  const get = (category: string, key: string) =>
    byCategory.get(category)?.find((t) => t.key === key)?.value;

  // ── Colors ──
  const colorGroups: ColorGroup[] = [];
  const colorTokens = byCategory.get('colors') || [];
  const colorGroupSlugs = new Set(groups.filter((g) => g.category === 'colors').map((g) => g.slug));

  // Build color groups from tokens with group_slug
  const groupShades = new Map<string, Record<string, string>>();
  const semanticColors: Record<string, string> = {};

  for (const t of colorTokens) {
    if (t.group_slug && colorGroupSlugs.has(t.group_slug)) {
      const shade = t.key.split('.').slice(1).join('.');
      if (shade) {
        if (!groupShades.has(t.group_slug)) groupShades.set(t.group_slug, {});
        groupShades.get(t.group_slug)![shade] = t.value;
      }
    } else if (t.key.startsWith('semantic.')) {
      semanticColors[t.key.replace('semantic.', '')] = t.value;
    }
  }

  for (const g of groups.filter((g) => g.category === 'colors')) {
    colorGroups.push({
      slug: g.slug,
      label: g.label,
      shades: groupShades.get(g.slug) || {},
    });
  }

  // ── Typography ──
  const typoTokens = byCategory.get('typography') || [];
  const typoMap = Object.fromEntries(typoTokens.map((t) => [t.key, t.value]));

  const FONT_CATEGORIES: Record<string, 'serif' | 'sans-serif' | 'monospace' | 'display'> = {
    gloock: 'serif', spectral: 'serif', playfair: 'serif',
    'dm-sans': 'sans-serif', inter: 'sans-serif', manrope: 'sans-serif',
    geist: 'sans-serif', roboto: 'sans-serif', system: 'sans-serif',
    'jetbrains-mono': 'monospace', 'fira-code': 'monospace',
  };

  const makeFontSpec = (key: string): FontSpec | undefined => {
    const val = typoMap[key];
    if (!val) return undefined;
    return { family: val, category: FONT_CATEGORIES[val] || 'sans-serif' };
  };

  // ── Identity ──
  const identityTokens = byCategory.get('identity') || [];
  const idMap = Object.fromEntries(identityTokens.map((t) => [t.key, t]));
  const identityCustom: Record<string, CustomField> = {};
  const knownIdentityKeys = new Set(['display_name', 'legal_name', 'founding_year', 'headquarters', 'website', 'industry']);

  for (const t of identityTokens) {
    if (!knownIdentityKeys.has(t.key) && !t.key.startsWith('logo_')) {
      identityCustom[t.key] = {
        value: t.value,
        type: t.type as CustomField['type'],
        label: t.label || t.key,
        description: t.description || undefined,
      };
    }
  }

  // ── Logos ──
  const logos: EnsembleBrandSpec['logos'] = {};
  for (const t of identityTokens) {
    if (t.key.startsWith('logo_')) {
      const logoKey = t.key.replace('logo_', '') as keyof typeof logos;
      (logos as Record<string, string>)[logoKey] = t.value;
    }
  }

  // ── Messaging ──
  const msgTokens = byCategory.get('messaging') || [];
  const msgMap = Object.fromEntries(msgTokens.map((t) => [t.key, t]));
  const msgCustom: Record<string, CustomField> = {};
  const knownMsgKeys = new Set([
    'tagline', 'elevator_pitch', 'mission', 'boilerplate', 'legal_footer',
    'value_props', 'tone_descriptors', 'tone_avoid', 'voice_guidelines',
  ]);

  for (const t of msgTokens) {
    if (!knownMsgKeys.has(t.key)) {
      msgCustom[t.key] = {
        value: t.value,
        type: t.type as CustomField['type'],
        label: t.label || t.key,
        description: t.description || undefined,
      };
    }
  }

  let valueProps: Array<{ headline: string; description: string }> | undefined;
  try {
    if (msgMap.value_props) valueProps = JSON.parse(msgMap.value_props.value);
  } catch { /* ignore */ }

  const toneDescriptors = msgMap.tone_descriptors?.value.split(',').map((s) => s.trim()).filter(Boolean);
  const toneAvoid = msgMap.tone_avoid?.value.split(',').map((s) => s.trim()).filter(Boolean);

  // ── Assemble ──
  const spec: EnsembleBrandSpec = {
    ensemble_brand: '1.0',
    updated_at: new Date().toISOString(),

    identity: {
      display_name: idMap.display_name?.value || '',
      legal_name: idMap.legal_name?.value || undefined,
      founding_year: idMap.founding_year?.value || undefined,
      headquarters: idMap.headquarters?.value || undefined,
      website: idMap.website?.value || undefined,
      industry: idMap.industry?.value || undefined,
      ...(Object.keys(identityCustom).length > 0 ? { custom: identityCustom } : {}),
    },

    colors: {
      groups: colorGroups,
      semantic: {
        success: semanticColors['success'] || '#5B8A72',
        'success-light': semanticColors['success-light'],
        info: semanticColors['info'] || '#6B8FAD',
        'info-light': semanticColors['info-light'],
        warning: semanticColors['warning'] || '#CB9661',
        'warning-light': semanticColors['warning-light'],
        error: semanticColors['error'] || '#C62828',
        'error-light': semanticColors['error-light'],
      },
    },

    typography: {
      display: makeFontSpec('display_font'),
      heading: makeFontSpec('heading_font'),
      body: makeFontSpec('body_font'),
      mono: makeFontSpec('mono_font'),
    },

    logos,

    messaging: {
      tagline: msgMap.tagline?.value || undefined,
      elevator_pitch: msgMap.elevator_pitch?.value || undefined,
      mission: msgMap.mission?.value || undefined,
      boilerplate: msgMap.boilerplate?.value || undefined,
      legal_footer: msgMap.legal_footer?.value || undefined,
      value_props: valueProps,
      tone: (toneDescriptors || toneAvoid || msgMap.voice_guidelines) ? {
        descriptors: toneDescriptors,
        avoid: toneAvoid,
        voice_guidelines: msgMap.voice_guidelines?.value || undefined,
      } : undefined,
      ...(Object.keys(msgCustom).length > 0 ? { custom: msgCustom } : {}),
    },

    ...(baseUrl ? {
      endpoints: {
        spec: `${baseUrl}/_ensemble/brand/spec`,
        css: `${baseUrl}/_ensemble/brand/css`,
        context: `${baseUrl}/_ensemble/brand/context`,
        tokens: `${baseUrl}/_ensemble/brand/tokens`,
      },
    } : {}),
  };

  return spec;
}

// ============================================================================
// Generate CSS from Spec
// ============================================================================

const FONT_FAMILIES: Record<string, string> = {
  system: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  inter: '"Inter", system-ui, sans-serif',
  manrope: '"Manrope", system-ui, sans-serif',
  geist: '"Geist", system-ui, sans-serif',
  spectral: '"Spectral", serif',
  gloock: '"Gloock", serif',
  playfair: '"Playfair Display", serif',
  roboto: '"Roboto", system-ui, sans-serif',
  'dm-sans': '"DM Sans", system-ui, sans-serif',
  'cal-sans': '"Cal Sans", system-ui, sans-serif',
  'jetbrains-mono': '"JetBrains Mono", monospace',
  'fira-code': '"Fira Code", monospace',
};

/**
 * Generate CSS custom properties from a brand spec.
 */
export function generateCssFromSpec(spec: EnsembleBrandSpec): string {
  const lines: string[] = [];
  lines.push(`/* Ensemble Brand Spec v${spec.ensemble_brand} — ${spec.identity.display_name || 'Workspace'} */`);
  lines.push('');

  // Google Fonts import
  const fontFamilies = [
    spec.typography.display?.family,
    spec.typography.heading?.family,
    spec.typography.body?.family,
    spec.typography.mono?.family,
  ].filter((f): f is string => !!f && f !== 'system');

  if (fontFamilies.length > 0) {
    const uniqueFonts = [...new Set(fontFamilies)];
    const params = uniqueFonts.map((f) => `family=${f.replace(/ /g, '+')}:wght@300;400;500;600;700`).join('&');
    lines.push(`@import url('https://fonts.googleapis.com/css2?${params}&display=swap');`);
    lines.push('');
  }

  lines.push(':root {');

  // Color groups
  for (const group of spec.colors.groups) {
    lines.push(`  /* ${group.label} */`);
    const sortedShades = Object.entries(group.shades).sort(([a], [b]) => Number(a) - Number(b));
    for (const [shade, hex] of sortedShades) {
      lines.push(`  --brand-${group.slug}-${shade}: ${hex};`);
    }
    lines.push('');
  }

  // Semantic colors
  lines.push('  /* Semantic */');
  for (const [key, value] of Object.entries(spec.colors.semantic)) {
    if (value) lines.push(`  --brand-${key}: ${value};`);
  }
  lines.push('');

  // Typography
  lines.push('  /* Typography */');
  if (spec.typography.display) {
    lines.push(`  --brand-font-display: ${FONT_FAMILIES[spec.typography.display.family] || `"${spec.typography.display.family}", sans-serif`};`);
  }
  if (spec.typography.heading) {
    lines.push(`  --brand-font-heading: ${FONT_FAMILIES[spec.typography.heading.family] || `"${spec.typography.heading.family}", sans-serif`};`);
  }
  if (spec.typography.body) {
    lines.push(`  --brand-font-body: ${FONT_FAMILIES[spec.typography.body.family] || `"${spec.typography.body.family}", sans-serif`};`);
  }
  if (spec.typography.mono) {
    lines.push(`  --brand-font-mono: ${FONT_FAMILIES[spec.typography.mono.family] || `"${spec.typography.mono.family}", monospace`};`);
  }
  lines.push('');

  // Spatial
  if (spec.spatial) {
    lines.push('  /* Spatial */');
    if (spec.spatial.radius) lines.push(`  --brand-radius: ${spec.spatial.radius};`);
    if (spec.spatial.radius_lg) lines.push(`  --brand-radius-lg: ${spec.spatial.radius_lg};`);
    if (spec.spatial.spacing_unit) lines.push(`  --brand-spacing: ${spec.spatial.spacing_unit};`);
    lines.push('');
  }

  // Gradients
  if (spec.gradients) {
    lines.push('  /* Gradients */');
    for (const [name, value] of Object.entries(spec.gradients)) {
      lines.push(`  --brand-gradient-${name}: ${value};`);
    }
    lines.push('');
  }

  lines.push('}');

  return lines.join('\n');
}

// ============================================================================
// Generate AI Context (Markdown) from Spec
// ============================================================================

/**
 * Generate a human/AI-readable markdown brand context from a spec.
 */
export function generateContextFromSpec(spec: EnsembleBrandSpec): string {
  const lines: string[] = [];
  const name = spec.identity.display_name || 'Workspace';

  lines.push(`# ${name} Brand Guide`);
  lines.push('');

  // Identity
  if (spec.identity.legal_name || spec.identity.industry || spec.identity.headquarters) {
    lines.push('## Company');
    if (spec.identity.legal_name) lines.push(`- **Legal name:** ${spec.identity.legal_name}`);
    if (spec.identity.industry) lines.push(`- **Industry:** ${spec.identity.industry}`);
    if (spec.identity.headquarters) lines.push(`- **Headquarters:** ${spec.identity.headquarters}`);
    if (spec.identity.founding_year) lines.push(`- **Founded:** ${spec.identity.founding_year}`);
    if (spec.identity.website) lines.push(`- **Website:** ${spec.identity.website}`);
    if (spec.identity.custom) {
      for (const [key, field] of Object.entries(spec.identity.custom)) {
        lines.push(`- **${field.label}:** ${field.value}`);
      }
    }
    lines.push('');
  }

  // Messaging
  if (spec.messaging.tagline || spec.messaging.mission) {
    lines.push('## Messaging');
    if (spec.messaging.tagline) lines.push(`**Tagline:** "${spec.messaging.tagline}"`);
    if (spec.messaging.elevator_pitch) {
      lines.push('');
      lines.push(`**Elevator pitch:** ${spec.messaging.elevator_pitch}`);
    }
    if (spec.messaging.mission) {
      lines.push('');
      lines.push(`**Mission:** ${spec.messaging.mission}`);
    }
    if (spec.messaging.value_props?.length) {
      lines.push('');
      lines.push('**Value propositions:**');
      for (const vp of spec.messaging.value_props) {
        lines.push(`- **${vp.headline}** — ${vp.description}`);
      }
    }
    if (spec.messaging.custom) {
      for (const [key, field] of Object.entries(spec.messaging.custom)) {
        lines.push(`- **${field.label}:** ${field.value}`);
      }
    }
    lines.push('');
  }

  // Tone
  if (spec.messaging.tone) {
    lines.push('## Voice & Tone');
    if (spec.messaging.tone.descriptors?.length) {
      lines.push(`**Tone:** ${spec.messaging.tone.descriptors.join(', ')}`);
    }
    if (spec.messaging.tone.avoid?.length) {
      lines.push(`**Avoid:** ${spec.messaging.tone.avoid.join(', ')}`);
    }
    if (spec.messaging.tone.voice_guidelines) {
      lines.push('');
      lines.push(spec.messaging.tone.voice_guidelines);
    }
    lines.push('');
  }

  // Colors
  if (spec.colors.groups.length > 0) {
    lines.push('## Colors');
    for (const group of spec.colors.groups) {
      const shadeList = Object.entries(group.shades)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([shade, hex]) => `${shade}: ${hex}`)
        .join(', ');
      lines.push(`- **${group.label}:** ${shadeList}`);
    }
    lines.push(`- **Success:** ${spec.colors.semantic.success} | **Error:** ${spec.colors.semantic.error} | **Warning:** ${spec.colors.semantic.warning} | **Info:** ${spec.colors.semantic.info}`);
    lines.push('');
  }

  // Typography
  if (spec.typography.heading || spec.typography.body) {
    lines.push('## Typography');
    if (spec.typography.display) lines.push(`- **Display:** ${spec.typography.display.family} (${spec.typography.display.category})`);
    if (spec.typography.heading) lines.push(`- **Headings:** ${spec.typography.heading.family} (${spec.typography.heading.category})`);
    if (spec.typography.body) lines.push(`- **Body:** ${spec.typography.body.family} (${spec.typography.body.category})`);
    if (spec.typography.mono) lines.push(`- **Code:** ${spec.typography.mono.family} (${spec.typography.mono.category})`);
    lines.push('');
  }

  // Boilerplate
  if (spec.messaging.boilerplate) {
    lines.push('## Boilerplate');
    lines.push(spec.messaging.boilerplate);
    lines.push('');
  }

  if (spec.messaging.legal_footer) {
    const year = new Date().getFullYear().toString();
    lines.push(`*${spec.messaging.legal_footer.replace('{year}', year)}*`);
  }

  return lines.join('\n');
}

// ============================================================================
// Import Spec into DB (graceful merge)
// ============================================================================

/**
 * Import a brand spec into a workspace, merging with existing data.
 * Custom fields in identity and messaging are created automatically.
 */
export async function importBrandSpec(
  db: D1Database,
  workspaceId: string,
  spec: EnsembleBrandSpec,
  overwrite: boolean = false,
): Promise<{ created: number; updated: number; skipped: number }> {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  const upsertToken = async (
    category: string,
    key: string,
    value: string,
    type: string = 'text',
    label?: string,
    groupSlug?: string,
    sortOrder: number = 0,
  ) => {
    if (!overwrite) {
      const existing = await db.prepare(
        `SELECT value FROM brand_tokens WHERE workspace_id = ? AND category = ? AND key = ? AND locale = ''`
      ).bind(workspaceId, category, key).first();
      if (existing) { skipped++; return; }
    }

    const result = await db.prepare(
      `INSERT INTO brand_tokens (workspace_id, category, key, value, type, label, group_slug, sort_order, locale, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', datetime('now'))
       ON CONFLICT (workspace_id, category, key, locale)
       DO UPDATE SET value = excluded.value, type = excluded.type, label = excluded.label,
                     group_slug = excluded.group_slug, sort_order = excluded.sort_order, updated_at = datetime('now')`
    ).bind(workspaceId, category, key, value, type, label || null, groupSlug || null, sortOrder).run();

    if (result.meta.changes > 0) {
      // Can't distinguish insert vs update easily, count as created for new imports
      if (overwrite) updated++; else created++;
    }
  };

  // Identity
  if (spec.identity.display_name) await upsertToken('identity', 'display_name', spec.identity.display_name);
  if (spec.identity.legal_name) await upsertToken('identity', 'legal_name', spec.identity.legal_name);
  if (spec.identity.founding_year) await upsertToken('identity', 'founding_year', spec.identity.founding_year);
  if (spec.identity.headquarters) await upsertToken('identity', 'headquarters', spec.identity.headquarters);
  if (spec.identity.website) await upsertToken('identity', 'website', spec.identity.website, 'url');
  if (spec.identity.industry) await upsertToken('identity', 'industry', spec.identity.industry);
  if (spec.identity.custom) {
    for (const [key, field] of Object.entries(spec.identity.custom)) {
      await upsertToken('identity', key, field.value, field.type, field.label);
    }
  }

  // Colors
  for (const group of spec.colors.groups) {
    // Create group
    await db.prepare(
      `INSERT INTO brand_token_groups (workspace_id, slug, label, category)
       VALUES (?, ?, ?, 'colors')
       ON CONFLICT (workspace_id, slug) DO UPDATE SET label = excluded.label`
    ).bind(workspaceId, group.slug, group.label).run();

    let sortOrder = 0;
    for (const [shade, hex] of Object.entries(group.shades)) {
      await upsertToken('colors', `${group.slug}.${shade}`, hex, 'color', `${group.label} ${shade}`, group.slug, sortOrder++);
    }
  }

  // Semantic colors
  for (const [key, value] of Object.entries(spec.colors.semantic)) {
    if (value) await upsertToken('colors', `semantic.${key}`, value, 'color');
  }

  // Typography
  if (spec.typography.display) await upsertToken('typography', 'display_font', spec.typography.display.family, 'font');
  if (spec.typography.heading) await upsertToken('typography', 'heading_font', spec.typography.heading.family, 'font');
  if (spec.typography.body) await upsertToken('typography', 'body_font', spec.typography.body.family, 'font');
  if (spec.typography.mono) await upsertToken('typography', 'mono_font', spec.typography.mono.family, 'font');

  // Logos
  for (const [key, url] of Object.entries(spec.logos)) {
    if (url) await upsertToken('identity', `logo_${key}`, url, 'url');
  }

  // Messaging
  if (spec.messaging.tagline) await upsertToken('messaging', 'tagline', spec.messaging.tagline);
  if (spec.messaging.elevator_pitch) await upsertToken('messaging', 'elevator_pitch', spec.messaging.elevator_pitch);
  if (spec.messaging.mission) await upsertToken('messaging', 'mission', spec.messaging.mission);
  if (spec.messaging.boilerplate) await upsertToken('messaging', 'boilerplate', spec.messaging.boilerplate);
  if (spec.messaging.legal_footer) await upsertToken('messaging', 'legal_footer', spec.messaging.legal_footer);
  if (spec.messaging.value_props) {
    await upsertToken('messaging', 'value_props', JSON.stringify(spec.messaging.value_props));
  }
  if (spec.messaging.tone?.descriptors) {
    await upsertToken('messaging', 'tone_descriptors', spec.messaging.tone.descriptors.join(', '));
  }
  if (spec.messaging.tone?.avoid) {
    await upsertToken('messaging', 'tone_avoid', spec.messaging.tone.avoid.join(', '));
  }
  if (spec.messaging.tone?.voice_guidelines) {
    await upsertToken('messaging', 'voice_guidelines', spec.messaging.tone.voice_guidelines);
  }
  if (spec.messaging.custom) {
    for (const [key, field] of Object.entries(spec.messaging.custom)) {
      await upsertToken('messaging', key, field.value, field.type, field.label);
    }
  }

  return { created, updated, skipped };
}
