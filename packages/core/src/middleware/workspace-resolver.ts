/**
 * Workspace Resolver Middleware
 *
 * Resolves the current workspace from the request hostname or path.
 * Supports multiple resolution strategies:
 * 1. Subdomain: acme.ensemble.ai → workspace "acme"
 * 2. Custom domain: hub.acme.com → lookup in workspaces table
 * 3. Path prefix: /w/acme/... → workspace "acme"
 * 4. Config-based: Single workspace from ensemble.config.ts
 */

import { createMiddleware } from 'hono/factory';
import type { Env, ContextVariables, Workspace, ResolvedConfig } from '../types';

/**
 * Known Ensemble domains (for subdomain resolution).
 */
const ENSEMBLE_DOMAINS = [
  'ensemble.ai',
  'ensemble.dev', // For development
];

/**
 * Create workspace resolver middleware.
 *
 * @param config - Resolved workspace config (from ensemble.config.ts)
 * @returns Hono middleware
 */
export function workspaceResolver(config: ResolvedConfig) {
  return createMiddleware<{
    Bindings: Env;
    Variables: ContextVariables;
  }>(async (c, next) => {
    const host = c.req.header('Host') ?? '';
    const url = new URL(c.req.url);

    // Generate request ID for logging
    const requestId = crypto.randomUUID().slice(0, 8);
    c.set('requestId', requestId);

    let workspace: Workspace | null = null;

    // Strategy 1: Config-based (single workspace deployment)
    // This is the most common case for self-hosted workspaces
    if (config.workspace.slug) {
      workspace = await resolveFromConfig(c.env.DB, config);
    }

    // Strategy 2: Subdomain resolution (*.ensemble.ai)
    if (!workspace) {
      const subdomain = extractSubdomain(host);
      if (subdomain) {
        workspace = await resolveBySlug(c.env.DB, subdomain);
      }
    }

    // Strategy 3: Custom domain lookup
    if (!workspace) {
      workspace = await resolveByDomain(c.env.DB, host);
    }

    // Strategy 4: Path prefix (/w/:slug/...)
    if (!workspace && url.pathname.startsWith('/w/')) {
      const pathSlug = url.pathname.split('/')[2];
      if (pathSlug) {
        workspace = await resolveBySlug(c.env.DB, pathSlug);
      }
    }

    // If still no workspace, check if we should create one from config
    if (!workspace && config.workspace.slug) {
      // First request - workspace doesn't exist in DB yet
      // This will be handled by the seed script or auto-creation
      workspace = createWorkspaceFromConfig(config);
    }

    if (!workspace) {
      return c.json(
        {
          error: 'workspace_not_found',
          message: 'Could not resolve workspace from request',
        },
        404
      );
    }

    // Attach workspace to context
    c.set('workspace', workspace);

    await next();
  });
}

/**
 * Resolve workspace from config (single workspace deployment).
 */
async function resolveFromConfig(
  db: D1Database,
  config: ResolvedConfig
): Promise<Workspace | null> {
  try {
    const result = await db
      .prepare('SELECT * FROM workspaces WHERE slug = ?')
      .bind(config.workspace.slug)
      .first<{
        id: string;
        slug: string;
        name: string;
        type: string;
        settings_json: string;
        created_at: string;
        updated_at: string;
      }>();

    if (!result) return null;

    return {
      id: result.id,
      slug: result.slug,
      name: result.name,
      type: result.type as Workspace['type'],
      settings: JSON.parse(result.settings_json || '{}'),
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    };
  } catch {
    // Database might not be initialized yet
    return null;
  }
}

/**
 * Resolve workspace by slug.
 */
async function resolveBySlug(
  db: D1Database,
  slug: string
): Promise<Workspace | null> {
  try {
    const result = await db
      .prepare('SELECT * FROM workspaces WHERE slug = ?')
      .bind(slug.toLowerCase())
      .first<{
        id: string;
        slug: string;
        name: string;
        type: string;
        settings_json: string;
        created_at: string;
        updated_at: string;
      }>();

    if (!result) return null;

    return {
      id: result.id,
      slug: result.slug,
      name: result.name,
      type: result.type as Workspace['type'],
      settings: JSON.parse(result.settings_json || '{}'),
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    };
  } catch {
    return null;
  }
}

/**
 * Resolve workspace by custom domain.
 */
async function resolveByDomain(
  db: D1Database,
  domain: string
): Promise<Workspace | null> {
  try {
    // Look up domain in workspace_domains table (future feature)
    // For now, return null
    return null;
  } catch {
    return null;
  }
}

/**
 * Extract subdomain from host.
 * Examples:
 * - acme.ensemble.ai → "acme"
 * - workspace.nendo.ai → null (not an Ensemble domain)
 * - ensemble.ai → null (no subdomain)
 */
function extractSubdomain(host: string): string | null {
  // Remove port if present
  const hostname = host.split(':')[0];

  for (const domain of ENSEMBLE_DOMAINS) {
    if (hostname.endsWith(`.${domain}`)) {
      const subdomain = hostname.slice(0, -(domain.length + 1));
      // Ignore common subdomains
      if (!['www', 'app', 'api', 'status', 'docs'].includes(subdomain)) {
        return subdomain;
      }
    }
  }

  return null;
}

/**
 * Create workspace object from config (for first-run before DB is seeded).
 */
function createWorkspaceFromConfig(config: ResolvedConfig): Workspace {
  return {
    id: `ws_${config.workspace.slug}`,
    slug: config.workspace.slug,
    name: config.workspace.name,
    type: config.workspace.type,
    settings: {
      defaultLocale: config.locale.baseLanguage,
      supportedLocales: config.locale.supportedLanguages,
      timezone: config.locale.timezone,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
