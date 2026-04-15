/**
 * Bootstrap Routes
 *
 * One-time setup flow for creating the first workspace owner.
 * Only accessible when the users table has zero rows.
 *
 * Routes:
 * - GET  /_ensemble/bootstrap - Setup form
 * - POST /_ensemble/bootstrap - Create workspace + owner
 */

import { Hono } from 'hono';
import type { Env, ContextVariables, ResolvedConfig } from '../types';
import { hashPassword, validatePassword } from '../utils/password';
import {
  setAccessTokenCookie,
  setRefreshTokenCookie,
  getCookieOptionsForEnv,
} from '../utils/cookies';
import { signAccessToken, signRefreshToken, getJwtSecret } from '../utils/jwt';
import { markBootstrapComplete } from '../middleware/bootstrap';

/**
 * Bootstrap form data.
 */
interface BootstrapFormData {
  workspaceName: string;
  displayName: string;
  email: string;
  handle: string;
  password: string;
  confirmPassword: string;
}

/**
 * Validation result.
 */
interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

/**
 * Generate a unique ID.
 */
function generateId(prefix: string = ''): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const id = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return prefix ? `${prefix}_${id}` : id;
}

/**
 * Validate handle format.
 */
function validateHandle(handle: string): boolean {
  // 3-30 chars, lowercase alphanumeric + hyphens, no leading/trailing hyphens
  const pattern = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
  return pattern.test(handle) || (handle.length === 3 && /^[a-z0-9]{3}$/.test(handle));
}

/**
 * Validate email format.
 */
function validateEmail(email: string): boolean {
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern.test(email);
}

/**
 * Validate bootstrap form data.
 */
function validateForm(data: BootstrapFormData): ValidationResult {
  const errors: Record<string, string> = {};

  // Workspace name
  if (!data.workspaceName || data.workspaceName.trim().length < 2) {
    errors.workspaceName = 'Workspace name must be at least 2 characters';
  } else if (data.workspaceName.trim().length > 64) {
    errors.workspaceName = 'Workspace name must be 64 characters or less';
  }

  // Display name
  if (!data.displayName || data.displayName.trim().length < 2) {
    errors.displayName = 'Name must be at least 2 characters';
  } else if (data.displayName.trim().length > 100) {
    errors.displayName = 'Name must be 100 characters or less';
  }

  // Email
  if (!data.email || !validateEmail(data.email)) {
    errors.email = 'Please enter a valid email address';
  }

  // Handle
  if (!data.handle) {
    errors.handle = 'Handle is required';
  } else if (!validateHandle(data.handle.toLowerCase())) {
    errors.handle = 'Handle must be 3-30 characters, lowercase letters, numbers, and hyphens only';
  }

  // Password
  const passwordValidation = validatePassword(data.password);
  if (!passwordValidation.valid) {
    errors.password = passwordValidation.error || 'Invalid password';
  }

  // Confirm password
  if (data.password !== data.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Create bootstrap routes.
 *
 * @param config - Resolved workspace config (for default brand values)
 * @returns Hono router
 */
export function createBootstrapRoutes(config: ResolvedConfig) {
  const bootstrap = new Hono<{
    Bindings: Env;
    Variables: ContextVariables;
  }>();

  /**
   * GET /_ensemble/bootstrap
   *
   * Show the setup form. Only works when zero users exist.
   */
  bootstrap.get('/', async (c) => {
    // Check if bootstrap is still needed
    const result = await c.env.DB
      .prepare('SELECT COUNT(*) as count FROM users')
      .first<{ count: number }>();

    if (result && result.count > 0) {
      // Already bootstrapped - return 404
      return c.notFound();
    }

    return c.html(generateBootstrapHtml(config, {}));
  });

  /**
   * POST /_ensemble/bootstrap
   *
   * Create workspace, owner user, membership, and default data.
   * All in a single transaction.
   */
  bootstrap.post('/', async (c) => {
    // Check if bootstrap is still needed
    const countResult = await c.env.DB
      .prepare('SELECT COUNT(*) as count FROM users')
      .first<{ count: number }>();

    if (countResult && countResult.count > 0) {
      // Already bootstrapped - return 404
      return c.notFound();
    }

    // Parse form data
    const contentType = c.req.header('Content-Type') || '';
    let formData: BootstrapFormData;

    if (contentType.includes('application/json')) {
      formData = await c.req.json();
    } else {
      const form = await c.req.formData();
      formData = {
        workspaceName: form.get('workspaceName')?.toString() || '',
        displayName: form.get('displayName')?.toString() || '',
        email: form.get('email')?.toString() || '',
        handle: form.get('handle')?.toString() || '',
        password: form.get('password')?.toString() || '',
        confirmPassword: form.get('confirmPassword')?.toString() || '',
      };
    }

    // Validate
    const validation = validateForm(formData);
    if (!validation.valid) {
      // Return form with errors
      if (contentType.includes('application/json')) {
        return c.json({ errors: validation.errors }, 400);
      }
      return c.html(generateBootstrapHtml(config, validation.errors, formData), 400);
    }

    // Generate IDs
    const workspaceId = generateId('ws');
    const userId = generateId('user');
    const sessionId = generateId('sess');

    // Hash password
    const passwordHash = await hashPassword(formData.password);

    // Normalize data
    const email = formData.email.toLowerCase().trim();
    const handle = formData.handle.toLowerCase().trim();
    const displayName = formData.displayName.trim();
    const workspaceName = formData.workspaceName.trim();

    try {
      // Execute all inserts in a batch (D1 transaction)
      const now = new Date().toISOString();

      await c.env.DB.batch([
        // Create workspace
        c.env.DB.prepare(
          `INSERT INTO workspaces (id, slug, name, type, settings_json, created_at, updated_at)
           VALUES (?, ?, ?, 'organization', '{}', ?, ?)`
        ).bind(workspaceId, config.workspace.slug, workspaceName, now, now),

        // Create user
        c.env.DB.prepare(
          `INSERT INTO users (id, email, password_hash, handle, display_name, locale, created_at)
           VALUES (?, ?, ?, ?, ?, 'en', ?)`
        ).bind(userId, email, passwordHash, handle, displayName, now),

        // Create membership (owner role)
        c.env.DB.prepare(
          `INSERT INTO memberships (user_id, workspace_id, role, created_at)
           VALUES (?, ?, 'owner', ?)`
        ).bind(userId, workspaceId, now),

        // Seed default brand tokens
        c.env.DB.prepare(
          `INSERT INTO brand_tokens (workspace_id, category, key, value, type, label, updated_at)
           VALUES (?, 'colors', 'accent', ?, 'color', 'Accent', ?)`
        ).bind(workspaceId, config.brand.accent, now),

        c.env.DB.prepare(
          `INSERT INTO brand_tokens (workspace_id, category, key, value, type, label, updated_at)
           VALUES (?, 'colors', 'primary', '#1a1a2e', 'color', 'Primary', ?)`
        ).bind(workspaceId, now),

        c.env.DB.prepare(
          `INSERT INTO brand_tokens (workspace_id, category, key, value, type, label, updated_at)
           VALUES (?, 'colors', 'surface', '#ffffff', 'color', 'Surface', ?)`
        ).bind(workspaceId, now),

        c.env.DB.prepare(
          `INSERT INTO brand_tokens (workspace_id, category, key, value, type, label, updated_at)
           VALUES (?, 'colors', 'background', '#fafafa', 'color', 'Background', ?)`
        ).bind(workspaceId, now),

        c.env.DB.prepare(
          `INSERT INTO brand_tokens (workspace_id, category, key, value, type, label, updated_at)
           VALUES (?, 'identity', 'display_name', ?, 'text', 'Display Name', ?)`
        ).bind(workspaceId, workspaceName, now),

        // Seed default nav config
        c.env.DB.prepare(
          `INSERT INTO nav_config (workspace_id, config_json, updated_at)
           VALUES (?, ?, ?)`
        ).bind(workspaceId, JSON.stringify(getDefaultNavConfig()), now),

        // Create audit log entry
        c.env.DB.prepare(
          `INSERT INTO audit_log (id, workspace_id, actor_id, actor_handle, action, resource_type, resource_id, details_json, created_at)
           VALUES (?, ?, ?, ?, 'workspace.bootstrapped', 'workspace', ?, '{}', ?)`
        ).bind(generateId('audit'), workspaceId, userId, handle, workspaceId, now),
      ]);

      // Mark bootstrap complete in KV
      await markBootstrapComplete(c.env.KV);

      // Generate tokens (use dev fallback if JWT_SECRET not set)
      const jwtSecret = getJwtSecret(c.env.JWT_SECRET, c.env.ENVIRONMENT);

      const accessToken = await signAccessToken(
        {
          userId,
          email,
          handle,
          workspaceId,
          role: 'owner',
        },
        jwtSecret
      );

      const refreshToken = await signRefreshToken(sessionId, jwtSecret);

      // Store session
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const tokenHash = await hashSessionToken(refreshToken);

      await c.env.DB.prepare(
        `INSERT INTO sessions (id, user_id, workspace_id, token_hash, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(sessionId, userId, workspaceId, tokenHash, expiresAt, now).run();

      // Set cookies
      const cookieOptions = getCookieOptionsForEnv(c.env.ENVIRONMENT, c.req.url);
      c.header('Set-Cookie', setAccessTokenCookie(accessToken, cookieOptions), { append: true });
      c.header('Set-Cookie', setRefreshTokenCookie(refreshToken, cookieOptions), { append: true });

      // Redirect to home (JSON response for API requests)
      if (contentType.includes('application/json')) {
        return c.json({
          success: true,
          workspace: { id: workspaceId, slug: config.workspace.slug, name: workspaceName },
          user: { id: userId, email, handle, displayName },
        });
      }

      return c.redirect('/');
    } catch (error) {
      console.error('Bootstrap failed:', error);

      const errorMessage = error instanceof Error ? error.message : 'Setup failed';

      if (contentType.includes('application/json')) {
        return c.json({ error: errorMessage }, 500);
      }

      return c.html(
        generateBootstrapHtml(config, { form: errorMessage }, formData),
        500
      );
    }
  });

  return bootstrap;
}

/**
 * Hash session token for storage.
 */
async function hashSessionToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Get default navigation config.
 */
function getDefaultNavConfig() {
  // Icon names reference Lucide icons (see 01-style.md spec)
  return {
    sections: [
      {
        id: 'apps',
        label: 'Apps',
        items: [
          { id: 'home', label: 'Home', icon: 'home', path: '/' },
        ],
      },
      {
        id: 'workspace',
        label: 'Workspace',
        items: [
          { id: 'people', label: 'People', icon: 'users', path: '/people' },
          { id: 'brand', label: 'Brand', icon: 'palette', path: '/brand' },
          { id: 'settings', label: 'Settings', icon: 'settings', path: '/settings' },
        ],
      },
    ],
  };
}

/**
 * Generate bootstrap setup HTML.
 *
 * Static HTML form, no JavaScript framework.
 * Uses Ensemble's default neutral theme (no brand yet).
 */
function generateBootstrapHtml(
  config: ResolvedConfig,
  errors: Record<string, string>,
  values?: Partial<BootstrapFormData>
): string {
  const errorHtml = (field: string) => {
    if (errors[field]) {
      return `<p class="text-sm text-destructive mt-1">${escapeHtml(errors[field])}</p>`;
    }
    return '';
  };

  const inputClass = (field: string) => {
    const base = 'flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
    return errors[field] ? `${base} border-destructive` : `${base} border-input`;
  };

  // Pure Tailwind/shadcn utility classes
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="${config.brand.accent}">
  <title>Set up your workspace</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/_ensemble/shell/shell.css">
</head>
<body class="min-h-svh flex items-center justify-center p-4 bg-muted">
  <div class="w-full max-w-sm bg-card rounded-lg shadow-lg p-6 space-y-6">
    <!-- Logo -->
    <div class="flex items-center gap-2 justify-center">
      <span class="text-2xl text-primary">◆</span>
      <span class="text-xl font-semibold text-foreground">Ensemble</span>
    </div>

    <!-- Title -->
    <h1 class="text-center text-lg font-medium text-foreground">Set up your workspace</h1>

    ${errors.form ? `<div class="text-sm text-destructive bg-destructive/10 p-3 rounded-md">${escapeHtml(errors.form)}</div>` : ''}

    <form class="space-y-4" method="POST" action="/_ensemble/bootstrap">
      <!-- Workspace Name -->
      <div class="space-y-2">
        <label class="text-sm font-medium text-foreground" for="workspaceName">Workspace name</label>
        <input
          type="text"
          id="workspaceName"
          name="workspaceName"
          class="${inputClass('workspaceName')}"
          value="${escapeHtml(values?.workspaceName || config.workspace.name)}"
          required
          autocomplete="organization"
        >
        ${errorHtml('workspaceName')}
      </div>

      <div class="border-t border-border my-4"></div>

      <!-- Your Name -->
      <div class="space-y-2">
        <label class="text-sm font-medium text-foreground" for="displayName">Your name</label>
        <input
          type="text"
          id="displayName"
          name="displayName"
          class="${inputClass('displayName')}"
          value="${escapeHtml(values?.displayName || '')}"
          required
          autocomplete="name"
        >
        ${errorHtml('displayName')}
      </div>

      <!-- Email -->
      <div class="space-y-2">
        <label class="text-sm font-medium text-foreground" for="email">Email</label>
        <input
          type="email"
          id="email"
          name="email"
          class="${inputClass('email')}"
          value="${escapeHtml(values?.email || '')}"
          required
          autocomplete="email"
        >
        ${errorHtml('email')}
      </div>

      <!-- Handle -->
      <div class="space-y-2">
        <label class="text-sm font-medium text-foreground" for="handle">Handle</label>
        <div class="flex items-center">
          <span class="text-sm text-muted-foreground mr-1">@</span>
          <input
            type="text"
            id="handle"
            name="handle"
            class="${inputClass('handle')}"
            value="${escapeHtml(values?.handle || '')}"
            required
            autocomplete="username"
            pattern="[a-z0-9][a-z0-9-]{1,28}[a-z0-9]"
          >
        </div>
        ${errorHtml('handle')}
        <p class="text-xs text-muted-foreground">3-30 characters, lowercase letters, numbers, and hyphens</p>
      </div>

      <!-- Password Row -->
      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-2">
          <label class="text-sm font-medium text-foreground" for="password">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            class="${inputClass('password')}"
            required
            autocomplete="new-password"
            minlength="8"
          >
          ${errorHtml('password')}
          <p class="text-xs text-muted-foreground">At least 8 characters</p>
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium text-foreground" for="confirmPassword">Confirm</label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            class="${inputClass('confirmPassword')}"
            required
            autocomplete="new-password"
          >
          ${errorHtml('confirmPassword')}
        </div>
      </div>

      <!-- Submit -->
      <button
        type="submit"
        class="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full"
      >
        Create workspace
      </button>
    </form>

    <!-- Footer -->
    <p class="text-center text-xs text-muted-foreground">
      This creates the owner account.<br>
      You can invite team members after setup.
    </p>
  </div>
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
