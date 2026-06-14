const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function randomBase62(len) {
    const bytes = new Uint8Array(len);
    crypto.getRandomValues(bytes);
    let out = '';
    for (let i = 0; i < len; i++)
        out += ALPHABET[bytes[i] % 62];
    return out;
}
/** SHA-256 hex of a string. */
async function sha256Hex(s) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function rowToKey(row) {
    let scopes = ['admin'];
    try {
        scopes = JSON.parse(row.scopes);
    }
    catch { /* default */ }
    return {
        id: row.id,
        workspace_id: row.workspace_id,
        created_by_user_id: row.created_by_user_id,
        name: row.name,
        key_prefix: row.key_prefix,
        scopes,
        created_at: row.created_at,
        last_used_at: row.last_used_at,
        expires_at: row.expires_at,
        revoked_at: row.revoked_at,
    };
}
/**
 * Create a new API key. Returns the full plaintext token ONCE; caller
 * must store/display it immediately because the plaintext can never
 * be recovered after this call.
 */
export async function createApiKey(env, input) {
    const plaintext = `wks_${randomBase62(29)}`;
    const key_prefix = plaintext.slice(0, 8); // "wks_abc1"
    const key_hash = await sha256Hex(plaintext);
    const id = crypto.randomUUID();
    const scopes = JSON.stringify(input.scopes ?? ['admin']);
    const created_at = new Date().toISOString();
    await env.DB.prepare(`INSERT INTO workspace_api_keys
       (id, workspace_id, created_by_user_id, name, key_prefix, key_hash,
        scopes, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, input.workspaceId, input.userId, input.name, key_prefix, key_hash, scopes, created_at, input.expiresAt ?? null).run();
    const row = await env.DB.prepare(`SELECT * FROM workspace_api_keys WHERE id = ?`).bind(id).first();
    return { key: rowToKey(row), plaintext };
}
/** List all keys for a workspace (revoked + active). */
export async function listApiKeys(env, workspaceId) {
    const result = await env.DB.prepare(`SELECT * FROM workspace_api_keys
      WHERE workspace_id = ?
      ORDER BY (revoked_at IS NULL) DESC, created_at DESC`).bind(workspaceId).all();
    return (result.results ?? []).map(rowToKey);
}
/** Mark a key as revoked. Returns true if a row was updated. */
export async function revokeApiKey(env, workspaceId, keyId) {
    const r = await env.DB.prepare(`UPDATE workspace_api_keys
        SET revoked_at = datetime('now')
      WHERE workspace_id = ? AND id = ? AND revoked_at IS NULL`).bind(workspaceId, keyId).run();
    return (r.meta?.changes ?? 0) > 0;
}
/**
 * Regenerate: create a new key with the same name+scopes, revoke the
 * old one. Returns the new plaintext.
 */
export async function regenerateApiKey(env, workspaceId, keyId, userId) {
    const old = await env.DB.prepare(`SELECT * FROM workspace_api_keys WHERE workspace_id = ? AND id = ?`).bind(workspaceId, keyId).first();
    if (!old)
        return null;
    await revokeApiKey(env, workspaceId, keyId);
    let scopes = ['admin'];
    try {
        scopes = JSON.parse(old.scopes);
    }
    catch { /* default */ }
    return createApiKey(env, {
        workspaceId,
        userId,
        name: old.name,
        scopes,
        expiresAt: old.expires_at,
    });
}
/**
 * Look up an API key by its plaintext token. Returns null if the
 * token doesn't exist, is revoked, or has expired. Updates
 * last_used_at on a successful match.
 */
export async function findApiKeyByPlaintext(env, plaintext) {
    if (!plaintext.startsWith('wks_'))
        return null;
    const key_hash = await sha256Hex(plaintext);
    const row = await env.DB.prepare(`SELECT * FROM workspace_api_keys WHERE key_hash = ?`).bind(key_hash).first();
    if (!row)
        return null;
    if (row.revoked_at)
        return null;
    if (row.expires_at && new Date(row.expires_at) <= new Date())
        return null;
    // Touch last_used_at. We don't await this — it's a write-and-forget
    // side-effect; the lookup completes regardless.
    env.DB.prepare(`UPDATE workspace_api_keys SET last_used_at = datetime('now') WHERE id = ?`).bind(row.id).run().catch(() => { });
    return rowToKey(row);
}
//# sourceMappingURL=api-keys.js.map