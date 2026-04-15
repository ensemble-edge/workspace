import type { CoreAppDefinition } from '../../types';

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
  registerRoutes: () => {
    // TODO: Phase 2 — member directory, invite flow, role management
  },
};
