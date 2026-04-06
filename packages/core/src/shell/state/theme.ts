/**
 * Theme State
 *
 * Preact Signals for theme management and CSS variable injection.
 */

import { signal, computed } from '@preact/signals-react';
import type { Theme } from '../../types';

/**
 * Current theme data.
 */
export const theme = signal<Theme | null>(null);

/**
 * Theme loading state.
 */
export const themeLoading = signal(true);

/**
 * Theme error.
 */
export const themeError = signal<string | null>(null);

/**
 * Dark mode preference.
 */
export const darkMode = signal(false);

/**
 * Initialize dark mode from system preference or localStorage.
 */
export function initDarkMode(): void {
  if (typeof window === 'undefined') return;

  // Check localStorage first
  const stored = localStorage.getItem('ensemble:darkMode');
  if (stored !== null) {
    darkMode.value = stored === 'true';
    return;
  }

  // Fall back to system preference
  if (window.matchMedia) {
    darkMode.value = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
}

/**
 * Toggle dark mode.
 */
export function toggleDarkMode(): void {
  if (typeof window === 'undefined') return;

  darkMode.value = !darkMode.value;
  localStorage.setItem('ensemble:darkMode', String(darkMode.value));
  applyTheme();
}

/**
 * Computed: Accent color.
 */
export const accentColor = computed(() => theme.value?.colors.accent ?? '#3B82F6');

/**
 * Fetch theme from API.
 */
export async function fetchTheme(): Promise<void> {
  themeLoading.value = true;
  themeError.value = null;

  try {
    const response = await fetch('/_ensemble/brand/theme');
    if (!response.ok) {
      throw new Error('Failed to load theme');
    }

    const data = (await response.json()) as Theme;
    theme.value = data;
    applyTheme();
  } catch (error) {
    themeError.value = error instanceof Error ? error.message : 'Unknown error';
  } finally {
    themeLoading.value = false;
  }
}

/**
 * Apply theme to document CSS variables.
 */
export function applyTheme(): void {
  if (typeof document === 'undefined') return;

  const t = theme.value;
  if (!t) return;

  const root = document.documentElement;
  const isDark = darkMode.value;

  // Colors (swap surface/background in dark mode)
  root.style.setProperty('--color-accent', t.colors.accent);
  root.style.setProperty('--color-primary', t.colors.primary);
  root.style.setProperty('--color-surface', isDark ? '#1a1a2e' : t.colors.surface);
  root.style.setProperty('--color-background', isDark ? '#0d0d1a' : t.colors.background);
  root.style.setProperty('--color-foreground', isDark ? '#ffffff' : t.colors.foreground);
  root.style.setProperty('--color-muted', isDark ? '#a0a0b0' : t.colors.muted);
  root.style.setProperty('--color-border', isDark ? '#2a2a3e' : t.colors.border);

  // Typography
  root.style.setProperty('--font-heading', `'${t.typography.headingFont}', sans-serif`);
  root.style.setProperty('--font-body', `'${t.typography.bodyFont}', sans-serif`);
  root.style.setProperty('--font-mono', `'${t.typography.monoFont}', monospace`);

  // Spatial
  root.style.setProperty('--radius', t.spatial.radius);

  // Set density class
  document.body.classList.remove('density-compact', 'density-normal', 'density-comfortable');
  document.body.classList.add(`density-${t.spatial.density}`);

  // Set dark mode class
  document.body.classList.toggle('dark', isDark);
}
