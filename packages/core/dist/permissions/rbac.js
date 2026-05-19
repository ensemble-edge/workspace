/**
 * Permissions Domain — RBAC
 *
 * Role-based access control for workspace resources.
 */
export function createPermissionsService() {
    return {
        check: async (_userId, _permission) => {
            // TODO: Implement permission checking
            return true;
        },
    };
}
//# sourceMappingURL=rbac.js.map