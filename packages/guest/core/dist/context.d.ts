/**
 * Context extraction utilities for guest apps.
 *
 * The Ensemble Gateway injects context headers into every request.
 * These helpers extract that context into typed objects.
 */
import { type GuestAppContext, type WorkspaceContext, type UserContext } from './types.js';
/**
 * Extract workspace context from request headers.
 */
export declare function getWorkspaceContext(request: Request): WorkspaceContext | null;
/**
 * Extract user context from request headers.
 */
export declare function getUserContext(request: Request): UserContext | null;
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
export declare function getContext(request: Request): GuestAppContext | null;
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
export declare function requireContext(request: Request): GuestAppContext;
/**
 * Require authenticated user or throw an error.
 *
 * @throws Error if user is not authenticated
 */
export declare function requireUser(request: Request): GuestAppContext & {
    user: UserContext;
};
/**
 * Check if the user has a specific role or higher.
 */
export declare function hasRole(ctx: GuestAppContext, requiredRole: UserContext['userRole']): boolean;
/**
 * Require a minimum role level.
 *
 * @throws Error if user doesn't have sufficient permissions
 */
export declare function requireRole(ctx: GuestAppContext, requiredRole: UserContext['userRole']): void;
//# sourceMappingURL=context.d.ts.map