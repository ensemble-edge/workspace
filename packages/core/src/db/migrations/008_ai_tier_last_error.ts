/**
 * Migration 008: AI tier last_error
 *
 * Adds `last_error TEXT` to workspace_ai_tiers so failed provisioning
 * attempts can persist the underlying Cloudflare API error. The UI's
 * tier row shows this in an info-icon tooltip — much better than the
 * pre-v0.1.14 opaque "Route not provisioned" badge.
 *
 * NULL = no failure recorded (either never tried, or last try succeeded).
 */

import type { Migration } from '../migrate';

export const migration: Migration = {
  name: '008_ai_tier_last_error',
  sql: `ALTER TABLE workspace_ai_tiers ADD COLUMN last_error TEXT;`,
};
