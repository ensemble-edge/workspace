import { registerAuditRoutes } from './routes';
export const auditApp = {
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
//# sourceMappingURL=index.js.map