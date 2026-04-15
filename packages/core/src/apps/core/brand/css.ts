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

  try {
    const result = await db.prepare(
      `SELECT category, key, value FROM brand_tokens
       WHERE workspace_id = ? AND locale = '' AND category IN ('colors', 'custom')`
    ).bind(workspaceId).all<{ category: string; key: string; value: string }>();

    for (const row of result.results || []) {
      if (row.category === 'colors' && row.key === 'accent') accent = row.value;
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
  const baseColor = customTokens.baseColor || 'zinc';
  const chartColor = customTokens.chartColor || 'blue';
  const themeMode = customTokens.themeMode || 'dark';
  const contentPadding = customTokens.contentPadding || '1.5';
  const cardPadding = customTokens.cardPadding || '1.5';

  const resolvedHeadingFont = FONT_FAMILIES[headingFont] || FONT_FAMILIES['dm-sans'];
  const resolvedBodyFont = FONT_FAMILIES[bodyFont] || FONT_FAMILIES['dm-sans'];

  // Full shadcn/ui color scales (dark and light)
  const darkScales: Record<string, Record<string, string>> = {
    zinc: { background: '240 10% 3.9%', foreground: '0 0% 98%', card: '240 10% 3.9%', 'card-foreground': '0 0% 98%', popover: '240 10% 3.9%', 'popover-foreground': '0 0% 98%', primary: '0 0% 98%', 'primary-foreground': '240 5.9% 10%', secondary: '240 3.7% 15.9%', 'secondary-foreground': '0 0% 98%', muted: '240 3.7% 15.9%', 'muted-foreground': '240 5% 64.9%', accent: '240 3.7% 15.9%', 'accent-foreground': '0 0% 98%', destructive: '0 62.8% 30.6%', 'destructive-foreground': '0 0% 98%', border: '240 3.7% 15.9%', input: '240 3.7% 15.9%', ring: '240 4.9% 83.9%', 'sidebar-background': '240 5.9% 10%', 'sidebar-foreground': '240 4.8% 95.9%', 'sidebar-primary': '224.3 76.3% 48%', 'sidebar-primary-foreground': '0 0% 100%', 'sidebar-accent': '240 3.7% 15.9%', 'sidebar-accent-foreground': '240 4.8% 95.9%', 'sidebar-border': '240 3.7% 15.9%', 'sidebar-ring': '217.2 91.2% 59.8%' },
    slate: { background: '222.2 84% 4.9%', foreground: '210 40% 98%', card: '222.2 84% 4.9%', 'card-foreground': '210 40% 98%', popover: '222.2 84% 4.9%', 'popover-foreground': '210 40% 98%', primary: '210 40% 98%', 'primary-foreground': '222.2 47.4% 11.2%', secondary: '217.2 32.6% 17.5%', 'secondary-foreground': '210 40% 98%', muted: '217.2 32.6% 17.5%', 'muted-foreground': '215 20.2% 65.1%', accent: '217.2 32.6% 17.5%', 'accent-foreground': '210 40% 98%', destructive: '0 62.8% 30.6%', 'destructive-foreground': '210 40% 98%', border: '217.2 32.6% 17.5%', input: '217.2 32.6% 17.5%', ring: '212.7 26.8% 83.9%', 'sidebar-background': '222.2 47.4% 11.2%', 'sidebar-foreground': '210 40% 96%', 'sidebar-primary': '217.2 91.2% 59.8%', 'sidebar-primary-foreground': '0 0% 100%', 'sidebar-accent': '217.2 32.6% 17.5%', 'sidebar-accent-foreground': '210 40% 96%', 'sidebar-border': '217.2 32.6% 17.5%', 'sidebar-ring': '217.2 91.2% 59.8%' },
    stone: { background: '20 14.3% 4.1%', foreground: '60 9.1% 97.8%', card: '20 14.3% 4.1%', 'card-foreground': '60 9.1% 97.8%', popover: '20 14.3% 4.1%', 'popover-foreground': '60 9.1% 97.8%', primary: '60 9.1% 97.8%', 'primary-foreground': '24 9.8% 10%', secondary: '12 6.5% 15.1%', 'secondary-foreground': '60 9.1% 97.8%', muted: '12 6.5% 15.1%', 'muted-foreground': '24 5.4% 63.9%', accent: '12 6.5% 15.1%', 'accent-foreground': '60 9.1% 97.8%', destructive: '0 62.8% 30.6%', 'destructive-foreground': '60 9.1% 97.8%', border: '12 6.5% 15.1%', input: '12 6.5% 15.1%', ring: '24 5.7% 82.9%', 'sidebar-background': '24 9.8% 10%', 'sidebar-foreground': '60 9.1% 96%', 'sidebar-primary': '25 95% 53%', 'sidebar-primary-foreground': '0 0% 100%', 'sidebar-accent': '12 6.5% 15.1%', 'sidebar-accent-foreground': '60 9.1% 96%', 'sidebar-border': '12 6.5% 15.1%', 'sidebar-ring': '25 95% 53%' },
    gray: { background: '224 71.4% 4.1%', foreground: '210 20% 98%', card: '224 71.4% 4.1%', 'card-foreground': '210 20% 98%', popover: '224 71.4% 4.1%', 'popover-foreground': '210 20% 98%', primary: '210 20% 98%', 'primary-foreground': '220.9 39.3% 11%', secondary: '215 27.9% 16.9%', 'secondary-foreground': '210 20% 98%', muted: '215 27.9% 16.9%', 'muted-foreground': '217.9 10.6% 64.9%', accent: '215 27.9% 16.9%', 'accent-foreground': '210 20% 98%', destructive: '0 62.8% 30.6%', 'destructive-foreground': '210 20% 98%', border: '215 27.9% 16.9%', input: '215 27.9% 16.9%', ring: '216 12.2% 83.9%', 'sidebar-background': '220.9 39.3% 11%', 'sidebar-foreground': '210 20% 96%', 'sidebar-primary': '217.2 91.2% 59.8%', 'sidebar-primary-foreground': '0 0% 100%', 'sidebar-accent': '215 27.9% 16.9%', 'sidebar-accent-foreground': '210 20% 96%', 'sidebar-border': '215 27.9% 16.9%', 'sidebar-ring': '217.2 91.2% 59.8%' },
    neutral: { background: '0 0% 3.9%', foreground: '0 0% 98%', card: '0 0% 3.9%', 'card-foreground': '0 0% 98%', popover: '0 0% 3.9%', 'popover-foreground': '0 0% 98%', primary: '0 0% 98%', 'primary-foreground': '0 0% 9%', secondary: '0 0% 14.9%', 'secondary-foreground': '0 0% 98%', muted: '0 0% 14.9%', 'muted-foreground': '0 0% 63.9%', accent: '0 0% 14.9%', 'accent-foreground': '0 0% 98%', destructive: '0 62.8% 30.6%', 'destructive-foreground': '0 0% 98%', border: '0 0% 14.9%', input: '0 0% 14.9%', ring: '0 0% 83.1%', 'sidebar-background': '0 0% 9%', 'sidebar-foreground': '0 0% 96%', 'sidebar-primary': '0 0% 98%', 'sidebar-primary-foreground': '0 0% 9%', 'sidebar-accent': '0 0% 14.9%', 'sidebar-accent-foreground': '0 0% 96%', 'sidebar-border': '0 0% 14.9%', 'sidebar-ring': '0 0% 83.1%' },
  };

  const lightScales: Record<string, Record<string, string>> = {
    zinc: { background: '0 0% 100%', foreground: '240 10% 3.9%', card: '0 0% 100%', 'card-foreground': '240 10% 3.9%', popover: '0 0% 100%', 'popover-foreground': '240 10% 3.9%', primary: '240 5.9% 10%', 'primary-foreground': '0 0% 98%', secondary: '240 4.8% 95.9%', 'secondary-foreground': '240 5.9% 10%', muted: '240 4.8% 95.9%', 'muted-foreground': '240 3.8% 46.1%', accent: '240 4.8% 95.9%', 'accent-foreground': '240 5.9% 10%', destructive: '0 84.2% 60.2%', 'destructive-foreground': '0 0% 98%', border: '240 5.9% 90%', input: '240 5.9% 90%', ring: '240 5.9% 10%', 'sidebar-background': '0 0% 98%', 'sidebar-foreground': '240 5.3% 26.1%', 'sidebar-primary': '240 5.9% 10%', 'sidebar-primary-foreground': '0 0% 98%', 'sidebar-accent': '240 4.8% 95.9%', 'sidebar-accent-foreground': '240 5.9% 10%', 'sidebar-border': '220 13% 91%', 'sidebar-ring': '217.2 91.2% 59.8%' },
    slate: { background: '0 0% 100%', foreground: '222.2 84% 4.9%', card: '0 0% 100%', 'card-foreground': '222.2 84% 4.9%', popover: '0 0% 100%', 'popover-foreground': '222.2 84% 4.9%', primary: '222.2 47.4% 11.2%', 'primary-foreground': '210 40% 98%', secondary: '210 40% 96.1%', 'secondary-foreground': '222.2 47.4% 11.2%', muted: '210 40% 96.1%', 'muted-foreground': '215.4 16.3% 46.9%', accent: '210 40% 96.1%', 'accent-foreground': '222.2 47.4% 11.2%', destructive: '0 84.2% 60.2%', 'destructive-foreground': '210 40% 98%', border: '214.3 31.8% 91.4%', input: '214.3 31.8% 91.4%', ring: '222.2 84% 4.9%', 'sidebar-background': '0 0% 98%', 'sidebar-foreground': '222.2 47.4% 26%', 'sidebar-primary': '222.2 47.4% 11.2%', 'sidebar-primary-foreground': '210 40% 98%', 'sidebar-accent': '210 40% 96.1%', 'sidebar-accent-foreground': '222.2 47.4% 11.2%', 'sidebar-border': '214.3 31.8% 91.4%', 'sidebar-ring': '222.2 84% 4.9%' },
    stone: { background: '0 0% 100%', foreground: '20 14.3% 4.1%', card: '0 0% 100%', 'card-foreground': '20 14.3% 4.1%', popover: '0 0% 100%', 'popover-foreground': '20 14.3% 4.1%', primary: '24 9.8% 10%', 'primary-foreground': '60 9.1% 97.8%', secondary: '60 4.8% 95.9%', 'secondary-foreground': '24 9.8% 10%', muted: '60 4.8% 95.9%', 'muted-foreground': '25 5.3% 44.7%', accent: '60 4.8% 95.9%', 'accent-foreground': '24 9.8% 10%', destructive: '0 84.2% 60.2%', 'destructive-foreground': '60 9.1% 97.8%', border: '20 5.9% 90%', input: '20 5.9% 90%', ring: '20 14.3% 4.1%', 'sidebar-background': '60 9.1% 97.8%', 'sidebar-foreground': '24 9.8% 26%', 'sidebar-primary': '24 9.8% 10%', 'sidebar-primary-foreground': '60 9.1% 97.8%', 'sidebar-accent': '60 4.8% 95.9%', 'sidebar-accent-foreground': '24 9.8% 10%', 'sidebar-border': '20 5.9% 90%', 'sidebar-ring': '20 14.3% 4.1%' },
    gray: { background: '0 0% 100%', foreground: '224 71.4% 4.1%', card: '0 0% 100%', 'card-foreground': '224 71.4% 4.1%', popover: '0 0% 100%', 'popover-foreground': '224 71.4% 4.1%', primary: '220.9 39.3% 11%', 'primary-foreground': '210 20% 98%', secondary: '220 14.3% 95.9%', 'secondary-foreground': '220.9 39.3% 11%', muted: '220 14.3% 95.9%', 'muted-foreground': '220 8.9% 46.1%', accent: '220 14.3% 95.9%', 'accent-foreground': '220.9 39.3% 11%', destructive: '0 84.2% 60.2%', 'destructive-foreground': '210 20% 98%', border: '220 13% 91%', input: '220 13% 91%', ring: '224 71.4% 4.1%', 'sidebar-background': '210 20% 98%', 'sidebar-foreground': '220.9 39.3% 26%', 'sidebar-primary': '220.9 39.3% 11%', 'sidebar-primary-foreground': '210 20% 98%', 'sidebar-accent': '220 14.3% 95.9%', 'sidebar-accent-foreground': '220.9 39.3% 11%', 'sidebar-border': '220 13% 91%', 'sidebar-ring': '224 71.4% 4.1%' },
    neutral: { background: '0 0% 100%', foreground: '0 0% 3.9%', card: '0 0% 100%', 'card-foreground': '0 0% 3.9%', popover: '0 0% 100%', 'popover-foreground': '0 0% 3.9%', primary: '0 0% 9%', 'primary-foreground': '0 0% 98%', secondary: '0 0% 96.1%', 'secondary-foreground': '0 0% 9%', muted: '0 0% 96.1%', 'muted-foreground': '0 0% 45.1%', accent: '0 0% 96.1%', 'accent-foreground': '0 0% 9%', destructive: '0 84.2% 60.2%', 'destructive-foreground': '0 0% 98%', border: '0 0% 89.8%', input: '0 0% 89.8%', ring: '0 0% 3.9%', 'sidebar-background': '0 0% 98%', 'sidebar-foreground': '0 0% 26%', 'sidebar-primary': '0 0% 9%', 'sidebar-primary-foreground': '0 0% 98%', 'sidebar-accent': '0 0% 96.1%', 'sidebar-accent-foreground': '0 0% 9%', 'sidebar-border': '0 0% 89.8%', 'sidebar-ring': '0 0% 3.9%' },
  };

  const cardColorHex = customTokens.cardColor || '';

  // Start with curated scales, then apply card color override if set
  const lightScale = { ...(lightScales[baseColor] || lightScales.zinc) };
  const darkScale = { ...(darkScales[baseColor] || darkScales.zinc) };

  // Apply accent color as --primary (buttons, badges, focus rings, sidebar active)
  const accentHsl = hexToHslString(accent);
  if (accentHsl) {
    const accentIsLight = isLightHex(accent);
    const accentFg = accentIsLight ? '0 0% 9%' : '0 0% 98%';
    lightScale.primary = accentHsl; lightScale['primary-foreground'] = accentFg;
    lightScale.ring = accentHsl;
    lightScale['sidebar-primary'] = accentHsl; lightScale['sidebar-primary-foreground'] = accentFg;
    darkScale.primary = accentHsl; darkScale['primary-foreground'] = accentFg;
    darkScale.ring = accentHsl;
    darkScale['sidebar-primary'] = accentHsl; darkScale['sidebar-primary-foreground'] = accentFg;
  }

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

  const chartColors: Record<string, string> = {
    blue: '220 70% 50%', green: '160 60% 45%', orange: '30 80% 55%',
    rose: '340 75% 55%', violet: '280 65% 60%',
  };
  const chart = chartColors[chartColor] || chartColors.blue;

  // Emit HSL triplets. Tailwind v4's @theme block wraps them:
  // --color-primary: hsl(var(--primary)). Since brand/css loads AFTER
  // shell.css, our :root values for --primary etc. take effect, and
  // the @theme hsl() wrapper reads them at computed value time.
  const emitVars = (scale: Record<string, string>) =>
    Object.entries(scale).map(([k, v]) => `  --${k}: ${v};`).join('\n');

  const lightVars = emitVars(lightScale);
  const darkVars = emitVars(darkScale);

  return `
/* Workspace Shell Theme (${baseColor} base, ${themeMode} default) */

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
  --chart-1: ${chart};
  --button-bg: ${customTokens.buttonColor || accent};
  --button-fg: ${isLightHex(customTokens.buttonColor || accent) ? 'hsl(0 0% 9%)' : 'hsl(0 0% 98%)'};
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
