/**
 * core:legal — Public read + render routes.
 *
 *   GET /api/legal/:slug?lang=&format=     one doc, JSON (html|markdown)
 *   GET /api/legal/active?lang=            active-doc enumeration, JSON
 *   GET /api/legal/active-versions?ids=    MAX(version_id) per doc, JSON
 *   GET /legal                             bare → redirect to first doc
 *   GET /legal/:slug                       crawlable HTML page
 *
 * All public, all workspace-scoped via the resolver (which runs before
 * auth and always populates c.get('workspace')). Edge-cached: 300s for
 * the doc/enumeration surfaces, 60s for active-versions (consent
 * accuracy matters more than CDN load there).
 *
 * Public legal pages are intentionally CRAWLABLE — no noindex, plus
 * hreflang alternates (spec §6.1). This is the opposite posture from
 * the /brand guide, which is noindex.
 */
import type { Hono } from 'hono';
import type { Env, ContextVariables } from '../../../types';
export declare function registerLegalPublicRoutes(app: Hono<{
    Bindings: Env;
    Variables: ContextVariables;
}>): void;
//# sourceMappingURL=public-routes.d.ts.map