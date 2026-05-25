/**
 * Workspace credentials service.
 *
 * Reads and writes workspace-scoped key/value pairs from the
 * workspace_credentials table (migration 006). Secrets are AES-GCM
 * encrypted at rest using a key derived from env.JWT_SECRET via HKDF
 * (see utils/derive-key.ts).
 *
 * Naming convention: keys are snake_case with a category prefix in
 * their meaning (not their string). The category is stored as a
 * column so the UI can render per-category sections.
 *
 * The functions here NEVER return secret values to anonymous callers.
 * Route handlers gate decryption behind admin-role checks.
 */
import { encryptString, decryptString } from '../utils/derive-key.js';
/**
 * Fetch a credential's decrypted value. For secrets, this performs
 * decryption — only call from admin-authorized code paths or from
 * server-side subsystems that need the value (email sender, AI proxy).
 *
 * Returns null if the key isn't set.
 */
export async function getCredential(env, workspaceId, key) {
    const row = await env.DB.prepare(`SELECT key, category, is_secret, value_encrypted, value_plain, updated_at, updated_by
       FROM workspace_credentials
      WHERE workspace_id = ? AND key = ?`).bind(workspaceId, key).first();
    if (!row)
        return null;
    if (row.is_secret) {
        if (!row.value_encrypted)
            return null;
        return decryptString(env.JWT_SECRET, 'ensemble:credentials:v1', row.value_encrypted);
    }
    return row.value_plain ?? null;
}
/**
 * Upsert a credential. Encrypts if `isSecret` is true.
 * Set `value` to null to clear (use deleteCredential() to remove the row entirely).
 */
export async function setCredential(env, workspaceId, key, category, value, opts) {
    const isSecret = opts.isSecret ? 1 : 0;
    const encrypted = opts.isSecret
        ? await encryptString(env.JWT_SECRET, 'ensemble:credentials:v1', value)
        : null;
    const plain = opts.isSecret ? null : value;
    await env.DB.prepare(`INSERT INTO workspace_credentials
       (workspace_id, key, category, is_secret, value_encrypted, value_plain, updated_at, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)
     ON CONFLICT (workspace_id, key) DO UPDATE
       SET category = excluded.category,
           is_secret = excluded.is_secret,
           value_encrypted = excluded.value_encrypted,
           value_plain = excluded.value_plain,
           updated_at = excluded.updated_at,
           updated_by = excluded.updated_by`).bind(workspaceId, key, category, isSecret, encrypted, plain, opts.updatedBy ?? null).run();
}
/**
 * Remove a credential row entirely.
 */
export async function deleteCredential(env, workspaceId, key) {
    await env.DB.prepare(`DELETE FROM workspace_credentials WHERE workspace_id = ? AND key = ?`).bind(workspaceId, key).run();
}
/**
 * List credentials as summaries (no secret values revealed).
 * Filter by category if provided.
 */
export async function listCredentials(env, workspaceId, category) {
    const stmt = category
        ? env.DB.prepare(`SELECT key, category, is_secret, value_encrypted, value_plain, updated_at, updated_by
           FROM workspace_credentials
          WHERE workspace_id = ? AND category = ?
          ORDER BY category, key`).bind(workspaceId, category)
        : env.DB.prepare(`SELECT key, category, is_secret, value_encrypted, value_plain, updated_at, updated_by
           FROM workspace_credentials
          WHERE workspace_id = ?
          ORDER BY category, key`).bind(workspaceId);
    const result = await stmt.all();
    return (result.results ?? []).map((row) => ({
        key: row.key,
        category: row.category,
        is_secret: row.is_secret === 1,
        set: row.is_secret ? !!row.value_encrypted : !!row.value_plain,
        value: row.is_secret ? null : row.value_plain,
        updated_at: row.updated_at,
        updated_by: row.updated_by,
    }));
}
/**
 * Workspace-public-URL helper. Returns the stored canonical URL
 * (e.g. https://workspace.curalisto.com) used for magic-link emails,
 * password-reset links, OAuth redirects, etc. Falls back to the
 * incoming request's origin and warns if unset.
 *
 * Subsystems that send emails or generate external-facing URLs MUST
 * use this rather than reading request.url directly.
 */
export async function getWorkspacePublicUrl(env, workspaceId, fallbackRequest) {
    const stored = await getCredential(env, workspaceId, 'workspace_public_url');
    if (stored)
        return stored.replace(/\/+$/, '');
    if (fallbackRequest) {
        const fallback = new URL(fallbackRequest.url).origin;
        console.warn(`[credentials] workspace_public_url not set; falling back to request origin ${fallback}. ` +
            `Set it in Settings → Auth & Security → Credentials → Connection.`);
        return fallback;
    }
    throw new Error('workspace_public_url not set and no request available for fallback');
}
//# sourceMappingURL=credentials.js.map