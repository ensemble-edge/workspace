/**
 * Permissions Domain — RBAC
 *
 * Role-based access control for workspace resources.
 */
export interface Permission {
    resource: string;
    action: 'read' | 'write' | 'delete' | 'admin';
}
export declare function createPermissionsService(): {
    check: (_userId: string, _permission: Permission) => Promise<boolean>;
};
//# sourceMappingURL=rbac.d.ts.map