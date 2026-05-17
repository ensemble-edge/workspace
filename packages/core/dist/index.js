// @ensemble-edge/core — Ensemble Workspace Engine
// ============================================================================
// Main Factory Functions
// ============================================================================
// Legacy API (backwards compatible)
export { createWorkspace } from './create-workspace';
// Mode-aware API (recommended for new projects)
export { createWorkspaceV2 } from './create-workspace-v2';
// ============================================================================
// Mode Detection & Configuration
// ============================================================================
// Config helper
export { defineConfig, validateStandaloneConfig, validateCloudConfig } from './mode/define-config';
// Mode types
export { DEFAULT_CLOUD_AUTH_HEADERS, isStandaloneMode, isCloudMode, getCloudAuthHeaders, detectModeFromEnv, isValidDeploymentMode, } from './mode';
// ============================================================================
// Middleware
// ============================================================================
// Common middleware
export { cors, workspaceResolver } from './middleware';
// Standalone mode middleware
export { bootstrapCheck, auth, requireRole, requireOwnership, requirePermission } from './middleware';
// Cloud mode middleware
export { cloudAuth, createCloudAuthMiddleware } from './middleware';
// Database utilities
export { runMigrations, hasMigrations, migrations } from './db';
// Auth utilities
export { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken, hashPassword, verifyPassword, validatePassword, setCookie, parseCookies, getCookie, clearCookie, setAccessTokenCookie, setRefreshTokenCookie, setWorkspaceCookie, getAuthCookies, clearAuthCookies, getCookieOptionsForEnv, COOKIE_NAMES, TOKEN_EXPIRY, ACCESS_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY, } from './utils';
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
// Shell — now a separate package: @ensemble-edge/shell
// Shell assets (JS/CSS) are imported from '@ensemble-edge/shell/assets'
// by create-workspace.ts and served at /_ensemble/shell/*
//# sourceMappingURL=index.js.map