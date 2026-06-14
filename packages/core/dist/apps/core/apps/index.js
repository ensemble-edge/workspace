import { registerAppsRoutes } from './routes.js';
export const appsApp = {
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
//# sourceMappingURL=index.js.map