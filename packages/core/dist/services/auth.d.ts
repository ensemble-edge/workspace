/**
 * Auth Service
 *
 * Handles authentication, session management, and user operations.
 * Uses D1 for persistent storage and JWT for stateless auth.
 */
import type { D1Database } from '@cloudflare/workers-types';
import type { User, Membership, Role, JWTPayload } from '../types';
/**
 * Auth service configuration.
 */
export interface AuthConfig {
    db: D1Database;
    jwtSecret: string;
}
/**
 * Login credentials.
 */
export interface LoginCredentials {
    email: string;
    password: string;
    workspaceId: string;
}
/**
 * Registration data.
 */
export interface RegisterData {
    email: string;
    password: string;
    displayName?: string;
    handle?: string;
    workspaceId: string;
    role?: Role;
}
/**
 * Auth result returned from login/register.
 */
export interface AuthResult {
    user: User;
    membership: Membership;
    accessToken: string;
    refreshToken: string;
}
/**
 * Auth Service class.
 *
 * @example
 * ```ts
 * const auth = new AuthService({ db: c.env.DB, jwtSecret: c.env.JWT_SECRET });
 *
 * // Login
 * const result = await auth.login({
 *   email: 'user@example.com',
 *   password: 'password123',
 *   workspaceId: 'ws_123'
 * });
 *
 * // Set cookies and return
 * c.header('Set-Cookie', setAccessTokenCookie(result.accessToken));
 * ```
 */
export declare class AuthService {
    private db;
    private jwtSecret;
    constructor(config: AuthConfig);
    /**
     * Register a new user.
     *
     * @param data - Registration data
     * @returns Auth result with tokens
     * @throws Error if email already exists or validation fails
     */
    register(data: RegisterData): Promise<AuthResult>;
    /**
     * Authenticate a user with email and password.
     *
     * @param credentials - Login credentials
     * @returns Auth result with tokens
     * @throws Error if credentials are invalid
     */
    login(credentials: LoginCredentials): Promise<AuthResult>;
    /**
     * Logout and invalidate session.
     *
     * @param refreshToken - Refresh token to invalidate
     */
    logout(refreshToken: string): Promise<void>;
    /**
     * Refresh access token using refresh token.
     *
     * @param refreshToken - Current refresh token
     * @returns New tokens
     * @throws Error if refresh token is invalid
     */
    refresh(refreshToken: string): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    /**
     * Get current user from access token.
     *
     * @param accessToken - JWT access token
     * @returns User and membership or null if invalid
     */
    me(accessToken: string): Promise<{
        user: User;
        membership: Membership;
    } | null>;
    /**
     * Verify access token and return payload.
     *
     * @param accessToken - JWT access token
     * @returns Payload or null if invalid
     */
    verifyToken(accessToken: string): Promise<JWTPayload | null>;
    /**
     * Create session tokens.
     */
    private createSession;
}
/**
 * Create an auth service instance.
 *
 * @param config - Auth configuration
 * @returns Auth service instance
 */
export declare function createAuthService(config: AuthConfig): AuthService;
//# sourceMappingURL=auth.d.ts.map