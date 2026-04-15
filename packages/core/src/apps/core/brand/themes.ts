/**
 * Workspace Theme Presets
 *
 * Each theme defines a complete color set for BOTH light and dark modes.
 * The CSS endpoint uses these to generate :root and .dark blocks.
 * Users can override individual colors on top of the preset.
 */

export interface ThemePreset {
  id: string;
  label: string;
  description: string;
  light: ThemeColors;
  dark: ThemeColors;
  /** Default primary (button) color */
  primary: string;
  /** Default accent color */
  accent: string;
}

export interface ThemeColors {
  background: string;
  foreground: string;
  card: string;
  'card-foreground': string;
  popover: string;
  'popover-foreground': string;
  primary: string;
  'primary-foreground': string;
  secondary: string;
  'secondary-foreground': string;
  muted: string;
  'muted-foreground': string;
  accent: string;
  'accent-foreground': string;
  destructive: string;
  'destructive-foreground': string;
  border: string;
  input: string;
  ring: string;
  'sidebar-background': string;
  'sidebar-foreground': string;
  'sidebar-primary': string;
  'sidebar-primary-foreground': string;
  'sidebar-accent': string;
  'sidebar-accent-foreground': string;
  'sidebar-border': string;
  'sidebar-ring': string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'default',
    label: 'Default',
    description: 'Clean and neutral',
    primary: '#18181b',
    accent: '#18181b',
    light: {
      background: '0 0% 100%', foreground: '240 10% 3.9%',
      card: '0 0% 100%', 'card-foreground': '240 10% 3.9%',
      popover: '0 0% 100%', 'popover-foreground': '240 10% 3.9%',
      primary: '240 5.9% 10%', 'primary-foreground': '0 0% 98%',
      secondary: '240 4.8% 95.9%', 'secondary-foreground': '240 5.9% 10%',
      muted: '240 4.8% 95.9%', 'muted-foreground': '240 3.8% 46.1%',
      accent: '240 4.8% 95.9%', 'accent-foreground': '240 5.9% 10%',
      destructive: '0 84.2% 60.2%', 'destructive-foreground': '0 0% 98%',
      border: '240 5.9% 90%', input: '240 5.9% 90%', ring: '240 5.9% 10%',
      'sidebar-background': '0 0% 98%', 'sidebar-foreground': '240 5.3% 26.1%',
      'sidebar-primary': '240 5.9% 10%', 'sidebar-primary-foreground': '0 0% 98%',
      'sidebar-accent': '240 4.8% 95.9%', 'sidebar-accent-foreground': '240 5.9% 10%',
      'sidebar-border': '220 13% 91%', 'sidebar-ring': '217.2 91.2% 59.8%',
    },
    dark: {
      background: '240 10% 3.9%', foreground: '0 0% 98%',
      card: '240 10% 3.9%', 'card-foreground': '0 0% 98%',
      popover: '240 10% 3.9%', 'popover-foreground': '0 0% 98%',
      primary: '0 0% 98%', 'primary-foreground': '240 5.9% 10%',
      secondary: '240 3.7% 15.9%', 'secondary-foreground': '0 0% 98%',
      muted: '240 3.7% 15.9%', 'muted-foreground': '240 5% 64.9%',
      accent: '240 3.7% 15.9%', 'accent-foreground': '0 0% 98%',
      destructive: '0 62.8% 30.6%', 'destructive-foreground': '0 0% 98%',
      border: '240 3.7% 15.9%', input: '240 3.7% 15.9%', ring: '240 4.9% 83.9%',
      'sidebar-background': '240 5.9% 10%', 'sidebar-foreground': '240 4.8% 95.9%',
      'sidebar-primary': '224.3 76.3% 48%', 'sidebar-primary-foreground': '0 0% 100%',
      'sidebar-accent': '240 3.7% 15.9%', 'sidebar-accent-foreground': '240 4.8% 95.9%',
      'sidebar-border': '240 3.7% 15.9%', 'sidebar-ring': '217.2 91.2% 59.8%',
    },
  },
  {
    id: 'warm',
    label: 'Warm',
    description: 'Cream canvas, linen cards',
    primary: '#92400e',
    accent: '#b45309',
    light: {
      background: '40 33% 97%', foreground: '20 14.3% 4.1%',
      card: '40 30% 95%', 'card-foreground': '20 14.3% 4.1%',
      popover: '40 30% 95%', 'popover-foreground': '20 14.3% 4.1%',
      primary: '24 70% 31%', 'primary-foreground': '40 33% 97%',
      secondary: '30 20% 92%', 'secondary-foreground': '20 14.3% 4.1%',
      muted: '30 20% 92%', 'muted-foreground': '20 10% 45%',
      accent: '30 20% 90%', 'accent-foreground': '20 14.3% 4.1%',
      destructive: '0 84.2% 60.2%', 'destructive-foreground': '0 0% 98%',
      border: '30 15% 85%', input: '30 15% 85%', ring: '24 70% 31%',
      'sidebar-background': '25 18% 93%', 'sidebar-foreground': '20 14.3% 20%',
      'sidebar-primary': '24 70% 31%', 'sidebar-primary-foreground': '40 33% 97%',
      'sidebar-accent': '30 20% 88%', 'sidebar-accent-foreground': '20 14.3% 20%',
      'sidebar-border': '30 15% 85%', 'sidebar-ring': '24 70% 31%',
    },
    dark: {
      background: '20 14.3% 4.1%', foreground: '40 30% 95%',
      card: '20 12% 7%', 'card-foreground': '40 30% 95%',
      popover: '20 12% 7%', 'popover-foreground': '40 30% 95%',
      primary: '35 80% 56%', 'primary-foreground': '20 14.3% 4.1%',
      secondary: '20 10% 14%', 'secondary-foreground': '40 30% 95%',
      muted: '20 10% 14%', 'muted-foreground': '30 10% 60%',
      accent: '20 10% 14%', 'accent-foreground': '40 30% 95%',
      destructive: '0 62.8% 30.6%', 'destructive-foreground': '0 0% 98%',
      border: '20 10% 14%', input: '20 10% 14%', ring: '35 80% 56%',
      'sidebar-background': '20 14% 6%', 'sidebar-foreground': '40 20% 90%',
      'sidebar-primary': '35 80% 56%', 'sidebar-primary-foreground': '20 14.3% 4.1%',
      'sidebar-accent': '20 10% 12%', 'sidebar-accent-foreground': '40 20% 90%',
      'sidebar-border': '20 10% 12%', 'sidebar-ring': '35 80% 56%',
    },
  },
  {
    id: 'ocean',
    label: 'Ocean',
    description: 'Blue-tinted, navy sidebar',
    primary: '#1e40af',
    accent: '#2563eb',
    light: {
      background: '210 40% 98%', foreground: '222.2 84% 4.9%',
      card: '210 40% 96%', 'card-foreground': '222.2 84% 4.9%',
      popover: '210 40% 96%', 'popover-foreground': '222.2 84% 4.9%',
      primary: '221.2 83.2% 53.3%', 'primary-foreground': '210 40% 98%',
      secondary: '210 30% 93%', 'secondary-foreground': '222.2 47.4% 11.2%',
      muted: '210 30% 93%', 'muted-foreground': '215 16.3% 46.9%',
      accent: '210 30% 91%', 'accent-foreground': '222.2 47.4% 11.2%',
      destructive: '0 84.2% 60.2%', 'destructive-foreground': '210 40% 98%',
      border: '214.3 31.8% 91.4%', input: '214.3 31.8% 91.4%', ring: '221.2 83.2% 53.3%',
      'sidebar-background': '222 47% 11%', 'sidebar-foreground': '210 40% 90%',
      'sidebar-primary': '217.2 91.2% 59.8%', 'sidebar-primary-foreground': '0 0% 100%',
      'sidebar-accent': '222 40% 17%', 'sidebar-accent-foreground': '210 40% 90%',
      'sidebar-border': '222 40% 17%', 'sidebar-ring': '217.2 91.2% 59.8%',
    },
    dark: {
      background: '222.2 84% 4.9%', foreground: '210 40% 98%',
      card: '222 70% 7%', 'card-foreground': '210 40% 98%',
      popover: '222 70% 7%', 'popover-foreground': '210 40% 98%',
      primary: '217.2 91.2% 59.8%', 'primary-foreground': '222.2 47.4% 11.2%',
      secondary: '217.2 32.6% 17.5%', 'secondary-foreground': '210 40% 98%',
      muted: '217.2 32.6% 17.5%', 'muted-foreground': '215 20.2% 65.1%',
      accent: '217.2 32.6% 17.5%', 'accent-foreground': '210 40% 98%',
      destructive: '0 62.8% 30.6%', 'destructive-foreground': '210 40% 98%',
      border: '217.2 32.6% 17.5%', input: '217.2 32.6% 17.5%', ring: '217.2 91.2% 59.8%',
      'sidebar-background': '222 60% 6%', 'sidebar-foreground': '210 40% 90%',
      'sidebar-primary': '217.2 91.2% 59.8%', 'sidebar-primary-foreground': '0 0% 100%',
      'sidebar-accent': '222 40% 12%', 'sidebar-accent-foreground': '210 40% 90%',
      'sidebar-border': '222 40% 12%', 'sidebar-ring': '217.2 91.2% 59.8%',
    },
  },
  {
    id: 'forest',
    label: 'Forest',
    description: 'Sage greens, natural tones',
    primary: '#166534',
    accent: '#16a34a',
    light: {
      background: '120 15% 97%', foreground: '150 20% 4%',
      card: '120 12% 94%', 'card-foreground': '150 20% 4%',
      popover: '120 12% 94%', 'popover-foreground': '150 20% 4%',
      primary: '142 72% 29%', 'primary-foreground': '120 15% 97%',
      secondary: '120 10% 91%', 'secondary-foreground': '150 20% 10%',
      muted: '120 10% 91%', 'muted-foreground': '140 8% 46%',
      accent: '120 10% 89%', 'accent-foreground': '150 20% 10%',
      destructive: '0 84.2% 60.2%', 'destructive-foreground': '0 0% 98%',
      border: '120 8% 86%', input: '120 8% 86%', ring: '142 72% 29%',
      'sidebar-background': '150 20% 10%', 'sidebar-foreground': '120 12% 88%',
      'sidebar-primary': '142 76% 36%', 'sidebar-primary-foreground': '0 0% 100%',
      'sidebar-accent': '150 18% 15%', 'sidebar-accent-foreground': '120 12% 88%',
      'sidebar-border': '150 18% 15%', 'sidebar-ring': '142 76% 36%',
    },
    dark: {
      background: '150 20% 4%', foreground: '120 12% 94%',
      card: '150 18% 6%', 'card-foreground': '120 12% 94%',
      popover: '150 18% 6%', 'popover-foreground': '120 12% 94%',
      primary: '142 76% 36%', 'primary-foreground': '150 20% 4%',
      secondary: '150 15% 12%', 'secondary-foreground': '120 12% 94%',
      muted: '150 15% 12%', 'muted-foreground': '140 8% 60%',
      accent: '150 15% 12%', 'accent-foreground': '120 12% 94%',
      destructive: '0 62.8% 30.6%', 'destructive-foreground': '0 0% 98%',
      border: '150 15% 12%', input: '150 15% 12%', ring: '142 76% 36%',
      'sidebar-background': '150 22% 5%', 'sidebar-foreground': '120 10% 88%',
      'sidebar-primary': '142 76% 36%', 'sidebar-primary-foreground': '150 20% 4%',
      'sidebar-accent': '150 15% 10%', 'sidebar-accent-foreground': '120 10% 88%',
      'sidebar-border': '150 15% 10%', 'sidebar-ring': '142 76% 36%',
    },
  },
  {
    id: 'sunset',
    label: 'Sunset',
    description: 'Warm amber, terracotta',
    primary: '#c2410c',
    accent: '#ea580c',
    light: {
      background: '30 50% 97%', foreground: '15 20% 5%',
      card: '30 40% 94%', 'card-foreground': '15 20% 5%',
      popover: '30 40% 94%', 'popover-foreground': '15 20% 5%',
      primary: '21 90% 48%', 'primary-foreground': '30 50% 97%',
      secondary: '25 25% 91%', 'secondary-foreground': '15 20% 10%',
      muted: '25 25% 91%', 'muted-foreground': '20 12% 46%',
      accent: '25 25% 88%', 'accent-foreground': '15 20% 10%',
      destructive: '0 84.2% 60.2%', 'destructive-foreground': '0 0% 98%',
      border: '25 20% 85%', input: '25 20% 85%', ring: '21 90% 48%',
      'sidebar-background': '15 30% 12%', 'sidebar-foreground': '30 30% 88%',
      'sidebar-primary': '24 95% 53%', 'sidebar-primary-foreground': '0 0% 100%',
      'sidebar-accent': '15 25% 17%', 'sidebar-accent-foreground': '30 30% 88%',
      'sidebar-border': '15 25% 17%', 'sidebar-ring': '24 95% 53%',
    },
    dark: {
      background: '15 20% 4%', foreground: '30 40% 94%',
      card: '15 18% 7%', 'card-foreground': '30 40% 94%',
      popover: '15 18% 7%', 'popover-foreground': '30 40% 94%',
      primary: '24 95% 53%', 'primary-foreground': '15 20% 4%',
      secondary: '15 12% 14%', 'secondary-foreground': '30 40% 94%',
      muted: '15 12% 14%', 'muted-foreground': '20 10% 60%',
      accent: '15 12% 14%', 'accent-foreground': '30 40% 94%',
      destructive: '0 62.8% 30.6%', 'destructive-foreground': '0 0% 98%',
      border: '15 12% 14%', input: '15 12% 14%', ring: '24 95% 53%',
      'sidebar-background': '15 22% 5%', 'sidebar-foreground': '30 25% 88%',
      'sidebar-primary': '24 95% 53%', 'sidebar-primary-foreground': '15 20% 4%',
      'sidebar-accent': '15 15% 10%', 'sidebar-accent-foreground': '30 25% 88%',
      'sidebar-border': '15 15% 10%', 'sidebar-ring': '24 95% 53%',
    },
  },
  {
    id: 'midnight',
    label: 'Midnight',
    description: 'Deep purple, lavender accents',
    primary: '#7c3aed',
    accent: '#8b5cf6',
    light: {
      background: '270 20% 98%', foreground: '270 30% 6%',
      card: '270 15% 95%', 'card-foreground': '270 30% 6%',
      popover: '270 15% 95%', 'popover-foreground': '270 30% 6%',
      primary: '263 70% 50%', 'primary-foreground': '270 20% 98%',
      secondary: '270 12% 92%', 'secondary-foreground': '270 30% 10%',
      muted: '270 12% 92%', 'muted-foreground': '270 8% 46%',
      accent: '270 12% 89%', 'accent-foreground': '270 30% 10%',
      destructive: '0 84.2% 60.2%', 'destructive-foreground': '0 0% 98%',
      border: '270 10% 87%', input: '270 10% 87%', ring: '263 70% 50%',
      'sidebar-background': '270 35% 8%', 'sidebar-foreground': '270 15% 88%',
      'sidebar-primary': '263 70% 58%', 'sidebar-primary-foreground': '0 0% 100%',
      'sidebar-accent': '270 30% 13%', 'sidebar-accent-foreground': '270 15% 88%',
      'sidebar-border': '270 30% 13%', 'sidebar-ring': '263 70% 58%',
    },
    dark: {
      background: '270 30% 4%', foreground: '270 15% 95%',
      card: '270 25% 7%', 'card-foreground': '270 15% 95%',
      popover: '270 25% 7%', 'popover-foreground': '270 15% 95%',
      primary: '263 70% 58%', 'primary-foreground': '270 30% 4%',
      secondary: '270 20% 13%', 'secondary-foreground': '270 15% 95%',
      muted: '270 20% 13%', 'muted-foreground': '270 10% 60%',
      accent: '270 20% 13%', 'accent-foreground': '270 15% 95%',
      destructive: '0 62.8% 30.6%', 'destructive-foreground': '0 0% 98%',
      border: '270 20% 13%', input: '270 20% 13%', ring: '263 70% 58%',
      'sidebar-background': '270 35% 5%', 'sidebar-foreground': '270 12% 88%',
      'sidebar-primary': '263 70% 58%', 'sidebar-primary-foreground': '270 30% 4%',
      'sidebar-accent': '270 22% 10%', 'sidebar-accent-foreground': '270 12% 88%',
      'sidebar-border': '270 22% 10%', 'sidebar-ring': '263 70% 58%',
    },
  },
];

/**
 * Get a theme preset by ID.
 */
export function getThemePreset(id: string): ThemePreset | undefined {
  return THEME_PRESETS.find((t) => t.id === id);
}

/**
 * Get the color scale for a theme preset and mode.
 */
export function getPresetScale(presetId: string, mode: 'light' | 'dark'): ThemeColors | undefined {
  const preset = getThemePreset(presetId);
  if (!preset) return undefined;
  return mode === 'dark' ? preset.dark : preset.light;
}
