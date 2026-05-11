import { defineGuestApp } from '@ensemble-edge/guest';
import { createGuestWorker } from '@ensemble-edge/guest-cloudflare';
import { Hono } from 'hono';

// @ts-expect-error — Text rule in wrangler.toml turns this into a string.
import bundleJs from '../dist/app.bundle.js';

/**
 * The guest's iframe HTML. Loads the workspace-served runtime, then mounts
 * our app. Both <link>s point at the host workspace, which is same-origin
 * with the iframe — no CORS, no proxy, no copying assets.
 */
function indexHtml(title: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="/_ensemble/brand/css">
  <link rel="stylesheet" href="/_ensemble/runtime/v1/runtime.css">
  <script src="/_ensemble/runtime/v1/runtime.js"></script>
  <style>
    html, body { margin: 0; padding: 0; min-height: 100%;
                 background: hsl(var(--background));
                 color: hsl(var(--foreground)); }
    #root { min-height: 100%; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module">
${bundleJs as string}
window.Ensemble.mount(window.__EnsembleApp);
  </script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c] as string));
}

const router = new Hono();
router.get('*', (c) => c.html(indexHtml('Hello, React')));

const app = defineGuestApp({
  manifest: {
    id: 'hello-react',
    name: 'Hello, React',
    version: '0.1.0',
    icon: 'sparkles',
    category: 'tool',
    permissions: ['read:user', 'read:workspace'],
    entry: '/',
    tier: 'iframe',
  },
  fetch: (request) => router.fetch(request),
});

export default createGuestWorker(app);
