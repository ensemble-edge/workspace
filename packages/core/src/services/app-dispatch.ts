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

export type DispatchTarget =
  | { kind: 'passthrough'; appId: string } // core app mount — serve in-process
  | { kind: 'guest'; appId: string; guestId: string; matchedPath: string } // forward to guest worker
  | { kind: 'fallthrough' }; // no app claims this (host, path)

/** Lowercase, strip port. */
function normHost(host: string): string {
  return host.split(':')[0]!.trim().toLowerCase();
}

/**
 * Does `path` fall under `mountPath`? Prefix match on a path boundary so
 * `/legal` matches `/legal` and `/legal/x` but NOT `/legalese`.
 */
function pathMatches(mountPath: string, path: string): boolean {
  if (path === mountPath) return true;
  const base = mountPath.endsWith('/') ? mountPath : `${mountPath}/`;
  return path.startsWith(base);
}

/**
 * Resolve which app mount serves (host, path). Pure: takes the already-
 * loaded registry. Returns the most-specific match (longest mount path
 * wins, so a deeper mount beats a shallower one).
 */
export function resolveDispatch(apps: AppEntry[], host: string, path: string): DispatchTarget {
  const h = normHost(host);

  let best: { app: AppEntry; mountPath: string } | null = null;
  for (const app of apps) {
    if (app.status !== 'active') continue;
    for (const m of app.mounts) {
      // '*' mounts are served by the normal routes on the workspace host;
      // dispatch only handles explicit (brand) host mounts.
      if (m.host === '*') continue;
      if (normHost(m.host) !== h) continue;
      if (!pathMatches(m.path, path)) continue;
      if (!best || m.path.length > best.mountPath.length) {
        best = { app, mountPath: m.path };
      }
    }
  }

  if (!best) return { kind: 'fallthrough' };

  if (best.app.tier === 'core') {
    // Core mounts serve in-process; dispatch doesn't proxy them.
    return { kind: 'passthrough', appId: best.app.id };
  }

  // guest:<id> — strip the prefix to get the guest_apps.id.
  const guestId = best.app.id.startsWith('guest:') ? best.app.id.slice('guest:'.length) : best.app.id;
  return { kind: 'guest', appId: best.app.id, guestId, matchedPath: path };
}
