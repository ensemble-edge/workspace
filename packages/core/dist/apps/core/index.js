/**
 * Core Apps — Registration
 *
 * Registers all core app API routes into the Hono app.
 * Called from createWorkspace() after the middleware pipeline.
 */
import { brandApp } from './brand';
import { adminApp } from './admin';
import { peopleApp } from './people';
import { appsApp } from './apps';
import { auditApp } from './audit';
/** All registered core apps */
export const coreApps = [
    brandApp,
    adminApp,
    peopleApp,
    appsApp,
    auditApp,
];
/**
 * Register all core app API routes into the Hono app.
 */
export function registerCoreApps(app) {
    for (const coreApp of coreApps) {
        coreApp.registerRoutes(app);
    }
}
/**
 * Get all core app manifests.
 * Used by the /_ensemble/nav endpoint to build navigation sections.
 */
export function getCoreAppManifests() {
    return coreApps.map((app) => app.manifest);
}
//# sourceMappingURL=index.js.map