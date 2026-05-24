import type { Env } from '../../types';
/**
 * Resolve the icon mark SVG. Returns null when:
 *   - no icon configured (operator hasn't uploaded one), OR
 *   - the configured icon is a non-SVG (PNG/JPG — raster icons can't
 *     feed the SVG composition pipeline; consumers should branch on
 *     null and use the raster URL directly).
 */
export declare function getIconSvg(env: Env, workspaceId: string): Promise<string | null>;
/**
 * Resolve the wordmark SVG (uploaded master only). Text-mode
 * wordmarks are NOT compiled here — render.ts handles those
 * directly via the JSX/Satori pipeline.
 */
export declare function getWordmarkSvg(env: Env, workspaceId: string): Promise<string | null>;
//# sourceMappingURL=sources.d.ts.map