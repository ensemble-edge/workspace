import { defineGuestApp } from '@ensemble-edge/workspace/guest';
import { createGuestWorker } from '@ensemble-edge/workspace/guest/cloudflare';
import { Hono } from 'hono';

// @ts-expect-error — Text rule in wrangler.toml turns this into a string.
import bundleJs from '../dist/app.bundle.js';

/**
 * Sandboxed-iframe HTML shell.
 *
 * Note what's MISSING compared to the trusted-runtime shell:
 *   - No <link href="/_ensemble/brand/css"> — sandboxed iframes have null
 *     origin and can't load same-origin stylesheets from workspace anyway.
 *     If you want workspace's theme, fetch /_ensemble/brand/css yourself
 *     and inline it (the gateway serves it cross-origin-friendly).
 *   - No <script src="/_ensemble/runtime/v1/runtime.js"> — sandboxed apps
 *     don't share React with the host. You bring your own.
 *
 * What you DO get:
 *   - A typed postMessage channel back to the host (via
 *     @ensemble-edge/workspace/guest-sandbox).
 *   - Sidebar entry, permission gating, audit logging — all controlled
 *     by the host based on this app's guest_apps row.
 */
function indexHtml(title: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    html, body { margin: 0; padding: 0; min-height: 100%; background: #fafafa; color: #111; }
    #root { min-height: 100%; }
  </style>
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
  },
  fetch: (request) => router.fetch(request),
});

export default createGuestWorker(app);
