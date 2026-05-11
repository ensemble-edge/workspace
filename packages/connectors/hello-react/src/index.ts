import { defineGuestApp } from '@ensemble-edge/guest';
import { createGuestWorker } from '@ensemble-edge/guest-cloudflare';
import { Hono } from 'hono';

// @ts-expect-error — Text rule in wrangler.toml converts these to string modules.
// If your editor complains, that's expected; the rule applies at bundle time.
import bundleJs from '../dist/app.bundle.js';
// @ts-expect-error — same
import bundleCss from '../dist/app.bundle.css';

function indexHtml(title: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="/_ensemble/brand/css">
  <style>
    /* Minimal iframe-body reset so workspace's brand tokens are the only
       authority on layout/colors. Without this, default 8px UA margin
       on body misaligns the React app vs. the shell's content area. */
    html, body { margin: 0; padding: 0; min-height: 100%; background: hsl(var(--background)); color: hsl(var(--foreground)); }
    #root { min-height: 100%; }
  </style>
  <style>${bundleCss as string}</style>
</head>
<body>
  <div id="root"></div>
  <script type="module">${bundleJs as string}</script>
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
  },
  fetch: (request) => router.fetch(request),
});

export default createGuestWorker(app);
