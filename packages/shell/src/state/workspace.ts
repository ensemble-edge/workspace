/**
 * Workspace State
 *
 * Preact Signals for workspace context including identity,
 * settings, and current selection.
 */

import { signal, computed } from '@preact/signals-react';
import type { Workspace, WorkspaceSettings } from '../../types';

/**
 * Current workspace data.
 */
export const workspace = signal<Workspace | null>(null);

/**
 * List of workspaces the user has access to.
 */
export const workspaces = signal<Workspace[]>([]);

/**
 * Loading state for workspace data.
 */
export const workspaceLoading = signal(true);

/**
 * Error message for workspace loading.
 */
export const workspaceError = signal<string | null>(null);

/**
 * Computed: Workspace slug.
 */
export const workspaceSlug = computed(() => workspace.value?.slug ?? null);

/**
 * Computed: Workspace name.
 */
export const workspaceName = computed(() => workspace.value?.name ?? 'Workspace');

/**
 * Computed: Workspace settings.
 */
export const workspaceSettings = computed<WorkspaceSettings>(() =>
  workspace.value?.settings ?? {}
);

/**
 * Fetch workspace data from API.
 */
export async function fetchWorkspace(): Promise<void> {
  workspaceLoading.value = true;
  workspaceError.value = null;

  try {
    const response = await fetch('/_ensemble/workspace');
    if (!response.ok) {
      throw new Error('Failed to load workspace');
    }

    const data = (await response.json()) as Workspace;
    workspace.value = data;
  } catch (error) {
    workspaceError.value = error instanceof Error ? error.message : 'Unknown error';
  } finally {
    workspaceLoading.value = false;
  }
}

/**
 * Switch to a different workspace.
 */
export async function switchWorkspace(slug: string): Promise<void> {
  if (typeof window === 'undefined') return;

  // Navigate to new workspace
  window.location.href = `/${slug}/`;
}
