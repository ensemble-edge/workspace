/**
 * Define a guest app for Ensemble Workspace.
 *
 * This is the main entry point for creating guest apps. It takes a configuration
 * object and returns a DefinedGuestApp that can be used with platform adapters.
 *
 * @example
 * ```ts
 * import { defineGuestApp } from './index';
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
export declare function defineGuestApp(config: GuestAppConfig): DefinedGuestApp;
//# sourceMappingURL=define-guest-app.d.ts.map