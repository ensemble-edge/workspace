/**
 * Brand source-asset readers — wordmark + icon SVG masters from R2.
 *
 * v0.1.51. Extracted from the old brand-assets.ts so consumers
 * (favicon endpoint, brand-images resolver, etc.) keep working after
 * the legacy compose/finish/background pipeline is removed.
 *
 * Reads go through R2 directly via the binding — NOT via HTTP self-
 * fetch — to avoid the Worker subrequest budget pressure that bit us
 * in v0.1.32 (variants-matrix render exhausted the budget under
 * concurrent load).
 */
import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../../types';
import { getR2Bucket } from '../r2-binding';

/**
 * Resolve the icon mark SVG. Returns null when:
 *   - no icon configured (operator hasn't uploaded one), OR
 *   - the configured icon is a non-SVG (PNG/JPG — raster icons can't
 *     feed the SVG composition pipeline; consumers should branch on
 *     null and use the raster URL directly).
 */
export async function getIconSvg(env: Env, workspaceId: string): Promise<string | null> {
  const tokens = await loadIdentityTokens(env.DB, workspaceId);
  const url = tokens['logo_icon_mark_svg'] || tokens['logo_icon_mark'];
  if (!url) return null;
  if (!url.endsWith('.svg') && !tokens['logo_icon_mark_svg']) return null;
  return readSvgFromR2(env, workspaceId, url);
}

/**
 * Resolve the wordmark SVG (uploaded master only). Text-mode
 * wordmarks are NOT compiled here — render.ts handles those
 * directly via the JSX/Satori pipeline.
 */
export async function getWordmarkSvg(env: Env, workspaceId: string): Promise<string | null> {
  const tokens = await loadIdentityTokens(env.DB, workspaceId);
  const url = tokens['logo_wordmark_svg'] || tokens['logo_wordmark'];
  if (!url) return null;
  if (!url.endsWith('.svg') && !tokens['logo_wordmark_svg']) return null;
  return readSvgFromR2(env, workspaceId, url);
}

async function loadIdentityTokens(db: D1Database, workspaceId: string): Promise<Record<string, string>> {
  const rows = await db.prepare(
    `SELECT key, value FROM brand_tokens
     WHERE workspace_id = ? AND category IN ('identity', 'typography') AND locale = ''`,
  ).bind(workspaceId).all<{ key: string; value: string }>();
  const out: Record<string, string> = {};
  for (const r of rows.results ?? []) out[r.key] = r.value;
  return out;
}

/**
 * Extract the R2 key from a stored brand-token URL and read the
 * object. Handles both canonical `/_ensemble/brand/asset/<key>` and
 * pretty-alias `/<alias>/<key>` forms.
 */
async function readSvgFromR2(env: Env, workspaceId: string, urlOrKey: string): Promise<string | null> {
  let key: string;
  if (urlOrKey.startsWith('brand/')) {
    key = urlOrKey;
  } else {
    const canonicalMatch = /\/_ensemble\/brand\/asset\/(.+)$/.exec(urlOrKey);
    if (canonicalMatch) {
      key = decodeURIComponent(canonicalMatch[1]);
    } else {
      const m = /^\/[^/]+\/(.+)$/.exec(urlOrKey);
      if (m) key = decodeURIComponent(m[1]);
      else return null;
    }
  }
  if (!key.startsWith('brand/')) return null;

  const r2 = await getR2Bucket(env, workspaceId);
  if (!r2) return null;
  try {
    const obj = await r2.get(key);
    if (!obj) return null;
    return await obj.text();
  } catch {
    return null;
  }
}
