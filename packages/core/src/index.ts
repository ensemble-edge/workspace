// @ensemble-edge/core — Ensemble Workspace Engine

// ============================================================================
// Main Factory Functions
// ============================================================================

// Legacy API (backwards compatible)
export { createWorkspace } from './create-workspace';
export type { WorkspaceInstance } from './create-workspace';

// Mode-aware API (recommended for new projects)
export { createWorkspaceV2 } from './create-workspace-v2';

// ============================================================================
// Mode Detection & Configuration
// ============================================================================

// Config helper
export { defineConfig, validateStandaloneConfig, validateCloudConfig } from './mode/define-config';
export type {
  ResolvedStandaloneConfig,
  ResolvedCloudConfig,
  ResolvedModeConfig,
} from './mode/define-config';

// Mode types
export {
  DEFAULT_CLOUD_AUTH_HEADERS,
  isStandaloneMode,
  isCloudMode,
  getCloudAuthHeaders,
  detectModeFromEnv,
  isValidDeploymentMode,
} from './mode';
export type {
  DeploymentMode,
  StandaloneAuthProvider,
  EmailConfig,
  SessionConfig,
  OAuthProviderConfig,
  SAMLConfig,
  StandaloneModeConfig,
  CloudAuthHeaders,
  CloudModeConfig,
  BaseWorkspaceConfig,
  WorkspaceModeConfig,
} from './mode';

// ============================================================================
// Core Types
// ============================================================================

export type {
  Env,
  Workspace,
  WorkspaceSettings,
  WorkspaceConfig,
  ResolvedConfig,
  User,
  Membership,
  Role,
  Session,
  JWTPayload,
  BrandToken,
  BrandCategory,
  Theme,
  NavConfig,
  NavSection,
  NavItem,
  ContextVariables,
  EnsembleContext,
} from './types';

// ============================================================================
// Middleware
// ============================================================================

// Common middleware
export { cors, workspaceResolver } from './middleware';

// Standalone mode middleware
export { bootstrapCheck, auth, requireRole, requireOwnership, requirePermission } from './middleware';
export type { AuthMiddlewareOptions } from './middleware';

// Cloud mode middleware
export { cloudAuth, createCloudAuthMiddleware } from './middleware';
export type { CloudAuthMiddlewareOptions } from './middleware';

// Database utilities
export { runMigrations, hasMigrations, migrations } from './db';
export type { Migration } from './db';

// Auth utilities
export {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashPassword,
  verifyPassword,
  validatePassword,
  setCookie,
  parseCookies,
  getCookie,
  clearCookie,
  setAccessTokenCookie,
  setRefreshTokenCookie,
  setWorkspaceCookie,
  getAuthCookies,
  clearAuthCookies,
  getCookieOptionsForEnv,
  COOKIE_NAMES,
  TOKEN_EXPIRY,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
} from './utils';
export type { CookieOptions } from './utils';

// ============================================================================
// Domain Exports (new structure)
// ============================================================================

// Workspace domain (theme, i18n)
export * from './workspace';

// Apps domain (registry)
export * from './apps';

// Gateway domain (proxy)
export * from './gateway';

// Permissions domain (RBAC)
export * from './permissions';

// Knowledge domain (RAG)
export * from './knowledge';

// Events domain (bus)
export * from './events';

// Notifications domain
export * from './notifications';

// AI domain
export * from './ai';

// Auth service (larger, kept in services/)
export * from './services/auth';

// Shell (client-side SPA)
// IMPORTANT: Shell components are browser-only and should NOT be imported in Workers.
// The shell is served as a pre-bundled JS string via /_ensemble/shell/shell.js.
// For client-side code, import shell components from '@ensemble-edge/core/shell'.
//
// DO NOT export shell functions here - they contain browser APIs (window, document)
// that will crash Workers at module load time.
