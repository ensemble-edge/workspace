export interface AuthToken {
    token: string;
    expiresAt: number;
}
/**
 * Get the current auth token for API calls.
 */
export declare function getAuth(): AuthToken | null;
/**
 * Request elevated permissions.
 */
export declare function requestPermission(permission: string): Promise<boolean>;
//# sourceMappingURL=auth.d.ts.map