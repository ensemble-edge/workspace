/**
 * Toast Notification System
 *
 * Ephemeral UI alerts that slide in, show a message, and auto-dismiss.
 * Built with Preact Signals for reactive state management.
 *
 * Usage:
 *   import { toast } from '@ensemble-edge/core/shell'
 *
 *   toast.success('Settings saved')
 *   toast.error('Invalid email', { description: 'Please check the format' })
 *   toast.info('Uploading...', { duration: 0 }) // persistent
 *
 * TODO: Add guest app event bridge for toasts via context.events.emit('toast', ...)
 */

import { signal, computed } from '@preact/signals-react';

/**
 * Toast notification type.
 */
export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  description?: string;
  duration?: number; // ms, default 5000. 0 = persistent until dismissed.
  dismissible?: boolean; // default true
  action?: {
    label: string;
    onClick: () => void;
  };
  createdAt: number; // timestamp for ordering
}

/**
 * Options for creating a toast (id is auto-generated).
 */
export type ToastOptions = Omit<Toast, 'id' | 'createdAt'>;

/**
 * Partial options for convenience methods.
 */
export type PartialToastOptions = Partial<Omit<ToastOptions, 'type' | 'message'>>;

/**
 * Toast store - reactive signal containing all active toasts.
 */
export const toasts = signal<Toast[]>([]);

/**
 * Maximum number of visible toasts.
 */
const MAX_TOASTS = 5;

/**
 * Default auto-dismiss duration in milliseconds.
 */
const DEFAULT_DURATION = 5000;

/**
 * Map of toast IDs to their auto-dismiss timeouts.
 */
const dismissTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Generate a unique toast ID.
 */
function generateId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Add a toast notification.
 *
 * @param options - Toast configuration
 * @returns The toast ID for programmatic dismissal
 */
function addToast(options: ToastOptions): string {
  const id = generateId();
  const duration = options.duration ?? DEFAULT_DURATION;
  const dismissible = options.dismissible ?? true;

  const newToast: Toast = {
    ...options,
    id,
    duration,
    dismissible,
    createdAt: Date.now(),
  };

  // Add toast, enforcing max limit
  toasts.value = [...toasts.value, newToast].slice(-MAX_TOASTS);

  // Set up auto-dismiss if duration > 0
  if (duration > 0) {
    scheduleAutoDismiss(id, duration);
  }

  return id;
}

/**
 * Schedule auto-dismissal of a toast.
 */
function scheduleAutoDismiss(id: string, duration: number): void {
  // Clear any existing timeout
  const existingTimeout = dismissTimeouts.get(id);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }

  const timeout = setTimeout(() => {
    dismissToast(id);
  }, duration);

  dismissTimeouts.set(id, timeout);
}

/**
 * Pause auto-dismiss for a toast (e.g., on hover).
 */
export function pauseAutoDismiss(id: string): void {
  const timeout = dismissTimeouts.get(id);
  if (timeout) {
    clearTimeout(timeout);
    dismissTimeouts.delete(id);
  }
}

/**
 * Resume auto-dismiss for a toast (e.g., on mouse leave).
 */
export function resumeAutoDismiss(id: string, remainingDuration: number): void {
  if (remainingDuration > 0) {
    scheduleAutoDismiss(id, remainingDuration);
  }
}

/**
 * Dismiss a specific toast by ID.
 */
export function dismissToast(id: string): void {
  // Clear timeout if exists
  const timeout = dismissTimeouts.get(id);
  if (timeout) {
    clearTimeout(timeout);
    dismissTimeouts.delete(id);
  }

  // Remove from store
  toasts.value = toasts.value.filter((t) => t.id !== id);
}

/**
 * Dismiss all toasts.
 */
export function dismissAllToasts(): void {
  // Clear all timeouts
  dismissTimeouts.forEach((timeout) => clearTimeout(timeout));
  dismissTimeouts.clear();

  // Clear store
  toasts.value = [];
}

/**
 * Dismiss the most recent toast.
 */
export function dismissMostRecent(): void {
  const mostRecent = toasts.value[toasts.value.length - 1];
  if (mostRecent) {
    dismissToast(mostRecent.id);
  }
}

/**
 * Toast factory with convenience methods.
 */
interface ToastFunction {
  (options: ToastOptions): string;
  success: (message: string, options?: PartialToastOptions) => string;
  error: (message: string, options?: PartialToastOptions) => string;
  warning: (message: string, options?: PartialToastOptions) => string;
  info: (message: string, options?: PartialToastOptions) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

/**
 * Main toast function with convenience methods attached.
 */
export const toast: ToastFunction = Object.assign(
  (options: ToastOptions): string => addToast(options),
  {
    success: (message: string, options?: PartialToastOptions): string =>
      addToast({ type: 'success', message, ...options }),

    error: (message: string, options?: PartialToastOptions): string =>
      addToast({ type: 'error', message, ...options }),

    warning: (message: string, options?: PartialToastOptions): string =>
      addToast({ type: 'warning', message, ...options }),

    info: (message: string, options?: PartialToastOptions): string =>
      addToast({ type: 'info', message, ...options }),

    dismiss: dismissToast,
    dismissAll: dismissAllToasts,
  }
);
