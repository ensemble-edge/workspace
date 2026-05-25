// @ensemble-edge/core — Ensemble Workspace Engine
// ============================================================================
// Main Factory Functions
// ============================================================================
// Legacy API (backwards compatible)
export { createWorkspace } from './create-workspace.js';
// Mode-aware API (recommended for new projects)
export { createWorkspaceV2 } from './create-workspace-v2.js';
// ============================================================================
// Mode Detection & Configuration
// ============================================================================
// Config helper
export { defineConfig, validateStandaloneConfig, validateCloudConfig } from './mode/define-config.js';
// Mode types
export { DEFAULT_CLOUD_AUTH_HEADERS, isStandaloneMode, isCloudMode, getCloudAuthHeaders, detectModeFromEnv, isValidDeploymentMode, } from './mode/index.js';
// ============================================================================
// Middleware
// ============================================================================
// Common middleware
export { cors, workspaceResolver } from './middleware/index.js';
// Standalone mode middleware
export { bootstrapCheck, auth, requireRole, requireOwnership, requirePermission } from './middleware/index.js';
// Cloud mode middleware
export { cloudAuth, createCloudAuthMiddleware } from './middleware/index.js';
// Database utilities
export { runMigrations, hasMigrations, migrations } from './db/index.js';
// Auth utilities
export { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken, hashPassword, verifyPassword, validatePassword, setCookie, parseCookies, getCookie, clearCookie, setAccessTokenCookie, setRefreshTokenCookie, setWorkspaceCookie, getAuthCookies, clearAuthCookies, getCookieOptionsForEnv, COOKIE_NAMES, TOKEN_EXPIRY, ACCESS_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY, } from './utils/index.js';
// ============================================================================
// Domain Exports (new structure)
// ============================================================================
// Workspace domain (theme, i18n)
export * from './workspace/index.js';
// Apps domain (registry)
export * from './apps/index.js';
// Gateway domain (proxy)
export * from './gateway/index.js';
// Permissions domain (RBAC)
export * from './permissions/index.js';
// Knowledge domain (RAG)
export * from './knowledge/index.js';
// Events domain (bus)
export * from './events/index.js';
// Notifications domain
export * from './notifications/index.js';
// AI domain
export * from './ai/index.js';
// Auth service (larger, kept in services/)
export * from './services/auth.js';
// Shell — now a separate package: @ensemble-edge/shell
// Shell assets (JS/CSS) are imported from '../../shell/dist/assets.js'
// by create-workspace.ts and served at /_ensemble/shell/*
//# sourceMappingURL=index.js.map