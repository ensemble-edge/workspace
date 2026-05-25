/**
 * D1 Migration Runner
 *
 * Runs SQL migrations in order, tracking applied migrations in the
 * _migrations table. Safe to run multiple times - only applies new migrations.
 *
 * Usage:
 *   await runMigrations(env.DB, migrations);
 */
/**
 * Migration definition.
 */
export interface Migration {
    /** Migration name (e.g., "001_initial") */
    name: string;
    /** SQL to execute */
    sql: string;
}
/**
 * Run all pending migrations.
 *
 * @param db - D1 database binding
 * @param migrations - Array of migrations to run
 * @returns Array of applied migration names
 */
export declare function runMigrations(db: D1Database, migrations: Migration[]): Promise<string[]>;
/**
 * Check if migrations have been run.
 */
export declare function hasMigrations(db: D1Database): Promise<boolean>;
//# sourceMappingURL=migrate.d.ts.map