/**
 * Core Apps — Registration
 *
 * Registers all core app API routes into the Hono app.
 * Called from createWorkspace() after the middleware pipeline.
 */

import type { Hono } from 'hono';
import type { Env, ContextVariables } from '../../types';
import type { CoreAppDefinition } from '../types';

import { brandApp } from './brand';
import { adminApp } from './admin';
import { peopleApp } from './people';
import { appsApp } from './apps';

// v0.1.77: auditApp removed from the core-app registry. The audit
// log viewer is now a tab in Settings (Settings → Audit Log), not a
// standalone app. The /_ensemble/core/audit/events read route still
// exists and is now registered from admin's routes module — same
// endpoint, one fewer sidebar entry, one canonical surface.

/** All registered core apps */
export const coreApps: CoreAppDefinition[] = [
  brandApp,
  adminApp,
  peopleApp,
  appsApp,
];

/**
 * Register all core app API routes into the Hono app.
 */
export function registerCoreApps(
  app: Hono<{ Bindings: Env; Variables: ContextVariables }>
): void {
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
