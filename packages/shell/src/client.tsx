/**
 * Shell Client Entry Point
 *
 * This is the client-side entry point for the React shell SPA.
 * Uses shadcn/ui components from @ensemble-edge/ui.
 */

// Enable @preact/signals-react auto-tracking for React components
// This MUST be imported before any components that use signals
import '@preact/signals-react/runtime';

import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { Shell } from './components/Shell';
import * as EnsembleUI from '@ensemble-edge/ui';

/**
 * useAI hook — see guest-runtime/runtime.tsx for the canonical version.
 * Duplicated here intentionally: the shell's runtime exposure is for
 * component-tier guests imported into the host React tree, while
 * guest-runtime is for iframe-tier guests. Same shape, same behavior,
 * different host context.
 */
function useAI({ tier }: { tier: string }) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fallback, setFallback] = React.useState<string | null>(null);

  const call = React.useCallback(
    async (body: unknown) => {
      setLoading(true);
      setError(null);
      setFallback(null);
      try {
        const response = await fetch(`/_ensemble/ai/call/${encodeURIComponent(tier)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        });
        const fb = response.headers.get('X-Ensemble-Tier-Fallback');
        if (fb) setFallback(fb);
        let data: unknown = null;
        try {
          data = await response.clone().json();
        } catch {
          data = await response.clone().text();
        }
        if (!response.ok) {
          const msg =
            typeof data === 'object' && data && 'error' in data
              ? String((data as { error: unknown }).error)
              : `AI call failed: ${response.status}`;
          setError(msg);
        }
        return { response, data, fallback: fb };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'AI call failed';
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [tier],
  );

  return { call, loading, error, fallback };
}

/**
 * Expose `window.Ensemble` so that dynamically-imported guest component
 * modules (tier: 'component') can render against the same React + UI
 * library the shell uses. The guest's compiled JSX targets
 * window.Ensemble.createElement via the jsx-runtime shim from
 * @ensemble-edge/workspace/guest-runtime.
 *
 * No iframe here — this is the shell's own window. Guest components
 * imported via `import('/_ensemble/apps/<id>/ui/component.js')` run in
 * the same JS context as the shell, so they pick up this global directly.
 */
function installEnsembleGlobal() {
  if (typeof window === 'undefined') return;
  (window as unknown as { Ensemble: Record<string, unknown> }).Ensemble = {
    version: 1,
    React,
    createElement: React.createElement,
    Fragment: React.Fragment,
    useState: React.useState,
    useEffect: React.useEffect,
    useMemo: React.useMemo,
    useCallback: React.useCallback,
    useRef: React.useRef,
    useContext: React.useContext,
    useReducer: React.useReducer,
    ...EnsembleUI,
    // Layout primitives re-exported under their short names.
    Page: EnsembleUI.EnsemblePage,
    Section: EnsembleUI.EnsembleSection,
    // AI runtime hook (v0.1.12).
    useAI,
  };
}

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

  // Install window.Ensemble BEFORE rendering — component-tier guest apps
  // imported during shell render reference it during their own load.
  installEnsembleGlobal();

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
