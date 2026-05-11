export interface User {
    id: string;
    email: string;
    name: string;
}
export interface UseAuthReturn {
    user: User | null;
    isAuthenticated: boolean;
    logout: () => Promise<void>;
}
export declare function useAuth(): UseAuthReturn;
//# sourceMappingURL=use-auth.d.ts.map