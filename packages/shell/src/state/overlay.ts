/**
 * Overlay State Management
 *
 * Manages the overlay stack for drawers, modals, and dialogs.
 * Overlays ARE pages — they have URLs, respect permissions, and are deep-linkable.
 *
 * Layer hierarchy (from 01-page-architecture.md):
 * - Layer 60: Toasts (always on top, non-blocking)
 * - Layer 50: Command palette (⌘K, overlays everything)
 * - Layer 40: Dialog (small confirmation, blocks below)
 * - Layer 35: Modal (centered form, blocks below)
 * - Layer 30: Drawer (right-side detail, semi-blocking)
 * - Layer 15: Right strip panels (AI, activity — non-blocking)
 * - Layer 0: Viewport (the canvas with cards)
 */

import { signal, computed } from '@preact/signals-react';
import type { ReactNode } from 'react';

// =============================================================================
// Types
// =============================================================================

export type OverlayDisplay = 'drawer' | 'modal' | 'dialog';

export interface OverlayConfig {
  /** Unique identifier for this overlay */
  id: string;
  /** Display mode */
  display: OverlayDisplay;
  /** Content to render inside the overlay */
  content: ReactNode;
  /** Title for the overlay header */
  title?: string;
  /** Custom width (overrides defaults) */
  width?: number;
  /** Called when overlay is closed */
  onClose?: () => void;
  /** Whether clicking backdrop closes the overlay (default: true for drawer/modal, false for dialog) */
  closeOnBackdrop?: boolean;
  /** Whether Escape key closes the overlay (default: true) */
  closeOnEscape?: boolean;
  /** Route path that triggered this overlay (for URL sync) */
  routePath?: string;
}

export interface DrawerConfig extends Omit<OverlayConfig, 'display'> {
  display?: 'drawer';
}

export interface ModalConfig extends Omit<OverlayConfig, 'display'> {
  display?: 'modal';
  /** Max width for modal (default: 560px) */
  maxWidth?: number;
}

export interface DialogConfig extends Omit<OverlayConfig, 'display'> {
  display?: 'dialog';
  /** Max width for dialog (default: 400px) */
  maxWidth?: number;
}

export interface ConfirmOptions {
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'default' | 'primary' | 'danger';
}

export interface AlertOptions {
  title: string;
  body: string;
  buttonLabel?: string;
}

// =============================================================================
// State Signals
// =============================================================================

/**
 * The overlay stack. Multiple overlays can be open simultaneously.
 * Rules:
 * - A dialog can open on top of a modal
 * - A dialog can open on top of a drawer
 * - A modal can open on top of a drawer
 * - Drawers don't stack — opening a new drawer replaces the current one
 */
export const overlayStack = signal<OverlayConfig[]>([]);

/**
 * Track which overlays are animating out (for exit animations).
 */
export const closingOverlays = signal<Set<string>>(new Set());

// =============================================================================
// Computed Values
// =============================================================================

/**
 * Currently active drawer (only one at a time).
 */
export const activeDrawer = computed<OverlayConfig | null>(() => {
  const stack = overlayStack.value;
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].display === 'drawer') {
      return stack[i];
    }
  }
  return null;
});

/**
 * Currently active modal (topmost).
 */
export const activeModal = computed<OverlayConfig | null>(() => {
  const stack = overlayStack.value;
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].display === 'modal') {
      return stack[i];
    }
  }
  return null;
});

/**
 * Currently active dialog (topmost).
 */
export const activeDialog = computed<OverlayConfig | null>(() => {
  const stack = overlayStack.value;
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].display === 'dialog') {
      return stack[i];
    }
  }
  return null;
});

/**
 * Whether any overlay is open.
 */
export const hasOpenOverlay = computed(() => overlayStack.value.length > 0);

/**
 * The topmost overlay (for focus management).
 */
export const topmostOverlay = computed<OverlayConfig | null>(() => {
  const stack = overlayStack.value;
  return stack.length > 0 ? stack[stack.length - 1] : null;
});

/**
 * Whether a drawer is currently open.
 */
export const isDrawerOpen = computed(() => activeDrawer.value !== null);

/**
 * Whether any blocking overlay is open (modal or dialog).
 */
export const hasBlockingOverlay = computed(() => {
  return overlayStack.value.some(o => o.display === 'modal' || o.display === 'dialog');
});

// =============================================================================
// Actions
// =============================================================================

let overlayIdCounter = 0;

/**
 * Generate a unique overlay ID.
 */
function generateOverlayId(): string {
  return `overlay-${++overlayIdCounter}-${Date.now()}`;
}

/**
 * Open a drawer overlay.
 * If a drawer is already open, it will be replaced.
 */
export function openDrawer(config: Omit<DrawerConfig, 'id'>): string {
  const id = generateOverlayId();

  // Close any existing drawer first (drawers don't stack)
  const currentDrawer = activeDrawer.value;
  if (currentDrawer) {
    closeOverlay(currentDrawer.id);
  }

  // Close AI panel if open (they share the same space)
  // This will be handled by the Shell component

  const overlay: OverlayConfig = {
    id,
    display: 'drawer',
    closeOnBackdrop: true,
    closeOnEscape: true,
    ...config,
  };

  overlayStack.value = [...overlayStack.value, overlay];
  return id;
}

/**
 * Open a modal overlay.
 * Modals can stack on top of drawers.
 */
export function openModal(config: Omit<ModalConfig, 'id'>): string {
  const id = generateOverlayId();

  const overlay: OverlayConfig = {
    id,
    display: 'modal',
    closeOnBackdrop: true,
    closeOnEscape: true,
    ...config,
  };

  overlayStack.value = [...overlayStack.value, overlay];
  return id;
}

/**
 * Open a dialog overlay.
 * Dialogs can stack on top of modals and drawers.
 * Click outside does NOT close dialogs (prevents accidental dismissal).
 */
export function openDialog(config: Omit<DialogConfig, 'id'>): string {
  const id = generateOverlayId();

  const overlay: OverlayConfig = {
    id,
    display: 'dialog',
    closeOnBackdrop: false, // Dialogs don't close on backdrop click
    closeOnEscape: true,
    ...config,
  };

  overlayStack.value = [...overlayStack.value, overlay];
  return id;
}

/**
 * Close a specific overlay by ID.
 * Triggers exit animation before removal.
 */
export function closeOverlay(id: string): void {
  const overlay = overlayStack.value.find(o => o.id === id);
  if (!overlay) return;

  // Mark as closing for animation
  closingOverlays.value = new Set([...closingOverlays.value, id]);

  // Call onClose callback
  overlay.onClose?.();

  // Remove after animation completes
  setTimeout(() => {
    overlayStack.value = overlayStack.value.filter(o => o.id !== id);
    const newClosing = new Set(closingOverlays.value);
    newClosing.delete(id);
    closingOverlays.value = newClosing;
  }, 200); // Match animation duration
}

/**
 * Close the topmost overlay.
 * Used for Escape key handling.
 */
export function closeTopOverlay(): void {
  const top = topmostOverlay.value;
  if (top && top.closeOnEscape !== false) {
    closeOverlay(top.id);
  }
}

/**
 * Close all overlays.
 */
export function closeAllOverlays(): void {
  const ids = overlayStack.value.map(o => o.id);
  ids.forEach(id => closeOverlay(id));
}

/**
 * Close all overlays of a specific type.
 */
export function closeOverlaysByType(display: OverlayDisplay): void {
  const ids = overlayStack.value
    .filter(o => o.display === display)
    .map(o => o.id);
  ids.forEach(id => closeOverlay(id));
}

// =============================================================================
// Convenience Methods: Confirm & Alert Dialogs
// =============================================================================

/**
 * Show a confirmation dialog. Returns a promise that resolves to true/false.
 */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const {
      title,
      body,
      confirmLabel = 'Confirm',
      cancelLabel = 'Cancel',
      confirmVariant = 'primary',
    } = options;

    // We'll create the content in the Dialog component
    // For now, store the config and let the component render it
    const id = openDialog({
      title,
      content: { type: 'confirm', body, confirmLabel, cancelLabel, confirmVariant, resolve },
      onClose: () => resolve(false),
    } as any);

    // Store resolve function for the dialog to call
    (overlayStack.value.find(o => o.id === id) as any)._confirmResolve = resolve;
  });
}

/**
 * Show an alert dialog. Returns a promise that resolves when dismissed.
 */
export function alert(options: AlertOptions): Promise<void> {
  return new Promise((resolve) => {
    const { title, body, buttonLabel = 'OK' } = options;

    openDialog({
      title,
      content: { type: 'alert', body, buttonLabel, resolve },
      onClose: () => resolve(),
    } as any);
  });
}

// =============================================================================
// Keyboard Handler
// =============================================================================

/**
 * Initialize keyboard handlers for overlays.
 * Should be called once on app mount.
 */
export function initOverlayKeyboard(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && hasOpenOverlay.value) {
      e.preventDefault();
      e.stopPropagation();
      closeTopOverlay();
    }
  });
}

// =============================================================================
// useOverlay Hook Interface
// =============================================================================

/**
 * The overlay API object returned by useOverlay().
 */
export interface OverlayAPI {
  /** Open a drawer with custom content */
  openDrawer: (config: Omit<DrawerConfig, 'id'>) => string;
  /** Open a modal with custom content */
  openModal: (config: Omit<ModalConfig, 'id'>) => string;
  /** Open a dialog with custom content */
  openDialog: (config: Omit<DialogConfig, 'id'>) => string;
  /** Show a confirmation dialog */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Show an alert dialog */
  alert: (options: AlertOptions) => Promise<void>;
  /** Close a specific overlay by ID */
  close: (id: string) => void;
  /** Close the topmost overlay */
  closeTop: () => void;
  /** Close all overlays */
  closeAll: () => void;
  /** Check if any overlay is open */
  hasOpen: () => boolean;
}

/**
 * Get the overlay API.
 * This is the imperative API for opening overlays programmatically.
 *
 * Usage:
 * ```tsx
 * import { useOverlay } from '@ensemble-edge/ui';
 *
 * const overlay = useOverlay();
 *
 * // Confirmation dialog
 * const confirmed = await overlay.confirm({
 *   title: 'Delete item?',
 *   body: 'This cannot be undone.',
 *   confirmVariant: 'danger',
 * });
 *
 * // Open a drawer with custom content
 * overlay.openDrawer({
 *   title: 'Customer Details',
 *   content: <CustomerDetail id={customerId} />,
 * });
 * ```
 */
export function useOverlay(): OverlayAPI {
  return {
    openDrawer,
    openModal,
    openDialog,
    confirm,
    alert,
    close: closeOverlay,
    closeTop: closeTopOverlay,
    closeAll: closeAllOverlays,
    hasOpen: () => hasOpenOverlay.value,
  };
}
