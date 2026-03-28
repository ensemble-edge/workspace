import type { GuestAppConfig } from './types';

/**
 * Define a guest app for Ensemble Workspace.
 *
 * @example
 * ```ts
 * import { defineGuestApp } from '@ensemble-edge/guest';
 *
 * export default defineGuestApp({
 *   manifest: {
 *     id: 'my-app',
 *     name: 'My App',
 *     version: '1.0.0',
 *     permissions: ['read:user'],
 *     entry: '/app',
 *   },
 *   onInit: async () => {
 *     console.log('App initialized');
 *   },
 * });
 * ```
 */
export function defineGuestApp(config: GuestAppConfig) {
  return {
    manifest: config.manifest,
    init: config.onInit,
    activate: config.onActivate,
    deactivate: config.onDeactivate,
  };
}
