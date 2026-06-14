/**
 * @ensemble-edge/guest — Guest App SDK (platform-agnostic)
 *
 * Build guest apps (connectors, tools, agents) for Ensemble Workspace.
 *
 * @example
 * ```ts
 * import { defineGuestApp, getContext } from './index';
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
export { defineGuestApp } from './define-guest-app.js';
export { getContext, getWorkspaceContext, getUserContext, requireContext, requireUser, hasRole, requireRole, } from './context.js';
export type { GuestAppManifest, GuestAppTier, Permission, WidgetDefinition, SearchConfig, AIConfig, AITool, AIToolParameter, SettingsConfig, SettingField, ExternalServiceConfig, ScheduleConfig, EventSubscription, GuestAppContext, WorkspaceContext, UserContext, ThemeContext, GuestAppConfig, DefinedGuestApp, ApiResponse, ApiError, PaginatedResponse, GuestAppEvent, } from './types.js';
export { ENSEMBLE_HEADERS } from './types.js';
export { getTheme } from './theme.js';
export { events } from './events.js';
export { getAuth } from './auth.js';
//# sourceMappingURL=index.d.ts.map