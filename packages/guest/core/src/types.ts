/**
 * @ensemble-edge/guest — Type Definitions
 *
 * Complete type definitions for building guest apps (connectors, tools, agents)
 * that run inside Ensemble Workspace.
 */

// ============================================================================
// Manifest Types
// ============================================================================

/**
 * Guest app manifest — the contract between a guest app and Ensemble.
 */
export interface GuestAppManifest {
  /** Unique identifier (kebab-case, e.g., "stripe-connector") */
  id: string;

  /** Display name shown in sidebar and app registry */
  name: string;

  /** Semantic version (e.g., "1.0.0") */
  version: string;

  /** Short description for app registry */
  description?: string;

  /** Icon name (Lucide) or URL */
  icon?: string;

  /** App category */
  category: 'tool' | 'connector' | 'agent' | 'panel';

  /** Permissions required by this app */
  permissions: Permission[];

  /** Entry point path (e.g., "/", "/app") */
  entry: string;

  /** Author information */
  author?: {
    name: string;
    email?: string;
    url?: string;
  };

  /** Widget definitions for dashboard */
  widgets?: WidgetDefinition[];

  /** Search provider configuration */
  search?: SearchConfig;

  /** AI panel tool definitions */
  ai?: AIConfig;

  /** Settings schema for admin configuration */
  settings?: SettingsConfig;

  /** External service connection (for connectors) */
  connects_to?: ExternalServiceConfig;

  /** Cron schedules (for agents) */
  schedules?: ScheduleConfig[];

  /** Event subscriptions */
  events?: EventSubscription[];

  /** Health check endpoint (defaults to /health) */
  health_endpoint?: string;
}

/**
 * Permissions that a guest app can request.
 */
export type Permission =
  | 'read:user'
  | 'read:workspace'
  | 'read:members'
  | 'write:members'
  | 'read:settings'
  | 'write:settings'
  | 'read:brand'
  | 'write:brand'
  | 'emit:events'
  | 'read:audit'
  | 'storage:read'
  | 'storage:write'
  | 'ai:invoke'
  | string; // Allow custom permissions

/**
 * Widget definition for dashboard integration.
 */
export interface WidgetDefinition {
  id: string;
  name: string;
  description?: string;
  size: 'small' | 'medium' | 'large' | 'wide' | 'tall';
  data_endpoint: string;
  refresh_interval_seconds?: number;
}

/**
 * Search provider configuration.
 */
export interface SearchConfig {
  enabled: boolean;
  endpoint: string;
  placeholder?: string;
  min_query_length?: number;
}

/**
 * AI panel configuration.
 */
export interface AIConfig {
  enabled?: boolean;
  tools: AITool[];
}

/**
 * AI tool definition for the AI panel.
 */
export interface AITool {
  name: string;
  description: string;
  parameters: Record<string, AIToolParameter>;
  endpoint?: string; // Defaults to /api/ai/{tool_name}
}

/**
 * AI tool parameter definition.
 */
export interface AIToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  required?: boolean;
  default?: unknown;
  enum?: string[];
}

/**
 * Settings configuration schema.
 */
export interface SettingsConfig {
  /** Admin-only settings (secrets, API keys) */
  admin?: SettingField[];
  /** User-configurable settings */
  user?: SettingField[];
}

/**
 * Setting field definition.
 */
export interface SettingField {
  name: string;
  type: 'string' | 'secret' | 'number' | 'boolean' | 'select';
  label: string;
  description?: string;
  required?: boolean;
  default?: unknown;
  options?: { value: string; label: string }[];
}

/**
 * External service connection configuration (for connectors).
 */
export interface ExternalServiceConfig {
  service: string;
  auth_type: 'oauth2' | 'api_key' | 'basic';
  oauth_config?: {
    authorization_url: string;
    token_url: string;
    scopes: string[];
  };
}

/**
 * Cron schedule configuration.
 */
export interface ScheduleConfig {
  id: string;
  cron: string;
  handler: string;
  description?: string;
}

/**
 * Event subscription configuration.
 */
export interface EventSubscription {
  event: string;
  handler: string;
}

// ============================================================================
// Context Types
// ============================================================================

/**
 * Workspace context injected by the gateway.
 */
export interface WorkspaceContext {
  workspaceId: string;
  workspaceName?: string;
  workspaceSlug?: string;
}

/**
 * User context injected by the gateway.
 */
export interface UserContext {
  userId: string;
  userEmail: string;
  userRole: 'owner' | 'admin' | 'member' | 'viewer' | 'guest';
  displayName?: string;
}

/**
 * Full guest app context (workspace + user + request).
 */
export interface GuestAppContext {
  workspace: WorkspaceContext;
  user: UserContext | null;
  appId: string;
  requestId: string;
  capabilityToken: string;
}

/**
 * Theme context for styling.
 */
export interface ThemeContext {
  colors: {
    accent: string;
    accentHover: string;
    accentDim: string;
    canvas: string;
    card: string;
    cardHover: string;
    cardBorder: string;
    textPrimary: string;
    textSecondary: string;
    textTertiary: string;
    error: string;
    success: string;
    warning: string;
    info: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    monoFont: string;
  };
  spatial: {
    radius: string;
    radiusSm: string;
    radiusLg: string;
  };
  mode: 'light' | 'dark';
}

// ============================================================================
// Config Types
// ============================================================================

/**
 * Guest app configuration passed to defineGuestApp.
 */
export interface GuestAppConfig {
  /** App manifest */
  manifest: GuestAppManifest;

  /** Called when the app is first loaded */
  onInit?: (ctx: GuestAppContext) => void | Promise<void>;

  /** Called when the app becomes active (user navigates to it) */
  onActivate?: (ctx: GuestAppContext) => void | Promise<void>;

  /** Called when the app is deactivated (user navigates away) */
  onDeactivate?: (ctx: GuestAppContext) => void | Promise<void>;

  /** Request handler for API routes (env is passed by the Cloudflare adapter) */
  fetch?: (request: Request, ctx: GuestAppContext, env?: unknown) => Response | Promise<Response>;
}

/**
 * Defined guest app (returned by defineGuestApp).
 */
export interface DefinedGuestApp {
  manifest: GuestAppManifest;
  init?: (ctx: GuestAppContext) => void | Promise<void>;
  activate?: (ctx: GuestAppContext) => void | Promise<void>;
  deactivate?: (ctx: GuestAppContext) => void | Promise<void>;
  fetch?: (request: Request, ctx: GuestAppContext, env?: unknown) => Response | Promise<Response>;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Standard API response shape.
 */
export interface ApiResponse<T = unknown> {
  data: T;
  meta?: {
    request_id: string;
    timestamp?: string;
    [key: string]: unknown;
  };
}

/**
 * Standard error response shape.
 */
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    request_id: string;
  };
}

/**
 * Paginated response shape.
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    request_id: string;
    total: number;
    page: number;
    per_page: number;
    has_more: boolean;
  };
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Event emitted by a guest app.
 */
export interface GuestAppEvent {
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
  source: {
    appId: string;
    workspaceId: string;
  };
}

// ============================================================================
// Header Constants
// ============================================================================

/**
 * HTTP headers injected by the gateway.
 */
export const ENSEMBLE_HEADERS = {
  WORKSPACE_ID: 'X-Ensemble-Workspace-Id',
  USER_ID: 'X-Ensemble-User-Id',
  USER_EMAIL: 'X-Ensemble-User-Email',
  USER_ROLE: 'X-Ensemble-User-Role',
  APP_ID: 'X-Ensemble-App-Id',
  CAPABILITY_TOKEN: 'X-Ensemble-Capability-Token',
  REQUEST_ID: 'X-Ensemble-Request-Id',
} as const;
