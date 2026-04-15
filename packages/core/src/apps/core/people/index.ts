import type { CoreAppDefinition } from '../../types';
import { registerPeopleRoutes } from './routes';

export const peopleApp: CoreAppDefinition = {
  manifest: {
    id: 'core:people',
    name: 'People & Teams',
    icon: 'users',
    description: 'Member directory, roles, teams, and invites.',
    tier: 'core',
    nav: {
      label: 'People',
      icon: 'users',
      section: 'workspace',
      path: '/people',
    },
  },
  registerRoutes: registerPeopleRoutes,
};
