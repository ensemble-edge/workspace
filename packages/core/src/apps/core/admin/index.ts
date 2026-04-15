import type { CoreAppDefinition } from '../../types';

export const adminApp: CoreAppDefinition = {
  manifest: {
    id: 'core:admin',
    name: 'Workspace Admin',
    icon: 'settings',
    description: 'General workspace settings, locale, and configuration.',
    tier: 'core',
    nav: {
      label: 'Settings',
      icon: 'settings',
      section: 'workspace',
      path: '/settings',
    },
  },
  registerRoutes: () => {
    // TODO: Phase 2 — workspace settings CRUD routes
  },
};
