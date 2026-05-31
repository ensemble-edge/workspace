import { registerAdminRoutes } from './routes.js';
export const adminApp = {
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
//# sourceMappingURL=index.js.map