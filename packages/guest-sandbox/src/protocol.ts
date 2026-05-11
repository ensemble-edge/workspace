/**
 * The Ensemble guest-sandbox postMessage protocol.
 *
 * This is the v1 wire contract between the workspace shell and sandboxed
 * guest iframes. It's deliberately small: a fixed set of message shapes,
 * each versioned. Sandboxed guests cannot reach the host except through
 * these messages.
 *
 * **Contract stability:** Within v1, message shapes are frozen. New types
 * can be added (additive); existing types' fields cannot change. Unknown
 * types are ignored on receipt — that's how additive evolution works.
 *
 * Direction legend:
 *   guest -> host
 *   host  -> guest
 */

export type EnsembleMessage =
  /** guest -> host: Guest has loaded and is ready to receive context. */
  | { type: 'ensemble:ready'; v: 1 }

  /** host -> guest: Initial / refreshed context snapshot. */
  | {
      type: 'ensemble:context';
      v: 1;
      payload: {
        /** Current top-level path the iframe was mounted at (e.g. /apps/my-app). */
        path: string;
        /** Any additional context the host wants to push. Extensible. */
        [k: string]: unknown;
      };
    }

  /** guest -> host: Ask the host to navigate to a workspace URL. */
  | { type: 'ensemble:navigate'; v: 1; path: string }

  /** host -> guest: Workspace theme/brand changed. */
  | { type: 'ensemble:themeChange'; v: 1; payload: { mode?: 'light' | 'dark' } }

  /**
   * host -> guest: Snapshot of the host's computed CSS custom properties.
   * Sent on iframe mount (in response to ensemble:ready) and re-sent whenever
   * the operator changes workspace settings.
   *
   * The iframe applies these to its own :root so any var(--*) reference
   * inside the iframe resolves to the host's exact value — no drift on
   * padding, fonts, radius, etc. This is what makes guest apps look
   * pixel-identical to core apps regardless of the iframe document boundary.
   */
  | {
      type: 'ensemble:cssVars';
      v: 1;
      /** Map of CSS custom property name (with leading --) to value. */
      payload: Record<string, string>;
    }

  /** guest -> host: Emit an audit event (logged to workspace's audit trail). */
  | { type: 'ensemble:audit'; v: 1; event: string; details?: Record<string, unknown> }

  /** guest -> host: Report preferred content height (host may adjust iframe). */
  | { type: 'ensemble:resize'; v: 1; height: number };

export type EnsembleMessageType = EnsembleMessage['type'];

/** Type guard: is this a recognized ensemble: message? */
export function isEnsembleMessage(x: unknown): x is EnsembleMessage {
  if (!x || typeof x !== 'object') return false;
  const m = x as { type?: unknown; v?: unknown };
  return typeof m.type === 'string' && m.type.startsWith('ensemble:') && m.v === 1;
}
