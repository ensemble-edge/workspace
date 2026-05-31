/**
 * Migration regression test.
 *
 * v0.1.100: spins up an in-memory SQLite (better-sqlite3), wraps it
 * in a minimal D1Database-shaped adapter, runs every migration from
 * the production migrations[] array, and asserts:
 *   • No migration throws
 *   • _migrations contains a row for every migration name
 *   • The order matches the production array
 *
 * Why this exists: v0.1.99 shipped with migration 005 broken on
 * fresh D1 deploys — the DROP COLUMN happened before its index was
 * dropped, so SQLite couldn't rebuild the table. Any future migration
 * with the same shape would fail silently in CI without this test.
 *
 * The test runs against better-sqlite3, NOT real D1. SQLite version
 * differences are minor and the failure modes we care about
 * (statement ordering, missing column references, broken indexes)
 * reproduce identically in both engines.
 */

import { describe, it, expect } from 'vitest';
import { runMigrations } from './migrate';
import { migrations } from './migrations';

// better-sqlite3 needs a compiled native binding. Some dev containers
// (no gcc/python toolchain) can't load it. In those cases we skip the
// test rather than fail the build — CI environments with proper Node
// binaries run the test as intended.
let Database: typeof import('better-sqlite3') | null = null;
let bindingError: string | null = null;
try {
  // Probe by actually instantiating a db. Just importing doesn't
  // always trigger the binding load.
  const mod = await import('better-sqlite3');
  const Ctor = mod.default;
  const probe = new Ctor(':memory:');
  probe.close();
  Database = Ctor;
} catch (err) {
  bindingError = err instanceof Error ? err.message : String(err);
}

/**
 * Minimal D1Database-shaped adapter over better-sqlite3.
 *
 * Exposes _sql on the prepare() return so batch() can re-execute
 * each statement — this matches how runMigrations uses batch()
 * (passes prepared statements with no bound params, just raw SQL).
 */
function makeD1AdapterWithBatch(): unknown {
  const db = new Database!(':memory:');

  function prepare(sql: string): unknown {
    let params: unknown[] = [];
    const api = {
      _sql: sql,
      bind(...args: unknown[]) {
        params = args;
        return api;
      },
      async all<T>(): Promise<{ results: T[] }> {
        try {
          const rows = db.prepare(sql).all(...params) as T[];
          return { results: rows };
        } catch (err) {
          if (String(err).includes('does not return data')) {
            db.prepare(sql).run(...params);
            return { results: [] };
          }
          throw err;
        }
      },
      async first<T>(): Promise<T | null> {
        try {
          const row = db.prepare(sql).get(...params) as T | undefined;
          return row ?? null;
        } catch (err) {
          if (String(err).includes('does not return data')) {
            db.prepare(sql).run(...params);
            return null;
          }
          throw err;
        }
      },
      async run(): Promise<{ meta: { changes: number } }> {
        const info = db.prepare(sql).run(...params);
        return { meta: { changes: Number(info.changes) } };
      },
    };
    return api;
  }

  async function batch(prepared: Array<{ _sql: string }>): Promise<unknown[]> {
    // Atomic: all statements in one transaction. better-sqlite3's
    // transaction() rolls back on throw, matching D1's batch semantics.
    const txn = db.transaction(() => {
      for (const p of prepared) {
        db.prepare(p._sql).run();
      }
    });
    txn();
    return prepared.map(() => ({}));
  }

  async function exec(sql: string): Promise<void> {
    db.exec(sql);
  }

  return { prepare, batch, exec };
}

describe('migrations', () => {
  // Skip everything if the native binding isn't available locally.
  // CI environments with proper Node binaries will run these tests.
  const itIfDb = Database ? it : it.skip;

  if (!Database) {
    it('SKIPPED — better-sqlite3 native binding unavailable in this environment', () => {
      console.warn(
        `better-sqlite3 binding failed to load: ${bindingError}. ` +
        'Migration regression tests skipped locally. They will run in CI ' +
        'environments with prebuilt binaries.',
      );
    });
  }

  itIfDb('every migration in the production array runs cleanly against a fresh in-memory SQLite', async () => {
    const db = makeD1AdapterWithBatch() as Parameters<typeof runMigrations>[0];

    // Run the full set. If any migration throws, this fails and we
    // catch the regression before deploy.
    const applied = await runMigrations(db, migrations);

    // All migrations should have run.
    expect(applied.length).toBe(migrations.length);

    // Order must match the production array.
    for (let i = 0; i < migrations.length; i++) {
      expect(applied[i]).toBe(migrations[i]!.name);
    }
  });

  itIfDb('running migrations twice is idempotent (no error, no new applies)', async () => {
    const db = makeD1AdapterWithBatch() as Parameters<typeof runMigrations>[0];
    await runMigrations(db, migrations);
    const second = await runMigrations(db, migrations);
    expect(second.length).toBe(0);
  });
});
