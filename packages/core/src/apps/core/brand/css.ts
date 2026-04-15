/**
 * Brand CSS Generation
 *
 * Generates CSS custom properties from brand tokens stored in D1.
 * Used by both /_ensemble/brand/css endpoints in createWorkspace and createWorkspaceV2.
 *
 * Loads ALL brand tokens in a single query and resolves them with defaults.
 * This CSS is loaded as <link rel="stylesheet"> in the HTML head,
 * so settings are available before any JS runs (optimistic/instant).
 */

/** Font family map — shared between CSS generation and WorkspaceTab UI */
export const FONT_FAMILIES: Record<string, string> = {
  system: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  inter: '"Inter", system-ui, sans-serif',
  manrope: '"Manrope", system-ui, sans-serif',
  geist: '"Geist", system-ui, sans-serif',
  'cal-sans': '"Cal Sans", system-ui, sans-serif',
  roboto: '"Roboto", system-ui, sans-serif',
  'dm-sans': '"DM Sans", system-ui, sans-serif',
};

/** Base color scales — HSL values for shadcn/ui dark mode */
export const BASE_COLOR_SCALES: Record<string, { bg: string; fg: string; border: string }> = {
  zinc: { bg: '240 10% 3.9%', fg: '0 0% 98%', border: '240 3.7% 15.9%' },
  slate: { bg: '222.2 84% 4.9%', fg: '210 40% 98%', border: '217.2 32.6% 17.5%' },
  stone: { bg: '20 14.3% 4.1%', fg: '60 9.1% 97.8%', border: '12 6.5% 15.1%' },
  gray: { bg: '224 71.4% 4.1%', fg: '210 20% 98%', border: '215 27.9% 16.9%' },
  neutral: { bg: '0 0% 3.9%', fg: '0 0% 98%', border: '0 0% 14.9%' },
};

/** Chart color HSL values */
export const CHART_COLORS: Record<string, string> = {
  blue: '220 70% 50%',
  green: '160 60% 45%',
  orange: '30 80% 55%',
  rose: '340 75% 55%',
  violet: '280 65% 60%',
};

/**
 * Generate brand CSS from D1 database tokens.
 *
 * @param db - D1 database binding
 * @param workspaceId - Current workspace ID
 * @param defaultAccent - Default accent color from config
 * @returns CSS string with :root custom properties
 */
export async function generateBrandCss(
  db: D1Database,
  workspaceId: string,
  defaultAccent: string
): Promise<string> {
  let accent = defaultAccent;
  let canvas = '#BDB7B0';
  const workspaceUi: Record<string, string> = {};

  try {
    const result = await db.prepare(
      `SELECT category, key, value FROM brand_tokens
       WHERE workspace_id = ? AND locale = ''`
    ).bind(workspaceId).all<{ category: string; key: string; value: string }>();

    for (const row of result.results || []) {
      if (row.category === 'colors' && row.key === 'accent') accent = row.value;
      if (row.category === 'colors' && row.key === 'canvas') canvas = row.value;
      if (row.category === 'custom') workspaceUi[row.key] = row.value;
    }
  } catch {
    // Use defaults if DB query fails
  }

  // Resolve custom tokens with defaults
  const radius = workspaceUi.radius || '0.5';
  const headingFont = workspaceUi.headingFont || 'dm-sans';
  const bodyFont = workspaceUi.bodyFont || 'dm-sans';
  const baseColor = workspaceUi.baseColor || 'zinc';
  const chartColor = workspaceUi.chartColor || 'blue';

  const resolvedHeadingFont = FONT_FAMILIES[headingFont] || FONT_FAMILIES['dm-sans'];
  const resolvedBodyFont = FONT_FAMILIES[bodyFont] || FONT_FAMILIES['dm-sans'];
  const scale = BASE_COLOR_SCALES[baseColor] || BASE_COLOR_SCALES.zinc;
  const chart = CHART_COLORS[chartColor] || CHART_COLORS.blue;

  return `
:root {
  /* Accent color */
  --color-accent: ${accent};
  --color-accent-hover: color-mix(in srgb, ${accent} 85%, white);
  --color-accent-dim: color-mix(in srgb, ${accent} 20%, transparent);

  /* Canvas background */
  --canvas: ${canvas};

  /* Base color scale */
  --background: ${scale.bg};
  --foreground: ${scale.fg};
  --border: ${scale.border};
  --muted: ${scale.border};

  /* Floating dark card surfaces */
  --card: #1e1e22;
  --card-hover: #252529;
  --card-border: rgba(255, 255, 255, 0.06);

  /* Always-dark chrome */
  --sidebar-bg: #141316;
  --sidebar-hover: #1c1b1f;
  --sidebar-active: #252429;

  /* Typography colors */
  --text-primary: #f0ede8;
  --text-secondary: #9a938a;
  --text-tertiary: #6b655c;

  /* Semantic colors */
  --color-error: #f87171;
  --color-success: #4ade80;
  --color-warning: #fbbf24;
  --color-info: #60a5fa;

  /* Typography */
  --font-heading: ${resolvedHeadingFont};
  --font-body: ${resolvedBodyFont};
  --font-mono: 'JetBrains Mono', monospace;
  --letter-spacing-label: 0.12em;

  /* Spatial */
  --radius: ${radius}rem;
  --radius-sm: ${Math.max(0, parseFloat(radius) - 0.25).toFixed(2)}rem;
  --radius-lg: ${(parseFloat(radius) + 0.25).toFixed(2)}rem;

  /* Chart */
  --chart-1: ${chart};

  /* Shadows */
  --shadow-card: 0 4px 24px rgba(0, 0, 0, 0.25);
  --shadow-card-lg: 0 8px 32px rgba(0, 0, 0, 0.35);
  --shadow-dropdown: 0 12px 40px rgba(0, 0, 0, 0.45);
}`.trim();
}
