/**
 * Migration regression test against REAL D1 (miniflare's wasm SQLite —
 * the same engine Cloudflare runs), complementing migrations.test.ts
 * which uses better-sqlite3 (and SKIPS when the native binding is absent,
 * as in this container + CI).
 *
 * Why this exists: v0.1.109 shipped migration 018 with
 * `INSERT ... SELECT ... ON CONFLICT (...) DO NOTHING`, which better-
 * sqlite3 (or the skipped test) never caught but D1 rejects with a
 * syntax error — wedging every tenant's boot. This test runs the FULL
 * production migration set through the real runMigrations() on D1, so
 * any statement D1 won't accept fails here, before deploy.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Miniflare } from 'miniflare';
import { runMigrations } from './migrate';
import { migrations } from './migrations';

let mf: Miniflare;
let db: D1Database;

beforeAll(async () => {
  mf = new Miniflare({
    modules: true,
    script: 'export default { async fetch(){ return new Response("ok"); } }',
    d1Databases: { DB: ':memory:' },
  });
  db = (await mf.getD1Database('DB')) as unknown as D1Database;
});

afterAll(async () => {
  await mf?.dispose();
});

describe('migrations on real D1', () => {
  it('the full production set applies cleanly (every statement is D1-valid)', async () => {
    const applied = await runMigrations(db, migrations);
    expect(applied.length).toBe(migrations.length);
    // Order matches production.
    for (let i = 0; i < migrations.length; i++) {
      expect(applied[i]).toBe(migrations[i]!.name);
    }
  });

  it('is idempotent — a second run applies nothing', async () => {
    const second = await runMigrations(db, migrations);
    expect(second.length).toBe(0);
  });

  it('018 seeds installed_apps rows for an existing workspace', async () => {
    // Create a workspace, then re-run 018's effect by inserting a fresh
    // workspace and confirming the seed pattern works on D1. (Migrations
    // already ran above; here we exercise the same INSERT OR IGNORE
    // SELECT shape that 018 uses, against a new workspace row.)
    await db.prepare(`INSERT INTO workspaces (id, slug, name) VALUES ('wD1','d1','D1')`).run();
    await db.exec(
      `INSERT OR IGNORE INTO installed_apps (workspace_id, app_id, manifest_json, settings_json, status) ` +
        `SELECT id, 'core:legal', '{}', '{}', 'active' FROM workspaces WHERE id = 'wD1'`,
    );
    const row = await db
      .prepare(`SELECT status FROM installed_apps WHERE workspace_id='wD1' AND app_id='core:legal'`)
      .first<{ status: string }>();
    expect(row?.status).toBe('active');
  });
});
