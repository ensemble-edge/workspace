/**
 * Brand CSS Generation
 *
 * Now delegates to the brand spec system:
 * 1. Assembles the full EnsembleBrandSpec from D1
 * 2. Generates CSS from the spec (brand tokens as --brand-* variables)
 * 3. Also generates workspace shell CSS (--background, --font-body, etc.)
 *
 * The CSS endpoint serves BOTH:
 * - Brand CSS (--brand-*) for external projects
 * - Shell CSS (shadcn/ui variables) for the workspace UI
 */

import { assembleBrandSpec, generateCssFromSpec } from './spec';
import { getThemePreset } from './themes';

/** Font family map — shared with shell Appearance tab */
export const FONT_FAMILIES: Record<string, string> = {
  system: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  inter: '"Inter", system-ui, sans-serif',
  manrope: '"Manrope", system-ui, sans-serif',
  geist: '"Geist", system-ui, sans-serif',
  'cal-sans': '"Cal Sans", system-ui, sans-serif',
  roboto: '"Roboto", system-ui, sans-serif',
  'dm-sans': '"DM Sans", system-ui, sans-serif',
  spectral: '"Spectral", serif',
  gloock: '"Gloock", serif',
  playfair: '"Playfair Display", serif',
};

/** Base color scales — HSL values for shadcn/ui dark mode */
export const BASE_COLOR_SCALES: Record<string, { bg: string; fg: string; border: string }> = {
  zinc: { bg: '240 10% 3.9%', fg: '0 0% 98%', border: '240 3.7% 15.9%' },
  slate: { bg: '222.2 84% 4.9%', fg: '210 40% 98%', border: '217.2 32.6% 17.5%' },
  stone: { bg: '20 14.3% 4.1%', fg: '60 9.1% 97.8%', border: '12 6.5% 15.1%' },
  gray: { bg: '224 71.4% 4.1%', fg: '210 20% 98%', border: '215 27.9% 16.9%' },
  neutral: { bg: '0 0% 3.9%', fg: '0 0% 98%', border: '0 0% 14.9%' },
};

/**
 * Generate the full CSS output for /_ensemble/brand/css.
 *
 * This includes:
 * 1. Brand CSS (--brand-* variables from the spec)
 * 2. Shell CSS (shadcn/ui variables for workspace appearance)
 */
export async function generateBrandCss(
  db: D1Database,
  workspaceId: string,
  defaultAccent: string,
): Promise<string> {
  // Assemble full spec
  const spec = await assembleBrandSpec(db, workspaceId);

  // Generate brand CSS from spec
  const brandCss = generateCssFromSpec(spec);

  // Also generate shell CSS (workspace appearance settings from 'custom' category)
  const shellCss = await generateShellCss(db, workspaceId, defaultAccent);

  return `${brandCss}\n\n${shellCss}`;
}

/**
 * Generate shell-specific CSS with FULL shadcn/ui color scale.
 *
 * Also exports the saved themeMode so the HTML can set `class="dark"`.
 */
async function generateShellCss(
  db: D1Database,
  workspaceId: string,
  defaultAccent: string,
): Promise<string> {
  let accent = defaultAccent;
  const customTokens: Record<string, string> = {};
  const brandTokens: Record<string, string> = {};

  try {
    const result = await db.prepare(
      `SELECT category, key, value FROM brand_tokens
       WHERE workspace_id = ? AND locale = '' AND category IN ('colors', 'custom')`
    ).bind(workspaceId).all<{ category: string; key: string; value: string }>();

    for (const row of result.results || []) {
      if (row.category === 'colors' && row.key === 'accent') accent = row.value;
      if (row.category === 'colors') brandTokens[row.key] = row.value;
      if (row.category === 'custom') customTokens[row.key] = row.value;
    }
    // Workspace accent color overrides brand accent
    if (customTokens.accentColor) accent = customTokens.accentColor;
  } catch {
    // Use defaults
  }

  const radius = customTokens.radius || '0.5';
  const headingFont = customTokens.headingFont || 'dm-sans';
  const bodyFont = customTokens.bodyFont || 'dm-sans';
  const themeMode = customTokens.themeMode || 'dark';
  const contentPadding = customTokens.contentPadding || '1.5';
  const cardPadding = customTokens.cardPadding || '1.5';
  const themePresetId = customTokens.themePreset || 'default';

  const resolvedHeadingFont = FONT_FAMILIES[headingFont] || FONT_FAMILIES['dm-sans'];
  const resolvedBodyFont = FONT_FAMILIES[bodyFont] || FONT_FAMILIES['dm-sans'];

  // Start from the theme preset (provides coordinated light + dark scales)
  // "brand" preset uses "default" as base — brand colors are applied via individual overrides
  const preset = getThemePreset(themePresetId === 'brand' ? 'default' : themePresetId) || getThemePreset('default')!;
  const lightScale: Record<string, string> = { ...preset.light };
  const darkScale: Record<string, string> = { ...preset.dark };

  // For "brand" preset, read colors directly from brand_tokens (live)
  // This means changing brand colors auto-updates the workspace appearance
  if (themePresetId === 'brand') {
    const bp = brandTokens['brand-primary'];
    const bs = brandTokens['brand-secondary'];
    const ba = brandTokens['brand-accent'];

    if (bp && !customTokens.buttonColor) customTokens.buttonColor = bp;
    if (ba && !customTokens.accentColor) customTokens.accentColor = ba;
    if (bs && !customTokens.sidebarColor) customTokens.sidebarColor = bs;

    // Pull brand semantic colors into workspace if not overridden
    for (const key of ['semantic.success', 'semantic.warning', 'semantic.error', 'semantic.info']) {
      const val = brandTokens[key];
      const wsKey = key.replace('semantic.', '') + 'Color';
      if (val && !customTokens[wsKey]) customTokens[wsKey] = val;
    }
  }

  // Apply user overrides on top of the preset

  // Primary color (buttons, badges, checkbox, switch, slider, links, focus ring)
  const buttonColorHex = customTokens.buttonColor || '';
  if (buttonColorHex) {
    const hsl = hexToHslString(buttonColorHex);
    if (hsl) {
      const fg = isLightHex(buttonColorHex) ? '0 0% 9%' : '0 0% 98%';
      lightScale.primary = hsl; lightScale['primary-foreground'] = fg;
      lightScale.ring = hsl;
      lightScale['sidebar-primary'] = hsl; lightScale['sidebar-primary-foreground'] = fg;
      darkScale.primary = hsl; darkScale['primary-foreground'] = fg;
      darkScale.ring = hsl;
      darkScale['sidebar-primary'] = hsl; darkScale['sidebar-primary-foreground'] = fg;
    }
  }

  // Accent color (sidebar hover/active)
  const accentColorHex = customTokens.accentColor || '';
  if (accentColorHex) {
    const hsl = hexToHslString(accentColorHex);
    if (hsl) {
      const fg = isLightHex(accentColorHex) ? '0 0% 9%' : '0 0% 98%';
      lightScale['sidebar-accent'] = hsl; lightScale['sidebar-accent-foreground'] = fg;
      darkScale['sidebar-accent'] = hsl; darkScale['sidebar-accent-foreground'] = fg;
    }
  }

  // Canvas color (page background)
  const canvasColorHex = customTokens.canvasColor || '';
  if (canvasColorHex) {
    const hsl = hexToHslString(canvasColorHex);
    if (hsl) {
      const isLight = isLightHex(canvasColorHex);
      lightScale.background = hsl;
      lightScale.foreground = isLight ? '0 0% 9%' : '0 0% 98%';
      // Auto-generate dark variant from same hue
      const darkBg = autoDarkVariant(canvasColorHex);
      if (darkBg) {
        darkScale.background = darkBg;
        darkScale.foreground = '0 0% 98%';
      }
    }
  }

  // Sidebar color
  const sidebarColorHex = customTokens.sidebarColor || '';
  if (sidebarColorHex) {
    const hsl = hexToHslString(sidebarColorHex);
    if (hsl) {
      const isLight = isLightHex(sidebarColorHex);
      const fg = isLight ? '0 0% 20%' : '0 0% 90%';
      lightScale['sidebar-background'] = hsl; lightScale['sidebar-foreground'] = fg;
      darkScale['sidebar-background'] = hsl; darkScale['sidebar-foreground'] = fg;
    }
  }

  // Card color (card/popover surfaces)
  const cardColorHex = customTokens.cardColor || '';
  if (cardColorHex) {
    const hsl = hexToHslString(cardColorHex);
    if (hsl) {
      const isLight = isLightHex(cardColorHex);
      const fg = isLight ? '0 0% 9%' : '0 0% 98%';
      const mutedFg = isLight ? '0 0% 40%' : '0 0% 65%';
      lightScale.card = hsl; lightScale['card-foreground'] = fg;
      lightScale.popover = hsl; lightScale['popover-foreground'] = fg;
      lightScale['muted-foreground'] = mutedFg;
      darkScale.card = hsl; darkScale['card-foreground'] = fg;
      darkScale.popover = hsl; darkScale['popover-foreground'] = fg;
      darkScale['muted-foreground'] = mutedFg;
    }
  }

  // Semantic color overrides (error uses --destructive which is standard shadcn)
  const errorHex = customTokens.errorColor || '';
  if (errorHex) {
    const hsl = hexToHslString(errorHex);
    if (hsl) {
      const fg = isLightHex(errorHex) ? '0 0% 9%' : '0 0% 98%';
      lightScale.destructive = hsl; lightScale['destructive-foreground'] = fg;
      darkScale.destructive = hsl; darkScale['destructive-foreground'] = fg;
    }
  }

  // Emit HSL triplets. Tailwind v4's @theme block wraps them:
  // --color-primary: hsl(var(--primary)). Since brand/css loads AFTER
  // shell.css, our :root values for --primary etc. take effect, and
  // the @theme hsl() wrapper reads them at computed value time.
  const emitVars = (scale: Record<string, string>) =>
    Object.entries(scale).map(([k, v]) => `  --${k}: ${v};`).join('\n');

  const lightVars = emitVars(lightScale);
  const darkVars = emitVars(darkScale);

  return `
/* Workspace Shell Theme (${themePresetId} theme, ${themeMode} mode) */

/* Shared tokens */
:root {
  --color-accent: ${accent};
  --color-accent-hover: color-mix(in srgb, ${accent} 85%, white);
  --color-accent-dim: color-mix(in srgb, ${accent} 20%, transparent);
  --font-heading: ${resolvedHeadingFont};
  --font-body: ${resolvedBodyFont};
  --font-mono: 'JetBrains Mono', monospace;
  --radius: ${radius}rem;
  --content-padding: ${contentPadding}rem;
  --card-padding: ${cardPadding}rem;
  --chart-1: 220 70% 50%;
  --color-success: ${customTokens.successColor || '#16a34a'};
  --color-warning: ${customTokens.warningColor || '#ca8a04'};
  --color-error: ${customTokens.errorColor || '#dc2626'};
  --color-info: ${customTokens.infoColor || '#2563eb'};
}

/* Light mode (default) */
:root {
${lightVars}
}

/* Dark mode */
.dark {
${darkVars}
}`.trim();
}

/**
 * Get the saved theme mode for the HTML class attribute.
 * 'system' means respect prefers-color-scheme — we default to dark for server render.
 */
export async function getSavedThemeMode(
  db: D1Database,
  workspaceId: string,
): Promise<'light' | 'dark' | 'system'> {
  try {
    const result = await db.prepare(
      `SELECT value FROM brand_tokens WHERE workspace_id = ? AND category = 'custom' AND key = 'themeMode' AND locale = ''`
    ).bind(workspaceId).first<{ value: string }>();
    return (result?.value as 'light' | 'dark' | 'system') || 'dark';
  } catch {
    return 'dark';
  }
}

/** Convert hex color to HSL string for CSS variables (e.g., "240 10% 3.9%") */
function hexToHslString(hex: string): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${(h * 360).toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%`;
}

/** Check if hex color is light (luminance > 0.5) */
function isLightHex(hex: string): boolean {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return false;
  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5;
}

/**
 * Auto-generate a dark mode variant from a hex color.
 * Preserves the hue, reduces saturation slightly, sets lightness to ~5%.
 */
function autoDarkVariant(hex: string): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = d / (2 - max - min); // Use the formula for l > 0.5 doesn't matter for hue
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  // Keep hue, reduce saturation to 70% of original, set lightness to 5%
  return `${(h * 360).toFixed(1)} ${Math.max(5, s * 70).toFixed(1)}% 5%`;
}
