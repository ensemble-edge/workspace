/**
 * Migration 006: Workspace Credentials
 *
 * Generic key/value store for workspace-managed credentials and config.
 *
 *   Secrets   (is_secret=1): AES-GCM encrypted at rest with a key
 *               derived from env.JWT_SECRET via HKDF-SHA256 with
 *               info 'ensemble:credentials:v1'.
 *   Config    (is_secret=0): plain text. Sending domains, account IDs,
 *               provider names, verification status, etc.
 *
 * Categories partition the namespace so the UI can render sections
 * independently and so future settings tabs can have their own buckets.
 */
import type { Migration } from '../migrate';
export declare const migration: Migration;
//# sourceMappingURL=006_workspace_credentials.d.ts.map