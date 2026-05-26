/**
 * App View Page — Render a guest app per its tier (v0.1.9+).
 *
 * Three tiers, three render strategies:
 *
 *   'component' — Default. The guest's UI is an ES module that default-
 *                 exports a React component. We `import()` it dynamically
 *                 and render it directly in the shell's React tree.
 *                 No iframe. Same document, same :root, same theme.
 *                 Visually identical to core apps by construction.
 *
 *   'iframe'    — Same-origin iframe; loads /_ensemble/runtime/v1/runtime.js.
 *                 Guest worker serves an HTML shell + a tiny app bundle.
 *                 Useful when you need iframe boundary semantics without
 *                 strict sandboxing.
 *
 *   'sandboxed' — Strict iframe sandbox (allow-scripts only). For untrusted
 *                 code. Communicates only via postMessage.
 *
 * The tier comes from guest_apps.tier surfaced via the manifest endpoint.
 */

import * as React from 'react';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useSignals } from '@preact/signals-react/runtime';

import {
  Card,
  CardContent,
  Button,
} from '@ensemble-edge/ui';

import { currentPath, navigate, registerIframeForEvents, toast } from '../../../state';
import { authedFetch } from '../../../state';

type Tier = 'component' | 'iframe' | 'sandboxed';

interface AppManifestResponse {
  name?: string;
  tier?: Tier;
}

interface AppInfo {
  name: string;
  id: string;
  tier: Tier;
}

export function AppViewPage() {
  useSignals();
  const path = currentPath.value;
  const appId = path.split('/')[2];
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authedFetch(`/_ensemble/apps/${appId}/manifest`)
      .then((res) => {
        if (!res.ok) throw new Error('App not found');
        return res.json() as Promise<AppManifestResponse>;
      })
      .then((manifest) => {
        setAppInfo({
          name: manifest.name || appId,
          id: appId,
          tier: manifest.tier ?? 'iframe',
        });
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [appId]);

  if (loading) return <LoadingState appId={appId} />;
  if (error) return <ErrorState message={error} />;

  const info = appInfo!;
  switch (info.tier) {
    case 'component':
      return <ComponentTierRenderer appInfo={info} />;
    case 'iframe':
    case 'sandboxed':
      return <IframeTierRenderer appInfo={info} path={path} />;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Tier 1: 'component' — render in host's React tree, no iframe
// ────────────────────────────────────────────────────────────────────────────

/**
 * Dynamically imports the guest's component module and renders it.
 * The guest worker serves /_ensemble/apps/<id>/ui/component.js as an ES
 * module whose default export is a React component.
 *
 * No iframe. The component renders directly in the shell's <Viewport>,
 * so it inherits every CSS variable, font, theme rule, and React
 * context that the host already provides.
 */
function ComponentTierRenderer({ appInfo }: { appInfo: AppInfo }) {
  const [Component, setComponent] = useState<React.ComponentType | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const url = `/_ensemble/apps/${appInfo.id}/ui/component.js`;
    import(/* @vite-ignore */ url)
      .then((mod) => {
        if (cancelled) return;
        const C = (mod && typeof mod === 'object' && 'default' in mod) ? mod.default : null;
        if (typeof C !== 'function') {
          setImportError(`Guest module at ${url} did not export a default React component.`);
          return;
        }
        setComponent(() => C as React.ComponentType);
      })
      .catch((err: Error) => {
        if (!cancelled) setImportError(err.message);
      });
    return () => { cancelled = true; };
  }, [appInfo.id]);

  if (importError) return <ErrorState message={importError} />;
  if (!Component) return <LoadingState appId={appInfo.id} />;

  // Render the guest in an error-boundary so a crashing component doesn't
  // unmount the whole shell.
  return (
    <ComponentErrorBoundary appName={appInfo.name}>
      <Suspense fallback={<LoadingState appId={appInfo.id} />}>
        <Component />
      </Suspense>
    </ComponentErrorBoundary>
  );
}

class ComponentErrorBoundary extends React.Component<
  { appName: string; children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) {
    console.error(`[guest:${this.props.appName}] crashed:`, error);
  }
  render() {
    if (this.state.error) {
      return <ErrorState message={`${this.props.appName} crashed: ${this.state.error.message}`} />;
    }
    return this.props.children;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Tiers 2 & 3: iframe / sandboxed — render in an iframe with proper sandbox
// ────────────────────────────────────────────────────────────────────────────

function IframeTierRenderer({ appInfo, path }: { appInfo: AppInfo; path: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Listen for postMessage from the iframe and respond with CSS-var snapshot
  // and context. This is what makes iframe-tier apps inherit host design
  // tokens (padding, fonts, radius) on mount.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Per-iframe unregister handle for the event-bus subscription.
    let unregisterEvents: (() => void) | null = null;

    function onMessage(event: MessageEvent) {
      if (event.source !== iframe?.contentWindow) return;
      const msg = event.data as { type?: string; v?: number; path?: string };
      if (!msg || typeof msg.type !== 'string' || !msg.type.startsWith('ensemble:')) return;

      switch (msg.type) {
        case 'ensemble:ready':
          sendContext(iframe);
          break;
        case 'ensemble:navigate':
          if (typeof msg.path === 'string' && msg.path.startsWith('/')) navigate(msg.path);
          break;
        case 'ensemble:audit':
          authedFetch('/_ensemble/audit/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: appInfo.id, ...((msg as unknown) as Record<string, unknown>) }),
          }).catch(() => { /* best-effort */ });
          break;
        case 'ensemble:subscribe-events':
          // Iframe asked to receive workspace events. Register its window
          // with the bus; unregister on iframe unload (covered by the
          // useEffect cleanup below).
          if (!unregisterEvents && iframe.contentWindow) {
            unregisterEvents = registerIframeForEvents(iframe.contentWindow);
          }
          break;
        case 'ensemble:toast': {
          // v0.1.86: iframe-tier guests ask the host to show a toast.
          // Functions (action.onClick) don't survive postMessage, so the
          // bridge supports kind/message/description/duration only. Action
          // buttons are a UI feature of the in-tree shell toast surface
          // and stay reserved for component-tier guests that call the
          // host toast directly.
          const p = (msg as unknown as { payload?: {
            kind?: 'success' | 'error' | 'warning' | 'info';
            message?: unknown;
            description?: unknown;
            duration?: unknown;
          } }).payload;
          if (!p || typeof p.message !== 'string') break;
          const kind = p.kind === 'error' || p.kind === 'warning' || p.kind === 'info'
            ? p.kind : 'success';
          const description = typeof p.description === 'string' ? p.description : undefined;
          const duration = typeof p.duration === 'number' ? p.duration : undefined;
          toast[kind](p.message, { description, duration });
          break;
        }
      }
    }
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
      if (unregisterEvents) unregisterEvents();
    };
  }, [appInfo.id]);

  const subpath = path.replace(/^\/apps\/[\w-]+/, '') || '/';
  const appUrl = `/_ensemble/apps/${appInfo.id}${subpath}`;
  const sandbox = appInfo.tier === 'sandboxed'
    ? 'allow-scripts'
    : 'allow-scripts allow-same-origin allow-forms allow-popups';

  return (
    <div className="flex flex-1 flex-col">
      <iframe
        ref={iframeRef}
        src={appUrl}
        className="flex-1 w-full border-0 block"
        title={appInfo.name}
        sandbox={sandbox}
        data-tier={appInfo.tier}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Shared helpers (loading state, error state, postMessage senders)
// ────────────────────────────────────────────────────────────────────────────

function LoadingState({ appId }: { appId: string }) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-muted-foreground">Loading {appId}...</p>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Card className="max-w-md">
        <CardContent className="flex flex-col items-center py-8">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-destructive">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h2 className="mt-4 text-lg font-semibold">Unable to load app</h2>
          <p className="mt-1 text-muted-foreground">{message}</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/apps')}>
            &larr; Back to Apps
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function sendContext(iframe: HTMLIFrameElement) {
  try {
    iframe.contentWindow?.postMessage(
      { type: 'ensemble:cssVars', v: 1, payload: snapshotHostCssVars() },
      '*',
    );
    iframe.contentWindow?.postMessage(
      { type: 'ensemble:context', v: 1, payload: { path: window.location.pathname } },
      '*',
    );
  } catch {
    /* iframe may not be ready; the guest will retry */
  }
}

function snapshotHostCssVars(): Record<string, string> {
  const out: Record<string, string> = {};
  const cs = getComputedStyle(document.documentElement);
  for (const name of collectCustomPropertyNames()) {
    const value = cs.getPropertyValue(name).trim();
    if (value) out[name] = value;
  }
  return out;
}

function collectCustomPropertyNames(): Set<string> {
  const names = new Set<string>();
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList | null = null;
    try { rules = sheet.cssRules; } catch { continue; }
    if (!rules) continue;
    walkRules(rules, names);
  }
  return names;
}

function walkRules(rules: CSSRuleList, names: Set<string>): void {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) {
      const style = rule.style;
      for (let i = 0; i < style.length; i++) {
        const prop = style.item(i);
        if (prop.startsWith('--')) names.add(prop);
      }
    } else if ('cssRules' in rule && (rule as CSSGroupingRule).cssRules) {
      walkRules((rule as CSSGroupingRule).cssRules, names);
    }
  }
}
