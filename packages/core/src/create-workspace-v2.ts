/**
 * createWorkspace v2 — Mode-Aware Factory Function
 *
 * Creates an Ensemble Workspace instance that supports both deployment modes:
 *
 * **Standalone Mode**: Worker handles everything
 * - Shell serving from bundled assets
 * - JWT-based auth with cookies
 * - Session management
 * - Bootstrap flow for first user
 *
 * **Cloud Mode**: Ensemble proxy handles shell + auth
 * - No shell serving (proxy handles it)
 * - User info from X-Ensemble-* headers
 * - No local auth routes
 * - Pure JSON API
 *
 * @example
 * ```ts
 * import { createWorkspace, defineConfig } from '@ensemble-edge/core';
 *
 * // Standalone mode
 * export default createWorkspace(defineConfig({
 *   mode: 'standalone',
 *   workspace: { name: 'Acme', slug: 'acme' },
 *   auth: {
 *     providers: ['email'],
 *     session: { secret: env.JWT_SECRET },
 *   },
 * }));
 *
 * // Cloud mode
 * export default createWorkspace(defineConfig({
 *   mode: 'cloud',
 *   workspace: { name: 'Acme', slug: 'acme' },
 *   proxySecret: env.ENSEMBLE_PROXY_SECRET,
 * }));
 * ```
 */

import { Hono } from 'hono';
import type { Env, ContextVariables, ResolvedConfig } from './types';
import type {
  ResolvedStandaloneConfig,
  ResolvedCloudConfig,
  ResolvedModeConfig,
} from './mode/define-config';
import {
  cors,
  workspaceResolver,
  bootstrapCheck,
  createCloudAuthMiddleware,
} from './middleware';
import { runMigrations, migrations } from './db';
import { createAuthRoutes, createBootstrapRoutes } from './routes';
import { registerCoreApps } from './apps';
import { generateBrandCss } from './apps/core/brand/css';

/**
 * Convert the new mode-aware config to the legacy ResolvedConfig format.
 * This maintains compatibility with existing middleware.
 */
function toLegacyConfig(config: ResolvedModeConfig): ResolvedConfig {
  const authProviders = config.mode === 'standalone'
    ? config.auth.providers.filter(
        (p): p is 'email' | 'google' | 'github' | 'microsoft' | 'saml' =>
          ['email', 'google', 'github', 'microsoft', 'saml'].includes(p)
      )
    : ['email' as const]; // Default for cloud mode

  return {
    workspace: config.workspace,
    brand: config.brand,
    locale: config.locale,
    cors: config.cors,
    auth: {
      providers: authProviders,
    },
  };
}

// Shell assets are built by @ensemble-edge/shell and exported as strings.
// In cloud mode, these may not exist (shell served from R2 by proxy).
let SHELL_JS = '';
let SHELL_CSS = '';
try {
  const assets = await import('@ensemble-edge/shell/assets');
  SHELL_JS = assets.SHELL_JS;
  SHELL_CSS = assets.SHELL_CSS;
} catch {
  // Shell assets not available - cloud mode only
}

/**
 * Cloudflare Worker instance returned by createWorkspace.
 */
export interface WorkspaceInstance {
  fetch: (
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ) => Response | Promise<Response>;
}

/**
 * Create a new Ensemble Workspace instance.
 *
 * @param config - Resolved workspace configuration (use defineConfig to create)
 * @returns Cloudflare Worker instance
 */
export function createWorkspaceV2(
  config: ResolvedModeConfig
): WorkspaceInstance {
  if (config.mode === 'standalone') {
    return createStandaloneWorkspace(config);
  }
  return createCloudWorkspace(config);
}

// ============================================================================
// Standalone Mode Implementation
// ============================================================================

function createStandaloneWorkspace(
  config: ResolvedStandaloneConfig
): WorkspaceInstance {
  const app = new Hono<{
    Bindings: Env;
    Variables: ContextVariables;
  }>();

  // ============================================================================
  // Middleware Pipeline (Standalone)
  // ============================================================================

  // 1. CORS headers
  app.use('*', cors({
    additionalOrigins: config.cors.brandOrigins,
  }));

  // 2. Run migrations on first request (checks for new migrations each cold start)
  let migrationsChecked = false;
  app.use('*', async (c, next) => {
    if (!migrationsChecked) {
      migrationsChecked = true;
      await runMigrations(c.env.DB, migrations);
    }
    await next();
  });

  // 3. Bootstrap check - redirect to setup if no users exist
  app.use('*', bootstrapCheck());

  // 4. Resolve workspace from hostname/path
  app.use('*', workspaceResolver(toLegacyConfig(config)));

  // ============================================================================
  // Health Check
  // ============================================================================

  app.get('/health', (c) => {
    return c.json({
      status: 'ok',
      mode: 'standalone',
      workspace: c.get('workspace')?.slug,
      timestamp: new Date().toISOString(),
    });
  });

  // ============================================================================
  // Shell Routes (Standalone serves its own shell)
  // ============================================================================

  if (config.serveShell) {
    // Shell HTML (SPA entry point)
    app.get('/', (c) => {
      const workspace = c.get('workspace');
      return c.html(generateShellHtml(
        workspace?.name ?? config.workspace.name,
        config.brand.accent
      ));
    });

    // Login page
    app.get('/login', (c) => {
      const workspace = c.get('workspace');
      return c.html(generateLoginHtml(
        workspace?.name ?? config.workspace.name,
        config.brand.accent
      ));
    });

    // Shell assets
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
  }

  // ============================================================================
  // API Routes (/_ensemble/*)
  // ============================================================================

  // Bootstrap routes (only works when zero users)
  app.route('/_ensemble/bootstrap', createBootstrapRoutes(toLegacyConfig(config)));

  // Auth routes (login, logout, register, refresh, me)
  app.route('/_ensemble/auth', createAuthRoutes());

  // Core App API Routes (/_ensemble/core/*)
  registerCoreApps(app);

  // Brand endpoints
  mountBrandRoutes(app, config);

  // Workspace info
  app.get('/_ensemble/workspace', (c) => {
    const workspace = c.get('workspace');
    return c.json({
      id: workspace?.id,
      slug: workspace?.slug,
      name: workspace?.name,
      type: workspace?.type,
      mode: 'standalone',
    });
  });

  // ============================================================================
  // Catch-all for SPA routing (Standalone)
  // ============================================================================

  if (config.serveShell) {
    app.get('*', (c) => {
      const workspace = c.get('workspace');
      return c.html(generateShellHtml(
        workspace?.name ?? config.workspace.name,
        config.brand.accent
      ));
    });
  }

  return { fetch: app.fetch };
}

// ============================================================================
// Cloud Mode Implementation
// ============================================================================

function createCloudWorkspace(
  config: ResolvedCloudConfig
): WorkspaceInstance {
  const app = new Hono<{
    Bindings: Env;
    Variables: ContextVariables;
  }>();

  // ============================================================================
  // Middleware Pipeline (Cloud)
  // ============================================================================

  // 1. CORS headers
  app.use('*', cors({
    additionalOrigins: config.cors.brandOrigins,
  }));

  // 2. Run migrations on first request (checks for new migrations each cold start)
  let cloudMigrationsChecked = false;
  app.use('*', async (c, next) => {
    if (!cloudMigrationsChecked) {
      cloudMigrationsChecked = true;
      await runMigrations(c.env.DB, migrations);
    }
    await next();
  });

  // 3. Resolve workspace from hostname/path
  app.use('*', workspaceResolver(toLegacyConfig(config)));

  // 4. Cloud auth - extract user from Ensemble proxy headers
  app.use('/_ensemble/*', createCloudAuthMiddleware(config));

  // ============================================================================
  // Health Check
  // ============================================================================

  app.get('/health', (c) => {
    return c.json({
      status: 'ok',
      mode: 'cloud',
      workspace: c.get('workspace')?.slug,
      timestamp: new Date().toISOString(),
    });
  });

  // ============================================================================
  // Cloud Mode: No Shell Routes
  // Shell is served by Ensemble proxy from R2/KV
  // ============================================================================

  // Return 404 for shell routes in cloud mode
  app.get('/', (c) => {
    return c.json({
      error: 'Not found',
      message: 'Shell is served by Ensemble proxy in cloud mode',
      mode: 'cloud',
    }, 404);
  });

  app.get('/login', (c) => {
    return c.json({
      error: 'Not found',
      message: 'Login is handled by Ensemble proxy in cloud mode',
      mode: 'cloud',
    }, 404);
  });

  // ============================================================================
  // API Routes (/_ensemble/*)
  // ============================================================================

  // No bootstrap routes in cloud mode - handled by Ensemble

  // No auth routes in cloud mode - handled by proxy
  // But we do expose /me endpoint for the shell to get current user
  app.get('/_ensemble/auth/me', (c) => {
    const user = c.get('user');
    const membership = c.get('membership');

    if (!user) {
      return c.json({ error: 'Not authenticated' }, 401);
    }

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        handle: user.handle,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        locale: user.locale,
      },
      membership: membership ? {
        workspaceId: membership.workspaceId,
        role: membership.role,
      } : null,
    });
  });

  // Core App API Routes (/_ensemble/core/*)
  registerCoreApps(app);

  // Brand endpoints
  mountBrandRoutes(app, config);

  // Workspace info
  app.get('/_ensemble/workspace', (c) => {
    const workspace = c.get('workspace');
    return c.json({
      id: workspace?.id,
      slug: workspace?.slug,
      name: workspace?.name,
      type: workspace?.type,
      mode: 'cloud',
    });
  });

  return { fetch: app.fetch };
}

// ============================================================================
// Shared Route Mounting
// ============================================================================

function mountBrandRoutes(
  app: Hono<{ Bindings: Env; Variables: ContextVariables }>,
  config: ResolvedModeConfig
): void {
  // GET /_ensemble/brand/theme - JSON theme
  app.get('/_ensemble/brand/theme', async (c) => {
    let accent = config.brand.accent;
    let canvas = '#BDB7B0';

    try {
      const workspaceId = c.get('workspace')?.id || '';

      const accentResult = await c.env.DB.prepare(
        `SELECT value FROM brand_tokens
         WHERE workspace_id = ? AND category = 'colors' AND key = 'accent' AND locale = ''`
      ).bind(workspaceId).first<{ value: string }>();
      if (accentResult?.value) accent = accentResult.value;

      const canvasResult = await c.env.DB.prepare(
        `SELECT value FROM brand_tokens
         WHERE workspace_id = ? AND category = 'colors' AND key = 'canvas' AND locale = ''`
      ).bind(workspaceId).first<{ value: string }>();
      if (canvasResult?.value) canvas = canvasResult.value;
    } catch {
      // Use defaults
    }

    return c.json({
      colors: {
        accent,
        accentHover: `color-mix(in srgb, ${accent} 85%, white)`,
        accentDim: `color-mix(in srgb, ${accent} 20%, transparent)`,
        canvas,
        card: '#1e1e22',
        cardHover: '#252529',
        cardBorder: 'rgba(255, 255, 255, 0.06)',
        sidebarBg: '#141316',
        sidebarHover: '#1c1b1f',
        sidebarActive: '#252429',
        textPrimary: '#f0ede8',
        textSecondary: '#9a938a',
        textTertiary: '#6b655c',
        error: '#f87171',
        success: '#4ade80',
        warning: '#fbbf24',
        info: '#60a5fa',
      },
      typography: {
        headingFont: 'DM Sans',
        bodyFont: 'DM Sans',
        monoFont: 'JetBrains Mono',
        labelTracking: '0.12em',
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
        name: config.workspace.name,
        logoUrl: null,
        faviconUrl: null,
      },
    });
  });

  // GET /_ensemble/brand/css - CSS variables (loads ALL tokens including workspace-ui)
  app.get('/_ensemble/brand/css', async (c) => {
    const workspaceId = c.get('workspace')?.id || '';
    const css = await generateBrandCss(c.env.DB, workspaceId, config.brand.accent);

    return c.text(css, 200, {
      'Content-Type': 'text/css',
      'Cache-Control': 'public, max-age=300',
    });
  });

  // PUT /_ensemble/brand/tokens - Save brand tokens
  app.put('/_ensemble/brand/tokens', async (c) => {
    try {
      const workspace = c.get('workspace');
      if (!workspace?.id) {
        return c.json({ error: 'Workspace not found' }, 400);
      }

      const body = await c.req.json<{
        category: string;
        tokens: Record<string, string>;
      }>();

      if (!body.category || !body.tokens) {
        return c.json({ error: 'Category and tokens are required' }, 400);
      }

      // Infer token type from category
      const typeMap: Record<string, string> = {
        colors: 'color', typography: 'font', spatial: 'text',
        identity: 'text', messaging: 'text', custom: 'text',
      };
      const tokenType = typeMap[body.category] || 'text';

      for (const [key, value] of Object.entries(body.tokens)) {
        await c.env.DB.prepare(
          `INSERT INTO brand_tokens (workspace_id, category, key, value, type, locale, updated_at)
           VALUES (?, ?, ?, ?, ?, '', datetime('now'))
           ON CONFLICT (workspace_id, category, key, locale)
           DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
        ).bind(workspace.id, body.category, key, value, tokenType).run();
      }

      return c.json({ success: true });
    } catch (error) {
      console.error('Failed to save brand tokens:', error);
      return c.json({ error: 'Failed to save brand settings' }, 500);
    }
  });
}

// ============================================================================
// HTML Generation (Standalone mode only)
// ============================================================================

function generateShellHtml(workspaceName: string, accentColor: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="${accentColor}">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <title>${workspaceName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/_ensemble/brand/css">
  <link rel="stylesheet" href="/_ensemble/shell/shell.css">
  <style>
    :root {
      --color-accent: ${accentColor};
      --color-accent-hover: color-mix(in srgb, ${accentColor} 85%, white);
      --color-accent-dim: color-mix(in srgb, ${accentColor} 20%, transparent);
      --canvas: #BDB7B0;
      --card: #1e1e22;
      --card-hover: #252529;
      --card-border: rgba(255, 255, 255, 0.06);
      --sidebar-bg: #141316;
      --text-primary: #f0ede8;
      --text-secondary: #9a938a;
      --text-tertiary: #6b655c;
      --radius: 12px;
      --radius-sm: 8px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      font-family: 'DM Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--canvas);
      color: var(--text-primary);
      overflow: hidden;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    #app { min-height: 100vh; min-height: 100dvh; }
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
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div id="app">
    <div class="shell-loading">
      <div class="shell-loading__spinner"></div>
      <div>Loading ${workspaceName}...</div>
    </div>
  </div>
  <script type="module" src="/_ensemble/shell/shell.js"></script>
</body>
</html>`;
}

function generateLoginHtml(workspaceName: string, accentColor: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login — ${workspaceName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --canvas: #BDB7B0;
      --card: #1e1e22;
      --card-hover: #252529;
      --card-border: rgba(255, 255, 255, 0.06);
      --text-primary: #f0ede8;
      --text-secondary: #9a938a;
      --text-tertiary: #6b655c;
      --accent: ${accentColor};
      --accent-hover: color-mix(in srgb, ${accentColor} 85%, white);
      --accent-dim: color-mix(in srgb, ${accentColor} 20%, transparent);
      --error: #f87171;
      --radius: 12px;
      --radius-sm: 8px;
      --font-body: 'DM Sans', system-ui, sans-serif;
      --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.35);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--font-body);
      background: var(--canvas);
      color: var(--text-primary);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      -webkit-font-smoothing: antialiased;
    }
    .login-card {
      background: var(--card);
      border: 1px solid var(--card-border);
      border-radius: var(--radius);
      padding: 40px;
      width: 100%;
      max-width: 400px;
      box-shadow: var(--shadow-lg);
    }
    .login-logo { font-size: 20px; font-weight: 700; text-align: center; margin-bottom: 8px; }
    .login-subtitle { font-size: 14px; color: var(--text-secondary); text-align: center; margin-bottom: 32px; }
    .login-form { display: flex; flex-direction: column; gap: 20px; }
    .form-group { display: flex; flex-direction: column; gap: 8px; }
    .form-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: var(--text-tertiary); }
    .form-input {
      padding: 12px 14px;
      border: 1px solid var(--card-border);
      border-radius: var(--radius-sm);
      background: var(--canvas);
      color: var(--text-primary);
      font-family: var(--font-body);
      font-size: 14px;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .form-input::placeholder { color: var(--text-tertiary); }
    .form-input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-dim); }
    .login-btn {
      padding: 14px;
      background: var(--accent);
      color: white;
      border: none;
      border-radius: var(--radius-sm);
      font-family: var(--font-body);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s, transform 0.1s;
      margin-top: 8px;
    }
    .login-btn:hover:not(:disabled) { background: var(--accent-hover); transform: translateY(-1px); }
    .login-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .error-message {
      background: rgba(248, 113, 113, 0.1);
      border: 1px solid rgba(248, 113, 113, 0.2);
      border-radius: var(--radius-sm);
      padding: 12px 14px;
      color: var(--error);
      font-size: 13px;
      display: none;
    }
    .error-message.visible { display: block; }
  </style>
</head>
<body>
  <div class="login-card">
    <div class="login-logo">${workspaceName}</div>
    <div class="login-subtitle">Sign in to your workspace</div>
    <div class="error-message" id="errorMessage"></div>
    <form class="login-form" id="loginForm">
      <div class="form-group">
        <label class="form-label" for="email">Email</label>
        <input class="form-input" type="email" id="email" name="email" placeholder="you@example.com" required autocomplete="email">
      </div>
      <div class="form-group">
        <label class="form-label" for="password">Password</label>
        <input class="form-input" type="password" id="password" name="password" placeholder="••••••••" required autocomplete="current-password">
      </div>
      <button class="login-btn" type="submit" id="submitBtn">Sign in</button>
    </form>
  </div>
  <script>
    const form = document.getElementById('loginForm');
    const submitBtn = document.getElementById('submitBtn');
    const errorMessage = document.getElementById('errorMessage');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      errorMessage.classList.remove('visible');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing in...';
      try {
        const response = await fetch('/_ensemble/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Login failed');
        window.location.href = '/';
      } catch (error) {
        errorMessage.textContent = error.message;
        errorMessage.classList.add('visible');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign in';
      }
    });
  </script>
</body>
</html>`;
}
