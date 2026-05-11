/**
 * Worker entry for the component-tier guest app.
 *
 * Unlike iframe-tier workers, this one doesn't serve an HTML shell — the
 * host shell renders the guest directly. The worker just serves:
 *   GET /ui/component.js  — the ES module the host imports
 *   GET /api/*            — your own API routes (none in this stub)
 */

import { defineGuestApp } from '@ensemble-edge/guest';
import { createGuestWorker } from '@ensemble-edge/guest-cloudflare';
import { Hono } from 'hono';

// @ts-expect-error — Text rule in wrangler.toml turns this into a string.
import componentBundle from '../dist/component.bundle.js';

const router = new Hono();

// The component module — host shell does `import('/_ensemble/apps/hello-component/ui/component.js')`.
router.get('/ui/component.js', (c) => {
  return c.text(componentBundle as string, 200, {
    'Content-Type': 'application/javascript; charset=utf-8',
    'Cache-Control': 'public, max-age=300',
  });
});

// Add your own API routes here if your app needs them.
// e.g. router.get('/api/things', async (c) => c.json({ things: [...] }));

const app = defineGuestApp({
  manifest: {
    id: 'hello-component',
    name: 'Hello, Component',
    version: '0.1.0',
    icon: 'layers',
    category: 'tool',
    permissions: ['read:user', 'read:workspace'],
    entry: '/',
  },
  fetch: (request) => router.fetch(request),
});

export default createGuestWorker(app);
