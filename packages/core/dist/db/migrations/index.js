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
import { migration as m008 } from './008_ai_tier_last_error.js';
import { migration as m009 } from './009_workspace_locales.js';
import { migration as m010 } from './010_workspace_settings.js';
import { migration as m011 } from './011_ai_tier_provider.js';
import { migration as m012 } from './012_workspace_api_keys.js';
import { migration as m013 } from './013_guest_secrets.js';
import { migration as m014 } from './014_users_invite_pending.js';
import { migration as m015 } from './015_legal_docs.js';
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
    m008,
    m009,
    m010,
    m011,
    m012,
    m013,
    m014,
    m015,
];
//# sourceMappingURL=index.js.map