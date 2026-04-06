/**
 * defineConfig — Type-safe Configuration Helper
 *
 * Provides autocomplete and validation for workspace configuration.
 *
 * @example
 * ```ts
 * import { defineConfig, createWorkspace } from '@ensemble-edge/core';
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

import type {
  WorkspaceModeConfig,
  StandaloneModeConfig,
  CloudModeConfig,
  BaseWorkspaceConfig,
  CloudAuthHeaders,
} from './index';

// Re-export for convenience
export type { CloudAuthHeaders } from './index';

// ============================================================================
// Resolved Config Types (with defaults applied)
// ============================================================================

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

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_BRAND = {
  accent: '#3B82F6',
  baseTheme: 'neutral' as const,
};

const DEFAULT_LOCALE = {
  baseLanguage: 'en',
  supportedLanguages: ['en'],
  timezone: 'UTC',
  dateFormat: 'us' as const,
  numberFormat: 'us' as const,
};

const DEFAULT_CLOUD_HEADERS = {
  userId: 'X-Ensemble-User-Id',
  userEmail: 'X-Ensemble-User-Email',
  userRole: 'X-Ensemble-User-Role',
  workspaceId: 'X-Ensemble-Workspace-Id',
  signature: 'X-Ensemble-Signature',
};

// ============================================================================
// defineConfig Function
// ============================================================================

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
export function defineConfig<T extends WorkspaceModeConfig>(config: T): T extends { mode: 'standalone' }
  ? ResolvedStandaloneConfig
  : ResolvedCloudConfig {
  // Apply base defaults
  const baseResolved = {
    workspace: {
      name: config.workspace.name,
      slug: config.workspace.slug,
      type: config.workspace.type ?? 'organization',
    },
    brand: {
      accent: config.brand?.accent ?? DEFAULT_BRAND.accent,
      baseTheme: config.brand?.baseTheme ?? DEFAULT_BRAND.baseTheme,
      name: config.brand?.name ?? config.workspace.name,
    },
    locale: {
      baseLanguage: config.locale?.baseLanguage ?? DEFAULT_LOCALE.baseLanguage,
      supportedLanguages: config.locale?.supportedLanguages ?? DEFAULT_LOCALE.supportedLanguages,
      timezone: config.locale?.timezone ?? DEFAULT_LOCALE.timezone,
      dateFormat: config.locale?.dateFormat ?? DEFAULT_LOCALE.dateFormat,
      numberFormat: config.locale?.numberFormat ?? DEFAULT_LOCALE.numberFormat,
    },
    cors: {
      brandOrigins: config.cors?.brandOrigins ?? [],
    },
  };

  if (config.mode === 'standalone') {
    const standaloneConfig = config as BaseWorkspaceConfig & StandaloneModeConfig;
    return {
      ...baseResolved,
      mode: 'standalone',
      auth: {
        ...standaloneConfig.auth,
        allowRegistration: standaloneConfig.auth.allowRegistration ?? true,
        requireEmailVerification: standaloneConfig.auth.requireEmailVerification ?? true,
      },
      serveShell: standaloneConfig.serveShell ?? true,
    } as T extends { mode: 'standalone' } ? ResolvedStandaloneConfig : ResolvedCloudConfig;
  }

  // Cloud mode
  const cloudConfig = config as BaseWorkspaceConfig & CloudModeConfig;
  return {
    ...baseResolved,
    mode: 'cloud',
    authHeaders: {
      ...DEFAULT_CLOUD_HEADERS,
      ...cloudConfig.authHeaders,
    },
    proxySecret: cloudConfig.proxySecret,
    allowedProxyIps: cloudConfig.allowedProxyIps ?? [],
  } as T extends { mode: 'standalone' } ? ResolvedStandaloneConfig : ResolvedCloudConfig;
}

/**
 * Validate standalone config has required fields.
 *
 * @throws Error if config is invalid
 */
export function validateStandaloneConfig(
  config: BaseWorkspaceConfig & StandaloneModeConfig
): void {
  if (!config.auth?.providers?.length) {
    throw new Error('Standalone mode requires at least one auth provider');
  }

  if (!config.auth.session?.secret) {
    throw new Error('Standalone mode requires auth.session.secret');
  }

  // Check if magic-link is enabled but no email config
  if (config.auth.providers.includes('magic-link') && !config.auth.email) {
    throw new Error('Magic-link auth requires email configuration');
  }

  // Check OAuth providers have credentials
  const oauthProviders = ['google', 'github', 'microsoft'] as const;
  for (const provider of oauthProviders) {
    if (config.auth.providers.includes(provider)) {
      const oauthConfig = config.auth.oauth?.[provider];
      if (!oauthConfig?.clientId || !oauthConfig?.clientSecret) {
        throw new Error(`${provider} OAuth requires clientId and clientSecret`);
      }
    }
  }

  // Check SAML config
  if (config.auth.providers.includes('saml') && !config.auth.saml) {
    throw new Error('SAML auth requires saml configuration');
  }
}

/**
 * Validate cloud config has required fields.
 *
 * @throws Error if config is invalid
 */
export function validateCloudConfig(
  config: BaseWorkspaceConfig & CloudModeConfig
): void {
  // Cloud mode is simpler — proxy secret is recommended but not required
  // (can use IP allowlist instead)
  if (!config.proxySecret && !config.allowedProxyIps?.length) {
    console.warn(
      'Cloud mode: Neither proxySecret nor allowedProxyIps set. ' +
      'Requests will not be verified as coming from Ensemble proxy.'
    );
  }
}
