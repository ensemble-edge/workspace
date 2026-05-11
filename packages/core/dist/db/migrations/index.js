/**
 * Migration Registry
 *
 * Export all migrations in order. Add new migrations here.
 */
import { migration as m001 } from './001_initial.js';
import { migration as m002 } from './002_guest_apps.js';
import { migration as m003 } from './003_brand_groups.js';
/**
 * All migrations in order.
 * Add new migrations to this array.
 */
export const migrations = [
    m001,
    m002,
    m003,
];
//# sourceMappingURL=index.js.map