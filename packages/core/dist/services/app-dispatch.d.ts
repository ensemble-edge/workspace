/**
 * App dispatch (Track B) — resolve an incoming (host, path) to the app
 * mount that should serve it, from the App Manager mount map.
 *
 * This is the routing DECISION, kept pure so it's fully testable without
 * a live Worker→Worker hop:
 *   • core-app mount   → served in-process (the core routes already
 *                        handle /legal, /brand, etc.) — dispatch is a
 *                        no-op "passthrough", NOT a proxy.
 *   • guest-app mount  → forward to that guest worker (the caller does
 *                        the actual service-binding fetch, reusing the
 *                        gateway's proven proxy primitives).
 *   • no match         → fall through (let the normal route table /
 *                        SPA catch-all handle it).
 *
 * Only ACTIVE apps with a NON-'*' mount host participate — `host:'*'`
 * means "the workspace's own host," which the normal routes already
 * serve, so dispatch ignores it (no behavior change for existing setups).
 *
 * The live forward is verified on deploy (service bindings + zone routes
 * aren't exercisable in the dev container); this resolver's logic is
 * verified here. See docs/plan/app-manager-implementation.md §3b.
 */
import type { AppEntry } from './app-registry';
export type DispatchTarget = {
    kind: 'passthrough';
    appId: string;
} | {
    kind: 'guest';
    appId: string;
    guestId: string;
    matchedPath: string;
} | {
    kind: 'fallthrough';
};
/**
 * Resolve which app mount serves (host, path). Pure: takes the already-
 * loaded registry. Returns the most-specific match (longest mount path
 * wins, so a deeper mount beats a shallower one).
 */
export declare function resolveDispatch(apps: AppEntry[], host: string, path: string): DispatchTarget;
//# sourceMappingURL=app-dispatch.d.ts.map