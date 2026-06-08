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
    onThemeChange(cb: (theme: {
        mode?: 'light' | 'dark';
    }) => void): () => void;
}
/**
 * Connect to the workspace shell. Safe to call before the host is ready —
 * sends are queued via the browser's message channel; receives start as
 * soon as the listener is registered.
 *
 * Sandboxed iframes have a `null` origin, so we send/accept messages from
 * any origin. The trust boundary is the iframe boundary itself, not origin.
 */
export declare function connectToHost(): HostConnection;
//# sourceMappingURL=index.d.ts.map