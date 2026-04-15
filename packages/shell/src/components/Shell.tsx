/**
 * Shell Component
 *
 * Main shell layout using SidebarProvider from @ensemble-edge/ui.
 * Provides responsive sidebar with collapsible states.
 */

import * as React from 'react';
import { useEffect } from 'react';
import { useSignals } from '@preact/signals-react/runtime';

import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
  Separator,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  Toaster,
} from '@ensemble-edge/ui';

import { AppSidebar } from './AppSidebar';
import { Viewport } from './Viewport';
import {
  fetchWorkspace,
  fetchUser,
  fetchTheme,
  fetchNav,
  currentPath,
} from '../state';

// Map paths to breadcrumb labels
const pathLabels: Record<string, string> = {
  '/': 'Home',
  '/people': 'People',
  '/brand': 'Brand',
  '/settings': 'Settings',
  '/apps': 'Apps',
};

export function Shell() {
  useSignals();

  const path = currentPath.value;

  // Initialize on mount
  useEffect(() => {
    // Fetch all data in parallel
    Promise.all([
      fetchWorkspace(),
      fetchUser(),
      fetchTheme(),
      fetchNav(),
    ]).catch((err) => {
      console.error('[Shell] Failed to initialize:', err);
    });
  }, []);

  // Get breadcrumb label
  const pageLabel = pathLabels[path] || path.split('/').pop() || 'Page';

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="h-svh overflow-hidden">
        {/* Header with breadcrumb */}
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>{pageLabel}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        {/* Main content - scrollable */}
        <div className="flex-1 overflow-y-auto p-4">
          <Viewport />
        </div>
      </SidebarInset>

      {/* Toast notifications (alert-styled) */}
      <Toaster position="bottom-right" />
    </SidebarProvider>
  );
}
