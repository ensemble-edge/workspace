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
export function workspaceResolver(config) {
    return createMiddleware(async (c, next) => {
        const host = c.req.header('Host') ?? '';
        const url = new URL(c.req.url);
        // Generate request ID for logging
        const requestId = crypto.randomUUID().slice(0, 8);
        c.set('requestId', requestId);
        let workspace = null;
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
            return c.json({
                error: 'workspace_not_found',
                message: 'Could not resolve workspace from request',
            }, 404);
        }
        // Attach workspace to context
        c.set('workspace', workspace);
        // Brand domain: set regardless of which strategy resolved the
        // workspace. If the request came in ON a brand domain, we know it
        // from that host; otherwise look up the workspace's primary brand
        // domain so canonical/hreflang still point at it (and the redirect
        // can fire) even when an admin views the page on the workspace host.
        try {
            const { workspaceIdForDomain, primaryDomainForWorkspace } = await import('../services/brand-domain.js');
            const onBrand = await workspaceIdForDomain(c.env, host);
            if (onBrand && onBrand.workspaceId === workspace.id) {
                c.set('brandDomain', { domain: normalizeHostForCtx(host), proto: onBrand.proto });
            }
            else {
                c.set('brandDomain', await primaryDomainForWorkspace(c.env, workspace.id));
            }
        }
        catch {
            c.set('brandDomain', null);
        }
        await next();
    });
}
/** Host-only, lowercased (mirror of the service's normalizeHost). */
function normalizeHostForCtx(host) {
    return host.split(':')[0].trim().toLowerCase();
}
/**
 * Resolve workspace from config (single workspace deployment).
 */
async function resolveFromConfig(db, config) {
    try {
        const result = await db
            .prepare('SELECT * FROM workspaces WHERE slug = ?')
            .bind(config.workspace.slug)
            .first();
        if (!result)
            return null;
        return {
            id: result.id,
            slug: result.slug,
            name: result.name,
            type: result.type,
            settings: JSON.parse(result.settings_json || '{}'),
            createdAt: result.created_at,
            updatedAt: result.updated_at,
        };
    }
    catch {
        // Database might not be initialized yet
        return null;
    }
}
/**
 * Resolve workspace by slug.
 */
async function resolveBySlug(db, slug) {
    try {
        const result = await db
            .prepare('SELECT * FROM workspaces WHERE slug = ?')
            .bind(slug.toLowerCase())
            .first();
        if (!result)
            return null;
        return {
            id: result.id,
            slug: result.slug,
            name: result.name,
            type: result.type,
            settings: JSON.parse(result.settings_json || '{}'),
            createdAt: result.created_at,
            updatedAt: result.updated_at,
        };
    }
    catch {
        return null;
    }
}
/**
 * Resolve workspace by custom domain.
 */
async function resolveByDomain(db, domain) {
    try {
        // Reverse lookup host → workspace_id via workspace_domains (PK hit,
        // cached per isolate), then load that workspace. See
        // services/brand-domain.ts.
        const { workspaceIdForDomain } = await import('../services/brand-domain.js');
        const match = await workspaceIdForDomain({ DB: db }, domain);
        if (!match)
            return null;
        const result = await db
            .prepare('SELECT * FROM workspaces WHERE id = ?')
            .bind(match.workspaceId)
            .first();
        if (!result)
            return null;
        return {
            id: result.id,
            slug: result.slug,
            name: result.name,
            type: result.type,
            settings: JSON.parse(result.settings_json || '{}'),
            createdAt: result.created_at,
            updatedAt: result.updated_at,
        };
    }
    catch {
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
function extractSubdomain(host) {
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
function createWorkspaceFromConfig(config) {
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
//# sourceMappingURL=workspace-resolver.js.map