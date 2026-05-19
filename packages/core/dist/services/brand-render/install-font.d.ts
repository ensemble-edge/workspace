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
/**
 * Ensure the (family, weight) Google Font is in R2. If already
 * present, no-op. If missing, fetch from Google Fonts, decode,
 * and put.
 *
 * Idempotent. Cheap to call on every save. The R2 head-check is
 * the only cost when the font is already installed.
 */
export declare function installFontIfMissing(env: Env, workspaceId: string, family: string, weight: number): Promise<void>;
//# sourceMappingURL=install-font.d.ts.map