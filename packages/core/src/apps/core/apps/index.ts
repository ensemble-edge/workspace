import type { CoreAppDefinition } from '../../types';

export const appsApp: CoreAppDefinition = {
  manifest: {
    id: 'core:apps',
    name: 'App Manager',
    icon: 'grid-3x3',
    description: 'Install, configure, and manage guest apps and connectors.',
    tier: 'core',
    nav: {
      label: 'Apps',
      icon: 'grid-3x3',
      section: 'workspace',
      path: '/apps',
    },
  },
  registerRoutes: () => {
    // Guest app management routes already exist at /_ensemble/apps/*
    // Phase 2 will add /_ensemble/core/apps/* for install/uninstall admin UI
  },
};
