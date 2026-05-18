/**
 * R2 binding resolver.
 *
 * The workspace stores brand assets, uploads, and other object data in
 * Cloudflare R2. By default we expect the bucket bound as `c.env.R2`,
 * but operators integrating Ensemble into an existing CF Worker
 * project often already bind R2 under another name (FILES, STORAGE,
 * ASSETS, etc.). Forcing them to add a duplicate binding or rename
 * their existing one is hostile.
 *
 * This helper resolves the binding via the `r2_binding_name`
 * workspace setting. Default is 'R2'; operators can change it in
 * Brand → Connections (Asset Storage card). Every R2 access in
 * Ensemble core MUST route through this helper so the setting
 * actually takes effect — directly referencing `c.env.R2` bypasses
 * the configurable name and breaks the abstraction.
 */

import type { Env } from '../types';
import { getSetting } from './workspace-settings';

/**
 * Look up the configured R2 binding name. Cached per-request would
 * be nicer but D1 reads are cheap enough that re-fetching each call
 * is fine for now. If we see the setting fetch become hot, memoize
 * on the c.env object.
 */
export async function getR2BindingName(
  env: { DB: Env['DB'] },
  workspaceId: string,
): Promise<string> {
  const configured = (await getSetting(env as Env, workspaceId, 'r2_binding_name')).trim();
  return configured || 'R2';
}

/**
 * Resolve the R2 bucket for this workspace. Returns null when no
 * binding by the configured name is present — callers should branch
 * on that and surface a clear "R2 not configured" message rather
 * than throwing.
 *
 * The cast to Record<string, unknown> is the only place we step
 * outside the typed Env shape. Worth it for the host-friendly
 * configurability.
 */
export async function getR2Bucket(
  env: Env,
  workspaceId: string,
): Promise<R2Bucket | null> {
  const name = await getR2BindingName(env, workspaceId);
  const binding = (env as unknown as Record<string, unknown>)[name];
  if (!binding) return null;
  return binding as R2Bucket;
}

/**
 * Synchronous variant for hot paths where we already know the binding
 * name (e.g. inside a request handler that resolved the name once at
 * the top of the function). Skip the setting lookup.
 */
export function getR2BucketByName(env: Env, name: string): R2Bucket | null {
  const binding = (env as unknown as Record<string, unknown>)[name];
  return (binding as R2Bucket | undefined) ?? null;
}
