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
import { ID_RE, loc, parseDocRow, renderMarkdown } from './shared.js';
import { renderLegalPage, renderLegalNotFound } from './render.js';
import { absoluteUrl } from '../../../services/brand-domain.js';
const CACHE_300 = 'public, max-age=300, stale-while-revalidate=86400';
const CACHE_60 = 'public, max-age=60';
async function defaultLocale(c, workspaceId) {
    const { getDefaultLocale } = await import('../../../services/locales.js');
    try {
        return await getDefaultLocale(c.env, workspaceId);
    }
    catch {
        return 'en';
    }
}
/**
 * Whether the public legal surfaces are published for this workspace.
 * Off by default — operators publish deliberately after reviewing the
 * seeded docs. When off, every public route 404s (the URLs look like
 * they don't exist), while the CMS surface stays fully available.
 */
async function isLegalPublicEnabled(c, workspaceId) {
    // Two gates compose: the App Manager enable/disable (is the legal app
    // active at all?) AND the publish toggle (are public pages live?).
    // Either off → public surfaces 404. The publish flag now lives on the
    // App Manager (settings.published) with a read-through shim to the
    // legacy legal_public_enabled setting for existing workspaces.
    const { isAppActive, isAppPublished } = await import('../../../services/app-registry.js');
    if (!(await isAppActive(c.env, workspaceId, 'core:legal')))
        return false;
    return isAppPublished(c.env, workspaceId, 'core:legal', 'legal_public_enabled');
}
/**
 * Build the workspace brand favicon <link> suite for the page <head>.
 * Dogfoods the same `/_ensemble/brand/favicon.*` endpoints (honoring the
 * operator's asset alias) that the login page and brand guide use — so
 * the public legal pages carry the workspace's icon, not a blank tab.
 * Uses root-relative URLs (baseUrl ''), like the /brand/css link.
 */
async function legalFavicon(c, workspaceId) {
    try {
        const { buildFaviconHeadSnippet } = await import('../../../services/brand-render/favicon.js');
        const { getSetting } = await import('../../../services/workspace-settings.js');
        const aliasPath = (await getSetting(c.env, workspaceId, 'asset_public_alias_path')).trim();
        const iconBasePath = aliasPath ? `/${aliasPath}/brand` : '/_ensemble/brand';
        return buildFaviconHeadSnippet({ baseUrl: '', iconBasePath });
    }
    catch {
        return '';
    }
}
/** Whether the operator has opted the legal app into search indexing. */
async function isLegalIndexable(c, workspaceId) {
    const { getSetting } = await import('../../../services/workspace-settings.js');
    return (await getSetting(c.env, workspaceId, 'legal_allow_indexing')) === 'true';
}
/**
 * For SEO cleanliness: when a tenant has a brand domain and a public
 * (unauthenticated) request lands on a DIFFERENT host (the workspace
 * subdomain), 301 it to the brand-domain equivalent so search engines
 * index the brand URL, not the workspace one. Returns a redirect Response
 * to return, or null to proceed.
 *
 * Skipped for authenticated requests (a workspace admin viewing from
 * inside the app keeps working on the workspace host) — detected by the
 * presence of the access-token cookie.
 */
async function brandRedirect(c, path) {
    const brand = c.get('brandDomain');
    if (!brand?.domain)
        return null;
    const url = new URL(c.req.url);
    if (url.host.split(':')[0].toLowerCase() === brand.domain)
        return null; // already on brand host
    const { getAuthCookies } = await import('../../../utils/cookies.js');
    if (getAuthCookies(c.req.header('Cookie')).accessToken)
        return null; // authed admin — no redirect
    return c.redirect(`${brand.proto}://${brand.domain}${path}${url.search}`, 301);
}
/**
 * Build the SEO <head> block for a legal page. The two forms are mutually
 * exclusive so the page never sends mixed signals:
 *   • indexable → absolute <link rel=canonical> + per-locale hreflang
 *     (qualified against the brand domain via absoluteUrl).
 *   • noindex   → <meta name=robots content="noindex,nofollow">, no
 *     canonical/hreflang. (The handler also sets the X-Robots-Tag header.)
 */
function buildSeoHead(c, indexable, currentSlug, slugs) {
    if (!indexable) {
        return '<meta name="robots" content="noindex, nofollow">';
    }
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const canonical = `<link rel="canonical" href="${esc(absoluteUrl(c, `/legal/${currentSlug}`))}">`;
    const hreflangs = Object.entries(slugs)
        .filter(([, s]) => s)
        .map(([locale, slug]) => `<link rel="alternate" hreflang="${esc(locale)}" href="${esc(absoluteUrl(c, `/legal/${slug}`))}">`)
        .join('\n');
    return `${canonical}\n${hreflangs}`;
}
export function registerLegalPublicRoutes(app) {
    // ───────────────────── Public JSON API ─────────────────────
    //
    // ROUTE ORDER MATTERS: the static paths (/active, /active-versions)
    // MUST be registered before the parameterized /:slug, or Hono matches
    // "active"/"active-versions" as a slug value and they 404. Most-
    // specific-first.
    /** GET /api/legal/active — every active doc in the requested locale. */
    app.get('/api/legal/active', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.notFound();
        if (!(await isLegalPublicEnabled(c, workspace.id)))
            return c.notFound();
        const lang = c.req.query('lang') || (await defaultLocale(c, workspace.id));
        const { results } = await c.env.DB.prepare(`SELECT id, slugs_json, title_json, description_json, notice_json, body_md_json,
              last_updated, status, sort_order
         FROM legal_docs
        WHERE workspace_id = ? AND status = 'active'
        ORDER BY sort_order ASC, id ASC`)
            .bind(workspace.id)
            .all();
        const docs = (results ?? []).map((r) => {
            const d = parseDocRow(r);
            return {
                id: d.id,
                slug: loc(d.slugs, lang),
                title: loc(d.title, lang),
                description: loc(d.description, lang),
                lastUpdated: d.lastUpdated,
                sortOrder: d.sortOrder,
            };
        });
        return c.json({ lang, docs }, 200, { 'Cache-Control': CACHE_300 });
    });
    /** GET /api/legal/active-versions?ids=a,b — MAX(version_id) per doc. */
    app.get('/api/legal/active-versions', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.notFound();
        if (!(await isLegalPublicEnabled(c, workspace.id)))
            return c.notFound();
        const idsRaw = c.req.query('ids') || '';
        const ids = idsRaw
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s && ID_RE.test(s))
            .slice(0, 50); // cap at 50 per request (spec §4.3)
        if (!ids.length)
            return c.json({ versions: [] }, 200, { 'Cache-Control': CACHE_60 });
        const placeholders = ids.map(() => '?').join(',');
        const { results } = await c.env.DB.prepare(`SELECT doc_id, MAX(version_id) AS version_id
         FROM legal_docs_versions
        WHERE workspace_id = ? AND doc_id IN (${placeholders})
        GROUP BY doc_id`)
            .bind(workspace.id, ...ids)
            .all();
        const versions = (results ?? []).map((r) => ({ id: r.doc_id, versionId: r.version_id }));
        return c.json({ versions }, 200, { 'Cache-Control': CACHE_60 });
    });
    /**
     * GET /api/legal/:slug — render one doc by localized slug.
     *
     * Registered LAST: this parameterized route must come after the static
     * /active and /active-versions routes above, or it shadows them.
     */
    app.get('/api/legal/:slug', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.notFound();
        if (!(await isLegalPublicEnabled(c, workspace.id)))
            return c.notFound();
        const slug = c.req.param('slug');
        const format = c.req.query('format') === 'markdown' ? 'markdown' : 'html';
        // 1. Resolve slug → (doc_id, native locale).
        const slugRow = await c.env.DB.prepare(`SELECT doc_id, locale FROM legal_doc_slugs
        WHERE workspace_id = ? AND slug = ? LIMIT 1`)
            .bind(workspace.id, slug)
            .first();
        if (!slugRow)
            return c.json({ error: 'not_found' }, 404);
        // 2. Load the active doc.
        const row = await c.env.DB.prepare(`SELECT id, slugs_json, title_json, description_json, notice_json, body_md_json,
              last_updated, status, sort_order
         FROM legal_docs
        WHERE workspace_id = ? AND id = ? AND status = 'active'`)
            .bind(workspace.id, slugRow.doc_id)
            .first();
        if (!row)
            return c.json({ error: 'not_found' }, 404);
        const doc = parseDocRow(row);
        // 3. Render locale: ?lang override → slug's native locale.
        const lang = c.req.query('lang') || slugRow.locale;
        const title = loc(doc.title, lang, slugRow.locale);
        const bodyMd = loc(doc.bodyMd, lang, slugRow.locale);
        const noticeRaw = loc(doc.notice, lang, slugRow.locale);
        // 4. Substitute placeholders (runs for BOTH html + markdown).
        const { resolveLegalPlaceholders } = await import('../../../services/legal-placeholders.js');
        const resolved = await resolveLegalPlaceholders(c.env, workspace.id, bodyMd, doc.lastUpdated, lang);
        const notice = noticeRaw
            ? await resolveLegalPlaceholders(c.env, workspace.id, noticeRaw, doc.lastUpdated, lang)
            : '';
        const content = format === 'html' ? renderMarkdown(resolved) : resolved;
        return c.json({
            slug,
            id: doc.id,
            lang,
            title,
            // Resolved notice text (empty string if none). Plain text/markdown;
            // consumers format it. The HTML page renders it as a top callout.
            notice,
            lastUpdated: doc.lastUpdated,
            format,
            content,
        }, 200, { 'Cache-Control': CACHE_300 });
    });
    // ───────────────────── Public HTML pages ─────────────────────
    /** GET /legal — redirect to the default-locale first active doc. */
    app.get('/legal', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.notFound();
        if (!(await isLegalPublicEnabled(c, workspace.id)))
            return c.notFound();
        const lang = await defaultLocale(c, workspace.id);
        const first = await c.env.DB.prepare(`SELECT slugs_json FROM legal_docs
        WHERE workspace_id = ? AND status = 'active'
        ORDER BY sort_order ASC, id ASC LIMIT 1`)
            .bind(workspace.id)
            .first();
        if (!first) {
            return c.html(renderLegalNotFound(lang, await legalFavicon(c, workspace.id)), 404);
        }
        const doc = parseDocRow({ ...EMPTY_ROW, slugs_json: first.slugs_json });
        const slug = loc(doc.slugs, lang) || Object.values(doc.slugs).find(Boolean) || '';
        if (!slug)
            return c.html(renderLegalNotFound(lang, await legalFavicon(c, workspace.id)), 404);
        return c.redirect(`/legal/${slug}`, 302);
    });
    /** GET /legal/:slug — crawlable HTML page with ToC sidebar. */
    app.get('/legal/:slug', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.notFound();
        if (!(await isLegalPublicEnabled(c, workspace.id)))
            return c.notFound();
        const slug = c.req.param('slug');
        // SEO: send public traffic on the workspace host to the brand domain.
        const redir = await brandRedirect(c, `/legal/${slug}`);
        if (redir)
            return redir;
        const slugRow = await c.env.DB.prepare(`SELECT doc_id, locale FROM legal_doc_slugs
        WHERE workspace_id = ? AND slug = ? LIMIT 1`)
            .bind(workspace.id, slug)
            .first();
        if (!slugRow)
            return c.html(renderLegalNotFound('es', await legalFavicon(c, workspace.id)), 404);
        const lang = c.req.query('lang') || slugRow.locale;
        // The active doc.
        const row = await c.env.DB.prepare(`SELECT id, slugs_json, title_json, description_json, notice_json, body_md_json,
              last_updated, status, sort_order
         FROM legal_docs
        WHERE workspace_id = ? AND id = ? AND status = 'active'`)
            .bind(workspace.id, slugRow.doc_id)
            .first();
        if (!row)
            return c.html(renderLegalNotFound(lang, await legalFavicon(c, workspace.id)), 404);
        // The ToC: all active docs, ordered.
        const { results: tocRows } = await c.env.DB.prepare(`SELECT id, slugs_json, title_json, description_json, notice_json, body_md_json,
              last_updated, status, sort_order
         FROM legal_docs
        WHERE workspace_id = ? AND status = 'active'
        ORDER BY sort_order ASC, id ASC`)
            .bind(workspace.id)
            .all();
        const doc = parseDocRow(row);
        const bodyMd = loc(doc.bodyMd, lang, slugRow.locale);
        const noticeRaw = loc(doc.notice, lang, slugRow.locale);
        const { resolveLegalPlaceholders } = await import('../../../services/legal-placeholders.js');
        const resolved = await resolveLegalPlaceholders(c.env, workspace.id, bodyMd, doc.lastUpdated, lang);
        const contentHtml = renderMarkdown(resolved);
        // Notice: resolve placeholders, render inline markdown (bold/links), but
        // NOT sectionized — it's a single callout block.
        const noticeHtml = noticeRaw
            ? renderMarkdown(await resolveLegalPlaceholders(c.env, workspace.id, noticeRaw, doc.lastUpdated, lang))
            : '';
        const indexable = await isLegalIndexable(c, workspace.id);
        const html = renderLegalPage({
            lang,
            activeId: doc.id,
            title: loc(doc.title, lang, slugRow.locale),
            lastUpdated: doc.lastUpdated,
            noticeHtml,
            faviconHtml: await legalFavicon(c, workspace.id),
            seoHead: buildSeoHead(c, indexable, slug, doc.slugs),
            contentHtml,
            slugs: doc.slugs,
            toc: (tocRows ?? []).map((r) => {
                const d = parseDocRow(r);
                return { id: d.id, title: loc(d.title, lang), slug: loc(d.slugs, lang) };
            }),
        });
        const headers = {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': CACHE_300,
        };
        // Belt-and-suspenders: when not indexable, the header backs up the
        // <meta robots> tag (and covers non-HTML crawler fetches).
        if (!indexable)
            headers['X-Robots-Tag'] = 'noindex, nofollow';
        return new Response(html, { headers });
    });
}
/** A blank row to reuse parseDocRow for slug-only lookups. */
const EMPTY_ROW = {
    id: '',
    slugs_json: '{}',
    title_json: '{}',
    description_json: null,
    notice_json: null,
    body_md_json: '{}',
    last_updated: '',
    status: 'active',
    sort_order: 0,
};
//# sourceMappingURL=public-routes.js.map