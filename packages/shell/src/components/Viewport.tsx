/**
 * Viewport Component
 *
 * Main content area where apps render.
 * Uses the dynamic page registry — core apps register their pages
 * via side-effect imports, and the Viewport resolves the current
 * path to a component at render time.
 */

import * as React from 'react';
import { useSignals } from '@preact/signals-react/runtime';

import {
  currentPath,
  isAuthenticated,
  authLoading,
} from '../state';

import { findPage } from '../apps/registry';
import { NotFoundPage } from '../apps/NotFoundPage';

// Register all core app pages (side-effect imports)
import '../apps/core/home';
import '../apps/core/brand';
import '../apps/core/people';
import '../apps/core/admin';
import '../apps/core/apps';
import '../apps/core/audit';
import '../apps/core/auth';
import '../apps/core/nav';
import '../apps/core/knowledge';

export function Viewport() {
  useSignals();
  const path = currentPath.value;
  const loading = authLoading.value;
  const authenticated = isAuthenticated.value;

  // Redirect to login if not authenticated
  if (!loading && !authenticated && path !== '/login') {
    window.location.href = '/login';
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    );
  }

  // Show loading state while auth initializes
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Resolve path to a registered page component
  const page = findPage(path);
  const Component = page?.component ?? NotFoundPage;

  return (
    <div className="flex flex-1 flex-col">
      <Component />
    </div>
  );
}
