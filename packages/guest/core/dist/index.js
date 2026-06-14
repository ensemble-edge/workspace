/**
 * @ensemble-edge/guest — Guest App SDK (platform-agnostic)
 *
 * Build guest apps (connectors, tools, agents) for Ensemble Workspace.
 *
 * @example
 * ```ts
 * import { defineGuestApp, getContext } from './index.js';
 *
 * export const app = defineGuestApp({
 *   manifest: {
 *     id: 'my-connector',
 *     name: 'My Connector',
 *     version: '1.0.0',
 *     category: 'connector',
 *     permissions: ['read:user'],
 *     entry: '/',
 *   },
 * });
 * ```
 */
// Core API
export { defineGuestApp } from './define-guest-app.js';
// Context utilities
export { getContext, getWorkspaceContext, getUserContext, requireContext, requireUser, hasRole, requireRole, } from './context.js';
// Constants
export { ENSEMBLE_HEADERS } from './types.js';
// Theme utilities (if needed client-side)
export { getTheme } from './theme.js';
// Event utilities (if needed for emit)
export { events } from './events.js';
// Auth utilities (for token validation)
export { getAuth } from './auth.js';
//# sourceMappingURL=index.js.map