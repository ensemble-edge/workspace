/**
 * createWorkspace — Main Factory Function
 *
 * Creates an Ensemble Workspace instance that can be deployed as a
 * Cloudflare Worker. Wires up middleware, routes, and the shell.
 *
 * @example
 * ```ts
 * // worker.ts
 * import { createWorkspace } from './index.js';
 *
 * export default createWorkspace({
 *   workspace: { name: 'Acme', slug: 'acme' },
 *   brand: { accent: '#3B82F6' },
 * });
 * ```
 */
import { Hono } from 'hono';
import { cors, publicCors, workspaceResolver, bootstrapCheck, auth } from './middleware/index.js';
import { runMigrations, migrations } from './db/index.js';
import { createAuthRoutes, createBootstrapRoutes, createGuestGatewayRoutes, createWorkspaceContextRoutes } from './routes/index.js';
import { registerCoreApps } from './apps/index.js';
import { generateBrandCss, getSavedThemeMode } from './apps/core/brand/css.js';
// Shell assets are built by @ensemble-edge/shell and exported as strings
import { SHELL_JS, SHELL_CSS } from '../../shell/dist/assets.js';
import { RUNTIME_JS, RUNTIME_CSS, RUNTIME_VERSION } from '../../guest-runtime/dist/assets.js';
import { createCredentialsRoutes } from './routes/credentials.js';
/**
 * Create a new Ensemble Workspace instance.
 */
export function createWorkspace(config) {
    // Resolve config with defaults
    const resolvedConfig = resolveConfig(config);
    // Create Hono app with typed bindings
    const app = new Hono();
    // ============================================================================
    // Global error handler — surfaces the actual cause of 500s instead of
    // a bare "Internal Server Error" page. Logs stack + request context to
    // the Worker log so production triage doesn't require guessing.
    // ============================================================================
    app.onError((err, c) => {
        const reqId = c.get('requestId') || 'no-id';
        const url = c.req.url;
        const method = c.req.method;
        console.error(`[500] ${method} ${url} req=${reqId} :: ${err?.name}: ${err?.message}`);
        if (err?.stack)
            console.error(err.stack);
        return c.json({
            error: 'internal_error',
            message: err?.message || 'Internal Server Error',
            requestId: reqId,
        }, 500);
    });
    // ============================================================================
    // Middleware Pipeline
    // ============================================================================
    // 1. CORS headers for API routes
    app.use('*', cors({
        additionalOrigins: resolvedConfig.cors.brandOrigins,
    }));
    // 1b. Public CORS on brand-asset surfaces. v0.1.80: every public
    // brand resource (favicon, manifest, css endpoint, spec/tokens JSON,
    // render URLs) is CDN-style public — consumer sites + marketing
    // pages embed them cross-origin. Origin: *, no credentials.
    //
    // Order matters: publicCors runs AFTER the credentialed cors() but
    // its Origin: * header overwrites any tighter value set above.
    // OPTIONS preflight short-circuits inside publicCors before reaching
    // the GET handlers.
    app.use('/_ensemble/brand/*', publicCors());
    app.use('/_ensemble/version', publicCors());
    app.use('/favicon.svg', publicCors());
    app.use('/favicon.ico', publicCors());
    app.use('/manifest.webmanifest', publicCors());
    // 2. Run migrations on first request (checks for new migrations each cold start).
    // Promise-based guard so concurrent first-requests share one run; if it
    // fails, we reset the guard so the next request can retry rather than
    // leaving the Worker stuck.
    let migrationsPromise = null;
    app.use('*', async (c, next) => {
        if (!migrationsPromise) {
            migrationsPromise = runMigrations(c.env.DB, migrations).catch((err) => {
                migrationsPromise = null;
                throw err;
            });
        }
        await migrationsPromise;
        await next();
    });
    // 3. Bootstrap check - redirect to setup if no users exist
    app.use('*', bootstrapCheck());
    // 4. Resolve workspace from hostname/path
    app.use('*', workspaceResolver(resolvedConfig));
    // ============================================================================
    // Static Routes (no auth required)
    // ============================================================================
    // Health check
    app.get('/health', (c) => {
        return c.json({
            status: 'ok',
            workspace: c.get('workspace')?.slug,
            timestamp: new Date().toISOString(),
        });
    });
    // Shell HTML (SPA entry point)
    app.get('/', async (c) => {
        const workspace = c.get('workspace');
        const themeMode = await getSavedThemeMode(c.env.DB, workspace?.id || '');
        return c.html(generateShellHtml(workspace?.name ?? resolvedConfig.workspace.name, resolvedConfig.brand.accent, themeMode));
    });
    // Login page — uses workspace appearance (brand/css)
    app.get('/login', async (c) => {
        const workspace = c.get('workspace');
        const themeMode = await getSavedThemeMode(c.env.DB, workspace?.id || '');
        // Load the styled-wordmark segments + typography so the login
        // screen renders the operator's brand mark in their chosen face.
        let wordmarkHtml = null;
        if (workspace?.id) {
            try {
                const { parseWordmarkSegments, renderWordmarkHtml } = await import('./services/wordmark-segments.js');
                const { loadAndResolveRoles, familyStack } = await import('./services/font-roles.js');
                const row = await c.env.DB.prepare(`SELECT value FROM brand_tokens
            WHERE workspace_id = ? AND category = 'identity'
              AND key = 'wordmark_text' AND locale = ''`).bind(workspace.id).first();
                const segments = parseWordmarkSegments(row?.value ?? '');
                const roles = await loadAndResolveRoles(c.env.DB, workspace.id);
                const wm = roles.wordmark;
                wordmarkHtml = renderWordmarkHtml(segments, {
                    fontSize: 24,
                    weight: wm.weight,
                    style: wm.style,
                    fontFamily: familyStack(wm.family),
                });
            }
            catch {
                // Fall back to plain workspace name.
            }
        }
        return c.html(generateLoginHtml(workspace?.name ?? resolvedConfig.workspace.name, resolvedConfig.brand.accent, themeMode, wordmarkHtml));
    });
    // ============================================================================
    // API Routes (/_ensemble/*)
    // ============================================================================
    // Bootstrap routes (/_ensemble/bootstrap) - only works when zero users
    app.route('/_ensemble/bootstrap', createBootstrapRoutes(resolvedConfig));
    // Auth routes (/_ensemble/auth/*)
    app.route('/_ensemble/auth', createAuthRoutes());
    // Guest App Gateway (/_ensemble/apps/*) - requires authentication
    app.use('/_ensemble/apps/*', auth());
    app.route('/_ensemble/apps', createGuestGatewayRoutes());
    // Credentials, AI tiers, setup/status, auth/methods, invite/reset
    // (v0.1.12). These need auth for any mutation; the route handlers
    // gate admin actions internally.
    app.use('/_ensemble/credentials/*', auth());
    app.use('/_ensemble/ai/*', auth());
    app.use('/_ensemble/users/*', auth());
    // v0.1.14: brand upload is admin-only (asset GET stays public for img tags).
    app.use('/_ensemble/brand/upload', auth());
    // v0.1.47: mutations under /_ensemble/core/brand/* (logo-policy
    // PUT etc.) need an authenticated user so requireAdmin can read
    // membership.role. GET reads on these paths stay open to public
    // brand-guide consumers, so we attach auth as optional — passes
    // through when no cookie is present and only gates per-handler.
    app.use('/_ensemble/core/brand/*', auth({ required: false }));
    // v0.1.15: workspace policy (settings) and content locales.
    app.use('/_ensemble/settings/*', auth());
    app.use('/_ensemble/locales/*', auth());
    app.use('/_ensemble/locales', auth());
    app.route('/', createCredentialsRoutes());
    // v0.1.40 — unified workspace context for the SDK + guest apps.
    // Single source of truth for workspace identity, current user,
    // locale (workspace + user-preferred), theme, brand. Extensible
    // by addition; see services/workspace-context.ts for the contract.
    app.use('/_ensemble/workspace/preferences/*', auth());
    app.route('/', createWorkspaceContextRoutes());
    // Core App API Routes (/_ensemble/core/*)
    registerCoreApps(app);
    // Brand endpoints (public, no auth)
    // Ensemble Design System: warm canvas + floating dark cards
    app.get('/_ensemble/brand/theme', async (c) => {
        // Try to load custom accent from brand_tokens table
        let accent = resolvedConfig.brand.accent;
        try {
            const result = await c.env.DB.prepare(`SELECT value FROM brand_tokens
         WHERE workspace_id = ? AND category = 'colors' AND key = 'accent' AND locale = ''`).bind(c.get('workspace')?.id || '').first();
            if (result?.value) {
                accent = result.value;
            }
        }
        catch {
            // Use default if DB query fails
        }
        // Load canvas color from DB (if saved)
        let canvas = '#BDB7B0'; // Default: light warm beige (Ensemble)
        try {
            const canvasResult = await c.env.DB.prepare(`SELECT value FROM brand_tokens
         WHERE workspace_id = ? AND category = 'colors' AND key = 'canvas' AND locale = ''`).bind(c.get('workspace')?.id || '').first();
            if (canvasResult?.value) {
                canvas = canvasResult.value;
            }
        }
        catch {
            // Use default if DB query fails
        }
        // Ensemble design tokens: warm canvas with floating dark cards
        return c.json({
            colors: {
                // Core accent (configurable)
                accent,
                accentHover: `color-mix(in srgb, ${accent} 85%, white)`,
                accentDim: `color-mix(in srgb, ${accent} 20%, transparent)`,
                // Warm canvas background (light beige by default, user-configurable)
                canvas,
                // Floating dark card surfaces
                card: '#1e1e22',
                cardHover: '#252529',
                cardBorder: 'rgba(255, 255, 255, 0.06)',
                // Always-dark chrome (sidebar, workspace strip)
                sidebarBg: '#141316',
                sidebarHover: '#1c1b1f',
                sidebarActive: '#252429',
                // Typography colors (warm whites)
                textPrimary: '#f0ede8',
                textSecondary: '#9a938a',
                textTertiary: '#6b655c',
                // Semantic colors
                error: '#f87171',
                success: '#4ade80',
                warning: '#fbbf24',
                info: '#60a5fa',
            },
            typography: {
                headingFont: 'DM Sans',
                bodyFont: 'DM Sans',
                monoFont: 'JetBrains Mono',
                labelTracking: '0.12em', // Ensemble section labels
            },
            spatial: {
                radius: '12px',
                radiusSm: '8px',
                radiusLg: '16px',
                density: 'normal',
            },
            shadows: {
                card: '0 4px 24px rgba(0, 0, 0, 0.25)',
                cardLg: '0 8px 32px rgba(0, 0, 0, 0.35)',
                dropdown: '0 12px 40px rgba(0, 0, 0, 0.45)',
            },
            identity: {
                name: resolvedConfig.workspace.name,
                logoUrl: null,
                faviconUrl: null,
            },
        });
    });
    app.get('/_ensemble/brand/css', async (c) => {
        const workspaceId = c.get('workspace')?.id || '';
        const css = await generateBrandCss(c.env.DB, workspaceId, resolvedConfig.brand.accent);
        return c.text(css, 200, {
            'Content-Type': 'text/css',
            'Cache-Control': 'no-store, must-revalidate',
        });
    });
    // PUT endpoint to save brand tokens
    app.put('/_ensemble/brand/tokens', async (c) => {
        try {
            const workspace = c.get('workspace');
            if (!workspace?.id) {
                return c.json({ error: 'Workspace not found' }, 400);
            }
            const body = await c.req.json();
            if (!body.category || !body.tokens) {
                return c.json({ error: 'Category and tokens are required' }, 400);
            }
            const locale = (body.locale ?? '').trim();
            // Infer token type from category
            const typeMap = {
                colors: 'color', typography: 'font', spatial: 'text',
                identity: 'text', messaging: 'text', custom: 'text',
            };
            const tokenType = typeMap[body.category] || 'text';
            for (const [key, value] of Object.entries(body.tokens)) {
                if (value === '') {
                    // Empty string deletes the row — operators clear a
                    // translation by passing ''. Doesn't touch other locales.
                    await c.env.DB.prepare(`DELETE FROM brand_tokens
              WHERE workspace_id = ? AND category = ? AND key = ? AND locale = ?`).bind(workspace.id, body.category, key, locale).run();
                    continue;
                }
                await c.env.DB.prepare(`INSERT INTO brand_tokens (workspace_id, category, key, value, type, locale, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT (workspace_id, category, key, locale)
           DO UPDATE SET value = excluded.value, updated_at = datetime('now')`).bind(workspace.id, body.category, key, value, tokenType, locale).run();
            }
            return c.json({ success: true });
        }
        catch (error) {
            console.error('Failed to save brand tokens:', error);
            return c.json({ error: 'Failed to save brand settings' }, 500);
        }
    });
    // Workspace info
    app.get('/_ensemble/workspace', (c) => {
        const workspace = c.get('workspace');
        return c.json({
            id: workspace?.id,
            slug: workspace?.slug,
            name: workspace?.name,
            type: workspace?.type,
        });
    });
    // Navigation config (includes installed apps)
    app.get('/_ensemble/nav', async (c) => {
        const workspace = c.get('workspace');
        const user = c.get('user');
        // Fetch installed guest apps
        let installedApps = [];
        if (workspace?.id) {
            try {
                const result = await c.env.DB.prepare(`SELECT id, name, icon, category FROM guest_apps
           WHERE workspace_id = ? AND enabled = 1
           ORDER BY name`).bind(workspace.id).all();
                installedApps = result.results || [];
            }
            catch {
                // Table might not exist yet
            }
        }
        // Build navigation sections
        const sections = [
            {
                id: 'apps',
                label: 'Apps',
                items: [
                    { id: 'home', label: 'Home', icon: 'home', path: '/' },
                    // Add installed apps as nav items
                    ...installedApps.map((app) => ({
                        id: app.id,
                        label: app.name,
                        icon: app.icon || 'box',
                        path: `/apps/${app.id}`,
                    })),
                ],
            },
            {
                id: 'workspace',
                label: 'Workspace',
                items: [
                    { id: 'people', label: 'People', icon: 'users', path: '/people' },
                    { id: 'brand', label: 'Brand', icon: 'palette', path: '/brand' },
                    { id: 'apps-manage', label: 'Apps', icon: 'grid-3x3', path: '/apps' },
                    { id: 'knowledge', label: 'Knowledge', icon: 'book-open', path: '/knowledge' },
                    // v0.1.78: audit log moved into Settings → Audit Log tab; no
                    // longer a sidebar entry. Auth & Security and Navigation were
                    // scaffolding placeholders without real pages; removed from
                    // sidebar pending real implementations.
                    { id: 'settings', label: 'Settings', icon: 'settings', path: '/settings' },
                ],
            },
        ];
        // Filter based on user role if needed
        // (for now, show all sections)
        const membership = c.get('membership');
        return c.json({
            sections,
            user: user ? {
                id: user.id,
                email: user.email,
                role: membership?.role ?? 'member',
                displayName: user.displayName,
            } : null,
        });
    });
    // Shell assets (JS and CSS bundles)
    // These are inlined from the build output via assets.generated.ts
    app.get('/_ensemble/shell/shell.js', (c) => {
        return c.text(SHELL_JS, 200, {
            'Content-Type': 'application/javascript; charset=utf-8',
            'Cache-Control': 'public, max-age=31536000, immutable',
        });
    });
    app.get('/_ensemble/shell/shell.css', (c) => {
        return c.text(SHELL_CSS, 200, {
            'Content-Type': 'text/css; charset=utf-8',
            'Cache-Control': 'public, max-age=31536000, immutable',
        });
    });
    // ============================================================================
    // Guest Runtime — served to iframe-side of guest apps
    // ============================================================================
    // The runtime bundle exposes React + workspace UI + layout primitives on
    // window.Ensemble. Guest apps load it via <script src="..."> and call
    // Ensemble.mount(YourComponent). Guest bundles ship only their own code.
    //
    // Versioned URL: /_ensemble/runtime/v1/* . Breaking changes ship as /v2/.
    // Cache-Control immutable + 1y because tagged runtime versions never change.
    app.get(`/_ensemble/runtime/v${RUNTIME_VERSION}/runtime.js`, (c) => {
        return c.text(RUNTIME_JS, 200, {
            'Content-Type': 'application/javascript; charset=utf-8',
            'Cache-Control': 'public, max-age=31536000, immutable',
        });
    });
    app.get(`/_ensemble/runtime/v${RUNTIME_VERSION}/runtime.css`, (c) => {
        return c.text(RUNTIME_CSS, 200, {
            'Content-Type': 'text/css; charset=utf-8',
            'Cache-Control': 'public, max-age=31536000, immutable',
        });
    });
    // ============================================================================
    // Version sentinel (v0.1.6+)
    // ============================================================================
    // Lets consumers verify which workspace version is actually deployed.
    // Useful when "I updated my pin and redeployed but iframe still looks
    // old" — hit this endpoint to check whether the new build is live.
    app.get('/_ensemble/version', (c) => {
        return c.json({
            runtime_version: RUNTIME_VERSION,
            shell_assets_size: SHELL_JS.length,
            runtime_assets_size: RUNTIME_JS.length,
            // The capabilities array is the discoverable feature list. Consumers
            // can check for "isolation" before assuming sandboxed-mode support.
            capabilities: ['runtime-v1', 'guest-isolation', 'sandbox-postmessage'],
        });
    });
    // ============================================================================
    // Public brand guide at /brand (v0.1.15.1)
    //
    // Toggled by the `public_brand_guide_enabled` setting in Settings →
    // Danger Zone. When off, falls through to the SPA catchall (which
    // shows the authenticated brand admin page if logged in, redirects
    // to /login otherwise). When on, serves a noindex HTML page sourced
    // from brand_tokens — designed to share with partners and designers.
    // ============================================================================
    app.get('/brand', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.notFound();
        // Authenticated users get the SPA's admin Brand page (the existing
        // experience). The public guide is for *external* visitors only.
        const { getAuthCookies } = await import('./utils/cookies.js');
        const { accessToken } = getAuthCookies(c.req.header('Cookie'));
        if (accessToken) {
            const themeMode = await getSavedThemeMode(c.env.DB, workspace.id);
            return c.html(generateShellHtml(workspace.name ?? resolvedConfig.workspace.name, resolvedConfig.brand.accent, themeMode));
        }
        // Unauthenticated: gate on the public-guide toggle. If off, 404 —
        // explicitly *not* a redirect to /login, because we don't want to
        // leak that the URL has a meaning.
        const { getSetting } = await import('./services/workspace-settings.js');
        const enabled = (await getSetting(c.env, workspace.id, 'public_brand_guide_enabled')) === 'true';
        if (!enabled)
            return c.notFound();
        const { renderBrandGuide } = await import('./services/brand-guide.js');
        const html = await renderBrandGuide(c.env, workspace.id);
        return new Response(html, {
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                // Defense-in-depth alongside the <meta name="robots"> tag.
                'X-Robots-Tag': 'noindex, nofollow',
                'Cache-Control': 'public, max-age=300',
            },
        });
    });
    // ============================================================================
    // Catch-all for SPA routing
    // ============================================================================
    //
    // Also handles the operator-configurable R2 asset alias path. We do
    // this *inside* the SPA catchall instead of as a separate top-level
    // wildcard route because a top-level `/:alias/:key{.+}` registration
    // matches every `/_ensemble/*` URL too — Hono's notFound() doesn't
    // fall through to other handlers, so it would 404 the entire API.
    // That regression is what broke v0.1.18; it's fixed here in v0.1.19
    // by colocating the check with the catchall.
    app.get('*', async (c) => {
        const workspace = c.get('workspace');
        // Check if this URL is the operator-configured asset alias path
        // before serving the SPA. Shape: /<configured-alias>/<r2-key...>
        // where <configured-alias> is the operator's chosen path segment
        // (e.g. 'assets', 'media', 'static-files').
        // Unified alias rewrite (v0.1.46+): the operator-configured pretty
        // alias path rewrites `/<alias>/brand/*` URLs to their canonical
        // `/_ensemble/brand/*` equivalents and re-dispatches via internal
        // fetch. One transform, applied uniformly to every brand resource
        // (asset, render, spec, css, favicon, messaging).
        //
        // Why this works: the canonical handlers under /_ensemble/brand/*
        // are already registered and tested. The alias is purely a URL
        // rewrite — same handler, prettier URL.
        if (workspace?.id) {
            const url = new URL(c.req.url);
            const segments = url.pathname.split('/').filter(Boolean);
            if (segments.length >= 2 && segments[1] === 'brand') {
                const { getSetting } = await import('./services/workspace-settings.js');
                const aliasPath = (await getSetting(c.env, workspace.id, 'asset_public_alias_path')).trim();
                if (aliasPath && segments[0] === aliasPath) {
                    // Build the canonical URL: /_ensemble/brand/<rest>
                    const rest = segments.slice(1).join('/'); // 'brand/...'
                    const canonicalUrl = `${url.origin}/_ensemble/${rest}${url.search}`;
                    // Internal re-dispatch — Hono runs the canonical handler
                    // and returns the same response back through us.
                    return app.fetch(new Request(canonicalUrl, c.req.raw), c.env, c.executionCtx);
                }
            }
        }
        // Default: return shell HTML for client-side routing.
        const themeMode = await getSavedThemeMode(c.env.DB, workspace?.id || '');
        return c.html(generateShellHtml(workspace?.name ?? resolvedConfig.workspace.name, resolvedConfig.brand.accent, themeMode));
    });
    return {
        fetch: app.fetch,
    };
}
/**
 * Resolve config with defaults.
 */
function resolveConfig(config) {
    return {
        workspace: {
            name: config.workspace.name,
            slug: config.workspace.slug,
            type: config.workspace.type ?? 'organization',
        },
        brand: {
            accent: config.brand?.accent ?? '#3B82F6',
            baseTheme: config.brand?.baseTheme ?? 'neutral',
            name: config.brand?.name ?? config.workspace.name,
        },
        locale: {
            baseLanguage: config.locale?.baseLanguage ?? 'en',
            supportedLanguages: config.locale?.supportedLanguages ?? ['en'],
            timezone: config.locale?.timezone ?? 'UTC',
            dateFormat: config.locale?.dateFormat ?? 'us',
            numberFormat: config.locale?.numberFormat ?? 'us',
        },
        auth: {
            providers: config.auth?.providers ?? ['email'],
        },
        cors: {
            brandOrigins: config.cors?.brandOrigins ?? [],
        },
    };
}
/**
 * Generate shell HTML with Preact SPA.
 *
 * The shell is a full Preact SPA that loads from /_ensemble/shell/shell.js.
 * CSS is loaded from /_ensemble/shell/shell.css (bundled) and
 * /_ensemble/brand/css (dynamic theme).
 */
function generateShellHtml(workspaceName, accentColor, themeMode = 'dark') {
    // For 'system' mode, default to dark and let the script below fix it
    const initialClass = themeMode === 'light' ? '' : 'dark';
    const systemScript = themeMode === 'system' ? `<script>if(window.matchMedia('(prefers-color-scheme:light)').matches)document.documentElement.classList.remove('dark')</script>` : '';
    return `<!DOCTYPE html>
<html lang="en" class="${initialClass}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="${accentColor}">
  <meta name="mobile-web-app-capable" content="yes">
  ${systemScript}
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <title>${workspaceName}</title>
  <link rel="icon" type="image/svg+xml" href="/_ensemble/brand/favicon.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/_ensemble/shell/shell.css">
  <link rel="stylesheet" href="/_ensemble/brand/css">
  <style>
    /* Minimal critical CSS — full theme loads from /_ensemble/brand/css */
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      font-family: var(--font-body, 'DM Sans', system-ui, sans-serif);
      background: hsl(var(--background));
      color: hsl(var(--foreground));
      overflow: hidden;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    #app {
      min-height: 100vh;
      min-height: 100dvh;
    }
    /* Loading state before JS loads */
    .shell-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      height: 100dvh;
      flex-direction: column;
      gap: 16px;
      color: var(--text-secondary);
    }
    .shell-loading__spinner {
      width: 32px;
      height: 32px;
      border: 3px solid var(--card-border);
      border-top-color: var(--color-accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div id="app">
    <!-- Loading state while Preact hydrates -->
    <div class="shell-loading">
      <div class="shell-loading__spinner"></div>
      <div>Loading ${workspaceName}...</div>
    </div>
  </div>
  <script type="module" src="/_ensemble/shell/shell.js"></script>
</body>
</html>`;
}
/**
 * Generate login page HTML using shadcn/ui Tailwind classes.
 *
 * Uses JavaScript to submit form as JSON instead of URL-encoded.
 * Styled to match the shadcn/ui design system loaded from shell.css.
 */
function generateLoginHtml(workspaceName, accentColor, themeMode = 'dark', wordmarkHtml = null) {
    const initialClass = themeMode === 'light' ? '' : 'dark';
    const systemScript = themeMode === 'system' ? `<script>if(window.matchMedia('(prefers-color-scheme:light)').matches)document.documentElement.classList.remove('dark')</script>` : '';
    const inputClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
    const inputErrorClass = 'border-destructive focus-visible:ring-destructive';
    return `<!DOCTYPE html>
<html lang="en" class="${initialClass}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="${accentColor}">
  <title>Login — ${workspaceName}</title>
  <link rel="icon" type="image/svg+xml" href="/_ensemble/brand/favicon.svg">
  ${systemScript}
  <link rel="stylesheet" href="/_ensemble/shell/shell.css">
  <link rel="stylesheet" href="/_ensemble/brand/css">
</head>
<body class="min-h-svh flex items-center justify-center p-4 bg-muted">
  <div class="w-full max-w-sm bg-card rounded-lg shadow-lg border p-6 space-y-6">
    <!-- Logo / wordmark -->
    <div class="flex items-center gap-2 justify-center text-foreground">
      ${wordmarkHtml ?? `<span class="text-2xl text-primary">◆</span><span class="text-xl font-semibold">${escapeHtml(workspaceName)}</span>`}
    </div>

    <!-- Title -->
    <div class="text-center space-y-1">
      <h1 class="text-lg font-medium text-foreground">Welcome back</h1>
      <p class="text-sm text-muted-foreground">Sign in to your workspace</p>
    </div>

    <!-- Global Error Message -->
    <div class="hidden text-sm text-destructive bg-destructive/10 p-3 rounded-md" id="errorMessage"></div>

    <form class="space-y-4" id="loginForm" novalidate>
      <!-- Email -->
      <div class="space-y-2">
        <label class="text-sm font-medium text-foreground" for="email">Email</label>
        <input
          type="email"
          id="email"
          name="email"
          class="${inputClass}"
          placeholder="you@example.com"
          autocomplete="email"
        >
        <p class="hidden text-xs text-destructive" id="emailError"></p>
      </div>

      <!-- Password -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <label class="text-sm font-medium text-foreground" for="password">Password</label>
          <a href="#" class="text-sm text-primary hover:underline">Forgot password?</a>
        </div>
        <input
          type="password"
          id="password"
          name="password"
          class="${inputClass}"
          placeholder="••••••••"
          autocomplete="current-password"
        >
        <p class="hidden text-xs text-destructive" id="passwordError"></p>
      </div>

      <!-- Submit -->
      <button
        type="submit"
        id="submitBtn"
        class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full"
      >
        Sign in
      </button>
    </form>

    <!-- Magic link (revealed only when email is configured)
         v0.1.79: two-state flow — "Send" button → code-entry form.
         The send creates BOTH a click-link AND a 6-digit code; the
         operator can either click the link in the email OR type
         the code here. -->
    <div id="magicLinkSection" hidden class="space-y-2">
      <div class="relative">
        <div class="absolute inset-0 flex items-center"><span class="w-full border-t"></span></div>
        <div class="relative flex justify-center text-xs uppercase">
          <span class="bg-card px-2 text-muted-foreground">or</span>
        </div>
      </div>

      <!-- State 1: send button -->
      <div id="magicLinkSendState">
        <button
          type="button"
          id="magicLinkBtn"
          class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 w-full"
        >
          Email me a sign-in code
        </button>
        <p id="magicLinkStatus" class="hidden text-center text-xs text-muted-foreground mt-2"></p>
      </div>

      <!-- State 2: code-entry form (revealed after send succeeds) -->
      <div id="magicLinkCodeState" hidden class="space-y-3">
        <p class="text-center text-xs text-muted-foreground" id="magicLinkSentMsg">
          We sent a sign-in code to your email.
        </p>
        <form id="magicCodeForm" class="space-y-2" novalidate>
          <label class="text-sm font-medium text-foreground" for="magicCode">Sign-in code</label>
          <input
            type="text"
            id="magicCode"
            name="magicCode"
            inputmode="numeric"
            pattern="\\d{6}"
            maxlength="6"
            autocomplete="one-time-code"
            class="${inputClass} text-center text-lg tracking-widest font-mono"
            placeholder="123456"
          >
          <p class="hidden text-xs text-destructive" id="magicCodeError"></p>
          <button
            type="submit"
            id="magicCodeSubmit"
            class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full"
          >
            Verify code
          </button>
        </form>
        <button
          type="button"
          id="magicLinkResendBtn"
          class="text-center text-xs text-muted-foreground hover:text-foreground underline w-full"
        >
          Use a different email or resend
        </button>
      </div>
    </div>

    <!-- Footer -->
    <p class="text-center text-xs text-muted-foreground">
      Don't have an account? <a href="#" class="text-primary hover:underline">Contact your admin</a>
    </p>
  </div>

  <script>
    const form = document.getElementById('loginForm');
    const submitBtn = document.getElementById('submitBtn');
    const errorMessage = document.getElementById('errorMessage');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const emailError = document.getElementById('emailError');
    const passwordError = document.getElementById('passwordError');

    const inputErrorClass = '${inputErrorClass}';

    // Reveal magic-link option only if email is configured & verified.
    // The endpoint is workspace-scoped, so this respects per-deployment
    // configuration without baking it into the HTML.
    (async () => {
      try {
        const r = await fetch('/_ensemble/auth/methods', { credentials: 'include' });
        if (!r.ok) return;
        const m = await r.json();
        if (m && m.magic_link) {
          document.getElementById('magicLinkSection').hidden = false;
        }
      } catch (_) {
        // Silently skip — magic link just stays hidden.
      }
    })();

    // v0.1.79: two-state magic-link flow.
    //   1) operator clicks "Email me a sign-in code"
    //   2) UI swaps to code-entry form with email-sent confirmation
    //   3) operator types the 6-digit code from the email → verify
    // The link in the email also works (one-shot, opens the workspace).
    const magicBtn = document.getElementById('magicLinkBtn');
    const magicStatus = document.getElementById('magicLinkStatus');
    const magicSendState = document.getElementById('magicLinkSendState');
    const magicCodeState = document.getElementById('magicLinkCodeState');
    const magicSentMsg = document.getElementById('magicLinkSentMsg');
    const magicCodeForm = document.getElementById('magicCodeForm');
    const magicCodeInput = document.getElementById('magicCode');
    const magicCodeError = document.getElementById('magicCodeError');
    const magicCodeSubmit = document.getElementById('magicCodeSubmit');
    const magicResendBtn = document.getElementById('magicLinkResendBtn');

    function maskEmail(email) {
      const [local, domain] = email.split('@');
      if (!domain || !local) return email;
      const visible = local.slice(0, 2);
      return visible + '***@' + domain;
    }

    async function sendMagicLink(email) {
      magicBtn.disabled = true;
      magicBtn.textContent = 'Sending...';
      try {
        await fetch('/_ensemble/auth/magic-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        // Generic success message regardless — don't leak email existence.
        magicSentMsg.textContent = 'If ' + maskEmail(email) + ' is registered, we sent a sign-in code. Check your inbox + spam folder.';
        magicSendState.hidden = true;
        magicCodeState.hidden = false;
        magicCodeInput.focus();
      } catch (_) {
        magicStatus.textContent = 'Could not send. Try again in a moment.';
        magicStatus.classList.remove('hidden');
      } finally {
        magicBtn.disabled = false;
        magicBtn.textContent = 'Email me a sign-in code';
      }
    }

    if (magicBtn) {
      magicBtn.addEventListener('click', () => {
        const email = emailInput.value.trim();
        if (!email) {
          showFieldError(emailInput, emailError, 'Enter your email first');
          return;
        }
        sendMagicLink(email);
      });
    }

    if (magicResendBtn) {
      magicResendBtn.addEventListener('click', () => {
        magicCodeState.hidden = true;
        magicSendState.hidden = false;
        magicCodeInput.value = '';
        magicCodeError.classList.add('hidden');
        emailInput.focus();
      });
    }

    if (magicCodeForm) {
      magicCodeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = (magicCodeInput.value || '').replace(/\\D/g, '');
        magicCodeError.classList.add('hidden');
        if (!/^\\d{6}$/.test(code)) {
          magicCodeError.textContent = 'Enter the 6-digit code from your email';
          magicCodeError.classList.remove('hidden');
          return;
        }
        magicCodeSubmit.disabled = true;
        magicCodeSubmit.textContent = 'Verifying...';
        try {
          const r = await fetch('/_ensemble/auth/magic-link/verify-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
          });
          if (r.ok) {
            window.location.href = '/';
            return;
          }
          const body = await r.json().catch(() => ({}));
          const reason = body && body.error;
          magicCodeError.textContent =
            reason === 'too_many_attempts' ? 'Too many attempts. Wait 5 minutes and try again.' :
            reason === 'invalid_code'      ? 'Code is invalid or expired. Request a new one.' :
                                             'Could not verify code. Try again.';
          magicCodeError.classList.remove('hidden');
        } finally {
          magicCodeSubmit.disabled = false;
          magicCodeSubmit.textContent = 'Verify code';
        }
      });
    }

    // Clear field error on input
    emailInput.addEventListener('input', () => {
      emailInput.classList.remove(...inputErrorClass.split(' '));
      emailError.classList.add('hidden');
    });
    passwordInput.addEventListener('input', () => {
      passwordInput.classList.remove(...inputErrorClass.split(' '));
      passwordError.classList.add('hidden');
    });

    function showFieldError(input, errorEl, message) {
      input.classList.add(...inputErrorClass.split(' '));
      errorEl.textContent = message;
      errorEl.classList.remove('hidden');
      input.focus();
    }

    function clearErrors() {
      errorMessage.classList.add('hidden');
      errorMessage.textContent = '';
      emailInput.classList.remove(...inputErrorClass.split(' '));
      passwordInput.classList.remove(...inputErrorClass.split(' '));
      emailError.classList.add('hidden');
      passwordError.classList.add('hidden');
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearErrors();

      const email = emailInput.value.trim();
      const password = passwordInput.value;

      // Custom validation
      if (!email) {
        showFieldError(emailInput, emailError, 'Email is required');
        return;
      }
      if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
        showFieldError(emailInput, emailError, 'Please enter a valid email address');
        return;
      }
      if (!password) {
        showFieldError(passwordInput, passwordError, 'Password is required');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in...';

      try {
        const response = await fetch('/_ensemble/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Login failed');
        }

        // Success — bounce to ?from= if present (set when an expired
        // session redirected here), otherwise home.
        const params = new URLSearchParams(window.location.search);
        const from = params.get('from');
        const dest = from && from.startsWith('/') && !from.startsWith('//')
          ? from
          : '/';
        window.location.href = dest;
      } catch (error) {
        errorMessage.textContent = error.message;
        errorMessage.classList.remove('hidden');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign in';
      }
    });
  </script>
</body>
</html>`;
}
/**
 * Escape HTML special characters.
 */
function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
//# sourceMappingURL=create-workspace.js.map