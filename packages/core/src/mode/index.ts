/**
 * @ensemble-edge/core — Deployment Mode Detection
 *
 * Ensemble workspaces can run in two modes:
 *
 * 1. **Standalone Mode**: The Worker handles everything — shell serving, auth,
 *    sessions, and API. Zero dependency on Ensemble infrastructure. Perfect for:
 *    - Self-hosted deployments
 *    - Development and testing
 *    - Organizations that want full control
 *
 * 2. **Cloud Mode**: The Ensemble proxy handles shell serving and auth. The
 *    Worker receives pre-authenticated requests with user info in headers.
 *    Benefits:
 *    - Shell updates without Worker deploys
 *    - Centralized SSO across workspaces
 *    - Managed infrastructure
 *
 * @example
 * ```ts
 * import { defineConfig } from '@ensemble-edge/core';
 *
 * // Standalone mode (default)
 * export default createWorkspace(defineConfig({
 *   mode: 'standalone',
 *   workspace: { name: 'Acme', slug: 'acme' },
 *   auth: {
 *     providers: ['email'],
 *     sessionSecret: env.SESSION_SECRET,
 *   },
 * }));
 *
 * // Cloud mode
 * export default createWorkspace(defineConfig({
 *   mode: 'cloud',
 *   workspace: { name: 'Acme', slug: 'acme' },
 *   // Auth handled by Ensemble proxy
 * }));
 * ```
 */

// ============================================================================
// Deployment Mode Types
// ============================================================================

/**
 * Deployment mode for the workspace.
 *
 * - `standalone`: Worker handles everything (shell, auth, API)
 * - `cloud`: Ensemble proxy handles shell + auth, Worker is pure API
 */
export type DeploymentMode = 'standalone' | 'cloud';

/**
 * Auth provider types for standalone mode.
 */
export type StandaloneAuthProvider =
  | 'email'       // Email + password
  | 'magic-link'  // Passwordless email
  | 'google'      // Google OAuth
  | 'github'      // GitHub OAuth
  | 'microsoft'   // Microsoft/Azure AD
  | 'saml';       // SAML SSO

/**
 * Email configuration for standalone mode.
 * Required for magic-link and password reset flows.
 */
export interface EmailConfig {
  /** Email provider to use */
  provider: 'resend' | 'sendgrid' | 'ses' | 'smtp';
  /** API key or credentials */
  apiKey?: string;
  /** From address for auth emails */
  fromAddress: string;
  /** From name for auth emails */
  fromName?: string;
  /** SMTP configuration (if provider is 'smtp') */
  smtp?: {
    host: string;
    port: number;
    secure?: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
}

/**
 * Session configuration for standalone mode.
 */
export interface SessionConfig {
  /** Secret used to sign JWTs (required) */
  secret: string;
  /** Access token expiry in seconds (default: 15 minutes) */
  accessTokenExpiry?: number;
  /** Refresh token expiry in seconds (default: 7 days) */
  refreshTokenExpiry?: number;
  /** Cookie domain (default: auto-detected) */
  cookieDomain?: string;
  /** Use secure cookies (default: true in production) */
  secureCookies?: boolean;
}

/**
 * OAuth provider configuration.
 */
export interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  /** Custom authorization URL (for enterprise SSO) */
  authorizationUrl?: string;
  /** Custom token URL (for enterprise SSO) */
  tokenUrl?: string;
  /** Additional scopes to request */
  scopes?: string[];
}

/**
 * SAML configuration for enterprise SSO.
 */
export interface SAMLConfig {
  /** Identity Provider metadata URL */
  metadataUrl?: string;
  /** Identity Provider SSO URL */
  ssoUrl: string;
  /** Identity Provider certificate */
  certificate: string;
  /** Service Provider entity ID */
  entityId: string;
  /** Assertion Consumer Service URL */
  acsUrl: string;
}

// ============================================================================
// Standalone Mode Config
// ============================================================================

/**
 * Configuration specific to standalone mode.
 */
export interface StandaloneModeConfig {
  mode: 'standalone';

  /** Auth configuration (required for standalone) */
  auth: {
    /** Enabled auth providers */
    providers: StandaloneAuthProvider[];
    /** Session/JWT configuration */
    session: SessionConfig;
    /** Email configuration (required for magic-link/password-reset) */
    email?: EmailConfig;
    /** OAuth provider configs */
    oauth?: {
      google?: OAuthProviderConfig;
      github?: OAuthProviderConfig;
      microsoft?: OAuthProviderConfig;
    };
    /** SAML configuration */
    saml?: SAMLConfig;
    /** Allow self-registration (default: true) */
    allowRegistration?: boolean;
    /** Require email verification (default: true) */
    requireEmailVerification?: boolean;
  };

  /** Whether to serve the shell from this Worker (default: true) */
  serveShell?: boolean;
}

// ============================================================================
// Cloud Mode Config
// ============================================================================

/**
 * Headers used by Ensemble proxy to pass auth info.
 */
export interface CloudAuthHeaders {
  /** Header containing user ID */
  userId: string;
  /** Header containing user email */
  userEmail: string;
  /** Header containing user's workspace role */
  userRole: string;
  /** Header containing workspace ID */
  workspaceId: string;
  /** Header containing request signature (for verification) */
  signature: string;
}

/**
 * Configuration specific to cloud mode.
 */
export interface CloudModeConfig {
  mode: 'cloud';

  /** Custom header names (defaults provided) */
  authHeaders?: Partial<CloudAuthHeaders>;

  /** Shared secret for verifying proxy requests */
  proxySecret?: string;

  /**
   * Allowed proxy IPs/ranges (optional, for extra security).
   * If not set, relies only on signature verification.
   */
  allowedProxyIps?: string[];
}

// ============================================================================
// Common Config
// ============================================================================

/**
 * Base configuration shared by both modes.
 */
export interface BaseWorkspaceConfig {
  /** Workspace identification */
  workspace: {
    name: string;
    slug: string;
    type?: 'organization' | 'personal' | 'team';
  };

  /** Brand configuration */
  brand?: {
    accent?: string;
    baseTheme?: 'warm' | 'cool' | 'neutral' | 'midnight' | 'stone';
    name?: string;
  };

  /** Locale configuration */
  locale?: {
    baseLanguage?: string;
    supportedLanguages?: string[];
    timezone?: string;
    dateFormat?: 'us' | 'eu' | 'iso';
    numberFormat?: 'us' | 'eu';
  };

  /** CORS configuration */
  cors?: {
    brandOrigins?: string[];
  };
}

// ============================================================================
// Combined Config Type
// ============================================================================

/**
 * Full workspace configuration — either standalone or cloud mode.
 */
export type WorkspaceModeConfig =
  | (BaseWorkspaceConfig & StandaloneModeConfig)
  | (BaseWorkspaceConfig & CloudModeConfig);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Default auth headers used by Ensemble proxy.
 */
export const DEFAULT_CLOUD_AUTH_HEADERS: CloudAuthHeaders = {
  userId: 'X-Ensemble-User-Id',
  userEmail: 'X-Ensemble-User-Email',
  userRole: 'X-Ensemble-User-Role',
  workspaceId: 'X-Ensemble-Workspace-Id',
  signature: 'X-Ensemble-Signature',
};

/**
 * Check if config is standalone mode.
 */
export function isStandaloneMode(
  config: WorkspaceModeConfig
): config is BaseWorkspaceConfig & StandaloneModeConfig {
  return config.mode === 'standalone';
}

/**
 * Check if config is cloud mode.
 */
export function isCloudMode(
  config: WorkspaceModeConfig
): config is BaseWorkspaceConfig & CloudModeConfig {
  return config.mode === 'cloud';
}

/**
 * Get resolved auth headers for cloud mode.
 */
export function getCloudAuthHeaders(
  config: BaseWorkspaceConfig & CloudModeConfig
): CloudAuthHeaders {
  return {
    ...DEFAULT_CLOUD_AUTH_HEADERS,
    ...config.authHeaders,
  };
}

/**
 * Detect mode from environment (useful for auto-configuration).
 *
 * Returns 'cloud' if ENSEMBLE_PROXY_SECRET is set, otherwise 'standalone'.
 */
export function detectModeFromEnv(env: Record<string, unknown>): DeploymentMode {
  if (env.ENSEMBLE_PROXY_SECRET) {
    return 'cloud';
  }
  return 'standalone';
}

/**
 * Type guard to check if a value is a valid deployment mode.
 */
export function isValidDeploymentMode(value: unknown): value is DeploymentMode {
  return value === 'standalone' || value === 'cloud';
}
