import { defineGuestApp } from '@ensemble-edge/workspace/guest';
import { createGuestWorker } from '@ensemble-edge/workspace/guest/cloudflare';
import { Hono } from 'hono';

// @ts-expect-error — Text rule in wrangler.toml turns this into a string.
import bundleJs from '../dist/app.bundle.js';

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
router.get('*', (c) => c.html(indexHtml('{{APP_NAME}}')));

const app = defineGuestApp({
  manifest: {
    id: '{{APP_ID}}',
    name: '{{APP_NAME}}',
    version: '0.0.1',
    icon: '{{ICON}}',
    category: 'tool',
    permissions: ['read:user', 'read:workspace'],
    entry: '/',
    tier: 'iframe',  // ← same-origin iframe; must match guest_apps.tier
  },
  fetch: (request) => router.fetch(request),
});

export default createGuestWorker(app);
