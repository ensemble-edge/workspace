/**
 * Core Apps — Registration
 *
 * Registers all core app API routes into the Hono app.
 * Called from createWorkspace() after the middleware pipeline.
 */
import type { Hono } from 'hono';
import type { Env, ContextVariables } from '../../types';
import type { CoreAppDefinition } from '../types';
/** All registered core apps */
export declare const coreApps: CoreAppDefinition[];
/**
 * Register all core app API routes into the Hono app.
 */
export declare function registerCoreApps(app: Hono<{
    Bindings: Env;
    Variables: ContextVariables;
}>): void;
/**
 * Get all core app manifests.
 * Used by the /_ensemble/nav endpoint to build navigation sections.
 */
export declare function getCoreAppManifests(): import("..").CoreAppManifest[];
//# sourceMappingURL=index.d.ts.map