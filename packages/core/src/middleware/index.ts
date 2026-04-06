/**
 * Middleware Exports
 *
 * Central export for all middleware. Middleware runs in the order
 * they are applied in createWorkspace().
 *
 * Pipeline order (Standalone mode):
 * 1. cors - Handle CORS preflight and headers
 * 2. bootstrapCheck - Redirect to setup if no users exist
 * 3. workspaceResolver - Resolve workspace from hostname/path
 * 4. auth - Validate JWT and attach user to context (API routes only)
 * 5. permissions - Check role-based access (API routes only)
 *
 * Pipeline order (Cloud mode):
 * 1. cors - Handle CORS preflight and headers
 * 2. workspaceResolver - Resolve workspace from hostname/path
 * 3. cloudAuth - Extract user from Ensemble proxy headers (API routes only)
 * 4. permissions - Check role-based access (API routes only)
 */

// Common middleware
export { cors } from './cors';
export { workspaceResolver } from './workspace-resolver';

// Standalone mode middleware
export { bootstrapCheck, markBootstrapComplete, clearBootstrapCache } from './bootstrap';
export { auth, requireRole, requireOwnership, requirePermission } from './auth';
export type { AuthMiddlewareOptions } from './auth';

// Cloud mode middleware
export { cloudAuth, createCloudAuthMiddleware } from './cloud-auth';
export type { CloudAuthMiddlewareOptions } from './cloud-auth';
