import type { CoreAppDefinition } from '../../types';
import { registerAuditRoutes } from './routes';

export const auditApp: CoreAppDefinition = {
  manifest: {
    id: 'core:audit',
    name: 'Audit Log',
    icon: 'scroll-text',
    description: 'Activity log for workspace events and compliance.',
    tier: 'core',
    nav: {
      label: 'Audit Log',
      icon: 'scroll-text',
      section: 'workspace',
      path: '/audit',
    },
  },
  registerRoutes: registerAuditRoutes,
};
