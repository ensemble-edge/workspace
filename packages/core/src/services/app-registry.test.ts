/**
 * App Manager integration test — registry + the App Manager API +
 * enable/disable gating, against a real D1 (miniflare).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Miniflare } from 'miniflare';
import { Hono } from 'hono';
import { migration as m001 } from '../db/migrations/001_initial';
import { migration as m002 } from '../db/migrations/002_guest_apps';
import { migration as m017 } from '../db/migrations/017_workspace_domains';
import { listApps, isAppActive, isAppPublished, buildInstalledAppsSeed } from './app-registry';
import { migration as m010 } from '../db/migrations/010_workspace_settings';
import { setSetting } from './workspace-settings';
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

  // 001 creates workspaces + installed_apps; 002 guest_apps; 010 settings.
  await applyMigration(m001);
  await applyMigration(m002);
  await applyMigration(m010);
  await applyMigration(m017);
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

describe('isAppPublished read-through shim', () => {
  const WS2 = 'ws_pub';
  it('falls back to the legacy setting when no settings.published', async () => {
    await db.prepare('INSERT INTO workspaces (id, slug, name) VALUES (?,?,?)').bind(WS2, 'pub', 'Pub').run();
    await db.batch(buildInstalledAppsSeed(db, WS2));
    // No settings.published yet → reads legacy legal_public_enabled.
    await setSetting({ DB: db } as never, WS2, 'legal_public_enabled', 'true', 'u1');
    expect(await isAppPublished({ DB: db }, WS2, 'core:legal', 'legal_public_enabled')).toBe(true);
    await setSetting({ DB: db } as never, WS2, 'legal_public_enabled', 'false', 'u1');
    expect(await isAppPublished({ DB: db }, WS2, 'core:legal', 'legal_public_enabled')).toBe(false);
  });

  it('explicit settings.published wins over the legacy setting', async () => {
    // legacy says false, but the App Manager wrote published:true.
    await setSetting({ DB: db } as never, WS2, 'legal_public_enabled', 'false', 'u1');
    await db
      .prepare(`UPDATE installed_apps SET settings_json = ? WHERE workspace_id = ? AND app_id = 'core:legal'`)
      .bind(JSON.stringify({ published: true }), WS2)
      .run();
    expect(await isAppPublished({ DB: db }, WS2, 'core:legal', 'legal_public_enabled')).toBe(true);
  });
});

describe('scalable routing (routePrefixes + routes-hint)', () => {
  it('every app declares routePrefixes covering its assets', async () => {
    const apps = await listApps({ DB: db }, WS);
    const byId = new Map(apps.map((a) => [a.id, a]));
    // Brand must include its asset prefix (the logos-404 bug).
    expect(byId.get('core:brand')?.routePrefixes).toContain('/_ensemble/brand');
    expect(byId.get('core:brand')?.routePrefixes).toContain('/brand');
    // Legal pages pull /brand/css + favicon, so they need the brand prefix too.
    expect(byId.get('core:legal')?.routePrefixes).toContain('/_ensemble/brand');
    expect(byId.get('core:legal')?.routePrefixes).toContain('/legal');
  });

  it('routes-hint emits a host/* route + a complete prefix breakdown for a registered domain (even with no mounts)', async () => {
    // Register a brand domain but mount NOTHING on it — the brand guide +
    // legal still serve there, so the hint must still cover them.
    await db
      .prepare(`INSERT OR IGNORE INTO workspace_domains (domain, workspace_id, proto) VALUES ('brandco.com', ?, 'https')`)
      .bind(WS)
      .run();

    const r = await adminApp().request('http://x/_ensemble/core/apps/routes-hint');
    expect(r.status).toBe(200);
    const body = (await r.json()) as {
      hosts: string[];
      wrangler: string;
      prefixes: Record<string, string[]>;
    };
    // The registered domain is present even though nothing is mounted on it.
    expect(body.hosts).toContain('brandco.com');
    expect(body.wrangler).toContain('pattern = "brandco.com/*"');
    // The prefix breakdown includes the brand asset prefix — the thing the
    // old mount-only hint missed, causing logos to 404.
    expect(body.prefixes['brandco.com']).toContain('/_ensemble/brand');
    expect(body.prefixes['brandco.com']).toContain('/legal');
  });
});
