/**
 * Your sandboxed guest app.
 *
 * This runs in a strict iframe — no shared origin with the workspace, no
 * access to workspace's React or UI library, no cookies, no DOM access
 * outside the iframe itself.
 *
 * You bring your own UI: plain DOM, your own React, Vue, Svelte, htmx,
 * whatever. The host workspace renders the chrome around you (sidebar,
 * title bar); you render whatever you want inside.
 *
 * Communication with the host is the `connectToHost()` SDK — typed
 * postMessage helpers. See the @ensemble-edge/workspace/guest-sandbox
 * package for the full API.
 */

import { connectToHost } from '@ensemble-edge/workspace/guest-sandbox';

const host = connectToHost();

// Tell the host we're ready. It'll push back an `ensemble:context` message
// with our current path and any other context the workspace wants to share.
host.ready();

host.onContext((ctx) => {
  console.log('[{{APP_ID}}] received context from host:', ctx);
});

// Render whatever UI you want. This template renders plain DOM as the
// minimal example. Swap in your favorite framework.
const root = document.getElementById('root')!;
root.innerHTML = `
  <main style="font-family: system-ui, sans-serif; padding: 1.5rem; max-width: 60ch;">
    <h1 style="margin-top: 0;">{{APP_NAME}}</h1>
    <p style="color: #666;">
      This is a sandboxed guest app. It runs in a strict iframe and
      communicates with the workspace via postMessage.
    </p>
    <button id="say-hi" style="padding: 0.5rem 1rem; border-radius: 0.375rem; border: 1px solid #ccc; cursor: pointer;">
      Audit a "hi" event
    </button>
  </main>
`;

document.getElementById('say-hi')!.addEventListener('click', () => {
  host.audit('hi', { source: '{{APP_ID}}' });
});
