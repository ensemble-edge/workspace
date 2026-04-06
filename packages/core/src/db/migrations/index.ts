/**
 * Migration Registry
 *
 * Export all migrations in order. Add new migrations here.
 */

import type { Migration } from '../migrate';
import { migration as m001 } from './001_initial';
import { migration as m002 } from './002_guest_apps';

/**
 * All migrations in order.
 * Add new migrations to this array.
 */
export const migrations: Migration[] = [
  m001,
  m002,
  // Add future migrations here:
  // m003,
];
