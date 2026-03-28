// Auth utilities for guest apps

export interface AuthToken {
  token: string;
  expiresAt: number;
}

/**
 * Get the current auth token for API calls.
 */
export function getAuth(): AuthToken | null {
  // TODO: Implement token retrieval from workspace
  return null;
}

/**
 * Request elevated permissions.
 */
export async function requestPermission(permission: string): Promise<boolean> {
  // TODO: Implement permission request flow
  return false;
}
