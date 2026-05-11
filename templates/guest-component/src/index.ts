import { defineGuestApp } from '@ensemble-edge/workspace/guest';
import { createGuestWorker } from '@ensemble-edge/workspace/guest/cloudflare';
import { Hono } from 'hono';

// @ts-expect-error — Text rule in wrangler.toml turns this into a string.
import componentBundle from '../dist/component.bundle.js';

const router = new Hono();

// The host shell does `import('/_ensemble/apps/{{APP_ID}}/ui/component.js')`
// and gets back this module.
router.get('/ui/component.js', (c) => {
  return c.text(componentBundle as string, 200, {
    'Content-Type': 'application/javascript; charset=utf-8',
    'Cache-Control': 'public, max-age=300',
  });
});

// Add your own API routes here as needed.
// e.g. router.get('/api/things', async (c) => c.json({ things: [...] }));

const app = defineGuestApp({
  manifest: {
    id: '{{APP_ID}}',
    name: '{{APP_NAME}}',
    version: '0.0.1',
    icon: '{{ICON}}',
    category: 'tool',
    permissions: ['read:user', 'read:workspace'],
    entry: '/',
    tier: 'component',  // ← renders in host React tree; must match guest_apps.tier
  },
  fetch: (request) => router.fetch(request),
});

export default createGuestWorker(app);
