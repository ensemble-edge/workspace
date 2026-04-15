/**
 * Theme State
 *
 * Theme is now fully handled by the CSS endpoint (/_ensemble/brand/css).
 * This module only provides the theme signal for components that need
 * to read theme data (like the Brand app's Overview tab).
 *
 * NO CSS manipulation here — brand/css handles all variables on page load.
 */

import { signal } from '@preact/signals-react';

interface ThemeData {
  colors: Record<string, string>;
  typography: Record<string, string>;
  spatial: Record<string, string>;
  identity: Record<string, string | null>;
}

/**
 * Current theme data (from /_ensemble/brand/theme JSON endpoint).
 * Used for reading theme values, NOT for applying CSS.
 */
export const theme = signal<ThemeData | null>(null);

export const themeLoading = signal(true);
export const themeError = signal<string | null>(null);
export const darkMode = signal(false);
export const accentColor = signal('#3B82F6');

/**
 * Fetch theme data from API (read-only, no CSS side effects).
 */
export async function fetchTheme(): Promise<void> {
  themeLoading.value = true;
  themeError.value = null;

  try {
    const response = await fetch('/_ensemble/brand/theme');
    if (!response.ok) throw new Error('Failed to load theme');

    const data = await response.json() as ThemeData;
    theme.value = data;
    if (data.colors?.accent) accentColor.value = data.colors.accent;
  } catch (error) {
    themeError.value = error instanceof Error ? error.message : 'Unknown error';
  } finally {
    themeLoading.value = false;
  }
}

/**
 * No-op — CSS is handled by /_ensemble/brand/css endpoint.
 * Kept for backwards compatibility with any code that calls it.
 */
export function applyTheme(): void {
  // Intentionally empty. Brand/css handles all theming.
}

export function initDarkMode(): void {
  // Dark mode is set by the server via class="dark" on <html>.
  // No client-side initialization needed.
}

export function toggleDarkMode(): void {
  // Handled by Appearance tab, not this module.
}
