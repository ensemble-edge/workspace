/**
 * App View Page — Render a guest app in an iframe.
 *
 * Two isolation modes (v0.1.6+):
 *
 *   trusted   — iframe has allow-same-origin; loads workspace's runtime;
 *               shares React + UI. For first-party apps.
 *   sandboxed — strict sandbox (allow-scripts only); no shared origin;
 *               no runtime access; communicates via postMessage.
 *               For third-party / untrusted apps.
 *
 * The mode comes from the guest_apps.isolation column, surfaced via the
 * /_ensemble/apps/<id>/manifest endpoint.
 */

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useSignals } from '@preact/signals-react/runtime';

import {
  Card,
  CardContent,
  Button,
} from '@ensemble-edge/ui';

import { currentPath, navigate } from '../../../state';

type Isolation = 'trusted' | 'sandboxed';

interface AppManifestResponse {
  name?: string;
  isolation?: Isolation;
}

export function AppViewPage() {
  useSignals();
  const path = currentPath.value;
  const appId = path.split('/')[2];
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [appInfo, setAppInfo] = useState<{ name: string; id: string; isolation: Isolation } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/_ensemble/apps/${appId}/manifest`)
      .then((res) => {
        if (!res.ok) throw new Error('App not found');
        return res.json() as Promise<AppManifestResponse>;
      })
      .then((manifest) => {
        setAppInfo({
          name: manifest.name || appId,
          id: appId,
          isolation: manifest.isolation ?? 'trusted',
        });
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [appId]);

  // Listen for postMessage from sandboxed iframes. We accept a small fixed
  // protocol — see packages/guest-sandbox/src/protocol.ts for the schema.
  // Trusted iframes also can use this but typically reach for window.Ensemble
  // directly.
  useEffect(() => {
    if (!appInfo) return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    function onMessage(event: MessageEvent) {
      // Authenticate by message source — origin will be "null" for sandboxed.
      if (event.source !== iframe?.contentWindow) return;
      const msg = event.data as { type?: string; v?: number; path?: string };
      if (!msg || typeof msg.type !== 'string' || !msg.type.startsWith('ensemble:')) return;

      switch (msg.type) {
        case 'ensemble:ready':
          // Guest is ready. Send a snapshot of the current theme/context.
          sendContext(iframe);
          break;
        case 'ensemble:navigate':
          if (typeof msg.path === 'string' && msg.path.startsWith('/')) {
            navigate(msg.path);
          }
          break;
        case 'ensemble:audit':
          // Forward to the audit log (best-effort, no auth needed — iframe is
          // already authenticated via the gateway's context headers).
          fetch('/_ensemble/audit/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: appId, ...((msg as unknown) as Record<string, unknown>) }),
          }).catch(() => { /* best-effort */ });
          break;
        default:
          // Unknown message types are ignored, not rejected — additive evolution.
      }
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [appInfo, appId]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading {appId}...</p>
        </div>
      </div>
    );
  }

  if (error) {
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
            <p className="mt-1 text-muted-foreground">{error}</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/apps')}>
              &larr; Back to Apps
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Forward the full subpath through the gateway so the guest worker
  // can route on its own. `/apps/quiz-cms/schemas/abc` →
  // `/_ensemble/apps/quiz-cms/schemas/abc`. Falls back to root if no suffix.
  const subpath = path.replace(/^\/apps\/[\w-]+/, '') || '/';
  const appUrl = `/_ensemble/apps/${appId}${subpath}`;
  const isolation = appInfo!.isolation;

  // Sandbox attribute differs by isolation mode.
  // - trusted: shared origin (loads the runtime, calls back to workspace API)
  // - sandboxed: NO same-origin, NO forms, NO popups. Just scripts. Untrusted
  //   code can't read the workspace's cookies or DOM.
  const sandbox = isolation === 'sandboxed'
    ? 'allow-scripts'
    : 'allow-scripts allow-same-origin allow-forms allow-popups';

  return (
    <div className="flex flex-1 flex-col">
      <iframe
        ref={iframeRef}
        src={appUrl}
        className="flex-1 w-full border-0 block"
        title={appInfo!.name}
        sandbox={sandbox}
        data-isolation={isolation}
      />
    </div>
  );
}

/** Push a context snapshot to the iframe. Used on ensemble:ready. */
function sendContext(iframe: HTMLIFrameElement) {
  // For sandboxed iframes contentWindow exists but cross-origin; postMessage
  // still works. We use targetOrigin '*' because sandboxed iframes have a
  // 'null' origin — there's no other valid targetOrigin to use.
  // Security note: the messages we send are not sensitive (just brand
  // tokens and viewport state); auth happens via gateway-injected headers.
  try {
    iframe.contentWindow?.postMessage(
      {
        type: 'ensemble:context',
        v: 1,
        payload: {
          path: window.location.pathname,
          // Brand tokens are already loaded into the iframe via
          // /_ensemble/brand/css — we don't need to send them here.
        },
      },
      '*',
    );
  } catch {
    /* iframe may not be ready; the guest will retry by sending another ready */
  }
}
