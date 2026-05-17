/**
 * Workspace locales service.
 *
 * Operators declare which content locales the workspace supports.
 * English is always enabled and always present after first read —
 * lazily seeded if missing. Exactly one locale is the default at any
 * time; promoting another demotes the previous default atomically.
 *
 * BCP-47 codes are stored case-preserving so 'fr-CA' stays 'fr-CA'
 * (not 'fr-ca') for correct Accept-Language negotiation downstream.
 */
export interface WorkspaceLocale {
    code: string;
    display_name: string;
    is_default: boolean;
    enabled: boolean;
    created_at: string;
}
interface Env {
    DB: D1Database;
}
export declare function isValidLocaleCode(code: string): boolean;
export declare function listLocales(env: Env, workspaceId: string): Promise<WorkspaceLocale[]>;
export declare function getDefaultLocale(env: Env, workspaceId: string): Promise<string>;
export declare function addLocale(env: Env, workspaceId: string, input: {
    code: string;
    display_name: string;
}): Promise<WorkspaceLocale>;
export declare function patchLocale(env: Env, workspaceId: string, code: string, patch: {
    display_name?: string;
    enabled?: boolean;
}): Promise<void>;
/**
 * Promote `code` to default. Demotes the previous default atomically.
 * Enables the locale as a side effect if it was disabled (you can't
 * have a disabled default).
 */
export declare function setDefaultLocale(env: Env, workspaceId: string, code: string): Promise<void>;
export declare function removeLocale(env: Env, workspaceId: string, code: string): Promise<void>;
export {};
//# sourceMappingURL=locales.d.ts.map