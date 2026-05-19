/**
 * Font install pipeline — Google Fonts → TTF → R2.
 *
 * v0.1.51.1 fix. The original v0.1.51 implementation fetched WOFF2
 * from Google Fonts and tried to decompress to TTF via the wawoff2
 * wasm library. That library is an emscripten-compiled Node-native
 * binding that does `require('fs')` and `require('path')` — it
 * doesn't work in the Workers runtime, even with the nodejs_compat
 * flag. Production hit it with "decompress is not a function".
 *
 * The fix: skip WOFF2 entirely. Google Fonts' CSS API serves
 * **different formats** based on the requesting User-Agent. After
 * testing the matrix we found exactly the right ancient UA: the
 * Android 2.3 browser. That UA gets raw TTF URLs with proper
 * `.ttf` extension and `format('truetype')` declaration. (IE
 * UAs get EOT — Microsoft's proprietary format, also unsupported
 * by Satori. Old Safari/Opera UAs get WOFF — still compressed,
 * still needs a decoder.) Android 2.3 → TTF → done.
 *
 * What this means in practice
 * ───────────────────────────
 * Operator can pick ANY Google Font from the catalog (~1900 families).
 * For each, we make one HTTP request to Google's CSS API, parse out
 * the TTF URL, fetch the TTF, store it in R2. No wasm, no decode,
 * no Node-binding compatibility minefield.
 *
 * In-flight coalescing
 * ────────────────────
 * If two workspaces save the same font in the same isolate at the
 * same time, only one fetch runs — the other awaits the same
 * Promise. After completion the Promise is dropped from the Map so
 * subsequent installs re-check R2 head and short-circuit on hit.
 */
import type { Env } from '../../types';
import { getR2Bucket } from '../r2-binding';
import { googleFontR2Key } from './fonts';

const inFlight = new Map<string, Promise<void>>();

/**
 * Ensure the (family, weight) Google Font is in R2. If already
 * present, no-op. If missing, fetch TTF from Google Fonts and put.
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

  // Already in-flight in this isolate — piggy-back.
  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = installFontInner(env, workspaceId, family, weight, key);
  inFlight.set(key, promise);
  try {
    await promise;
  } finally {
    inFlight.delete(key);
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

  // Get the TTF URL from Google Fonts CSS API (TTF, not WOFF2 —
  // see file header for why).
  const ttfUrl = await resolveGoogleFontTtfUrl(family, weight);
  if (!ttfUrl) {
    throw new Error(`No TTF URL found for ${family} ${weight} from Google Fonts. Family may not exist in the catalog.`);
  }

  const res = await fetch(ttfUrl);
  if (!res.ok) {
    throw new Error(`TTF fetch failed: ${res.status} for ${family} ${weight}`);
  }
  const ttfBytes = new Uint8Array(await res.arrayBuffer());

  await r2.put(r2Key, ttfBytes, {
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
 * Ask Google Fonts CSS API for the TTF URL of a (family, weight)
 * combination. Returns null when Google can't serve this family +
 * weight combination (typo, missing weight, etc.).
 *
 * The Android 2.3 User-Agent is what gets us raw TTF. Verified
 * against the Google Fonts CSS API directly — UA negotiation matrix:
 *   Modern Chrome/Safari/Firefox  → WOFF2 (compressed, Brotli)
 *   Old Safari / Opera Mobile     → WOFF  (compressed, zlib)
 *   IE 6 / 8                      → EOT   (Microsoft proprietary)
 *   Android 2.3 browser           → TTF   (uncompressed) ✓
 *
 * The Android 2.3 UA returns a CSS @font-face block like:
 *   src: url(https://fonts.gstatic.com/s/.../something.ttf) format('truetype');
 *
 * We parse the .ttf URL with a regex. If Google ever changes the
 * format-negotiation logic we'll need to update this — but the API
 * has been stable since 2011 and changing it would break the long
 * tail of legacy mobile browsers Google still supports.
 */
async function resolveGoogleFontTtfUrl(family: string, weight: number): Promise<string | null> {
  const familyParam = encodeURIComponent(family).replace(/%20/g, '+');
  // css API (not css2) — the older API has a simpler response shape
  // that's easier to parse with a single regex. Both APIs cover the
  // same ~1900-family catalog.
  const url = `https://fonts.googleapis.com/css?family=${familyParam}:${weight}`;
  const res = await fetch(url, {
    headers: {
      // Android 2.3 — Google serves TTF to this UA. See file header
      // for the UA negotiation matrix. Don't change without testing
      // every output format.
      'User-Agent': 'Mozilla/5.0 (Linux; U; Android 2.3; en-us) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1',
    },
  });
  if (!res.ok) return null;
  const css = await res.text();
  // Find the first .ttf url. Google returns one @font-face block
  // for the requested (family, weight) under the Android UA.
  const match = /url\((https:\/\/[^)]+\.ttf)\)/i.exec(css);
  return match ? match[1] : null;
}
