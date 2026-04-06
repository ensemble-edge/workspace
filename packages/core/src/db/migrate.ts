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
 * Parse SQL into individual statements.
 * Handles comments, multi-line statements, and semicolons.
 */
function parseSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';

  // Split into lines and process
  const lines = sql.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) {
      continue;
    }

    // Skip full-line comments
    if (trimmed.startsWith('--')) {
      continue;
    }

    // Strip inline comments (-- comment at end of line)
    // But be careful not to strip -- inside strings
    let lineWithoutComment = trimmed;
    const commentIndex = trimmed.indexOf('--');
    if (commentIndex > 0) {
      // Check if it's inside a string by counting quotes before it
      const beforeComment = trimmed.slice(0, commentIndex);
      const singleQuotes = (beforeComment.match(/'/g) || []).length;
      // If even number of quotes, the -- is not inside a string
      if (singleQuotes % 2 === 0) {
        lineWithoutComment = beforeComment.trim();
      }
    }

    // Skip if line becomes empty after removing comment
    if (!lineWithoutComment) {
      continue;
    }

    // Add line to current statement
    current += (current ? ' ' : '') + lineWithoutComment;

    // Check if statement is complete (ends with semicolon)
    if (lineWithoutComment.endsWith(';')) {
      // Remove trailing semicolon and add to statements
      const statement = current.slice(0, -1).trim();
      if (statement) {
        statements.push(statement);
      }
      current = '';
    }
  }

  // Handle any remaining statement without trailing semicolon
  if (current.trim()) {
    statements.push(current.trim());
  }

  return statements;
}

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
export async function runMigrations(
  db: D1Database,
  migrations: Migration[]
): Promise<string[]> {
  // Ensure _migrations table exists
  await db.exec(`CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, applied_at TEXT DEFAULT (datetime('now')))`);

  // Get already applied migrations
  const applied = await db
    .prepare('SELECT name FROM _migrations ORDER BY id')
    .all<{ name: string }>();

  const appliedNames = new Set(applied.results?.map((r) => r.name) ?? []);

  // Run pending migrations in order
  const newlyApplied: string[] = [];

  for (const migration of migrations) {
    if (appliedNames.has(migration.name)) {
      continue; // Already applied
    }

    try {
      // Execute migration SQL using batch() for reliable multi-statement execution
      // D1's exec() has issues with multi-line SQL, so we split on semicolons
      // and run each statement individually
      const statements = parseSqlStatements(migration.sql);

      if (statements.length > 0) {
        // Use batch() for atomic execution of all statements
        await db.batch(statements.map(sql => db.prepare(sql)));
      }

      // Record migration
      await db
        .prepare('INSERT INTO _migrations (name) VALUES (?)')
        .bind(migration.name)
        .run();

      newlyApplied.push(migration.name);
      console.log(`✓ Applied migration: ${migration.name}`);
    } catch (error) {
      console.error(`✗ Failed migration: ${migration.name}`, error);
      throw error;
    }
  }

  if (newlyApplied.length === 0) {
    console.log('No new migrations to apply');
  } else {
    console.log(`Applied ${newlyApplied.length} migration(s)`);
  }

  return newlyApplied;
}

/**
 * Check if migrations have been run.
 */
export async function hasMigrations(db: D1Database): Promise<boolean> {
  try {
    const result = await db
      .prepare('SELECT COUNT(*) as count FROM _migrations')
      .first<{ count: number }>();
    return (result?.count ?? 0) > 0;
  } catch {
    return false;
  }
}
