import type { ThemeContext } from './types';

/**
 * Get the current theme context.
 */
export function getTheme(): ThemeContext {
  // TODO: Implement theme sync with workspace
  return {
    primaryColor: '#3B82F6',
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
