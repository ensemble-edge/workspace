import type { ThemeContext } from './types.js';

/**
 * Get the current theme context.
 */
export function getTheme(): ThemeContext {
  // TODO: Implement theme sync with workspace
  return {
    colors: {
      accent: '#6366F1',
      accentHover: '#4F46E5',
      accentDim: '#6366F120',
      canvas: '#F5F5F5',
      card: '#FFFFFF',
      cardHover: '#FAFAFA',
      cardBorder: '#E5E5E5',
      textPrimary: '#171717',
      textSecondary: '#525252',
      textTertiary: '#737373',
      error: '#DC2626',
      success: '#16A34A',
      warning: '#D97706',
      info: '#2563EB',
    },
    typography: {
      headingFont: 'DM Sans, system-ui, sans-serif',
      bodyFont: 'DM Sans, system-ui, sans-serif',
      monoFont: 'JetBrains Mono, monospace',
    },
    spatial: {
      radius: '8px',
      radiusSm: '4px',
      radiusLg: '12px',
    },
    mode: 'light',
  };
}

/**
 * Subscribe to theme changes.
 */
export function onThemeChange(callback: (theme: ThemeContext) => void): () => void {
  // TODO: Implement theme subscription
  return () => {};
}
