/**
 * Shell Client Entry Point
 *
 * This is the client-side entry point for the React shell SPA.
 * Uses shadcn/ui components from @ensemble-edge/ui.
 */

// Enable @preact/signals-react auto-tracking for React components
// This MUST be imported before any components that use signals
import '@preact/signals-react/runtime';

import { createRoot } from 'react-dom/client';
import { Shell } from './components/Shell';

/**
 * Mount the shell to the DOM.
 *
 * Note: We always use render() instead of hydrate() because the initial HTML
 * contains a loading spinner placeholder, not SSR'd Shell content. Preact's
 * hydrate() expects the DOM to match the component tree exactly.
 */
function initShell(): void {
  const container = document.getElementById('app');

  if (!container) {
    console.error('[Shell] Mount container #app not found');
    return;
  }

  // Always render fresh - the loading spinner is just a placeholder
  const root = createRoot(container);
  root.render(<Shell />);
  console.log('[Shell] Mounted');
}

// Initialize when DOM is ready
if (typeof window !== 'undefined') {
  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initShell);
    } else {
      initShell();
    }
  } catch (err) {
    console.error('[Shell] Failed to initialize:', err);
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = `<div style="padding:40px;color:red;font-family:monospace"><h2>Shell Error</h2><pre>${err instanceof Error ? err.stack || err.message : String(err)}</pre></div>`;
    }
  }
}

// Export for programmatic use
export { initShell };
