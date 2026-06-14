/// <reference types="@cloudflare/workers-types" />
/**
 * @ensemble-edge/core — Type Definitions
 *
 * Core types for Ensemble Workspace including Cloudflare bindings,
 * context types, and domain models.
 */

import type { Context } from 'hono';

// ============================================================================
// Cloudflare Bindings
// ============================================================================

/**
 * Environment bindings available in the Cloudflare Worker.
 * These are configured in wrangler.toml.
 */
export interface Env {
  // Database
  DB: D1Database;

  // Key-Value store (sessions, cache)
  KV: KVNamespace;

  // Object storage (assets, uploads). The default binding name is
  // 'R2' but operators can rename it via the workspace setting
  // `r2_binding_name` to integrate with pre-existing CF projects
  // that already bind R2 under another name (e.g. FILES, STORAGE).
  // Access through getR2Bucket(env, workspaceId) — never c.env.R2
  // directly — so the configurable binding name actually takes effect.
  R2?: R2Bucket;

  // Secrets (set via `wrangler secret put`)
  JWT_SECRET: string;

  // Environment variables
  ENVIRONMENT?: 'development' | 'staging' | 'production';
}

// ============================================================================
// Workspace Types
// ============================================================================

/**
 * Workspace configuration stored in D1.
 */
export interface Workspace {
  id: string;
  slug: string;
  name: string;
  type: 'organization' | 'personal' | 'team';
  settings: WorkspaceSettings;
  createdAt: string;
  updatedAt: string;
}

/**
 * Workspace settings stored as JSON in D1.
 */
export interface WorkspaceSettings {
  /** Default locale for the workspace */
  defaultLocale?: string;
  /** Supported locales */
  supportedLocales?: string[];
  /** Timezone */
  timezone?: string;
  /** Custom settings */
  [key: string]: unknown;
}

// ============================================================================
// User & Auth Types
// ============================================================================

/**
 * User identity (AIUX identity, universal across workspaces).
 */
export interface User {
  id: string;
  email: string;
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  locale: string;
  createdAt: string;
}

/**
 * Membership connecting a user to a workspace.
 */
export interface Membership {
  userId: string;
  workspaceId: string;
  role: Role;
  createdAt: string;
}

/**
 * User roles in a workspace.
 */
export type Role = 'owner' | 'admin' | 'member' | 'viewer' | 'guest';

/**
 * Session stored in D1 (for refresh tokens).
 */
export interface Session {
  id: string;
  userId: string;
  workspaceId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
}

/**
 * JWT payload for access tokens.
 */
export interface JWTPayload {
  /** Subject (user ID) */
  sub: string;
  /** Workspace ID */
  wid: string;
  /** User email */
  email: string;
  /** User handle */
  handle: string | null;
  /** Role in workspace */
  role: Role;
  /** Issued at */
  iat: number;
  /** Expiration */
  exp: number;
}

// ============================================================================
// Brand & Theme Types
// ============================================================================

/**
 * Brand token stored in D1.
 */
export interface BrandToken {
  workspaceId: string;
  category: BrandCategory;
  key: string;
  value: string;
  type: 'color' | 'text' | 'number' | 'url' | 'font';
  label: string | null;
  locale: string | null;
  updatedAt: string;
}

/**
 * Brand token categories.
 */
export type BrandCategory =
  | 'colors'
  | 'typography'
  | 'identity'
  | 'spatial'
  | 'messaging'
  | 'custom';

/**
 * Theme configuration derived from brand tokens.
 */
export interface Theme {
  colors: {
    accent: string;
    primary: string;
    surface: string;
    background: string;
    foreground: string;
    muted: string;
    border: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    monoFont: string;
  };
  spatial: {
    radius: string;
    density: 'compact' | 'normal' | 'comfortable';
  };
  identity: {
    name: string;
    logoUrl: string | null;
    faviconUrl: string | null;
  };
}

// ============================================================================
// Navigation Types
// ============================================================================

/**
 * Navigation configuration stored in D1.
 */
export interface NavConfig {
  workspaceId: string;
  sections: NavSection[];
  updatedAt: string;
}

/**
 * Navigation section in the sidebar.
 */
export interface NavSection {
  id: string;
  label: string;
  visibility?: 'all' | 'admin' | 'owner';
  items: NavItem[];
}

/**
 * Navigation item in a section.
 */
export interface NavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  badge?: number;
}

// ============================================================================
// Hono Context Extensions
// ============================================================================

/**
 * Variables stored in Hono context.
 */
export interface ContextVariables {
  /** Current workspace (resolved from hostname/path) */
  workspace: Workspace;
  /** Current user (from JWT) */
  user: User | null;
  /** Current membership (user's role in workspace) */
  membership: Membership | null;
  /** JWT payload from verified token */
  jwtPayload: JWTPayload | null;
  /** Request ID for logging */
  requestId: string;
  /**
   * The tenant's brand domain ({ domain, proto }) when configured — set
   * by the resolver regardless of which host the request arrived on.
   * Drives fully-qualified canonical/hreflang URLs and the workspace-
   * host→brand-domain redirect. Null when the tenant has no brand domain
   * (URLs fall back to the request host). See services/brand-domain.ts.
   */
  brandDomain?: { domain: string; proto: string } | null;
  /**
   * Present when the request was authenticated via a workspace API key
   * (Authorization: Bearer wks_...). Null/undefined for cookie-auth.
   * The user/membership context still gets populated from the key's
   * creator + their workspace role, so role-based middleware works
   * uniformly across cookie and bearer auth.
   */
  apiKey?: { id: string; name: string } | null;
}

/**
 * Extended Hono context with Ensemble types.
 */
export type EnsembleContext = Context<{
  Bindings: Env;
  Variables: ContextVariables;
}>;

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Workspace configuration from ensemble.config.ts.
 */
export interface WorkspaceConfig {
  workspace: {
    name: string;
    slug: string;
    type?: 'organization' | 'personal' | 'team';
  };
  brand?: {
    accent?: string;
    baseTheme?: 'warm' | 'cool' | 'neutral' | 'midnight' | 'stone';
    name?: string;
  };
  locale?: {
    baseLanguage?: string;
    supportedLanguages?: string[];
    timezone?: string;
    dateFormat?: 'us' | 'eu' | 'iso';
    numberFormat?: 'us' | 'eu';
  };
  auth?: {
    providers?: ('email' | 'google' | 'github' | 'microsoft' | 'saml')[];
  };
  cors?: {
    brandOrigins?: string[];
  };
}

/**
 * Validated config with defaults applied.
 */
export interface ResolvedConfig {
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
  auth: {
    providers: ('email' | 'google' | 'github' | 'microsoft' | 'saml')[];
  };
  cors: {
    brandOrigins: string[];
  };
}
