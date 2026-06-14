import type { CoreAppDefinition } from '../../types';
import { registerAppsRoutes } from './routes';

export const appsApp: CoreAppDefinition = {
  manifest: {
    id: 'core:apps',
    name: 'App Manager',
    icon: 'grid-3x3',
    description: 'Manage every app — built-in and guest: enable/disable, routing, and config.',
    tier: 'core',
    nav: {
      label: 'Apps',
      icon: 'grid-3x3',
      section: 'workspace',
      path: '/apps',
    },
  },
  // App Manager API: list all apps, enable/disable, mounts, routes-hint.
  registerRoutes: registerAppsRoutes,
};
