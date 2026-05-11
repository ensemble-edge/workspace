/**
 * @ensemble-edge/guest-sandbox — Sandboxed-guest SDK.
 *
 * Sandboxed guests have NO access to window.Ensemble, NO shared origin
 * with the host workspace, and CANNOT read the workspace's cookies or
 * DOM. The only way they communicate with the host is postMessage.
 *
 * This package wraps that protocol with typed helpers so guest authors
 * don't write `window.parent.postMessage(...)` everywhere.
 *
 * Typical usage:
 *
 *   import { connectToHost } from '@ensemble-edge/workspace/guest-sandbox';
 *
 *   const host = connectToHost();
 *   host.ready();
 *   host.onContext((ctx) => { console.log('got context', ctx); });
 *
 *   button.addEventListener('click', () => {
 *     host.navigate('/apps/other');
 *     host.audit('button_clicked', { buttonId: 'save' });
 *   });
 */

export { isEnsembleMessage } from './protocol.js';
export type { EnsembleMessage, EnsembleMessageType } from './protocol.js';

import type { EnsembleMessage } from './protocol.js';

export interface HostConnection {
  /** Tell the host we're ready (typically called once on script load). */
  ready(): void;

  /** Ask the host to navigate to a workspace path. */
  navigate(path: string): void;

  /** Emit an audit event. Host writes it to the workspace audit log. */
  audit(event: string, details?: Record<string, unknown>): void;

  /** Tell the host our preferred content height (lets host size the iframe). */
  resize(heightPx: number): void;

  /** Register a callback for host-pushed context. Returns unsubscribe. */
  onContext(cb: (ctx: Record<string, unknown>) => void): () => void;

  /** Register a callback for theme changes. Returns unsubscribe. */
  onThemeChange(cb: (theme: { mode?: 'light' | 'dark' }) => void): () => void;
}

/**
 * Connect to the workspace shell. Safe to call before the host is ready —
 * sends are queued via the browser's message channel; receives start as
 * soon as the listener is registered.
 *
 * Sandboxed iframes have a `null` origin, so we send/accept messages from
 * any origin. The trust boundary is the iframe boundary itself, not origin.
 */
export function connectToHost(): HostConnection {
  if (typeof window === 'undefined' || window.parent === window) {
    // Not running in an iframe — return a no-op connection so guest
    // code can still be exercised in tests / dev.
    return makeNoopConnection();
  }

  const contextListeners = new Set<(ctx: Record<string, unknown>) => void>();
  const themeListeners = new Set<(t: { mode?: 'light' | 'dark' }) => void>();

  window.addEventListener('message', (event) => {
    const msg = event.data as Partial<EnsembleMessage>;
    if (!msg || typeof msg.type !== 'string' || msg.v !== 1) return;

    switch (msg.type) {
      case 'ensemble:context':
        for (const cb of contextListeners) {
          try { cb((msg as { payload: Record<string, unknown> }).payload); } catch { /* shield */ }
        }
        break;
      case 'ensemble:themeChange':
        for (const cb of themeListeners) {
          try { cb((msg as { payload: { mode?: 'light' | 'dark' } }).payload); } catch { /* shield */ }
        }
        break;
      case 'ensemble:cssVars': {
        // Apply host-provided CSS variables to this iframe's :root.
        // This is what makes the iframe pixel-identical to the host —
        // the same --content-padding, --font-heading, --primary, etc.
        // resolve to the same computed values, regardless of any
        // /_ensemble/brand/css fallbacks loaded via <link>.
        const payload = (msg as { payload: Record<string, string> }).payload;
        const root = document.documentElement;
        for (const [name, value] of Object.entries(payload || {})) {
          if (typeof name === 'string' && name.startsWith('--')) {
            root.style.setProperty(name, value);
          }
        }
        break;
      }
    }
  });

  function send(msg: EnsembleMessage): void {
    // targetOrigin '*' because sandboxed iframes can't compute the host
    // origin (null). The host validates by source, not by origin.
    window.parent.postMessage(msg, '*');
  }

  return {
    ready: () => send({ type: 'ensemble:ready', v: 1 }),
    navigate: (path) => send({ type: 'ensemble:navigate', v: 1, path }),
    audit: (event, details) =>
      send({ type: 'ensemble:audit', v: 1, event, details }),
    resize: (heightPx) =>
      send({ type: 'ensemble:resize', v: 1, height: Math.round(heightPx) }),
    onContext: (cb) => {
      contextListeners.add(cb);
      return () => { contextListeners.delete(cb); };
    },
    onThemeChange: (cb) => {
      themeListeners.add(cb);
      return () => { themeListeners.delete(cb); };
    },
  };
}

function makeNoopConnection(): HostConnection {
  const noop = () => { /* no-op */ };
  return {
    ready: noop,
    navigate: noop,
    audit: noop,
    resize: noop,
    onContext: () => noop,
    onThemeChange: () => noop,
  };
}
