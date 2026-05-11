/**
 * The sandboxed reference app. Plain DOM, no framework. Connects to the
 * workspace via @ensemble-edge/workspace/guest-sandbox.
 */

import { connectToHost } from '@ensemble-edge/guest-sandbox';

const host = connectToHost();
host.ready();

let lastContext: Record<string, unknown> | null = null;
host.onContext((ctx) => {
  lastContext = ctx;
  render();
});

const root = document.getElementById('root')!;

function render() {
  root.innerHTML = `
    <main style="font-family: system-ui, sans-serif; padding: 1.5rem; max-width: 60ch; line-height: 1.5;">
      <h1 style="margin: 0 0 0.25rem;">Hello, Sandboxed</h1>
      <p style="margin: 0 0 1rem; color: #666;">
        This is a sandboxed guest app. It can't read the workspace's
        cookies or DOM; it talks to the host only through postMessage.
      </p>
      <pre style="background: #f3f4f6; padding: 0.75rem; border-radius: 6px; overflow-x: auto; font-size: 0.85em;">${JSON.stringify(lastContext, null, 2) || '(waiting for context...)'}</pre>
      <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
        <button data-action="audit"  style="padding: 0.5rem 1rem; border-radius: 6px; border: 1px solid #d4d4d8; background: #fff; cursor: pointer;">Audit event</button>
        <button data-action="nav-apps" style="padding: 0.5rem 1rem; border-radius: 6px; border: 1px solid #d4d4d8; background: #fff; cursor: pointer;">Navigate host → /apps</button>
      </div>
    </main>
  `;

  root.querySelector('[data-action="audit"]')!.addEventListener('click', () => {
    host.audit('clicked_audit_button', { source: 'hello-sandboxed' });
  });
  root.querySelector('[data-action="nav-apps"]')!.addEventListener('click', () => {
    host.navigate('/apps');
  });
}

render();
