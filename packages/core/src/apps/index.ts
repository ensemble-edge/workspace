/**
 * Apps Domain
 *
 * Core app contract, registration, and app registry.
 */

// Core app contract types
export type { CoreAppDefinition, CoreAppManifest } from './types';

// Core app registration
export { coreApps, registerCoreApps, getCoreAppManifests } from './core';

// Guest app registry (existing)
export * from './registry';
