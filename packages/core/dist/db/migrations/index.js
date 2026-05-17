/**
 * Migration Registry
 *
 * Export all migrations in order. Add new migrations here.
 */
import { migration as m001 } from './001_initial.js';
import { migration as m002 } from './002_guest_apps.js';
import { migration as m003 } from './003_brand_groups.js';
import { migration as m004 } from './004_guest_apps_isolation.js';
import { migration as m005 } from './005_guest_apps_tier.js';
import { migration as m006 } from './006_workspace_credentials.js';
import { migration as m007 } from './007_workspace_ai_tiers.js';
/**
 * All migrations in order.
 * Add new migrations to this array.
 */
export const migrations = [
    m001,
    m002,
    m003,
    m004,
    m005,
    m006,
    m007,
];
//# sourceMappingURL=index.js.map