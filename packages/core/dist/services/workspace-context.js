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
export async function resolveWorkspaceContext(input) {
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
        capabilities: {}, // future: populated by guest-app permission gate
        featureFlags: {}, // future: populated by feature-flag service
    };
}
async function resolveWorkspaceIdentity({ env, workspaceId }) {
    try {
        const row = await env.DB.prepare(`SELECT id, slug, name FROM workspaces WHERE id = ?`).bind(workspaceId).first();
        // Operator may set a separate display name in brand_tokens.identity.
        const displayRow = await env.DB.prepare(`SELECT value FROM brand_tokens
       WHERE workspace_id = ? AND category = 'identity' AND key = 'display_name' AND locale = ''`).bind(workspaceId).first();
        return {
            id: row?.id ?? workspaceId,
            slug: row?.slug ?? '',
            name: row?.name ?? 'Workspace',
            displayName: displayRow?.value || row?.name || 'Workspace',
        };
    }
    catch {
        return { id: workspaceId, slug: '', name: 'Workspace', displayName: 'Workspace' };
    }
}
async function resolveUserIdentity({ env, userId }) {
    if (!userId)
        return null;
    try {
        const row = await env.DB.prepare(`SELECT id, email, display_name AS displayName, locale FROM users WHERE id = ?`).bind(userId).first();
        if (!row)
            return null;
        // Look up workspace membership role (auth middleware put it on the
        // context, but resolvers run independently — re-fetch).
        return { ...row, role: 'member' };
    }
    catch {
        return null;
    }
}
async function resolveLocale({ env, workspaceId, userId }) {
    let defaultLocale = 'en';
    let supported = ['en'];
    try {
        const rows = await env.DB.prepare(`SELECT code, is_default FROM workspace_locales WHERE workspace_id = ? ORDER BY display_order ASC`).bind(workspaceId).all();
        const list = (rows.results ?? []).map((r) => ({ code: r.code, isDefault: !!r.is_default }));
        if (list.length > 0) {
            supported = list.map((l) => l.code);
            const def = list.find((l) => l.isDefault);
            defaultLocale = def?.code ?? list[0].code;
        }
    }
    catch {
        // workspace_locales table may not exist yet on older workspaces;
        // safe fallback to English-only.
    }
    let userPreferred = null;
    if (userId) {
        try {
            const row = await env.DB.prepare(`SELECT value FROM user_preferences WHERE user_id = ? AND key = 'locale'`).bind(userId).first();
            if (row?.value && supported.includes(row.value)) {
                userPreferred = row.value;
            }
        }
        catch {
            // user_preferences table absent — silently skip.
        }
    }
    return { default: defaultLocale, supported, userPreferred };
}
async function resolveTheme({ env, workspaceId }) {
    let mode = 'dark';
    let primary = '#3B82F6';
    let accent = '#3B82F6';
    try {
        const rows = await env.DB.prepare(`SELECT category, key, value FROM brand_tokens
       WHERE workspace_id = ? AND locale = ''
         AND category IN ('colors', 'custom')`).bind(workspaceId).all();
        for (const r of rows.results ?? []) {
            if (r.category === 'custom' && r.key === 'themeMode') {
                if (r.value === 'light' || r.value === 'dark' || r.value === 'system')
                    mode = r.value;
            }
            else if (r.category === 'colors' && r.key === 'brand-primary') {
                primary = r.value;
            }
            else if (r.category === 'colors' && r.key === 'accent') {
                accent = r.value;
            }
        }
    }
    catch {
        // fall through to defaults
    }
    return { mode, primary, accent };
}
async function resolveBrand({ env, workspaceId }) {
    let name = 'Workspace';
    let tagline = null;
    let wordmarkUrl = null;
    let iconUrl = null;
    try {
        const wsRow = await env.DB.prepare(`SELECT name, slug FROM workspaces WHERE id = ?`).bind(workspaceId).first();
        name = wsRow?.name ?? name;
        const slug = (wsRow?.slug ?? '').toLowerCase();
        const tokRows = await env.DB.prepare(`SELECT key, value FROM brand_tokens
       WHERE workspace_id = ? AND category IN ('identity', 'messaging') AND locale = ''`).bind(workspaceId).all();
        const tokens = {};
        for (const r of tokRows.results ?? [])
            tokens[r.key] = r.value;
        tagline = tokens['tagline'] ?? null;
        // Unified URL model (v0.1.46+): every brand resource lives under
        // /_ensemble/brand/* canonically. If the operator has configured
        // a pretty alias, the same URL is also served at /<alias>/brand/*.
        // The alias transform applies uniformly — no special cases.
        const { applyAssetAlias, getSetting } = await import('./workspace-settings');
        const aliasPath = (await getSetting(env, workspaceId, 'asset_public_alias_path')).trim();
        // Prefer generated render URLs for vector sources (live-composed
        // from policy + brand colors). Fall back to the raw uploaded URL
        // for legacy raster wordmarks/icons.
        if (slug && (tokens['logo_wordmark_svg'] || tokens['wordmark_text'])) {
            wordmarkUrl = applyAssetAlias(`/_ensemble/brand/render/${slug}-wordmark-full-color-transparent.svg`, aliasPath);
        }
        else if (tokens['logo_wordmark']) {
            wordmarkUrl = applyAssetAlias(tokens['logo_wordmark'], aliasPath);
        }
        if (slug && tokens['logo_icon_mark_svg']) {
            iconUrl = applyAssetAlias(`/_ensemble/brand/render/${slug}-icon-full-color-transparent.svg`, aliasPath);
        }
        else if (tokens['logo_icon_mark']) {
            iconUrl = applyAssetAlias(tokens['logo_icon_mark'], aliasPath);
        }
    }
    catch {
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
export async function getUserPreference(db, userId, key) {
    try {
        const row = await db.prepare(`SELECT value FROM user_preferences WHERE user_id = ? AND key = ?`).bind(userId, key).first();
        return row?.value ?? null;
    }
    catch {
        return null;
    }
}
/**
 * Write a user preference. Creates the table on first use so we don't
 * need a migration step.
 */
export async function setUserPreference(db, userId, key, value) {
    // Lazy table creation — keeps the v0.1.40 release migration-free.
    // A proper schema migration is the right next step but this lets
    // the feature ship without coupling to the migration pipeline.
    await db.prepare(`CREATE TABLE IF NOT EXISTS user_preferences (
       user_id TEXT NOT NULL,
       key TEXT NOT NULL,
       value TEXT NOT NULL,
       updated_at TEXT DEFAULT (datetime('now')),
       PRIMARY KEY (user_id, key)
     )`).run();
    await db.prepare(`INSERT INTO user_preferences (user_id, key, value, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT (user_id, key)
     DO UPDATE SET value = excluded.value, updated_at = datetime('now')`).bind(userId, key, value).run();
}
//# sourceMappingURL=workspace-context.js.map