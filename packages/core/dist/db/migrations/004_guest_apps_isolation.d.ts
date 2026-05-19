/**
 * Migration 004: Guest Apps Isolation
 *
 * Adds the `isolation` column to guest_apps so the shell knows how to
 * render each app:
 *
 *   - 'trusted'   (default): iframe with allow-same-origin, loads workspace's
 *                 runtime, full UI integration. For first-party apps.
 *   - 'sandboxed': strict iframe sandbox (allow-scripts only), no shared
 *                 origin, no access to window.Ensemble. Communicates with
 *                 the host via postMessage. For untrusted/third-party apps.
 *
 * Existing rows default to 'trusted' so v0.1.5 apps keep working unchanged.
 */
import type { Migration } from '../migrate';
export declare const migration: Migration;
//# sourceMappingURL=004_guest_apps_isolation.d.ts.map