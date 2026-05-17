/**
 * Workspace events — pub/sub for "something the workspace owns changed."
 *
 * Mutation sites in the workspace (Languages tab, brand tabs, settings,
 * etc.) call `emitWorkspaceEvent('locale.added', { ... })` after a
 * successful save. Subscribers — component-tier guest apps in the host
 * React tree AND iframe-tier guests via postMessage — get notified.
 *
 * Why a custom bus instead of just using signals: signals fire on
 * *every* dependency change, including transient state. Events are
 * coarser — they fire once per logical mutation, carry a structured
 * payload, and are explicitly broadcast to iframes via postMessage.
 *
 * The contract is intentionally narrow (5–6 event types in v0.1.17) so
 * guest authors can rely on it. Adding new event types is additive;
 * removing or repurposing is a breaking change.
 */

import { signal } from '@preact/signals-react';

export type WorkspaceEventType =
  | 'locale.added'
  | 'locale.removed'
  | 'locale.default-changed'
  | 'brand.tokens.changed'
  | 'user.role.changed'
  | 'workspace.settings.changed';

export interface WorkspaceEvent {
  /** Event type. Treat as opaque — match by exact string. */
  type: WorkspaceEventType;
  /** Server-clock timestamp (ms since epoch). */
  ts: number;
  /** Type-specific payload. */
  data?: Record<string, unknown>;
}

/**
 * Latest event signal. Each emit replaces the value; subscribers in
 * Preact components that read this signal re-render.
 */
export const latestWorkspaceEvent = signal<WorkspaceEvent | null>(null);

type Listener = (event: WorkspaceEvent) => void;
const listeners = new Set<Listener>();
const subscribedIframes = new Set<Window>();

/**
 * Emit a workspace event. Fans out to the signal, direct listeners,
 * and subscribed iframe windows (via postMessage).
 */
export function emitWorkspaceEvent(
  type: WorkspaceEventType,
  data?: Record<string, unknown>,
): void {
  const event: WorkspaceEvent = { type, ts: Date.now(), data };
  latestWorkspaceEvent.value = event;
  for (const fn of listeners) {
    try { fn(event); } catch (e) { console.error('[ensemble-events] listener threw:', e); }
  }
  for (const w of subscribedIframes) {
    try {
      w.postMessage({ type: 'ensemble:event', v: 1, event }, '*');
    } catch {
      subscribedIframes.delete(w);
    }
  }
}

/** Imperative subscribe. Returns an unsubscribe function. */
export function subscribeWorkspaceEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/**
 * Register an iframe window for postMessage forwarding. Called when an
 * iframe-tier guest sends `ensemble:subscribe-events`. Returns an
 * unregister function (call on iframe unload).
 */
export function registerIframeForEvents(w: Window): () => void {
  subscribedIframes.add(w);
  return () => { subscribedIframes.delete(w); };
}
