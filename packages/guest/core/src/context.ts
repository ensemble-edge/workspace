/**
 * Context extraction utilities for guest apps.
 *
 * The Ensemble Gateway injects context headers into every request.
 * These helpers extract that context into typed objects.
 */

import {
  ENSEMBLE_HEADERS,
  type GuestAppContext,
  type WorkspaceContext,
  type UserContext,
} from './types.js';

/**
 * Extract workspace context from request headers.
 */
export function getWorkspaceContext(request: Request): WorkspaceContext | null {
  const workspaceId = request.headers.get(ENSEMBLE_HEADERS.WORKSPACE_ID);

  if (!workspaceId) {
    return null;
  }

  return {
    workspaceId,
  };
}

/**
 * Extract user context from request headers.
 */
export function getUserContext(request: Request): UserContext | null {
  const userId = request.headers.get(ENSEMBLE_HEADERS.USER_ID);
  const userEmail = request.headers.get(ENSEMBLE_HEADERS.USER_EMAIL);
  const userRole = request.headers.get(ENSEMBLE_HEADERS.USER_ROLE);

  if (!userId || !userEmail || !userRole) {
    return null;
  }

  return {
    userId,
    userEmail,
    userRole: userRole as UserContext['userRole'],
  };
}

/**
 * Extract full guest app context from request headers.
 *
 * @example
 * ```ts
 * export default {
 *   async fetch(request: Request): Promise<Response> {
 *     const ctx = getContext(request);
 *     if (!ctx) {
 *       return new Response('Missing context', { status: 400 });
 *     }
 *     console.log(`Request from workspace ${ctx.workspace.workspaceId}`);
 *     return new Response('OK');
 *   }
 * }
 * ```
 */
export function getContext(request: Request): GuestAppContext | null {
  const workspace = getWorkspaceContext(request);
  const appId = request.headers.get(ENSEMBLE_HEADERS.APP_ID);
  const requestId = request.headers.get(ENSEMBLE_HEADERS.REQUEST_ID);
  const capabilityToken = request.headers.get(ENSEMBLE_HEADERS.CAPABILITY_TOKEN);

  if (!workspace || !appId || !requestId || !capabilityToken) {
    return null;
  }

  return {
    workspace,
    user: getUserContext(request),
    appId,
    requestId,
    capabilityToken,
  };
}

/**
 * Require context or throw an error.
 *
 * @throws Error if context headers are missing
 *
 * @example
 * ```ts
 * export default {
 *   async fetch(request: Request): Promise<Response> {
 *     const ctx = requireContext(request); // Throws if missing
 *     return new Response(`Hello ${ctx.user?.userEmail ?? 'anonymous'}`);
 *   }
 * }
 * ```
 */
export function requireContext(request: Request): GuestAppContext {
  const ctx = getContext(request);
  if (!ctx) {
    throw new Error(
      'Missing Ensemble context headers. This app must be accessed through the Ensemble Gateway.'
    );
  }
  return ctx;
}

/**
 * Require authenticated user or throw an error.
 *
 * @throws Error if user is not authenticated
 */
export function requireUser(request: Request): GuestAppContext & { user: UserContext } {
  const ctx = requireContext(request);
  if (!ctx.user) {
    throw new Error('Authentication required');
  }
  return ctx as GuestAppContext & { user: UserContext };
}

/**
 * Check if the user has a specific role or higher.
 */
export function hasRole(
  ctx: GuestAppContext,
  requiredRole: UserContext['userRole']
): boolean {
  if (!ctx.user) return false;

  const roleHierarchy: Record<UserContext['userRole'], number> = {
    guest: 0,
    viewer: 1,
    member: 2,
    admin: 3,
    owner: 4,
  };

  const userLevel = roleHierarchy[ctx.user.userRole] ?? 0;
  const requiredLevel = roleHierarchy[requiredRole] ?? 0;

  return userLevel >= requiredLevel;
}

/**
 * Require a minimum role level.
 *
 * @throws Error if user doesn't have sufficient permissions
 */
export function requireRole(
  ctx: GuestAppContext,
  requiredRole: UserContext['userRole']
): void {
  if (!hasRole(ctx, requiredRole)) {
    throw new Error(`Insufficient permissions. Required: ${requiredRole}`);
  }
}
