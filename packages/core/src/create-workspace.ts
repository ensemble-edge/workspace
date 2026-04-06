/**
 * createWorkspace — Main Factory Function
 *
 * Creates an Ensemble Workspace instance that can be deployed as a
 * Cloudflare Worker. Wires up middleware, routes, and the shell.
 *
 * @example
 * ```ts
 * // worker.ts
 * import { createWorkspace } from '@ensemble-edge/core';
 *
 * export default createWorkspace({
 *   workspace: { name: 'Acme', slug: 'acme' },
 *   brand: { accent: '#3B82F6' },
 * });
 * ```
 */

import { Hono } from 'hono';
import type {
  Env,
  ContextVariables,
  WorkspaceConfig,
  ResolvedConfig,
} from './types';
import { cors, workspaceResolver, bootstrapCheck, auth } from './middleware';
import { runMigrations, hasMigrations, migrations } from './db';
import { createAuthRoutes, createBootstrapRoutes, createGuestGatewayRoutes } from './routes';
import { SHELL_JS, SHELL_CSS } from './shell/assets.generated';

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
 */
export function createWorkspace(config: WorkspaceConfig): WorkspaceInstance {
  // Resolve config with defaults
  const resolvedConfig = resolveConfig(config);

  // Create Hono app with typed bindings
  const app = new Hono<{
    Bindings: Env;
    Variables: ContextVariables;
  }>();

  // ============================================================================
  // Middleware Pipeline
  // ============================================================================

  // 1. CORS headers for API routes
  app.use('*', cors({
    additionalOrigins: resolvedConfig.cors.brandOrigins,
  }));

  // 2. Run migrations on first request (if needed)
  app.use('*', async (c, next) => {
    const hasRun = await hasMigrations(c.env.DB);
    if (!hasRun) {
      console.log('Running initial migrations...');
      await runMigrations(c.env.DB, migrations);
    }
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
  app.get('/', (c) => {
    const workspace = c.get('workspace');
    return c.html(generateShellHtml(
      workspace?.name ?? resolvedConfig.workspace.name,
      resolvedConfig.brand.accent
    ));
  });

  // Login page
  app.get('/login', (c) => {
    const workspace = c.get('workspace');
    return c.html(generateLoginHtml(
      workspace?.name ?? resolvedConfig.workspace.name,
      resolvedConfig.brand.accent
    ));
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

  // Brand endpoints (public, no auth)
  // Hauser Design System: warm canvas + floating dark cards
  app.get('/_ensemble/brand/theme', async (c) => {
    // Try to load custom accent from brand_tokens table
    let accent = resolvedConfig.brand.accent;
    try {
      const result = await c.env.DB.prepare(
        `SELECT value FROM brand_tokens
         WHERE workspace_id = ? AND category = 'colors' AND key = 'accent' AND locale = ''`
      ).bind(c.get('workspace')?.id || '').first<{ value: string }>();
      if (result?.value) {
        accent = result.value;
      }
    } catch {
      // Use default if DB query fails
    }

    // Load canvas color from DB (if saved)
    let canvas = '#BDB7B0'; // Default: light warm beige (Hauser)
    try {
      const canvasResult = await c.env.DB.prepare(
        `SELECT value FROM brand_tokens
         WHERE workspace_id = ? AND category = 'colors' AND key = 'canvas' AND locale = ''`
      ).bind(c.get('workspace')?.id || '').first<{ value: string }>();
      if (canvasResult?.value) {
        canvas = canvasResult.value;
      }
    } catch {
      // Use default if DB query fails
    }

    // Hauser design tokens: warm canvas with floating dark cards
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
        labelTracking: '0.12em', // Hauser section labels
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

    // Try to load custom accent from brand_tokens table
    let accent = resolvedConfig.brand.accent;
    let canvas = '#BDB7B0'; // Default: light warm beige (Hauser)

    try {
      // Load accent
      const accentResult = await c.env.DB.prepare(
        `SELECT value FROM brand_tokens
         WHERE workspace_id = ? AND category = 'colors' AND key = 'accent' AND locale = ''`
      ).bind(workspaceId).first<{ value: string }>();
      if (accentResult?.value) {
        accent = accentResult.value;
      }

      // Load canvas
      const canvasResult = await c.env.DB.prepare(
        `SELECT value FROM brand_tokens
         WHERE workspace_id = ? AND category = 'colors' AND key = 'canvas' AND locale = ''`
      ).bind(workspaceId).first<{ value: string }>();
      if (canvasResult?.value) {
        canvas = canvasResult.value;
      }
    } catch {
      // Use defaults if DB query fails
    }

    // Hauser CSS custom properties
    const css = `
:root {
  /* Accent color (configurable) */
  --color-accent: ${accent};
  --color-accent-hover: color-mix(in srgb, ${accent} 85%, white);
  --color-accent-dim: color-mix(in srgb, ${accent} 20%, transparent);

  /* Warm canvas background (light beige by default, user-configurable) */
  --canvas: ${canvas};

  /* Floating dark card surfaces */
  --card: #1e1e22;
  --card-hover: #252529;
  --card-border: rgba(255, 255, 255, 0.06);

  /* Always-dark chrome */
  --sidebar-bg: #141316;
  --sidebar-hover: #1c1b1f;
  --sidebar-active: #252429;

  /* Typography colors (warm whites) */
  --text-primary: #f0ede8;
  --text-secondary: #9a938a;
  --text-tertiary: #6b655c;

  /* Semantic colors */
  --color-error: #f87171;
  --color-success: #4ade80;
  --color-warning: #fbbf24;
  --color-info: #60a5fa;

  /* Typography */
  --font-heading: 'DM Sans', system-ui, sans-serif;
  --font-body: 'DM Sans', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --letter-spacing-label: 0.12em;

  /* Spatial */
  --radius: 12px;
  --radius-sm: 8px;
  --radius-lg: 16px;

  /* Shadows */
  --shadow-card: 0 4px 24px rgba(0, 0, 0, 0.25);
  --shadow-card-lg: 0 8px 32px rgba(0, 0, 0, 0.35);
  --shadow-dropdown: 0 12px 40px rgba(0, 0, 0, 0.45);
}
    `.trim();

    return c.text(css, 200, {
      'Content-Type': 'text/css',
      'Cache-Control': 'public, max-age=300',
    });
  });

  // PUT endpoint to save brand tokens
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

      // Upsert each token (locale defaults to '' for non-localized tokens)
      for (const [key, value] of Object.entries(body.tokens)) {
        await c.env.DB.prepare(
          `INSERT INTO brand_tokens (workspace_id, category, key, value, type, locale, updated_at)
           VALUES (?, ?, ?, ?, 'color', '', datetime('now'))
           ON CONFLICT (workspace_id, category, key, locale)
           DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
        ).bind(workspace.id, body.category, key, value).run();
      }

      return c.json({ success: true });
    } catch (error) {
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
    let installedApps: Array<{ id: string; name: string; icon: string; category: string }> = [];
    if (workspace?.id) {
      try {
        const result = await c.env.DB.prepare(
          `SELECT id, name, icon, category FROM guest_apps
           WHERE workspace_id = ? AND enabled = 1
           ORDER BY name`
        ).bind(workspace.id).all<{ id: string; name: string; icon: string; category: string }>();
        installedApps = result.results || [];
      } catch {
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
  // Catch-all for SPA routing
  // ============================================================================

  app.get('*', (c) => {
    // Return shell HTML for client-side routing
    const workspace = c.get('workspace');
    return c.html(generateShellHtml(
      workspace?.name ?? resolvedConfig.workspace.name,
      resolvedConfig.brand.accent
    ));
  });

  return {
    fetch: app.fetch,
  };
}

/**
 * Resolve config with defaults.
 */
function resolveConfig(config: WorkspaceConfig): ResolvedConfig {
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
    /* Critical CSS for initial load - Hauser design tokens */
    /* Note: Canvas uses light warm beige default; /_ensemble/brand/css will override with saved value */
    :root {
      /* Accent (configurable) */
      --color-accent: ${accentColor};
      --color-accent-hover: color-mix(in srgb, ${accentColor} 85%, white);
      --color-accent-dim: color-mix(in srgb, ${accentColor} 20%, transparent);

      /* Warm canvas background (light beige - Hauser style) */
      --canvas: #BDB7B0;

      /* Floating dark card surfaces */
      --card: #1e1e22;
      --card-hover: #252529;
      --card-border: rgba(255, 255, 255, 0.06);

      /* Always-dark chrome */
      --sidebar-bg: #141316;

      /* Typography (warm whites) */
      --text-primary: #f0ede8;
      --text-secondary: #9a938a;
      --text-tertiary: #6b655c;

      /* Spatial */
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
function generateLoginHtml(workspaceName: string, accentColor: string): string {
  const inputClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="${accentColor}">
  <title>Login — ${workspaceName}</title>
  <link rel="stylesheet" href="/_ensemble/shell/shell.css">
</head>
<body class="min-h-svh flex items-center justify-center p-4 bg-muted">
  <div class="w-full max-w-sm bg-card rounded-lg shadow-lg border p-6 space-y-6">
    <!-- Logo -->
    <div class="flex items-center gap-2 justify-center">
      <span class="text-2xl text-primary">◆</span>
      <span class="text-xl font-semibold text-foreground">${escapeHtml(workspaceName)}</span>
    </div>

    <!-- Title -->
    <div class="text-center space-y-1">
      <h1 class="text-lg font-medium text-foreground">Welcome back</h1>
      <p class="text-sm text-muted-foreground">Sign in to your workspace</p>
    </div>

    <!-- Error Message -->
    <div class="hidden text-sm text-destructive bg-destructive/10 p-3 rounded-md" id="errorMessage"></div>

    <form class="space-y-4" id="loginForm">
      <!-- Email -->
      <div class="space-y-2">
        <label class="text-sm font-medium text-foreground" for="email">Email</label>
        <input
          type="email"
          id="email"
          name="email"
          class="${inputClass}"
          placeholder="you@example.com"
          required
          autocomplete="email"
        >
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
          required
          autocomplete="current-password"
        >
      </div>

      <!-- Submit -->
      <button
        type="submit"
        id="submitBtn"
        class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full"
      >
        Sign in
      </button>
    </form>

    <!-- Footer -->
    <p class="text-center text-xs text-muted-foreground">
      Don't have an account? <a href="#" class="text-primary hover:underline">Contact your admin</a>
    </p>
  </div>

  <script>
    const form = document.getElementById('loginForm');
    const submitBtn = document.getElementById('submitBtn');
    const errorMessage = document.getElementById('errorMessage');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;

      // Clear previous errors
      errorMessage.classList.add('hidden');
      errorMessage.textContent = '';
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

        // Success - redirect to home
        window.location.href = '/';
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
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Re-export config type (WorkspaceInstance is already exported above)
export type { WorkspaceConfig } from './types';
