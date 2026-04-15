/**
 * Core App Contract
 *
 * Every core and bundled app implements this interface.
 * It defines both the server-side API routes (for the Worker)
 * and metadata (for the shell's navigation and page routing).
 */

import type { Hono } from 'hono';
import type { Env, ContextVariables } from '../types';

/**
 * The full definition of a core or bundled app.
 *
 * Server-side: registerRoutes mounts Hono API routes.
 * Client-side: the manifest tells the shell how to display the app in nav.
 */
export interface CoreAppDefinition {
  /** App manifest — metadata, nav config, display info */
  manifest: CoreAppManifest;

  /**
   * Register Hono API routes for this app.
   * Routes are mounted under /_ensemble/core/{app-id}/*
   */
  registerRoutes: (
    app: Hono<{ Bindings: Env; Variables: ContextVariables }>
  ) => void;
}

/**
 * Metadata for a core or bundled app.
 * Used by the shell for navigation, breadcrumbs, and page titles.
 */
export interface CoreAppManifest {
  /** Unique ID: "core:brand", "core:people", etc. */
  id: string;

  /** Display name */
  name: string;

  /** Lucide icon name */
  icon: string;

  /** Short description */
  description: string;

  /** App tier */
  tier: 'core' | 'bundled';

  /** Navigation configuration */
  nav: {
    /** Sidebar label */
    label: string;
    /** Lucide icon name for sidebar */
    icon: string;
    /** Which sidebar section: "apps" or "workspace" */
    section: 'apps' | 'workspace';
    /** Primary route path */
    path: string;
    /** Optional child routes for sub-navigation */
    children?: Array<{
      label: string;
      path: string;
      icon?: string;
    }>;
  };
}
