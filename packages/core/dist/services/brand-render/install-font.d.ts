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
/**
 * Ensure the (family, weight) Google Font is in R2. If already
 * present, no-op. If missing, fetch TTF from Google Fonts and put.
 *
 * Idempotent. Cheap to call on every save. The R2 head-check is
 * the only cost when the font is already installed.
 */
export declare function installFontIfMissing(env: Env, workspaceId: string, family: string, weight: number): Promise<void>;
//# sourceMappingURL=install-font.d.ts.map