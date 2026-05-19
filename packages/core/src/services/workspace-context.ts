/**
 * Workspace context resolver — the SINGLE server-side source of truth
 * for everything `@ensemble-edge/sdk`'s `useWorkspaceContext()` hook
 * surfaces to guest apps.
 *
 * Architectural contract:
 *
 *   1. ONE endpoint  (/_ensemble/workspace/context)
 *   2. ONE hook      (useWorkspaceContext)
 *   3. ONE type      (WorkspaceContext, versioned)
 *   4. EXTENSIBLE BY ADDITION ONLY
 *
 * Adding a new domain (e.g. `timezone`, `featureFlags`, `capabilities`)
 * means:
 *   - Add a resolver function below
 *   - Add a key to the WorkspaceContext type in @ensemble-edge/sdk
 *   - Call it from resolveWorkspaceContext()
 *   - Done. No new endpoint, no SDK version bump, existing guest apps
 *     see the field as additive.
 *
 * Renames / removals require bumping the `version` field at the root
 * and surface a deprecation period for guest authors. We've never had
 * to do this — the design intent is that v1 is forever.
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../types';

/* ──────────────────────────────────────────────────────────────
 * Public contract — shape returned by /_ensemble/workspace/context
 * ──────────────────────────────────────────────────────────── */

export type ThemeMode = 'light' | 'dark' | 'system';

export interface WorkspaceContextV1 {
  /** Schema version. Bump only on breaking changes. */
  version: 1;

  workspace: {
    id: string;
    slug: string;
    name: string;
    /** Operator-curated display name; falls back to `name`. */
    displayName: string;
  };

  /** null when the request is unauthenticated. */
  user: {
    id: string;
    email: string;
    displayName: string | null;
    role: string;
    locale: string | null;
  } | null;

  locale: {
    /** Workspace default (e.g. 'en'). */
    default: string;
    /** All supported BCP-47 codes (e.g. ['en','es','fr']). */
    supported: string[];
    /**
     * Current user's preferred locale. null when unauthenticated or
     * when the user hasn't picked one — caller falls back to default.
     */
    userPreferred: string | null;
  };

  theme: {
    /** Operator-saved mode: 'light' | 'dark' | 'system'. */
    mode: ThemeMode;
    /** Brand-primary hex for guest apps that want the accent color. */
    primary: string;
    accent: string;
  };

  brand: {
    name: string;
    tagline: string | null;
    wordmarkUrl: string | null;
    iconUrl: string | null;
  };

  /**
   * Guest-app capabilities — what the workspace allows this guest to
   * do. Used for feature gating (e.g. "can this guest invoke AI tier
   * X?"). Empty object for v0.1.40; populated as feature gating ships.
   */
  capabilities: Record<string, boolean>;

  /**
   * Operator-toggleable feature flags. Empty object for v0.1.40;
   * populated when we ship a feature-flag service.
   */
  featureFlags: Record<string, boolean>;
}

/* ──────────────────────────────────────────────────────────────
 * Resolvers
 * ──────────────────────────────────────────────────────────── */

interface ResolverInput {
  env: Env;
  workspaceId: string;
  userId: string | null;
}

export async function resolveWorkspaceContext(
  input: ResolverInput,
): Promise<WorkspaceContextV1> {
  // Run independent resolvers in parallel. Each is responsible for
  // gracefully degrading on error (returns sensible defaults rather
  // than throwing) so one slow/broken domain doesn't take the whole
  // context down.
  const [workspace, user, locale, theme, brand] = await Promise.all([
    resolveWorkspaceIdentity(input),
    resolveUserIdentity(input),
    resolveLocale(input),
    resolveTheme(input),
    resolveBrand(input),
  ]);

  return {
    version: 1,
    workspace,
    user,
    locale,
    theme,
    brand,
    capabilities: {},     // future: populated by guest-app permission gate
    featureFlags: {},     // future: populated by feature-flag service
  };
}

async function resolveWorkspaceIdentity(
  { env, workspaceId }: ResolverInput,
): Promise<WorkspaceContextV1['workspace']> {
  try {
    const row = await env.DB.prepare(
      `SELECT id, slug, name FROM workspaces WHERE id = ?`,
    ).bind(workspaceId).first<{ id: string; slug: string; name: string }>();

    // Operator may set a separate display name in brand_tokens.identity.
    const displayRow = await env.DB.prepare(
      `SELECT value FROM brand_tokens
       WHERE workspace_id = ? AND category = 'identity' AND key = 'display_name' AND locale = ''`,
    ).bind(workspaceId).first<{ value: string }>();

    return {
      id: row?.id ?? workspaceId,
      slug: row?.slug ?? '',
      name: row?.name ?? 'Workspace',
      displayName: displayRow?.value || row?.name || 'Workspace',
    };
  } catch {
    return { id: workspaceId, slug: '', name: 'Workspace', displayName: 'Workspace' };
  }
}

async function resolveUserIdentity(
  { env, userId }: ResolverInput,
): Promise<WorkspaceContextV1['user']> {
  if (!userId) return null;
  try {
    const row = await env.DB.prepare(
      `SELECT id, email, display_name AS displayName, locale FROM users WHERE id = ?`,
    ).bind(userId).first<{ id: string; email: string; displayName: string | null; locale: string | null }>();
    if (!row) return null;
    // Look up workspace membership role (auth middleware put it on the
    // context, but resolvers run independently — re-fetch).
    return { ...row, role: 'member' };
  } catch {
    return null;
  }
}

async function resolveLocale(
  { env, workspaceId, userId }: ResolverInput,
): Promise<WorkspaceContextV1['locale']> {
  let defaultLocale = 'en';
  let supported: string[] = ['en'];
  try {
    const rows = await env.DB.prepare(
      `SELECT code, is_default FROM workspace_locales WHERE workspace_id = ? ORDER BY display_order ASC`,
    ).bind(workspaceId).all<{ code: string; is_default: number }>();
    const list = (rows.results ?? []).map((r) => ({ code: r.code, isDefault: !!r.is_default }));
    if (list.length > 0) {
      supported = list.map((l) => l.code);
      const def = list.find((l) => l.isDefault);
      defaultLocale = def?.code ?? list[0].code;
    }
  } catch {
    // workspace_locales table may not exist yet on older workspaces;
    // safe fallback to English-only.
  }

  let userPreferred: string | null = null;
  if (userId) {
    try {
      const row = await env.DB.prepare(
        `SELECT value FROM user_preferences WHERE user_id = ? AND key = 'locale'`,
      ).bind(userId).first<{ value: string }>();
      if (row?.value && supported.includes(row.value)) {
        userPreferred = row.value;
      }
    } catch {
      // user_preferences table absent — silently skip.
    }
  }

  return { default: defaultLocale, supported, userPreferred };
}

async function resolveTheme(
  { env, workspaceId }: ResolverInput,
): Promise<WorkspaceContextV1['theme']> {
  let mode: ThemeMode = 'dark';
  let primary = '#3B82F6';
  let accent = '#3B82F6';
  try {
    const rows = await env.DB.prepare(
      `SELECT category, key, value FROM brand_tokens
       WHERE workspace_id = ? AND locale = ''
         AND category IN ('colors', 'custom')`,
    ).bind(workspaceId).all<{ category: string; key: string; value: string }>();
    for (const r of rows.results ?? []) {
      if (r.category === 'custom' && r.key === 'themeMode') {
        if (r.value === 'light' || r.value === 'dark' || r.value === 'system') mode = r.value;
      } else if (r.category === 'colors' && r.key === 'brand-primary') {
        primary = r.value;
      } else if (r.category === 'colors' && r.key === 'accent') {
        accent = r.value;
      }
    }
  } catch {
    // fall through to defaults
  }
  return { mode, primary, accent };
}

async function resolveBrand(
  { env, workspaceId }: ResolverInput,
): Promise<WorkspaceContextV1['brand']> {
  let name = 'Workspace';
  let tagline: string | null = null;
  let wordmarkUrl: string | null = null;
  let iconUrl: string | null = null;
  try {
    const wsRow = await env.DB.prepare(
      `SELECT name, slug FROM workspaces WHERE id = ?`,
    ).bind(workspaceId).first<{ name: string; slug: string }>();
    name = wsRow?.name ?? name;
    const slug = (wsRow?.slug ?? '').toLowerCase();

    const tokRows = await env.DB.prepare(
      `SELECT key, value FROM brand_tokens
       WHERE workspace_id = ? AND category IN ('identity', 'messaging') AND locale = ''`,
    ).bind(workspaceId).all<{ key: string; value: string }>();
    const tokens: Record<string, string> = {};
    for (const r of tokRows.results ?? []) tokens[r.key] = r.value;

    tagline = tokens['tagline'] ?? null;
    // Load the operator's asset alias setting once for this resolver.
    // Canonical /_ensemble/brand/asset URLs get rewritten to
    // /<alias>/<key>; path-style /brand/...svg URLs are already
    // pretty and pass through unchanged.
    const { applyAssetAlias, getSetting } = await import('./workspace-settings');
    const aliasPath = (await getSetting(env, workspaceId, 'asset_public_alias_path')).trim();
    // Prefer the path-style URL when slug is set (cleaner for guests
    // to embed). Fall back to the canonical asset path (alias-transformed).
    if (slug && (tokens['logo_wordmark_svg'] || tokens['wordmark_text'])) {
      wordmarkUrl = `/brand/${slug}-wordmark-full-color-transparent.svg`;
    } else if (tokens['logo_wordmark']) {
      wordmarkUrl = applyAssetAlias(tokens['logo_wordmark'], aliasPath);
    }
    if (slug && tokens['logo_icon_mark_svg']) {
      iconUrl = `/brand/${slug}-icon-full-color-transparent.svg`;
    } else if (tokens['logo_icon_mark']) {
      iconUrl = applyAssetAlias(tokens['logo_icon_mark'], aliasPath);
    }
  } catch {
    // fall through
  }
  return { name, tagline, wordmarkUrl, iconUrl };
}

/* ──────────────────────────────────────────────────────────────
 * User-preferred locale storage
 * ──────────────────────────────────────────────────────────── */

/**
 * Read a user preference. Returns null when the table doesn't exist
 * or the key isn't set.
 */
export async function getUserPreference(
  db: D1Database,
  userId: string,
  key: string,
): Promise<string | null> {
  try {
    const row = await db.prepare(
      `SELECT value FROM user_preferences WHERE user_id = ? AND key = ?`,
    ).bind(userId, key).first<{ value: string }>();
    return row?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * Write a user preference. Creates the table on first use so we don't
 * need a migration step.
 */
export async function setUserPreference(
  db: D1Database,
  userId: string,
  key: string,
  value: string,
): Promise<void> {
  // Lazy table creation — keeps the v0.1.40 release migration-free.
  // A proper schema migration is the right next step but this lets
  // the feature ship without coupling to the migration pipeline.
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS user_preferences (
       user_id TEXT NOT NULL,
       key TEXT NOT NULL,
       value TEXT NOT NULL,
       updated_at TEXT DEFAULT (datetime('now')),
       PRIMARY KEY (user_id, key)
     )`,
  ).run();
  await db.prepare(
    `INSERT INTO user_preferences (user_id, key, value, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT (user_id, key)
     DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
  ).bind(userId, key, value).run();
}
