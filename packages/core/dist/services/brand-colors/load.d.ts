/**
 * Load BrandColorsDoc from brand_tokens.
 *
 * v0.1.55. The doc is a single JSON blob stored at:
 *   category='colors', key='brand_colors_v1', locale=''
 *
 * On miss, returns defaultBrandColors() so a fresh workspace
 * still renders sensibly.
 */
import type { D1Database } from '@cloudflare/workers-types';
import { type BrandColorsDoc } from './schema';
export declare function loadBrandColors(db: D1Database, workspaceId: string): Promise<BrandColorsDoc>;
//# sourceMappingURL=load.d.ts.map