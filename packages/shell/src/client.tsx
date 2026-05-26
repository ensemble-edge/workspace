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
import { authedFetch, subscribeWorkspaceEvent, registerIframeForEvents, toast } from './state';
import type { WorkspaceEvent, WorkspaceEventType } from './state';

/**
 * useAI hook — see guest-runtime/runtime.tsx for the canonical version.
 * Duplicated here intentionally: the shell's runtime exposure is for
 * component-tier guests imported into the host React tree, while
 * guest-runtime is for iframe-tier guests. Same shape, same behavior,
 * different host context.
 */
/** v0.1.83: matches the extractor in @ensemble-edge/sdk and
 *  @ensemble-edge/guest-runtime so result.text is identical across all
 *  three useAI surfaces (component-tier shell, iframe-tier runtime,
 *  external SDK). */
function extractAiText(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const d = data as Record<string, unknown>;
  const choices = d.choices as Array<{ message?: { content?: string } }> | undefined;
  if (Array.isArray(choices) && choices[0]?.message?.content) {
    return String(choices[0].message.content);
  }
  const content = d.content as Array<{ text?: string }> | undefined;
  if (Array.isArray(content) && content[0]?.text) {
    return String(content[0].text);
  }
  const result = d.result as { response?: string; translated_text?: string } | undefined;
  if (result?.response) return String(result.response);
  if (result?.translated_text) return String(result.translated_text);
  if (typeof d.response === 'string') return d.response;
  return '';
}

/**
 * useSecret — see guest-runtime/runtime.tsx + @ensemble-edge/sdk for
 * the canonical versions. Component-tier guests run inside the host
 * React tree, so they can't derive appId from window.location like
 * iframe-tier guests can — appId is required. Shape matches the SDK
 * version exactly (v0.1.83 lesson: keep shapes identical across all
 * runtimes so the same guest code lifts between tiers).
 *
 * Guest apps are NOT required to use the workspace secret store. They
 * may keep secrets in their own storage; this is provided as a
 * convenience for apps that don't want to manage encryption themselves.
 */
type SecretScope = 'app' | 'user';
interface UseSecretOptions {
  appId: string;
  key: string;
  scope?: SecretScope;
}
function useSecret({ appId, key, scope = 'app' }: UseSecretOptions) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const baseUrl = React.useMemo(
    () => `/_ensemble/apps/${encodeURIComponent(appId)}/_secrets/${encodeURIComponent(key)}?scope=${scope}`,
    [appId, key, scope],
  );

  const get = React.useCallback(async (): Promise<string | null> => {
    setLoading(true); setError(null);
    try {
      const r = await authedFetch(baseUrl);
      if (r.status === 404) return null;
      if (!r.ok) {
        const detail = await r.text().catch(() => '');
        throw new Error(`secret read failed (HTTP ${r.status}): ${detail.slice(0, 200)}`);
      }
      const body = await r.json() as { value: string };
      return body.value;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'secret read failed';
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  const set = React.useCallback(async (value: string): Promise<void> => {
    setLoading(true); setError(null);
    try {
      const r = await authedFetch(baseUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });
      if (!r.ok) {
        const detail = await r.text().catch(() => '');
        throw new Error(`secret write failed (HTTP ${r.status}): ${detail.slice(0, 200)}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'secret write failed';
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  const remove = React.useCallback(async (): Promise<boolean> => {
    setLoading(true); setError(null);
    try {
      const r = await authedFetch(baseUrl, { method: 'DELETE' });
      if (!r.ok) {
        const detail = await r.text().catch(() => '');
        throw new Error(`secret delete failed (HTTP ${r.status}): ${detail.slice(0, 200)}`);
      }
      const body = await r.json() as { ok: boolean };
      return body.ok;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'secret delete failed';
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  return { get, set, remove, loading, error };
}

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
        // Use authedFetch so an expired access token triggers a refresh
        // and retry transparently — important because AI calls can be
        // fired well after page-load, when the original access token
        // has likely rotated out.
        const response = await authedFetch(`/_ensemble/ai/call/${encodeURIComponent(tier)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
        return { response, data, text: extractAiText(data), fallback: fb };
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
 * useLocales — see guest-runtime/runtime.tsx for the canonical version.
 * Duplicated here for the same reason as useAI: component-tier guests
 * run in the host React tree, iframe-tier guests run in the bundled
 * runtime. Same shape, same behavior.
 */
interface WorkspaceLocale {
  code: string;
  display_name: string;
  is_default: boolean;
  enabled: boolean;
}

let _localesCache: WorkspaceLocale[] | null = null;
let _localesPromise: Promise<WorkspaceLocale[]> | null = null;

async function fetchLocalesOnce(): Promise<WorkspaceLocale[]> {
  if (_localesCache) return _localesCache;
  if (_localesPromise) return _localesPromise;
  _localesPromise = (async () => {
    const r = await authedFetch('/_ensemble/locales');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const body = (await r.json()) as { locales: WorkspaceLocale[] };
    _localesCache = body.locales ?? [];
    return _localesCache;
  })();
  try {
    return await _localesPromise;
  } finally {
    _localesPromise = null;
  }
}

/**
 * useWorkspaceEvent — subscribe to workspace mutation events.
 *
 * Component-tier hook. Calls the handler whenever the workspace emits
 * an event matching `type` (or an array of types). Handler reference
 * doesn't need to be stable; the subscription re-registers when it
 * changes. Returns nothing.
 *
 * Event types in v0.1.17:
 *   'locale.added' | 'locale.removed' | 'locale.default-changed'
 *   'brand.tokens.changed' | 'user.role.changed' | 'workspace.settings.changed'
 */
function useWorkspaceEvent(
  type: WorkspaceEventType | WorkspaceEventType[],
  handler: (event: WorkspaceEvent) => void,
) {
  const handlerRef = React.useRef(handler);
  handlerRef.current = handler;

  React.useEffect(() => {
    const types = Array.isArray(type) ? type : [type];
    const unsub = subscribeWorkspaceEvent((event) => {
      if (types.includes(event.type)) {
        handlerRef.current(event);
      }
    });
    return unsub;
  }, [Array.isArray(type) ? type.join(',') : type]); // eslint-disable-line react-hooks/exhaustive-deps
}

interface FontRoleResolved {
  family: string;
  weight: string;
  style: 'normal' | 'italic';
  letterSpacing: string;
  textTransform: 'none' | 'uppercase' | 'lowercase';
  fontSize: string;
  scaleRatio: string;
  isSystem: boolean;
  stack: string;
  label?: string;
  usage?: string;
  inheritedFrom?: string;
}
type FontRoleKey =
  | 'wordmark' | 'display' | 'heading' | 'subheading'
  | 'body' | 'eyebrow' | 'label' | 'caption' | 'mono';
type ActiveFonts = Record<FontRoleKey, FontRoleResolved> | null;

let _fontsCache: ActiveFonts = null;
let _fontsPromise: Promise<ActiveFonts> | null = null;

async function fetchFontsOnce(): Promise<ActiveFonts> {
  if (_fontsCache) return _fontsCache;
  if (_fontsPromise) return _fontsPromise;
  _fontsPromise = (async () => {
    const r = await authedFetch('/_ensemble/core/brand/fonts/active');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const body = (await r.json()) as { roles: ActiveFonts };
    _fontsCache = body.roles ?? null;
    return _fontsCache;
  })();
  try { return await _fontsPromise; } finally { _fontsPromise = null; }
}

function useFonts() {
  const [roles, setRoles] = React.useState<ActiveFonts>(_fontsCache);
  const [loading, setLoading] = React.useState(!_fontsCache);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetchFontsOnce()
      .then((data) => { if (!cancelled) { setRoles(data); setLoading(false); } })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  return { roles, loading, error };
}

// Invalidate the fonts cache when brand tokens change. Component-tier
// uses the in-memory event bus directly.
subscribeWorkspaceEvent((event) => {
  if (event.type === 'brand.tokens.changed') _fontsCache = null;
});

function useLocales() {
  const [locales, setLocales] = React.useState<WorkspaceLocale[]>(_localesCache ?? []);
  const [loading, setLoading] = React.useState(!_localesCache);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetchLocalesOnce()
      .then((data) => {
        if (!cancelled) { setLocales(data); setLoading(false); }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  const defaultLocale = locales.find((l) => l.is_default)?.code ?? 'en';
  const enabledCodes = [...locales]
    .filter((l) => l.enabled)
    .sort((a, b) => (a.is_default && !b.is_default ? -1 : !a.is_default && b.is_default ? 1 : 0))
    .map((l) => l.code);
  return { locales, defaultLocale, enabledCodes, loading, error };
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
    useLocales,
    useWorkspaceEvent,
    useFonts,
    // Encrypted secret storage hook (v0.1.85). Component-tier signature
    // takes explicit appId (host pathname is the shell's, not the guest's).
    useSecret,
    // Toast notifications (v0.1.86). Component-tier guests share the
    // shell's React tree and can call the real toast() directly — no
    // postMessage hop. Same `toast` instance powers core-app toasts.
    toast,
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
