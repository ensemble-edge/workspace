/**
 * Client-Side Page Registry
 *
 * Core apps register their page components here.
 * The Viewport queries this registry to resolve paths to components.
 */

import type { ComponentType } from 'react';

/**
 * A page registration entry.
 * Each core app registers one or more pages.
 */
export interface AppPageRegistration {
  /** App ID this page belongs to (e.g., "core:brand") */
  appId: string;
  /** Route path — exact string or regex pattern */
  path: string | RegExp;
  /** React component to render */
  component: ComponentType;
  /** Page title for breadcrumbs */
  title?: string;
}

const pages: AppPageRegistration[] = [];

/**
 * Register a page component for a route.
 * Called by core app modules on import (side-effect registration).
 */
export function registerPage(registration: AppPageRegistration): void {
  pages.push(registration);
}

/**
 * Get all registered pages.
 */
export function getPages(): readonly AppPageRegistration[] {
  return pages;
}

/**
 * Find the page registration matching a given path.
 * Returns undefined if no match (Viewport shows 404).
 */
export function findPage(path: string): AppPageRegistration | undefined {
  return pages.find((p) => {
    if (typeof p.path === 'string') return p.path === path;
    return p.path.test(path);
  });
}
