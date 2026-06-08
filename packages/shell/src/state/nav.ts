/**
 * Navigation State
 *
 * Preact Signals for sidebar navigation, routing, and panel visibility.
 */

import { signal, computed } from '@preact/signals-react';
import type { NavConfig, NavSection, NavItem } from '../../types';
import { authedFetch } from './user';

/**
 * Navigation configuration from server.
 */
export const navConfig = signal<NavConfig | null>(null);

/**
 * Navigation loading state.
 */
export const navLoading = signal(true);

/**
 * Current path.
 */
export const currentPath = signal(
  typeof window !== 'undefined' ? window.location.pathname : '/'
);

/**
 * AI panel visibility.
 */
export const aiPanelOpen = signal(false);

/**
 * AI panel pinned state.
 * When pinned, the panel becomes part of the layout (panel mode).
 * When unpinned, it overlays as a drawer.
 */
export const aiPanelPinned = signal(
  typeof localStorage !== 'undefined'
    ? localStorage.getItem('ensemble:ai-panel-pinned') === 'true'
    : false
);

/**
 * Sidebar collapsed state.
 */
export const sidebarCollapsed = signal(false);

/**
 * Command palette open state.
 */
export const commandPaletteOpen = signal(false);

/**
 * Computed: Navigation sections.
 */
export const sections = computed<NavSection[]>(() =>
  navConfig.value?.sections ?? getDefaultSections()
);

/**
 * Computed: Current active nav item.
 */
export const activeItem = computed<NavItem | null>(() => {
  const path = currentPath.value;

  for (const section of sections.value) {
    for (const item of section.items) {
      if (item.path === path) {
        return item;
      }
    }
  }

  return null;
});

/**
 * Computed: Breadcrumb trail.
 */
export const breadcrumb = computed<string[]>(() => {
  const item = activeItem.value;
  if (!item) return ['Home'];

  // Find the section containing this item
  for (const section of sections.value) {
    const found = section.items.find((i) => i.id === item.id);
    if (found) {
      return [section.label, found.label];
    }
  }

  return [item.label];
});

/**
 * Default navigation sections (used before server config loads).
 *
 * Icon names reference Lucide icons (see 01-style.md spec):
 * - home: House icon
 * - users: Group of people (People & Teams)
 * - palette: Color palette (Brand Manager)
 * - settings: Gear cog (Admin / Settings)
 */
function getDefaultSections(): NavSection[] {
  return [
    {
      id: 'apps',
      label: 'Apps',
      items: [
        { id: 'home', label: 'Home', icon: 'home', path: '/' },
      ],
    },
    {
      id: 'workspace',
      label: 'Workspace',
      items: [
        { id: 'people', label: 'People', icon: 'users', path: '/people' },
        // v0.1.84: brand admin moved to /brand-app
        { id: 'brand', label: 'Brand', icon: 'palette', path: '/brand-app' },
        // core:legal CMS — bare /legal is the public pages, /legal-app is admin.
        { id: 'legal', label: 'Legal', icon: 'scale', path: '/legal-app' },
        { id: 'settings', label: 'Settings', icon: 'settings', path: '/settings' },
      ],
    },
  ];
}

/**
 * Fetch navigation config from API.
 */
export async function fetchNav(): Promise<void> {
  navLoading.value = true;

  try {
    const response = await authedFetch('/_ensemble/nav');
    if (response.ok) {
      const data = (await response.json()) as NavConfig;
      navConfig.value = data;
    }
    // If not OK (e.g., 401), use default sections
  } catch {
    // Use default sections on error
  } finally {
    navLoading.value = false;
  }
}

/**
 * Navigate to a path. Accepts an optional `#fragment` for deep-linking
 * into tabbed pages (e.g., `/auth#credentials`). The fragment is kept on
 * `window.location.hash` for hooks like `useHashTab` to read, while the
 * route signal only carries the path portion so the page registry
 * resolves correctly.
 */
export function navigate(path: string): void {
  if (typeof window === 'undefined') return;

  const hashIndex = path.indexOf('#');
  const pathOnly = hashIndex === -1 ? path : path.slice(0, hashIndex);

  // Update browser history with the full path+hash (URL bar shows it).
  window.history.pushState(null, '', path);

  // The route signal only carries the path — fragments are not routes.
  currentPath.value = pathOnly;

  // hashchange doesn't fire on pushState, so emit it explicitly when the
  // fragment changes. Hooks like useHashTab listen for this.
  window.dispatchEvent(new PopStateEvent('popstate'));
  if (hashIndex !== -1) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
}

/**
 * Toggle AI panel.
 */
export function toggleAIPanel(): void {
  aiPanelOpen.value = !aiPanelOpen.value;
}

/**
 * Toggle AI panel pinned state.
 * Persists to localStorage for user preference.
 */
export function toggleAIPanelPinned(): void {
  const newValue = !aiPanelPinned.value;
  aiPanelPinned.value = newValue;

  // Persist to localStorage
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('ensemble:ai-panel-pinned', String(newValue));
  }

  // If pinning while closed, open it
  if (newValue && !aiPanelOpen.value) {
    aiPanelOpen.value = true;
  }
}

/**
 * Set AI panel pinned state explicitly.
 */
export function setAIPanelPinned(pinned: boolean): void {
  aiPanelPinned.value = pinned;

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('ensemble:ai-panel-pinned', String(pinned));
  }
}

/**
 * Toggle sidebar collapsed state.
 */
export function toggleSidebar(): void {
  sidebarCollapsed.value = !sidebarCollapsed.value;
}

/**
 * Open command palette (⌘K).
 */
export function openCommandPalette(): void {
  commandPaletteOpen.value = true;
}

/**
 * Close command palette.
 */
export function closeCommandPalette(): void {
  commandPaletteOpen.value = false;
}

/**
 * Initialize navigation: listen for browser back/forward.
 */
export function initNavigation(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('popstate', () => {
    currentPath.value = window.location.pathname;
  });

  // Handle ⌘K shortcut
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      commandPaletteOpen.value = !commandPaletteOpen.value;
    }
  });
}
