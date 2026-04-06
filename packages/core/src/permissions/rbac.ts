/**
 * Permissions Domain — RBAC
 *
 * Role-based access control for workspace resources.
 */

export interface Permission {
  resource: string;
  action: 'read' | 'write' | 'delete' | 'admin';
}

export function createPermissionsService() {
  return {
    check: async (_userId: string, _permission: Permission): Promise<boolean> => {
      // TODO: Implement permission checking
      return true;
    },
  };
}
