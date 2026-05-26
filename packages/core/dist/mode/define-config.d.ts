/**
 * defineConfig — Type-safe Configuration Helper
 *
 * Provides autocomplete and validation for workspace configuration.
 *
 * @example
 * ```ts
 * import { defineConfig, createWorkspace } from '../index';
 *
 * export default createWorkspace(defineConfig({
 *   mode: 'standalone',
 *   workspace: { name: 'Acme', slug: 'acme' },
 *   auth: {
 *     providers: ['email'],
 *     session: { secret: env.JWT_SECRET },
 *   },
 * }));
 * ```
 */
import type { WorkspaceModeConfig, StandaloneModeConfig, CloudModeConfig, BaseWorkspaceConfig } from './index';
export type { CloudAuthHeaders } from './index';
/**
 * Resolved standalone config with all defaults applied.
 */
export interface ResolvedStandaloneConfig {
    mode: 'standalone';
    workspace: {
        name: string;
        slug: string;
        type: 'organization' | 'personal' | 'team';
    };
    brand: {
        accent: string;
        baseTheme: 'warm' | 'cool' | 'neutral' | 'midnight' | 'stone';
        name: string;
    };
    locale: {
        baseLanguage: string;
        supportedLanguages: string[];
        timezone: string;
        dateFormat: 'us' | 'eu' | 'iso';
        numberFormat: 'us' | 'eu';
    };
    auth: StandaloneModeConfig['auth'] & {
        allowRegistration: boolean;
        requireEmailVerification: boolean;
    };
    cors: {
        brandOrigins: string[];
    };
    serveShell: boolean;
}
/**
 * Resolved cloud config with all defaults applied.
 */
export interface ResolvedCloudConfig {
    mode: 'cloud';
    workspace: {
        name: string;
        slug: string;
        type: 'organization' | 'personal' | 'team';
    };
    brand: {
        accent: string;
        baseTheme: 'warm' | 'cool' | 'neutral' | 'midnight' | 'stone';
        name: string;
    };
    locale: {
        baseLanguage: string;
        supportedLanguages: string[];
        timezone: string;
        dateFormat: 'us' | 'eu' | 'iso';
        numberFormat: 'us' | 'eu';
    };
    cors: {
        brandOrigins: string[];
    };
    authHeaders: {
        userId: string;
        userEmail: string;
        userRole: string;
        workspaceId: string;
        signature: string;
    };
    proxySecret: string | undefined;
    allowedProxyIps: string[];
}
/**
 * Resolved config — either standalone or cloud.
 */
export type ResolvedModeConfig = ResolvedStandaloneConfig | ResolvedCloudConfig;
/**
 * Define workspace configuration with type safety and autocomplete.
 *
 * This function validates the config shape at compile time and applies
 * sensible defaults at runtime.
 *
 * @param config - Workspace configuration
 * @returns Validated and resolved configuration
 *
 * @example
 * ```ts
 * // Standalone mode with email auth
 * const config = defineConfig({
 *   mode: 'standalone',
 *   workspace: { name: 'Acme Corp', slug: 'acme' },
 *   auth: {
 *     providers: ['email', 'google'],
 *     session: { secret: process.env.JWT_SECRET! },
 *     oauth: {
 *       google: {
 *         clientId: process.env.GOOGLE_CLIENT_ID!,
 *         clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
 *       },
 *     },
 *   },
 * });
 *
 * // Cloud mode (auth handled by proxy)
 * const config = defineConfig({
 *   mode: 'cloud',
 *   workspace: { name: 'Acme Corp', slug: 'acme' },
 *   proxySecret: process.env.ENSEMBLE_PROXY_SECRET,
 * });
 * ```
 */
export declare function defineConfig<T extends WorkspaceModeConfig>(config: T): T extends {
    mode: 'standalone';
} ? ResolvedStandaloneConfig : ResolvedCloudConfig;
/**
 * Validate standalone config has required fields.
 *
 * @throws Error if config is invalid
 */
export declare function validateStandaloneConfig(config: BaseWorkspaceConfig & StandaloneModeConfig): void;
/**
 * Validate cloud config has required fields.
 *
 * @throws Error if config is invalid
 */
export declare function validateCloudConfig(config: BaseWorkspaceConfig & CloudModeConfig): void;
//# sourceMappingURL=define-config.d.ts.map