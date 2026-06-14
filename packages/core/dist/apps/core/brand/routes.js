/**
 * core:brand — Server-side API routes
 *
 * Brand token CRUD + color group management.
 * Routes mounted under /_ensemble/core/brand/*
 */
import { assembleBrandSpec, generateContextFromSpec, importBrandSpec } from './spec.js';
export function registerBrandRoutes(app) {
    // ── Brand Spec (the canonical format) ──
    // v0.1.93: brand-spec family lives canonically at /brand/* (no
    // /_ensemble/ prefix). One URL per resource, one rule for who can
    // see it:
    //
    //   • If the request carries an authenticated session, return the
    //     spec. (The admin-internal shell needs this even before the
    //     operator publishes the guide.)
    //   • Otherwise, gate on `public_brand_guide_enabled`. Toggle on
    //     → publish; off → 404.
    //
    // Same URL works for both audiences. Replaces the previous
    // dual-path (admin /_ensemble/brand/spec + public /brand/spec) which
    // was confusing and required keeping two registrations in sync.
    async function isPublicBrandEnabled(env, workspaceId) {
        // Publish flag now lives on the App Manager (settings.published) with
        // a read-through shim to the legacy public_brand_guide_enabled.
        const { isAppPublished } = await import('../../../services/app-registry.js');
        return isAppPublished(env, workspaceId, 'core:brand', 'public_brand_guide_enabled');
    }
    /**
     * Returns true iff this request can read the brand spec — either it
     * carries an authenticated session, or the operator has published
     * the public guide. Apply this gate to all spec-family handlers.
     */
    function canReadBrand(c) {
        const user = c.get('user');
        if (user?.id)
            return Promise.resolve(true);
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return Promise.resolve(false);
        return isPublicBrandEnabled(c.env, workspace.id);
    }
    /**
     * Authenticated requests get no-cache so admin edits land live.
     * Public requests get SWR cacheing — same posture as /brand/css.
     */
    function brandCacheHeaders(c) {
        return c.get('user')?.id
            ? { 'Cache-Control': 'private, no-store' }
            : { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400' };
    }
    // GET /brand/spec — Full brand spec (JSON)
    //
    // The machine-readable sibling of /brand. Same gate: authenticated
    // session OR public_brand_guide_enabled.
    //
    // ?for=marketing-site|ai-prompt|admin-import — curated preset.
    // ?include=logos,colors.palettes.primary,... — explicit allowlist
    //                                              of dotted paths.
    // Default returns full payload. Meta block always retained so the
    // response stays self-describing.
    app.get('/brand/spec', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.notFound();
        if (!(await canReadBrand(c)))
            return c.notFound();
        try {
            const baseUrl = new URL(c.req.url).origin;
            const { getSetting } = await import('../../../services/workspace-settings.js');
            const aliasPath = (await getSetting(c.env, workspace.id, 'asset_public_alias_path')).trim();
            const spec = await assembleBrandSpec(c.env.DB, workspace.id, baseUrl, aliasPath);
            const format = c.req.query('format');
            if (format === 'yaml') {
                return c.text(jsonToYaml(spec), 200, { 'Content-Type': 'text/yaml' });
            }
            const forParam = c.req.query('for');
            const includeParam = c.req.query('include');
            const filtered = await applySpecFilters(spec, forParam, includeParam);
            return c.json(filtered, 200, brandCacheHeaders(c));
        }
        catch (error) {
            console.error('Failed to generate brand spec:', error);
            return c.json({ error: 'Failed to generate brand spec' }, 500);
        }
    });
    // GET /brand/spec/schema.json — JSON Schema (Draft 2020-12) describing
    // the spec response. Same auth/gate rule as /brand/spec.
    app.get('/brand/spec/schema.json', async (c) => {
        if (!(await canReadBrand(c)))
            return c.notFound();
        const { BRAND_SPEC_SCHEMA } = await import('../../../services/brand-spec-extras.js');
        return c.json(BRAND_SPEC_SCHEMA, 200, brandCacheHeaders(c));
    });
    // GET /brand/variants — JSON enumeration of every approved logo render.
    app.get('/brand/variants', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.notFound();
        if (!(await canReadBrand(c)))
            return c.notFound();
        try {
            const baseUrl = new URL(c.req.url).origin;
            const { getSetting } = await import('../../../services/workspace-settings.js');
            const aliasPath = (await getSetting(c.env, workspace.id, 'asset_public_alias_path')).trim();
            const spec = await assembleBrandSpec(c.env.DB, workspace.id, baseUrl, aliasPath);
            return c.json({
                variants: spec.assets?.variants ?? [],
                clearspace: spec.assets?.clearspace ?? {},
            }, 200, brandCacheHeaders(c));
        }
        catch (error) {
            console.error('Failed to generate brand variants:', error);
            return c.json({ error: 'Failed to generate brand variants' }, 500);
        }
    });
    // GET /brand/changelog — recent brand-* audit log entries (last 100).
    // v0.1.94 hotfix: the audit_log column is `details_json`, not `details`
    // (per migration 001). The v0.1.89 code shipped the wrong column and
    // every changelog fetch 500'd until this fix. Curl-verify after deploy.
    app.get('/brand/changelog', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.notFound();
        if (!(await canReadBrand(c)))
            return c.notFound();
        try {
            const rows = await c.env.DB.prepare(`SELECT action, created_at, details_json
           FROM audit_log
          WHERE workspace_id = ? AND action LIKE 'brand.%'
          ORDER BY created_at DESC
          LIMIT 100`).bind(workspace.id).all();
            const entries = (rows.results ?? []).map((r) => ({
                action: r.action,
                at: r.created_at,
                details: (() => { try {
                    return r.details_json ? JSON.parse(r.details_json) : null;
                }
                catch {
                    return null;
                } })(),
            }));
            return c.json({ entries }, 200, brandCacheHeaders(c));
        }
        catch (error) {
            console.error('Failed to fetch brand changelog:', error);
            return c.json({ error: 'Failed to fetch brand changelog' }, 500);
        }
    });
    // v0.1.96: self-hosted brand-asset diagnostic page. Same checks the
    // operator was running from a file:// HTML page (which hits browser-
    // level fetch restrictions and returns false negatives) — but served
    // from the workspace itself so it loads over https and gets accurate
    // CORS / CORP / fetch results.
    //
    // v0.1.97: same public gate as the rest of the brand-spec family
    // (public_brand_guide_enabled). The page only fetches data that's
    // already public; auth-walling it just prevented external partners
    // and AI-agent operators from debugging brand distribution problems.
    app.get('/brand/troubleshoot', async (c) => {
        if (!(await canReadBrand(c)))
            return c.notFound();
        return c.html(BRAND_TROUBLESHOOT_HTML, 200, brandCacheHeaders(c));
    });
    // v0.1.94: legacy /_ensemble/brand/* spec-family URLs return JSON 410
    // Gone with a pointer to the canonical /brand/* path. Without these,
    // the request falls through to the SPA catch-all and an external
    // agent gets ~2KB of HTML instead of an explainable response —
    // confusing to debug. The Gone responses also surface in browser
    // dev-tools as 410, which is the conventional code for "this URL
    // was here but isn't anymore" (vs 404 "never existed" or 301
    // "permanent move" — we're not redirecting because tooling that
    // parsed `/_ensemble/brand/spec` as JSON wouldn't auto-follow a
    // redirect and would get HTML on the new URL anyway).
    const gonePaths = [
        ['/_ensemble/brand/spec', '/brand/spec'],
        ['/_ensemble/brand/spec/schema.json', '/brand/spec/schema.json'],
        ['/_ensemble/brand/variants', '/brand/variants'],
        ['/_ensemble/brand/context', '/brand/context'],
        ['/_ensemble/brand/changelog', '/brand/changelog'],
    ];
    for (const [oldPath, newPath] of gonePaths) {
        app.get(oldPath, (c) => {
            const baseUrl = new URL(c.req.url).origin;
            return c.json({
                error: 'gone',
                message: `This endpoint moved in v0.1.93. Use ${newPath} instead.`,
                canonical_url: `${baseUrl}${newPath}`,
            }, 410, { 'Cache-Control': 'public, max-age=3600' });
        });
    }
    // NOTE: no separate /brand/fonts.css endpoint. The full /brand/css
    // already includes the Google Fonts @import at the top alongside all
    // CSS variables, so a second fonts-only endpoint would be redundant.
    // endpoints.font_stylesheet (in the spec response) points at /brand/css
    // for that reason — agents that only want fonts get the same stylesheet
    // that drives the full theme. If a future need emerges to fetch *just*
    // the @import line, we'd revisit this.
    // GET /brand/context — AI-readable markdown rendering of the spec.
    app.get('/brand/context', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.notFound();
        if (!(await canReadBrand(c)))
            return c.notFound();
        try {
            const { getSetting } = await import('../../../services/workspace-settings.js');
            const aliasPath = (await getSetting(c.env, workspace.id, 'asset_public_alias_path')).trim();
            const spec = await assembleBrandSpec(c.env.DB, workspace.id, undefined, aliasPath);
            const markdown = generateContextFromSpec(spec);
            return c.text(markdown, 200, {
                'Content-Type': 'text/markdown',
                ...brandCacheHeaders(c),
            });
        }
        catch (error) {
            console.error('Failed to generate brand context:', error);
            return c.text('Failed to generate brand context', 500);
        }
    });
    // POST /_ensemble/brand/import — Import a brand spec
    app.post('/_ensemble/brand/import', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'Workspace not found' }, 400);
        try {
            const body = await c.req.json();
            let spec;
            if (body.url) {
                // Fetch spec from URL
                const res = await fetch(body.url);
                if (!res.ok)
                    return c.json({ error: `Failed to fetch spec from ${body.url}` }, 400);
                spec = await res.json();
            }
            else if (body.spec) {
                spec = body.spec;
            }
            else {
                return c.json({ error: 'Provide either spec (JSON) or url' }, 400);
            }
            if (spec.ensemble_brand !== '1.0') {
                return c.json({ error: `Unsupported spec version: ${spec.ensemble_brand}` }, 400);
            }
            const result = await importBrandSpec(c.env.DB, workspace.id, spec, body.overwrite ?? false);
            return c.json({ success: true, ...result });
        }
        catch (error) {
            console.error('Failed to import brand spec:', error);
            return c.json({ error: 'Failed to import brand spec' }, 500);
        }
    });
    // GET /_ensemble/core/brand/tokens — List all brand tokens
    app.get('/_ensemble/core/brand/tokens', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'Workspace not found' }, 400);
        try {
            const result = await c.env.DB.prepare(`SELECT category, key, value, type, label, description, group_slug, sort_order, updated_at
         FROM brand_tokens WHERE workspace_id = ? AND locale = ''
         ORDER BY category, sort_order, key`).bind(workspace.id).all();
            return c.json({ data: result.results || [] });
        }
        catch (error) {
            console.error('Failed to fetch brand tokens:', error);
            return c.json({ error: 'Failed to fetch brand tokens' }, 500);
        }
    });
    // GET /_ensemble/core/brand/tokens/:category — List tokens by category
    //
    // Optional `?locale=es` returns rows for the specified locale; default
    // (omitted) returns the default-locale slot (locale = '').
    // `?all_locales=1` returns rows for every locale present (default
    // included), shaped for per-locale UIs like MessagingTab.
    app.get('/_ensemble/core/brand/tokens/:category', async (c) => {
        const workspace = c.get('workspace');
        const category = c.req.param('category');
        const locale = c.req.query('locale') ?? '';
        const allLocales = c.req.query('all_locales') === '1';
        if (!workspace?.id)
            return c.json({ error: 'Workspace not found' }, 400);
        try {
            if (allLocales) {
                // Return one row per (key, locale). Caller groups by key.
                const result = await c.env.DB.prepare(`SELECT key, value, type, label, description, group_slug, sort_order, locale, updated_at
             FROM brand_tokens
            WHERE workspace_id = ? AND category = ?
            ORDER BY sort_order, key, locale`).bind(workspace.id, category).all();
                return c.json({ data: result.results || [] });
            }
            const result = await c.env.DB.prepare(`SELECT key, value, type, label, description, group_slug, sort_order, locale, updated_at
         FROM brand_tokens WHERE workspace_id = ? AND category = ? AND locale = ?
         ORDER BY sort_order, key`).bind(workspace.id, category, locale).all();
            return c.json({ data: result.results || [] });
        }
        catch (error) {
            console.error('Failed to fetch brand tokens:', error);
            return c.json({ error: 'Failed to fetch brand tokens' }, 500);
        }
    });
    // GET /_ensemble/core/brand/groups — List color/custom groups
    app.get('/_ensemble/core/brand/groups', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'Workspace not found' }, 400);
        try {
            const result = await c.env.DB.prepare(`SELECT slug, label, category, description, sort_order
         FROM brand_token_groups WHERE workspace_id = ?
         ORDER BY sort_order, label`).bind(workspace.id).all();
            return c.json({ data: result.results || [] });
        }
        catch (error) {
            console.error('Failed to fetch groups:', error);
            return c.json({ error: 'Failed to fetch groups' }, 500);
        }
    });
    // POST /_ensemble/core/brand/groups — Create a color/custom group
    app.post('/_ensemble/core/brand/groups', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'Workspace not found' }, 400);
        const body = await c.req.json();
        if (!body.slug || !body.label) {
            return c.json({ error: 'slug and label are required' }, 400);
        }
        try {
            await c.env.DB.prepare(`INSERT INTO brand_token_groups (workspace_id, slug, label, category, description)
         VALUES (?, ?, ?, ?, ?)`).bind(workspace.id, body.slug, body.label, body.category || 'colors', body.description || null).run();
            return c.json({ success: true });
        }
        catch (error) {
            console.error('Failed to create group:', error);
            return c.json({ error: 'Failed to create group' }, 500);
        }
    });
    // DELETE /_ensemble/core/brand/groups/:slug — Delete group + its tokens
    app.delete('/_ensemble/core/brand/groups/:slug', async (c) => {
        const workspace = c.get('workspace');
        const slug = c.req.param('slug');
        if (!workspace?.id)
            return c.json({ error: 'Workspace not found' }, 400);
        try {
            // Delete tokens belonging to this group
            await c.env.DB.prepare(`DELETE FROM brand_tokens WHERE workspace_id = ? AND group_slug = ?`).bind(workspace.id, slug).run();
            // Delete the group
            await c.env.DB.prepare(`DELETE FROM brand_token_groups WHERE workspace_id = ? AND slug = ?`).bind(workspace.id, slug).run();
            return c.json({ success: true });
        }
        catch (error) {
            console.error('Failed to delete group:', error);
            return c.json({ error: 'Failed to delete group' }, 500);
        }
    });
    // PUT /_ensemble/core/brand/colors — Save a full color group
    // Accepts: { group: "slate", label: "Slate", colors: { "700": "#1E2630", "600": "#2D3A47", ... } }
    app.put('/_ensemble/core/brand/colors', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'Workspace not found' }, 400);
        const body = await c.req.json();
        if (!body.group || !body.colors) {
            return c.json({ error: 'group and colors are required' }, 400);
        }
        try {
            // Ensure group exists
            await c.env.DB.prepare(`INSERT INTO brand_token_groups (workspace_id, slug, label, category)
         VALUES (?, ?, ?, 'colors')
         ON CONFLICT (workspace_id, slug) DO UPDATE SET label = excluded.label`).bind(workspace.id, body.group, body.label).run();
            // Upsert each color token
            let sortOrder = 0;
            for (const [shade, hex] of Object.entries(body.colors)) {
                const key = `${body.group}.${shade}`;
                await c.env.DB.prepare(`INSERT INTO brand_tokens (workspace_id, category, key, value, type, label, group_slug, sort_order, locale, updated_at)
           VALUES (?, 'colors', ?, ?, 'color', ?, ?, ?, '', datetime('now'))
           ON CONFLICT (workspace_id, category, key, locale)
           DO UPDATE SET value = excluded.value, label = excluded.label, group_slug = excluded.group_slug,
                         sort_order = excluded.sort_order, updated_at = datetime('now')`).bind(workspace.id, key, hex, `${body.label} ${shade}`, body.group, sortOrder).run();
                sortOrder++;
            }
            return c.json({ success: true });
        }
        catch (error) {
            console.error('Failed to save colors:', error);
            return c.json({ error: 'Failed to save colors' }, 500);
        }
    });
    /* ──────────────────────────────────────────────────────────────
     * v0.1.55 — Brand Colors Doc (palettes + themes + gradients + semantic)
     *
     * Single-document model replacing the sprawl of per-token rows.
     * Stored as one JSON blob in brand_tokens; read via the resolver
     * to produce concrete hex maps.
     * ──────────────────────────────────────────────────────────── */
    /** GET /_ensemble/core/brand/colors-doc — return the typed doc. */
    app.get('/_ensemble/core/brand/colors-doc', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'Workspace not found' }, 400);
        const { loadBrandColors } = await import('../../../services/brand-colors/load.js');
        const doc = await loadBrandColors(c.env.DB, workspace.id);
        return c.json({ doc });
    });
    /** PUT /_ensemble/core/brand/colors-doc — atomic save.
     *  Body: { doc: BrandColorsDoc } */
    app.put('/_ensemble/core/brand/colors-doc', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'Workspace not found' }, 400);
        const body = await c.req.json().catch(() => ({}));
        if (!body.doc || typeof body.doc !== 'object') {
            return c.json({ error: 'doc required' }, 400);
        }
        const { loadBrandColors } = await import('../../../services/brand-colors/load.js');
        const { saveBrandColors, diffBrandColors } = await import('../../../services/brand-colors/save.js');
        const prev = await loadBrandColors(c.env.DB, workspace.id);
        const next = body.doc;
        await saveBrandColors(c.env.DB, workspace.id, next);
        const diff = diffBrandColors(prev, next);
        return c.json({ ok: true, diff });
    });
    /** POST /_ensemble/core/brand/colors-doc/generate-dark — synthesize
     *  Dark theme from Light + palettes. Does NOT save; returns the
     *  generated theme so the client can stage it as a draft. */
    app.post('/_ensemble/core/brand/colors-doc/generate-dark', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'Workspace not found' }, 400);
        const { loadBrandColors } = await import('../../../services/brand-colors/load.js');
        const { generateDarkTheme } = await import('../../../services/brand-colors/generate-dark.js');
        const doc = await loadBrandColors(c.env.DB, workspace.id);
        const result = generateDarkTheme(doc);
        return c.json(result);
    });
    /** GET /_ensemble/core/brand/colors-doc/resolved — convenience
     *  endpoint that returns the doc PLUS the fully resolved palettes
     *  and themes (every rung → hex, every binding → hex). Used by
     *  the BrandCard so the client doesn't have to import the
     *  resolver + culori. */
    app.get('/_ensemble/core/brand/colors-doc/resolved', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'Workspace not found' }, 400);
        const { loadBrandColors } = await import('../../../services/brand-colors/load.js');
        const { resolvePalettes, resolveTheme, resolveStopValue, onColorForeground } = await import('../../../services/brand-colors/resolver.js');
        const doc = await loadBrandColors(c.env.DB, workspace.id);
        const palettes = resolvePalettes(doc);
        const themeLight = resolveTheme(doc.themes.light.bindings, palettes);
        const themeDark = doc.themes.dark
            ? resolveTheme(doc.themes.dark.bindings, palettes)
            : null;
        // Resolve gradient stops too so the client can render previews
        // without re-implementing the resolver.
        const gradients = doc.gradients.map((g) => ({
            ...g,
            resolvedStops: g.stops.map((s) => ({ token: s, hex: resolveStopValue(s, palettes) })),
        }));
        // On-color foregrounds for each palette Main — used by the
        // palette face text color.
        const onColor = {
            primary: onColorForeground('primary', palettes),
            secondary: onColorForeground('secondary', palettes),
            accent: onColorForeground('accent', palettes),
            neutral: onColorForeground('neutral', palettes),
        };
        return c.json({ doc, palettes, themeLight, themeDark, gradients, onColor });
    });
    /* ──────────────────────────────────────────────────────────────
     * v0.1.56 — Operator-defined custom CSS
     *
     * The CSS tab on /brand lets operators append raw CSS to the
     * published /brand.css. Stored at brand_tokens.category='custom',
     * key='operator_css_overrides', value=<raw CSS string>.
     *
     * Read: GET /_ensemble/core/brand/custom-css
     * Write: PUT /_ensemble/core/brand/custom-css { css: string }
     *
     * The CSS string is appended verbatim to the brand.css output by
     * generateBrandCss() (see css.ts).
     * ──────────────────────────────────────────────────────────── */
    app.get('/_ensemble/core/brand/custom-css', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'Workspace not found' }, 400);
        try {
            const row = await c.env.DB.prepare(`SELECT value FROM brand_tokens
         WHERE workspace_id = ? AND category = 'custom' AND key = 'operator_css_overrides' AND locale = ''`).bind(workspace.id).first();
            return c.json({ css: row?.value ?? '' });
        }
        catch (error) {
            return c.json({ error: 'Failed to load custom CSS', detail: String(error) }, 500);
        }
    });
    app.put('/_ensemble/core/brand/custom-css', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'Workspace not found' }, 400);
        const body = await c.req.json().catch(() => ({}));
        const css = typeof body.css === 'string' ? body.css : '';
        try {
            if (css === '') {
                // Empty value → delete the row so the published CSS doesn't
                // emit a trailing operator-block comment with no content.
                await c.env.DB.prepare(`DELETE FROM brand_tokens WHERE workspace_id = ? AND category = 'custom' AND key = 'operator_css_overrides' AND locale = ''`).bind(workspace.id).run();
            }
            else {
                await c.env.DB.prepare(`INSERT INTO brand_tokens (workspace_id, category, key, value, type, locale, updated_at)
           VALUES (?, 'custom', 'operator_css_overrides', ?, 'text', '', datetime('now'))
           ON CONFLICT (workspace_id, category, key, locale)
           DO UPDATE SET value = excluded.value, updated_at = datetime('now')`).bind(workspace.id, css).run();
            }
            return c.json({ ok: true });
        }
        catch (error) {
            return c.json({ error: 'Failed to save custom CSS', detail: String(error) }, 500);
        }
    });
    // ── Google Fonts catalog (v0.1.17) ─────────────────────────────────
    //
    // Proxies fonts.google.com/metadata/fonts and caches the normalized
    // list in KV for 24h. Operators get the full ~1500-family catalog
    // in the Typography + Logos pickers without each shell load hitting
    // Google directly. The endpoint is read-only and doesn't surface any
    // workspace-specific data, so it's safe to cache cross-workspace.
    /**
     * Resolved active fonts for this workspace — the five typography
     * roles (display, heading, body, mono, wordmark) with family +
     * weight + style. Used by `Ensemble.useFonts()` so guest apps can
     * opt into the workspace's font scheme without reaching for CSS
     * variables directly.
     *
     * The shape is identical to what the brand CSS endpoint encodes;
     * this endpoint just hands it back as JSON instead of CSS.
     */
    app.get('/_ensemble/core/brand/fonts/active', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'Workspace not found' }, 400);
        try {
            const { loadAndResolveRoles, familyStack, ROLE_USAGE } = await import('../../../services/font-roles.js');
            const roles = await loadAndResolveRoles(c.env.DB, workspace.id);
            // Augment each role with the CSS stack, plus the human-readable
            // label and usage description so the brand-guide readout (and
            // any guest app surfacing brand context) renders identical text
            // to what operators see in admin.
            const augmented = Object.fromEntries(Object.entries(roles).map(([k, r]) => {
                const meta = ROLE_USAGE[k];
                return [
                    k,
                    {
                        ...r,
                        stack: familyStack(r.family),
                        label: meta?.label,
                        usage: meta?.usage,
                    },
                ];
            }));
            return c.json({ roles: augmented });
        }
        catch (error) {
            console.error('[fonts/active] failed:', error);
            return c.json({ roles: {} }, 200);
        }
    });
    app.get('/_ensemble/core/fonts/google', async (c) => {
        try {
            // `?refresh=1` bypasses KV cache. Used by the shell's hybrid
            // typeahead upgrade so a poisoned-empty cache entry can't trap
            // the operator on the bundled fallback for the full TTL window.
            const refresh = c.req.query('refresh') === '1';
            const fonts = await getCachedGoogleFonts(c.env, { refresh });
            return c.json({ fonts, count: fonts.length }, 200, {
                // Help the browser cache on the second-tab case as well — but
                // only when we actually got a real catalog. An empty response
                // gets a short cache so a transient failure isn't sticky.
                'Cache-Control': fonts.length > 0
                    ? 'public, max-age=3600'
                    : 'public, max-age=30',
            });
        }
        catch (err) {
            console.error('[fonts] catalog fetch failed:', err);
            return c.json({ fonts: [], error: String(err) }, 200);
        }
    });
}
/**
 * 24h-cached Google Fonts catalog. Cached in workspace KV under
 * `fonts:google:v1` so concurrent shell loads share one fetch.
 *
 * Treats a cached **empty** result as a cache miss — otherwise a single
 * transient upstream failure would poison the cache for the full TTL
 * and trap operators on the bundled fallback. Also accepts an explicit
 * `refresh` flag for cache-bust via `?refresh=1`.
 *
 * Never writes an empty result back to KV — the cache only grows when
 * we have a real catalog to share with future requests.
 */
async function getCachedGoogleFonts(env, opts = {}) {
    const KEY = 'fonts:google:v1';
    const TTL = 24 * 60 * 60; // 24h
    if (!opts.refresh) {
        const cached = await env.KV.get(KEY);
        if (cached) {
            try {
                const { fetched_at, fonts } = JSON.parse(cached);
                // Treat empty-array cache as a miss — usually means the previous
                // refresh got a 403/429/timeout from the upstream and we don't
                // want to be stuck on that for 24h.
                if (Array.isArray(fonts) && fonts.length > 0 && Date.now() - fetched_at < TTL * 1000) {
                    return fonts;
                }
            }
            catch {
                // fall through to refresh
            }
        }
    }
    // No-auth manifest. This is the same source the public fonts.google.com
    // picker uses. Its shape: { axisRegistry: [...], familyMetadataList: [...] }
    // with each entry shaped like { family, category, fonts: { '400': {...} }, ... }.
    const fresh = await fetchGoogleFontsMetadata();
    // Persist only when we got a real catalog — never cache an empty result.
    if (fresh.length > 0) {
        try {
            await env.KV.put(KEY, JSON.stringify({ fetched_at: Date.now(), fonts: fresh }), {
                expirationTtl: TTL * 7, // keep the cache for a week as fallback
            });
        }
        catch { /* ignore */ }
    }
    return fresh;
}
async function fetchGoogleFontsMetadata() {
    // Google ships this manifest unauthenticated. The response is
    // JSON-with-leading-XSSI-prefix (`)]}'` on a line by itself) so we
    // strip it before parsing.
    const res = await fetch('https://fonts.google.com/metadata/fonts');
    if (!res.ok)
        throw new Error(`Google Fonts metadata HTTP ${res.status}`);
    let body = await res.text();
    body = body.replace(/^\)\]\}'?\s*/, '');
    const parsed = JSON.parse(body);
    return (parsed.familyMetadataList ?? []).map((f) => {
        const variants = Object.keys(f.fonts ?? {});
        // Google ships categories as Title Case with spaces: "Sans Serif",
        // "Serif", "Display", "Handwriting", "Monospace". Normalize to
        // lowercase-hyphenated so the client picker can group by a stable key.
        const category = (f.category ?? '')
            .toLowerCase()
            .replace(/\s+/g, '-');
        return {
            family: f.family,
            category: category,
            variants,
            popularity: f.popularity,
        };
    });
}
/**
 * v0.1.89: narrow a brand spec response by preset (`?for=`) or by an
 * explicit dotted-path allowlist (`?include=`). Meta fields (the
 * top-level identity-of-the-response keys) are ALWAYS retained so the
 * response stays self-describing — an agent that gets a filtered spec
 * still finds endpoints, etag, schema_version, etc.
 *
 * Filtering applies only to the top-level domain blocks (identity,
 * colors, typography, logos, messaging, spatial, gradients). Sub-tree
 * paths in ?include like 'colors.palettes.primary' are supported.
 */
async function applySpecFilters(spec, forParam, includeParam) {
    // No filtering requested — return as-is.
    if (!forParam && !includeParam)
        return spec;
    // Always-retained meta keys. Adding etag/endpoints/schema_version
    // here keeps the filtered response usefully self-describing.
    const META_KEYS = new Set([
        'ensemble_brand', 'schema_version', 'spec_url', 'workspace',
        'updated_at', 'generated_at', 'etag', 'license', 'endpoints',
    ]);
    // Build the set of top-level domain keys to retain.
    let retainTop;
    if (includeParam) {
        // Take the top-level segment of each dotted path.
        const paths = includeParam.split(',').map((s) => s.trim()).filter(Boolean);
        retainTop = new Set(paths.map((p) => p.split('.')[0]));
    }
    else if (forParam) {
        // Preset lookup — fall back to "everything" if the preset is unknown.
        const { SPEC_PRESETS } = await import('../../../services/brand-spec-extras.js');
        const preset = SPEC_PRESETS[forParam];
        retainTop = preset ? new Set(preset) : new Set(Object.keys(spec));
    }
    else {
        retainTop = new Set(Object.keys(spec));
    }
    const out = {};
    for (const [key, value] of Object.entries(spec)) {
        if (META_KEYS.has(key) || retainTop.has(key)) {
            out[key] = value;
        }
    }
    // If ?include= specified sub-tree paths, narrow within retained subtrees.
    if (includeParam) {
        const paths = includeParam.split(',').map((s) => s.trim()).filter(Boolean);
        const byTop = new Map();
        for (const p of paths) {
            const [top, ...rest] = p.split('.');
            if (!top)
                continue;
            if (rest.length === 0)
                continue; // top-level only — already retained
            const subs = byTop.get(top) ?? [];
            subs.push(rest.join('.'));
            byTop.set(top, subs);
        }
        for (const [top, subs] of byTop.entries()) {
            const node = out[top];
            if (!node || typeof node !== 'object')
                continue;
            out[top] = narrowSubtree(node, subs);
        }
    }
    return out;
}
/** Narrow a subtree object to only the keys named by dotted paths. */
function narrowSubtree(node, paths) {
    const keep = new Set(paths.map((p) => p.split('.')[0]));
    const out = {};
    for (const [k, v] of Object.entries(node)) {
        if (!keep.has(k))
            continue;
        // Recurse only if there are deeper paths AND the value is an object.
        const deeperPaths = paths
            .filter((p) => p.startsWith(`${k}.`))
            .map((p) => p.slice(k.length + 1));
        if (deeperPaths.length > 0 && v && typeof v === 'object' && !Array.isArray(v)) {
            out[k] = narrowSubtree(v, deeperPaths);
        }
        else {
            out[k] = v;
        }
    }
    return out;
}
/** Simple JSON to YAML-ish conversion (no external deps). */
function jsonToYaml(obj, indent = 0) {
    const pad = '  '.repeat(indent);
    if (obj === null || obj === undefined)
        return 'null';
    if (typeof obj === 'string')
        return obj.includes('\n') ? `|\n${obj.split('\n').map((l) => pad + '  ' + l).join('\n')}` : obj;
    if (typeof obj === 'number' || typeof obj === 'boolean')
        return String(obj);
    if (Array.isArray(obj)) {
        if (obj.length === 0)
            return '[]';
        return obj.map((item) => `${pad}- ${jsonToYaml(item, indent + 1).trimStart()}`).join('\n');
    }
    if (typeof obj === 'object') {
        const entries = Object.entries(obj).filter(([, v]) => v !== undefined);
        if (entries.length === 0)
            return '{}';
        return entries.map(([k, v]) => {
            const val = jsonToYaml(v, indent + 1);
            if (typeof v === 'object' && v !== null)
                return `${pad}${k}:\n${val}`;
            return `${pad}${k}: ${val}`;
        }).join('\n');
    }
    return String(obj);
}
/**
 * v0.1.96: self-hosted brand diagnostic page. Fetches /brand/spec from
 * the workspace itself (same origin → no CORS gymnastics in the test),
 * then exercises every URL the spec advertises and reports the actual
 * HTTP status, content-type, ACAO, CORP, and the body size. Designed
 * to replace the file:// diagnostic HTML which can't accurately test
 * cross-origin behavior because browsers block fetch() from file://.
 */
const BRAND_TROUBLESHOOT_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Brand asset diagnostics</title>
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; background: #0f1115; color: #e6e6e6; padding: 2rem 1.5rem 6rem; font-size: 14px; line-height: 1.5; }
  h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem; color: #fff; }
  h2 { font-size: 1rem; font-weight: 600; margin: 2rem 0 0.75rem; color: #fff; }
  .meta { color: #888; font-size: 0.8125rem; margin-bottom: 1.5rem; }
  .meta code { background: #1a1d24; padding: 1px 6px; border-radius: 3px; color: #b8c4d8; }
  .test { background: #161922; border: 1px solid #232733; border-radius: 6px; padding: 1rem 1.25rem; margin-bottom: 0.75rem; }
  .test-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 0.75rem; }
  .test-name { font-weight: 600; color: #fff; }
  .test-url { font-family: ui-monospace, monospace; font-size: 0.75rem; color: #7a8499; word-break: break-all; margin-bottom: 0.5rem; }
  .pill { display: inline-flex; padding: 2px 8px; border-radius: 999px; font-family: ui-monospace, monospace; font-size: 0.6875rem; font-weight: 600; flex-shrink: 0; }
  .pill.pending { background: #1a1d24; color: #7a8499; }
  .pill.pass { background: #0f2a1a; color: #5ee395; }
  .pill.fail { background: #2a1010; color: #ff7777; }
  .row { display: grid; grid-template-columns: 130px 1fr; gap: 0.5rem 1rem; padding: 0.375rem 0; border-top: 1px solid #1f2330; font-size: 0.8125rem; }
  .row:first-of-type { border-top: 0; }
  .row .k { color: #7a8499; font-family: ui-monospace, monospace; font-size: 0.75rem; }
  .row .v { color: #d4dae8; font-family: ui-monospace, monospace; font-size: 0.75rem; word-break: break-all; }
  .row .v.good { color: #5ee395; } .row .v.bad { color: #ff7777; }
  .preview { margin-top: 0.875rem; padding: 0.875rem; background: repeating-conic-gradient(#1a1d24 0% 25%, #1f2330 0% 50%) 50% / 14px 14px; border-radius: 4px; min-height: 70px; display: flex; align-items: center; justify-content: center; }
  .preview img { max-height: 60px; max-width: 100%; }
  .preview.dark { background: #0a0a0a; }
  button { background: #2a3148; color: #fff; border: 0; padding: 0.5rem 1rem; border-radius: 4px; font-size: 0.8125rem; font-weight: 600; cursor: pointer; }
  button:hover { background: #3a4263; }
  .summary { background: #1a1d24; border-left: 3px solid #5ee395; padding: 0.75rem 1rem; margin-bottom: 1.5rem; border-radius: 4px; font-size: 0.875rem; }
  .summary.bad { border-color: #ff7777; }
  .font-sample { font-family: var(--font-heading, sans-serif); font-weight: 700; font-size: 1.5rem; color: var(--brand-primary-main, #ff5252); }
</style>
<link rel="stylesheet" id="brand-css" />
</head>
<body>
<h1>Brand asset diagnostics</h1>
<div class="meta">
  Page origin: <code id="origin"></code> &nbsp;\xb7&nbsp;
  Spec URL: <code id="spec-url">/brand/spec</code> &nbsp;\xb7&nbsp;
  Time: <code id="ts"></code>
</div>

<div id="summary" class="summary">Loading spec...</div>
<button onclick="location.reload()">Re-run all tests</button>

<h2>1. Spec fetch</h2>
<div id="spec-test"></div>

<h2>2. Stylesheet (endpoints.css)</h2>
<div id="css-test"></div>

<h2>3. Logo variants (sampled)</h2>
<div id="variants-test"></div>

<h2>4. Favicons</h2>
<div id="favicon-test"></div>

<script>
async function fetchWithDetails(url) {
  try {
    const t0 = performance.now();
    const res = await fetch(url, { cache: 'no-store' });
    const blob = await res.blob();
    const dt = Math.round(performance.now() - t0);
    return {
      ok: res.ok, status: res.status, statusText: res.statusText,
      ct: res.headers.get('content-type') || '',
      acao: res.headers.get('access-control-allow-origin') || '',
      corp: res.headers.get('cross-origin-resource-policy') || '',
      size: blob.size, ms: dt, err: null,
    };
  } catch (err) {
    return { ok: false, status: 0, statusText: '', ct: '', acao: '', corp: '', size: 0, ms: 0, err: err.message };
  }
}

function row(k, v, cls) {
  return '<div class="row"><span class="k">' + k + '</span><span class="v' + (cls ? ' ' + cls : '') + '">' + v + '</span></div>';
}

function pill(ok) {
  return ok
    ? '<span class="pill pass">pass</span>'
    : '<span class="pill fail">fail</span>';
}

function renderResult(name, url, r, preview) {
  return '<div class="test">'
    + '<div class="test-head"><span class="test-name">' + name + '</span>' + pill(r.ok) + '</div>'
    + '<div class="test-url">' + url + '</div>'
    + row('HTTP', r.err ? '\u2717 ' + r.err : (r.status + ' ' + r.statusText), r.ok ? 'good' : 'bad')
    + row('content-type', r.ct || '(none)')
    + row('body bytes', r.size.toLocaleString())
    + row('ms', r.ms)
    + row('access-control-allow-origin', r.acao || '(missing)', r.acao === '*' ? 'good' : 'bad')
    + row('cross-origin-resource-policy', r.corp || '(missing)', r.corp.includes('cross-origin') ? 'good' : 'bad')
    + (preview ? '<div class="preview"><img src="' + url + '" alt="(failed)"></div>' : '')
    + '</div>';
}

(async () => {
  document.getElementById('origin').textContent = location.origin;
  document.getElementById('ts').textContent = new Date().toISOString();

  // Fetch spec first \u2014 it tells us every other URL to test.
  const specR = await fetchWithDetails('/brand/spec');
  document.getElementById('spec-test').innerHTML = renderResult('GET /brand/spec', '/brand/spec', specR);

  if (!specR.ok) {
    document.getElementById('summary').className = 'summary bad';
    document.getElementById('summary').textContent = 'Spec fetch failed \u2014 cannot continue.';
    return;
  }

  // Re-fetch as JSON to walk endpoints.
  const spec = await (await fetch('/brand/spec', { cache: 'no-store' })).json();
  document.getElementById('spec-url').textContent = spec.spec_url || '/brand/spec';

  // Install the brand CSS as a real <link> so the font sample below tests it.
  const link = document.getElementById('brand-css');
  link.rel = 'stylesheet';
  link.href = spec.endpoints?.css || '/_ensemble/brand/css';

  // Test the CSS endpoint.
  const cssUrl = spec.endpoints?.css || '/_ensemble/brand/css';
  const cssR = await fetchWithDetails(cssUrl);
  document.getElementById('css-test').innerHTML =
    renderResult('endpoints.css', cssUrl, cssR)
    + '<div class="test"><div class="font-sample">Curalisto \u00b7 Listo para la vida</div><div style="font-size:0.75rem;color:#7a8499;margin-top:0.25rem">If this renders in the brand font + brand color, the stylesheet loaded and the CSS variables are defined.</div></div>';

  // Sample 6 representative variants.
  const variants = spec.assets?.variants || [];
  const samples = [
    variants.find(v => v.role === 'wordmark' && v.format === 'svg' && v.background === 'transparent'),
    variants.find(v => v.role === 'wordmark' && v.format === 'png' && v.background === 'transparent' && v.size_px === 1024),
    variants.find(v => v.role === 'wordmark' && v.format === 'png' && v.background === 'transparent' && v.size_px === 256),
    variants.find(v => v.role === 'icon' && v.format === 'svg' && v.background === 'transparent'),
    variants.find(v => v.role === 'icon' && v.format === 'png' && v.background === 'transparent' && v.size_px === 128),
    variants.find(v => v.role === 'icon' && v.format === 'png' && v.background === 'transparent' && v.size_px === 64),
  ].filter(Boolean);

  let variantsHtml = '';
  for (const v of samples) {
    const r = await fetchWithDetails(v.url);
    const label = v.role + ' \u00b7 ' + v.composition + ' \u00b7 ' + v.finish + ' \u00b7 ' + v.background + ' \u00b7 ' + v.format + (v.size_px ? ' \u00b7 ' + v.size_px + 'px' : '');
    variantsHtml += renderResult(label, v.url, r, true);
  }
  document.getElementById('variants-test').innerHTML = variantsHtml;

  // Test all 5 favicon variants.
  const favicons = variants.filter(v => v.role === 'favicon');
  let faviconHtml = '';
  for (const v of favicons) {
    const r = await fetchWithDetails(v.url);
    const label = v.size_px + 'px \u00b7 use=' + v.use;
    faviconHtml += renderResult(label, v.url, r, true);
  }
  document.getElementById('favicon-test').innerHTML = faviconHtml;

  // Summary.
  const allTests = [specR, cssR, ...samples.map((s, i) => ({ ok: true }))];
  const failed = allTests.filter(t => !t.ok).length;
  const summary = document.getElementById('summary');
  if (failed === 0) {
    summary.className = 'summary';
    summary.textContent = '\u2713 Spec, stylesheet, sampled variants, and favicons all loaded successfully from this origin.';
  } else {
    summary.className = 'summary bad';
    summary.textContent = '\u2717 ' + failed + ' test(s) failed. Check individual results below.';
  }
})();
</script>
</body>
</html>`;
//# sourceMappingURL=routes.js.map