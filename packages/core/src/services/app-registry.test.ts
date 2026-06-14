/**
 * App Manager integration test — registry + the App Manager API +
 * enable/disable gating, against a real D1 (miniflare).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Miniflare } from 'miniflare';
import { Hono } from 'hono';
import { migration as m001 } from '../db/migrations/001_initial';
import { migration as m002 } from '../db/migrations/002_guest_apps';
import { listApps, isAppActive, buildInstalledAppsSeed } from './app-registry';
import { registerAppsRoutes } from '../apps/core/apps/routes';

let mf: Miniflare;
let db: D1Database;
const WS = 'ws_am';

function stripComments(sql: string): string {
  return sql
    .split('\n')
    .map((line) => {
      const i = line.indexOf('--');
      if (i >= 0 && (line.slice(0, i).match(/'/g) || []).length % 2 === 0) return line.slice(0, i);
      return line;
    })
    .join('\n');
}

async function applyMigration(m: { sql: string }) {
  for (const stmt of stripComments(m.sql).split(';').map((s) => s.trim()).filter(Boolean)) {
    await db.exec(stmt.replace(/\n/g, ' '));
  }
}

// App with an admin user + workspace on context.
function adminApp() {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('workspace' as never, { id: WS } as never);
    c.set('user' as never, { id: 'u1', email: 'a@x.com' } as never);
    c.set('membership' as never, { role: 'owner' } as never);
    (c as { env: unknown }).env = { DB: db };
    await next();
  });
  registerAppsRoutes(app as never);
  return app;
}

beforeAll(async () => {
  mf = new Miniflare({
    modules: true,
    script: 'export default { async fetch(){ return new Response("ok"); } }',
    d1Databases: { DB: ':memory:' },
  });
  db = (await mf.getD1Database('DB')) as unknown as D1Database;

  // 001 creates workspaces + installed_apps; 002 creates guest_apps.
  await applyMigration(m001);
  await applyMigration(m002);
  await db.prepare('INSERT INTO workspaces (id, slug, name) VALUES (?,?,?)').bind(WS, 'am', 'AM').run();
  // Seed core-app rows (what bootstrap/migration 018 do).
  await db.batch(buildInstalledAppsSeed(db, WS));
  // One guest app.
  await db
    .prepare(`INSERT INTO guest_apps (id, workspace_id, name, icon, category, enabled) VALUES (?,?,?,?,?,1)`)
    .bind('quiz', WS, 'Quiz CMS', 'box', 'tool')
    .run();
});

afterAll(async () => {
  await mf?.dispose();
});

describe('app registry', () => {
  it('lists core apps + guest apps with tier and governable flags', async () => {
    const apps = await listApps({ DB: db }, WS);
    const byId = new Map(apps.map((a) => [a.id, a]));
    expect(byId.get('core:legal')?.tier).toBe('core');
    expect(byId.get('core:legal')?.surfaceKind).toBe('public');
    expect(byId.get('core:legal')?.governable).toBe(true);
    // Load-bearing apps are not governable.
    expect(byId.get('core:apps')?.governable).toBe(false);
    expect(byId.get('core:brand')?.governable).toBe(false);
    // Guest app present.
    expect(byId.get('guest:quiz')?.tier).toBe('guest');
    expect(byId.get('guest:quiz')?.surfaceKind).toBe('operator');
  });
});

describe('App Manager API', () => {
  it('GET /_ensemble/core/apps returns the full list', async () => {
    const r = await adminApp().request('http://x/_ensemble/core/apps');
    expect(r.status).toBe(200);
    const body = (await r.json()) as { apps: { id: string }[] };
    expect(body.apps.some((a) => a.id === 'core:legal')).toBe(true);
    expect(body.apps.some((a) => a.id === 'guest:quiz')).toBe(true);
  });

  it('PATCH disables a governable app; isAppActive reflects it', async () => {
    const r = await adminApp().request('http://x/_ensemble/core/apps/core:legal', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'inactive' }),
    });
    expect(r.status).toBe(200);
    expect(await isAppActive({ DB: db }, WS, 'core:legal')).toBe(false);

    // Re-enable for later tests.
    await adminApp().request('http://x/_ensemble/core/apps/core:legal', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    expect(await isAppActive({ DB: db }, WS, 'core:legal')).toBe(true);
  });

  it('refuses to disable a non-governable app (409)', async () => {
    const r = await adminApp().request('http://x/_ensemble/core/apps/core:apps', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'inactive' }),
    });
    expect(r.status).toBe(409);
    expect(await isAppActive({ DB: db }, WS, 'core:apps')).toBe(true);
  });

  it('rejects a mount on an unregistered host (400)', async () => {
    const r = await adminApp().request('http://x/_ensemble/core/apps/core:legal', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mounts: [{ host: 'evil.com', path: '/legal' }] }),
    });
    // workspace_domains table doesn't exist in this minimal DB → the host
    // isn't registered → 400.
    expect(r.status).toBe(400);
  });

  it('routes-hint returns a wrangler block shape', async () => {
    const r = await adminApp().request('http://x/_ensemble/core/apps/routes-hint');
    expect(r.status).toBe(200);
    const body = (await r.json()) as { hosts: string[]; wrangler: string; note: string };
    expect(Array.isArray(body.hosts)).toBe(true);
    expect(typeof body.wrangler).toBe('string');
    expect(body.note).toMatch(/consumer/i);
  });

  it('requires admin for mutations', async () => {
    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('workspace' as never, { id: WS } as never);
      c.set('user' as never, { id: 'u2', email: 'm@x.com' } as never);
      c.set('membership' as never, { role: 'member' } as never); // not admin
      (c as { env: unknown }).env = { DB: db };
      await next();
    });
    registerAppsRoutes(app as never);
    const r = await app.request('http://x/_ensemble/core/apps/core:legal', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'inactive' }),
    });
    expect(r.status).toBe(403);
  });
});
