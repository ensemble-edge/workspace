import type { CoreAppDefinition } from '../../types';
import { registerAdminRoutes } from './routes';

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
  registerRoutes: registerAdminRoutes,
};
