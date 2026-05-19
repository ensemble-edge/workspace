/**
 * Font install pipeline — Google Fonts woff2 → TTF → R2.
 *
 * v0.1.51. Operator picks a Google Font in the Typography tab, hits
 * Save → this module fetches the woff2, decompresses to TTF, and
 * stores the TTF in R2 under the canonical googleFontR2Key path.
 *
 * Why TTF not woff2
 * ─────────────────
 * Satori requires TTF — its font parser doesn't accept the woff2
 * Brotli-compressed wrapper. The conversion is a one-time decode
 * step at install; after that the TTF sits in R2 forever.
 *
 * In-flight coalescing
 * ────────────────────
 * If two workspaces save the same font in the same isolate at the
 * same time, only one fetch+decode runs — the other awaits the
 * same Promise. After completion the Promise is dropped from the
 * Map so subsequent installs (different isolate, or after the first
 * promise resolved) re-check R2 head and short-circuit on hit.
 */
import type { Env } from '../../types';
import { getR2Bucket } from '../r2-binding';
import { googleFontR2Key } from './fonts';

const inFlight = new Map<string, Promise<void>>();

/**
 * Ensure the (family, weight) Google Font is in R2. If already
 * present, no-op. If missing, fetch from Google Fonts, decode,
 * and put.
 *
 * Idempotent. Cheap to call on every save. The R2 head-check is
 * the only cost when the font is already installed.
 */
export async function installFontIfMissing(
  env: Env,
  workspaceId: string,
  family: string,
  weight: number,
): Promise<void> {
  const key = googleFontR2Key(family, weight);
  const cacheKey = `${key}`;

  // Already in-flight in this isolate — piggy-back.
  const existing = inFlight.get(cacheKey);
  if (existing) return existing;

  const promise = installFontInner(env, workspaceId, family, weight, key);
  inFlight.set(cacheKey, promise);
  try {
    await promise;
  } finally {
    inFlight.delete(cacheKey);
  }
}

async function installFontInner(
  env: Env,
  workspaceId: string,
  family: string,
  weight: number,
  r2Key: string,
): Promise<void> {
  const r2 = await getR2Bucket(env, workspaceId);
  if (!r2) throw new Error('R2 bucket not configured for workspace');

  // Head check — already installed? Done.
  const head = await r2.head(r2Key);
  if (head) return;

  // Fetch the woff2 URL from Google Fonts CSS API.
  const woff2Url = await resolveGoogleFontWoff2Url(family, weight);
  if (!woff2Url) {
    throw new Error(`No woff2 URL found for ${family} ${weight}`);
  }

  const res = await fetch(woff2Url);
  if (!res.ok) {
    throw new Error(`woff2 fetch failed: ${res.status}`);
  }
  const woff2Bytes = new Uint8Array(await res.arrayBuffer());

  // Decode woff2 → TTF via wawoff2. The library exports a wasm-
  // backed `decompress` that accepts a Uint8Array and returns a
  // Uint8Array of TTF bytes.
  const { decompress } = await import('wawoff2');
  const ttf = await decompress(woff2Bytes);

  await r2.put(r2Key, ttf, {
    httpMetadata: { contentType: 'font/ttf' },
    customMetadata: {
      source: 'google-fonts',
      family,
      weight: String(weight),
      installedAt: new Date().toISOString(),
    },
  });
}

/**
 * Ask Google Fonts CSS API for the woff2 URL of a (family, weight)
 * combination. The API returns a CSS @font-face block; we parse out
 * the woff2 URL with a regex.
 *
 * The User-Agent header forces Google to return woff2 specifically.
 * Without it, the API may return formats based on the requesting
 * client; Workers' default UA gets a mix that doesn't always include
 * woff2.
 */
async function resolveGoogleFontWoff2Url(family: string, weight: number): Promise<string | null> {
  const familyParam = encodeURIComponent(family).replace(/%20/g, '+');
  const url = `https://fonts.googleapis.com/css2?family=${familyParam}:wght@${weight}`;
  const res = await fetch(url, {
    headers: {
      // Modern Chrome UA → woff2 with the latest unicode-range support.
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });
  if (!res.ok) return null;
  const css = await res.text();
  // First woff2 URL in the response. Google returns multiple
  // unicode-range blocks; we pick the first one (Latin Basic) which
  // covers most logos. Future improvement: pick the block matching
  // the wordmark's actual character set.
  const match = /url\((https:\/\/[^)]+\.woff2)\)\s*format\(['"]woff2['"]\)/.exec(css);
  return match ? match[1] : null;
}
