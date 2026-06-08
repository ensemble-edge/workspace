/**
 * Legal Center — data-layer integration test.
 *
 * Runs migration 015 + the core route SQL against a real D1 (SQLite via
 * miniflare — the same engine Cloudflare runs in production). Exercises
 * the load-bearing flows without needing the full Worker bundle:
 *
 *   • list active docs
 *   • slug → doc/locale resolution
 *   • PUT upsert: version snapshot + junction rebuild
 *   • active-versions MAX(version_id)
 *   • multi-tenant isolation + workspace-scoped slug uniqueness
 *
 * Why miniflare and not better-sqlite3: the latter needs a native
 * binding some dev containers can't compile; miniflare's D1 is wasm and
 * always loads, and it matches D1 semantics (prepare/bind/batch) exactly.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Miniflare } from 'miniflare';
import { migration as m015 } from '../../../db/migrations/015_legal_docs';
import { migration as m010 } from '../../../db/migrations/010_workspace_settings';
import { buildLegalSeedStatements } from './seed';
import { getSetting, setSetting } from '../../../services/workspace-settings';

let mf: Miniflare;
let db: D1Database;
const WS = 'ws1';

beforeAll(async () => {
  mf = new Miniflare({
    modules: true,
    script: 'export default { async fetch(){ return new Response("ok"); } }',
    d1Databases: { DB: ':memory:' },
  });
  db = (await mf.getD1Database('DB')) as unknown as D1Database;

  // workspaces table for the FK + two tenants.
  await db.exec('CREATE TABLE workspaces (id TEXT PRIMARY KEY, slug TEXT, name TEXT)');
  await db.prepare('INSERT INTO workspaces (id,slug,name) VALUES (?,?,?)').bind(WS, 'demo', 'Demo').run();
  await db.prepare('INSERT INTO workspaces (id,slug,name) VALUES (?,?,?)').bind('ws2', 't2', 'T2').run();

  // Apply migrations 010 (workspace_settings, for the publish gate) +
  // 015 (legal tables). Strip full-line and inline `--` comments first
  // (migration 010 has an inline comment that would otherwise swallow
  // the rest of the statement once newlines are collapsed), then split
  // on `;` — mirrors what db/migrate.ts does.
  const stripComments = (sql: string): string =>
    sql
      .split('\n')
      .map((line) => {
        const i = line.indexOf('--');
        // Only strip when the -- isn't inside a string (even # of quotes before it).
        if (i >= 0 && (line.slice(0, i).match(/'/g) || []).length % 2 === 0) {
          return line.slice(0, i);
        }
        return line;
      })
      .join('\n');
  for (const m of [m010, m015]) {
    for (const stmt of stripComments(m.sql).split(';').map((s) => s.trim()).filter(Boolean)) {
      await db.exec(stmt.replace(/\n/g, ' '));
    }
  }

  // Seed the starter docs for WS (Privacy Policy + Terms of Use).
  await db.batch(buildLegalSeedStatements(db, WS, '2026-06-07T00:00:00Z', 'u1'));
});

afterAll(async () => {
  await mf?.dispose();
});

describe('legal data-layer flow', () => {
  it('seeds the two starter docs (Privacy Policy + Terms of Use), ordered', async () => {
    const { results } = await db
      .prepare(`SELECT id FROM legal_docs WHERE workspace_id=? AND status='active' ORDER BY sort_order ASC`)
      .bind(WS)
      .all<{ id: string }>();
    expect(results.map((r) => r.id)).toEqual(['privacy', 'terms']);
  });

  it('resolves a localized slug to its doc + native locale', async () => {
    const row = await db
      .prepare('SELECT doc_id, locale FROM legal_doc_slugs WHERE workspace_id=? AND slug=? LIMIT 1')
      .bind(WS, 'privacidad')
      .first<{ doc_id: string; locale: string }>();
    expect(row).toMatchObject({ doc_id: 'privacy', locale: 'es' });
  });

  it('PUT upsert snapshots the prior row and rebuilds the slug junction', async () => {
    const existing = await db
      .prepare('SELECT * FROM legal_docs WHERE workspace_id=? AND id=?')
      .bind(WS, 'privacy')
      .first<Record<string, string>>();
    expect(existing).not.toBeNull();
    if (!existing) throw new Error('seed doc missing');

    await db.batch([
      db
        .prepare(
          `INSERT INTO legal_docs_versions
             (workspace_id,doc_id,slugs_json,title_json,description_json,body_md_json,last_updated,status,saved_by,saved_at)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
        )
        .bind(
          WS,
          'privacy',
          existing.slugs_json,
          existing.title_json,
          existing.description_json,
          existing.body_md_json,
          existing.last_updated,
          existing.status,
          'u1',
          't2',
        ),
      db
        .prepare(`UPDATE legal_docs SET slugs_json=? WHERE workspace_id=? AND id=?`)
        .bind('{"es":"privacidad-2","en":"privacy"}', WS, 'privacy'),
      db.prepare(`DELETE FROM legal_doc_slugs WHERE workspace_id=? AND doc_id=?`).bind(WS, 'privacy'),
      db.prepare(`INSERT INTO legal_doc_slugs (workspace_id,slug,locale,doc_id) VALUES (?,?,?,?)`).bind(WS, 'privacidad-2', 'es', 'privacy'),
      db.prepare(`INSERT INTO legal_doc_slugs (workspace_id,slug,locale,doc_id) VALUES (?,?,?,?)`).bind(WS, 'privacy', 'en', 'privacy'),
    ]);

    const versions = await db
      .prepare(`SELECT COUNT(*) AS n FROM legal_docs_versions WHERE workspace_id=? AND doc_id=?`)
      .bind(WS, 'privacy')
      .first<{ n: number }>();
    expect(versions?.n).toBe(1);

    const oldSlug = await db
      .prepare(`SELECT 1 AS x FROM legal_doc_slugs WHERE workspace_id=? AND slug='privacidad'`)
      .bind(WS)
      .first();
    expect(oldSlug).toBeNull();

    const newSlug = await db
      .prepare(`SELECT doc_id FROM legal_doc_slugs WHERE workspace_id=? AND slug='privacidad-2'`)
      .bind(WS)
      .first<{ doc_id: string }>();
    expect(newSlug?.doc_id).toBe('privacy');
  });

  it('active-versions returns MAX(version_id) per doc', async () => {
    const { results } = await db
      .prepare(
        `SELECT doc_id, MAX(version_id) AS version_id FROM legal_docs_versions
          WHERE workspace_id=? AND doc_id IN (?) GROUP BY doc_id`,
      )
      .bind(WS, 'privacy')
      .all<{ doc_id: string; version_id: number }>();
    expect(results).toHaveLength(1);
    expect(results[0].version_id).toBeGreaterThan(0);
  });

  it('re-seeding is idempotent — no duplicate docs or slugs', async () => {
    // Use a dedicated, un-mutated workspace so other tests' slug edits
    // can't perturb the counts. Seed twice (what double-clicking the
    // "Add starter documents" button, or a re-run, would do).
    const FRESH = 'ws-seed';
    await db.prepare('INSERT INTO workspaces (id,slug,name) VALUES (?,?,?)').bind(FRESH, 'seed', 'Seed').run();
    await db.batch(buildLegalSeedStatements(db, FRESH, '2026-06-08T00:00:00Z', 'u2'));
    await db.batch(buildLegalSeedStatements(db, FRESH, '2026-06-08T00:00:00Z', 'u2'));

    const docs = await db
      .prepare(`SELECT COUNT(*) AS n FROM legal_docs WHERE workspace_id=?`)
      .bind(FRESH)
      .first<{ n: number }>();
    expect(docs?.n).toBe(2); // privacy + terms, not 4

    const slugs = await db
      .prepare(`SELECT COUNT(*) AS n FROM legal_doc_slugs WHERE workspace_id=?`)
      .bind(FRESH)
      .first<{ n: number }>();
    expect(slugs?.n).toBe(4); // 2 docs × 2 locales, not 8
  });

  it('public-publish gate defaults off and toggles on (legal_public_enabled)', async () => {
    const env = { DB: db } as unknown as Parameters<typeof getSetting>[0];

    // Default: no row → 'false'. The public routes 404 on this.
    const off = await getSetting(env, WS, 'legal_public_enabled');
    expect(off).toBe('false');

    // Operator publishes.
    await setSetting(env, WS, 'legal_public_enabled', 'true', 'u1');
    const on = await getSetting(env, WS, 'legal_public_enabled');
    expect(on).toBe('true');

    // A second tenant is independent — still off.
    const otherTenant = await getSetting(env, 'ws2', 'legal_public_enabled');
    expect(otherTenant).toBe('false');
  });

  it('enforces tenant isolation and workspace-scoped slug uniqueness', async () => {
    const cross = await db
      .prepare(`SELECT COUNT(*) AS n FROM legal_docs WHERE workspace_id='ws2'`)
      .first<{ n: number }>();
    expect(cross?.n).toBe(0);

    // The same slug 'privacy' may exist in a different tenant — the PK
    // is (workspace_id, slug, locale). This would throw under the
    // prototype's tenant-blind PRIMARY KEY (slug, locale).
    await expect(
      db
        .prepare(`INSERT INTO legal_doc_slugs (workspace_id,slug,locale,doc_id) VALUES ('ws2','privacy','en','privacy')`)
        .run(),
    ).resolves.toBeTruthy();
  });
});
