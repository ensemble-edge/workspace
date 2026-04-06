/**
 * Define a guest app for Ensemble Workspace.
 *
 * This is the main entry point for creating guest apps. It takes a configuration
 * object and returns a DefinedGuestApp that can be used with platform adapters.
 *
 * @example
 * ```ts
 * import { defineGuestApp } from '@ensemble-edge/guest';
 *
 * export const app = defineGuestApp({
 *   manifest: {
 *     id: 'my-app',
 *     name: 'My App',
 *     version: '1.0.0',
 *     category: 'tool',
 *     permissions: ['read:user'],
 *     entry: '/',
 *   },
 *   onInit: async (ctx) => {
 *     console.log(`App initialized for workspace ${ctx.workspace.workspaceId}`);
 *   },
 * });
 * ```
 */

import type { GuestAppConfig, DefinedGuestApp } from './types.js';

/**
 * Define a guest app for Ensemble Workspace.
 */
export function defineGuestApp(config: GuestAppConfig): DefinedGuestApp {
  // Validate manifest
  validateManifest(config.manifest);

  return {
    manifest: config.manifest,
    init: config.onInit,
    activate: config.onActivate,
    deactivate: config.onDeactivate,
    fetch: config.fetch,
  };
}

/**
 * Validate a guest app manifest.
 *
 * @throws Error if manifest is invalid
 */
function validateManifest(manifest: GuestAppConfig['manifest']): void {
  if (!manifest.id) {
    throw new Error('Manifest must have an id');
  }

  if (!/^[a-z0-9-]+$/.test(manifest.id)) {
    throw new Error('Manifest id must be kebab-case (lowercase letters, numbers, hyphens)');
  }

  if (!manifest.name) {
    throw new Error('Manifest must have a name');
  }

  if (!manifest.version) {
    throw new Error('Manifest must have a version');
  }

  if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
    throw new Error('Manifest version must be semver (e.g., "1.0.0")');
  }

  if (!manifest.entry) {
    throw new Error('Manifest must have an entry point');
  }

  if (!manifest.entry.startsWith('/')) {
    throw new Error('Manifest entry must start with /');
  }

  const validCategories = ['tool', 'connector', 'agent', 'panel'];
  if (!validCategories.includes(manifest.category)) {
    throw new Error(`Manifest category must be one of: ${validCategories.join(', ')}`);
  }
}
