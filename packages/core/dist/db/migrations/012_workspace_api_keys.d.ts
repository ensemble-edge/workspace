/**
 * Migration 012: workspace_api_keys
 *
 * Operator-issued API keys for programmatic access to the workspace's
 * existing HTTP surface (the same /_ensemble/* routes the UI uses).
 *
 * Auth model:
 *   • Plaintext token is shown ONCE at creation time (key_prefix +
 *     random suffix, format `wks_<base62>`). We store SHA-256(plaintext)
 *     in key_hash and the first 8 chars of the plaintext in key_prefix
 *     for human-recognition in the keys list ("wks_abc1...").
 *   • Caller sends `Authorization: Bearer <plaintext>`; middleware
 *     hashes it, looks up by hash, sets the user/workspace context.
 *   • Revocation is immediate (revoked_at IS NOT NULL).
 *   • Optional expiry (expires_at IS NOT NULL AND past = treat as expired).
 *
 * Scopes are stored as a JSON array of strings. For v0.1.76 we ship a
 * coarse-grained model (just 'admin' or 'read'); finer scopes
 * (read:brand, write:credentials, ...) come later without a schema
 * change since it's a free-form JSON column.
 *
 * created_by_user_id ties the key to its issuer — useful for audit
 * trails ("who created this key?") and for revoke-on-member-removal
 * logic (revoke a member's keys when their workspace access ends).
 */
import type { Migration } from '../migrate';
export declare const migration: Migration;
//# sourceMappingURL=012_workspace_api_keys.d.ts.map