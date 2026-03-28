import type { WorkspaceContext } from './types';

/**
 * Get the current workspace context.
 */
export function getContext(): WorkspaceContext {
  // TODO: Implement postMessage communication with workspace
  return {
    workspaceId: '',
    workspaceName: '',
    userId: '',
    userEmail: '',
  };
}
