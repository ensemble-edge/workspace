/**
 * Workspace locales service.
 *
 * Operators declare which content locales the workspace supports.
 * English is always enabled and always present after first read —
 * lazily seeded if missing. Exactly one locale is the default at any
 * time; promoting another demotes the previous default atomically.
 *
 * BCP-47 codes are stored case-preserving so 'fr-CA' stays 'fr-CA'
 * (not 'fr-ca') for correct Accept-Language negotiation downstream.
 */
/**
 * Validate a BCP-47 tag. Accepts the common shapes we care about:
 *   en | es-419 | zh-Hans-CN | fr-CA
 * Rejects garbage. The regex is permissive enough to allow real-world
 * codes without becoming a full BCP-47 parser.
 */
const BCP47_RE = /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-([A-Z]{2}|\d{3}))?$/;
export function isValidLocaleCode(code) {
    return BCP47_RE.test(code);
}
/**
 * Lazy seed: ensure English exists and is default if no locale rows
 * are present yet. Idempotent. Called from every list/get path so a
 * fresh workspace immediately has a sensible baseline without a
 * migration-time seed (which can't know workspace_id).
 */
async function seedIfEmpty(env, workspaceId) {
    const row = await env.DB.prepare(`SELECT 1 FROM workspace_locales WHERE workspace_id = ? LIMIT 1`)
        .bind(workspaceId)
        .first();
    if (row)
        return;
    await env.DB.prepare(`INSERT INTO workspace_locales (workspace_id, code, display_name, is_default, enabled)
     VALUES (?, 'en', 'English', 1, 1)`)
        .bind(workspaceId)
        .run();
}
export async function listLocales(env, workspaceId) {
    await seedIfEmpty(env, workspaceId);
    const result = await env.DB.prepare(`SELECT code, display_name, is_default, enabled, created_at
       FROM workspace_locales
      WHERE workspace_id = ?
      ORDER BY is_default DESC, created_at ASC`)
        .bind(workspaceId)
        .all();
    return (result.results ?? []).map(rowToLocale);
}
export async function getDefaultLocale(env, workspaceId) {
    await seedIfEmpty(env, workspaceId);
    const row = await env.DB.prepare(`SELECT code FROM workspace_locales
      WHERE workspace_id = ? AND is_default = 1 LIMIT 1`)
        .bind(workspaceId)
        .first();
    return row?.code ?? 'en';
}
export async function addLocale(env, workspaceId, input) {
    if (!isValidLocaleCode(input.code)) {
        throw new Error(`Invalid BCP-47 code: "${input.code}". Examples: en, es, fr-CA, zh-Hans-CN.`);
    }
    await seedIfEmpty(env, workspaceId);
    await env.DB.prepare(`INSERT INTO workspace_locales (workspace_id, code, display_name, is_default, enabled)
     VALUES (?, ?, ?, 0, 1)
     ON CONFLICT(workspace_id, code) DO UPDATE
       SET display_name = excluded.display_name, enabled = 1`)
        .bind(workspaceId, input.code, input.display_name)
        .run();
    const row = await env.DB.prepare(`SELECT code, display_name, is_default, enabled, created_at
       FROM workspace_locales WHERE workspace_id = ? AND code = ?`)
        .bind(workspaceId, input.code)
        .first();
    if (!row)
        throw new Error('Failed to read back added locale');
    return rowToLocale(row);
}
export async function patchLocale(env, workspaceId, code, patch) {
    const fields = [];
    const values = [];
    if (patch.display_name !== undefined) {
        fields.push('display_name = ?');
        values.push(patch.display_name);
    }
    if (patch.enabled !== undefined) {
        // Disabling the default is forbidden — promote another first.
        if (!patch.enabled) {
            const row = await env.DB.prepare(`SELECT is_default FROM workspace_locales WHERE workspace_id = ? AND code = ?`)
                .bind(workspaceId, code)
                .first();
            if (row?.is_default === 1) {
                throw new Error(`Cannot disable the default locale "${code}". Promote another locale first.`);
            }
        }
        fields.push('enabled = ?');
        values.push(patch.enabled ? 1 : 0);
    }
    if (fields.length === 0)
        return;
    values.push(workspaceId, code);
    await env.DB.prepare(`UPDATE workspace_locales SET ${fields.join(', ')} WHERE workspace_id = ? AND code = ?`)
        .bind(...values)
        .run();
}
/**
 * Promote `code` to default. Demotes the previous default atomically.
 * Enables the locale as a side effect if it was disabled (you can't
 * have a disabled default).
 */
export async function setDefaultLocale(env, workspaceId, code) {
    await seedIfEmpty(env, workspaceId);
    const exists = await env.DB.prepare(`SELECT 1 FROM workspace_locales WHERE workspace_id = ? AND code = ?`)
        .bind(workspaceId, code)
        .first();
    if (!exists) {
        throw new Error(`Locale "${code}" is not enabled in this workspace.`);
    }
    await env.DB.batch([
        env.DB.prepare(`UPDATE workspace_locales SET is_default = 0 WHERE workspace_id = ?`).bind(workspaceId),
        env.DB.prepare(`UPDATE workspace_locales
          SET is_default = 1, enabled = 1
        WHERE workspace_id = ? AND code = ?`).bind(workspaceId, code),
    ]);
}
export async function removeLocale(env, workspaceId, code) {
    if (code === 'en') {
        throw new Error('English is required and cannot be removed.');
    }
    await seedIfEmpty(env, workspaceId);
    const row = await env.DB.prepare(`SELECT is_default FROM workspace_locales WHERE workspace_id = ? AND code = ?`)
        .bind(workspaceId, code)
        .first();
    if (!row)
        return;
    if (row.is_default === 1) {
        throw new Error(`Cannot remove the default locale "${code}". Promote another locale first.`);
    }
    // Hard-delete any brand_tokens rows tagged with this locale before
    // removing the locale itself. The strong-warning confirm in the UI
    // tells the operator this is going to happen and how many rows are
    // affected (via countLocalizedBrandTokens below).
    await env.DB.batch([
        env.DB.prepare(`DELETE FROM brand_tokens WHERE workspace_id = ? AND locale = ?`).bind(workspaceId, code),
        env.DB.prepare(`DELETE FROM workspace_locales WHERE workspace_id = ? AND code = ?`).bind(workspaceId, code),
    ]);
}
/**
 * Count how many brand_tokens rows are tagged with this locale, so the
 * UI can show the operator exactly what they're about to delete in the
 * remove-locale confirm dialog. Returns 0 when the locale has no
 * localized content.
 */
export async function countLocalizedBrandTokens(env, workspaceId, code) {
    const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM brand_tokens WHERE workspace_id = ? AND locale = ?`)
        .bind(workspaceId, code)
        .first();
    return Number(row?.n ?? 0);
}
function rowToLocale(row) {
    return {
        code: row.code,
        display_name: row.display_name,
        is_default: row.is_default === 1,
        enabled: row.enabled === 1,
        created_at: row.created_at,
    };
}
//# sourceMappingURL=locales.js.map