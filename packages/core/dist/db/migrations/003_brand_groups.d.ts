/**
 * Migration 003: Brand Token Groups
 *
 * Adds brand_token_groups table for user-defined color groups
 * (e.g., "Slate", "Gold", "Vermillion") and custom token groups.
 *
 * Also relaxes the type CHECK on brand_tokens to support 'rich_text' and 'gradient'.
 */
import type { Migration } from '../migrate';
export declare const migration: Migration;
//# sourceMappingURL=003_brand_groups.d.ts.map