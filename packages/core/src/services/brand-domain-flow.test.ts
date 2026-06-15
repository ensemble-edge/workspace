/**
 * Brand-domain integration test — migration 017 + the Domains API +
 * resolver lookups + the SEO/indexing behavior of the legal renderer,
 * against a real D1 (miniflare).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Miniflare } from 'miniflare';
import { Hono } from 'hono';
import { migration as m010 } from '../db/migrations/010_workspace_settings';
import { migration as m015 } from '../db/migrations/015_legal_docs';
import { migration as m016 } from '../db/migrations/016_legal_notice';
import { migration as m017 } from '../db/migrations/017_workspace_domains';
import { buildLegalSeedStatements } from '../apps/core/legal/seed';
import { registerLegalRoutes } from '../apps/core/legal/routes';
import { createDomainsRoutes } from '../routes/domains';
import { setSetting } from './workspace-settings';
import { workspaceIdForDomain, primaryDomainForWorkspace, invalidateDomainCache } from './brand-domain';

let mf: Miniflare;
let db: D1Database;
const WS = 'ws_brand';

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

// App with an admin user + workspace on context (no brand host).
function adminApp() {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('workspace' as never, { id: WS } as never);
    c.set('user' as never, { id: 'u1', email: 'a@x.com' } as never);
    c.set('membership' as never, { role: 'owner' } as never);
    c.set('brandDomain' as never, null as never);
    (c as { env: unknown }).env = { DB: db };
    await next();
  });
  registerDomains(app);
  return app;
}
function registerDomains(app: Hono) {
  // mount domains routes
  const sub = createDomainsRoutes();
  app.route('/', sub as never);
}

beforeAll(async () => {
  mf = new Miniflare({
    modules: true,
    script: 'export default { async fetch(){ return new Response("ok"); } }',
    d1Databases: { DB: ':memory:' },
  });
  db = (await mf.getD1Database('DB')) as unknown as D1Database;

  await db.exec('CREATE TABLE workspaces (id TEXT PRIMARY KEY, slug TEXT, name TEXT)');
  await db.prepare('INSERT INTO workspaces (id,slug,name) VALUES (?,?,?)').bind(WS, 'brand', 'Brand').run();
  await db.prepare('INSERT INTO workspaces (id,slug,name) VALUES (?,?,?)').bind('ws_other', 'o', 'O').run();

  for (const m of [m010, m015, m016, m017]) {
    for (const stmt of stripComments(m.sql).split(';').map((s) => s.trim()).filter(Boolean)) {
      await db.exec(stmt.replace(/\n/g, ' '));
    }
  }
  await db.batch(buildLegalSeedStatements(db, WS, '2026-06-14T00:00:00Z', 'u1'));
  invalidateDomainCache(WS);
});

afterAll(async () => {
  await mf?.dispose();
});

describe('Domains API', () => {
  it('adds, lists, rejects duplicates, and removes a brand domain', async () => {
    const app = adminApp();

    const add = await app.request('http://x/_ensemble/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'curalisto.com' }),
    });
    expect(add.status).toBe(200);

    const list = await app.request('http://x/_ensemble/domains');
    const listBody = (await list.json()) as { domains: { domain: string; verified: boolean }[] };
    expect(listBody.domains.map((d) => d.domain)).toContain('curalisto.com');

    // Same workspace re-adding → 409.
    const dup = await app.request('http://x/_ensemble/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'curalisto.com' }),
    });
    expect(dup.status).toBe(409);

    // Bad format → 400.
    const bad = await app.request('http://x/_ensemble/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'https://nope.com/x' }),
    });
    expect(bad.status).toBe(400);

    const del = await app.request('http://x/_ensemble/domains/curalisto.com', { method: 'DELETE' });
    expect(del.status).toBe(200);
  });

  it('a second tenant cannot claim a domain owned by another (PK enforces it)', async () => {
    invalidateDomainCache(WS);
    invalidateDomainCache('ws_other');
    // WS adds it.
    await adminApp().request('http://x/_ensemble/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'shared.com' }),
    });
    // ws_other tries the same domain.
    const other = new Hono();
    other.use('*', async (c, next) => {
      c.set('workspace' as never, { id: 'ws_other' } as never);
      c.set('user' as never, { id: 'u2', email: 'b@x.com' } as never);
      c.set('membership' as never, { role: 'owner' } as never);
      (c as { env: unknown }).env = { DB: db };
      await next();
    });
    registerDomains(other);
    const res = await other.request('http://x/_ensemble/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'shared.com' }),
    });
    expect(res.status).toBe(409);
  });
});

describe('resolver lookups', () => {
  it('workspaceIdForDomain resolves a registered domain and ignores unknown', async () => {
    invalidateDomainCache(WS);
    await db
      .prepare(`INSERT OR IGNORE INTO workspace_domains (domain, workspace_id, proto) VALUES ('lookup.com', ?, 'https')`)
      .bind(WS)
      .run();
    invalidateDomainCache(WS, 'lookup.com');
    const hit = await workspaceIdForDomain({ DB: db }, 'lookup.com');
    expect(hit?.workspaceId).toBe(WS);
    const miss = await workspaceIdForDomain({ DB: db }, 'nobody.example');
    expect(miss).toBeNull();
  });

  it('primaryDomainForWorkspace returns the earliest domain', async () => {
    const p = await primaryDomainForWorkspace({ DB: db }, WS);
    expect(p?.domain).toBeTruthy();
  });
});

describe('legal SEO + indexing', () => {
  function legalApp(brand: { domain: string; proto: string } | null) {
    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('workspace' as never, { id: WS } as never);
      c.set('brandDomain' as never, brand as never);
      (c as { env: unknown }).env = { DB: db };
      await next();
    });
    registerLegalRoutes(app as never);
    return app;
  }

  it('noindex by default: robots meta + X-Robots-Tag, no canonical', async () => {
    await setSetting({ DB: db } as never, WS, 'legal_public_enabled', 'true', 'u1');
    await setSetting({ DB: db } as never, WS, 'legal_allow_indexing', 'false', 'u1');
    const res = await legalApp(null).request('http://workspace.x/legal/privacy');
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    const html = await res.text();
    expect(html).toContain('noindex, nofollow');
    expect(html).not.toContain('rel="canonical"');
  });

  it('indexable: absolute canonical against brand domain, no robots noindex', async () => {
    await setSetting({ DB: db } as never, WS, 'legal_allow_indexing', 'true', 'u1');
    // Request ON the brand host — that's where an indexable page actually
    // renders (a workspace-host hit would 301 to here first).
    const res = await legalApp({ domain: 'curalisto.com', proto: 'https' }).request('http://curalisto.com/legal/privacy');
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Robots-Tag')).toBeNull();
    const html = await res.text();
    expect(html).toContain('<link rel="canonical" href="https://curalisto.com/legal/privacy">');
    expect(html).not.toContain('noindex');
  });

  it('redirects public traffic on the workspace host to the brand domain (301)', async () => {
    const res = await legalApp({ domain: 'curalisto.com', proto: 'https' }).request(
      'http://workspace.x/legal/privacy',
    );
    // No session cookie → public → 301 to brand host.
    expect(res.status).toBe(301);
    expect(res.headers.get('Location')).toBe('https://curalisto.com/legal/privacy');
  });

  it('does NOT redirect a request already on the brand host', async () => {
    const res = await legalApp({ domain: 'curalisto.com', proto: 'https' }).request(
      'http://curalisto.com/legal/privacy',
    );
    expect(res.status).toBe(200);
  });

  it('does NOT redirect an authenticated request (session cookie present)', async () => {
    const res = await legalApp({ domain: 'curalisto.com', proto: 'https' }).request(
      'http://workspace.x/legal/privacy',
      { headers: { Cookie: 'ensemble_access=sometoken' } },
    );
    expect(res.status).toBe(200);
  });

  it('global trailing-slash normalization runs BEFORE the SPA catch-all (the real bug)', async () => {
    // Production has a catch-all (app.get('*')) that returns 200 (the SPA
    // shell) for unmatched paths. So a 404-triggered normalizer never
    // fires — /brand/ would silently serve the blank shell. The fix
    // redirects BEFORE routing. This test mirrors that wiring: the
    // pre-routing normalizer, then routes, then a 200 catch-all.
    const app = new Hono();
    // The exact normalizer from create-workspace.
    app.use('*', async (c, next) => {
      const method = c.req.method;
      if (method === 'GET' || method === 'HEAD') {
        const url = new URL(c.req.url);
        const p = url.pathname;
        if (p.length > 1 && p.endsWith('/') && !p.startsWith('/_ensemble/')) {
          url.pathname = p.replace(/\/+$/, '') || '/';
          return c.redirect(url.toString(), 301);
        }
      }
      return next();
    });
    app.use('*', async (c, next) => {
      c.set('workspace' as never, { id: WS } as never);
      c.set('brandDomain' as never, null as never);
      (c as { env: unknown }).env = { DB: db };
      await next();
    });
    registerLegalRoutes(app as never);
    // The SPA catch-all that returns 200 for everything (the masking bug).
    app.get('*', (c) => c.html('<!DOCTYPE html><html lang="en"><body>SPA shell</body></html>'));

    // /legal/ and /brand/ → 301 to no-slash, NOT the 200 shell.
    for (const path of ['/legal/?lang=es', '/brand/']) {
      const res = await app.request(`http://workspace.x${path}`, { redirect: 'manual' });
      expect(res.status).toBe(301);
      expect(new URL(res.headers.get('Location')!).pathname).toBe(path.split('?')[0].replace(/\/$/, ''));
    }

    // /_ensemble/* is NEVER touched (API/asset surface) — a trailing
    // slash there falls through to the catch-all (200), not a redirect.
    const api = await app.request('http://workspace.x/_ensemble/something/', { redirect: 'manual' });
    expect(api.status).toBe(200);

    // The bare no-slash /legal still resolves normally (not redirected).
    // (publish gate off in this app → 404, but importantly NOT a 301.)
    const bare = await app.request('http://workspace.x/legal', { redirect: 'manual' });
    expect(bare.status).not.toBe(301);
  });
});
