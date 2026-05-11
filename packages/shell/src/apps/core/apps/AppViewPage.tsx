/**
 * App View Page — Render a guest app in an iframe.
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

export function AppViewPage() {
  useSignals();
  const path = currentPath.value;
  const appId = path.split('/')[2];
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [appInfo, setAppInfo] = useState<{ name: string; id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/_ensemble/apps/${appId}/manifest`)
      .then((res) => {
        if (!res.ok) throw new Error('App not found');
        return res.json() as Promise<{ name?: string }>;
      })
      .then((manifest) => {
        setAppInfo({ name: manifest.name || appId, id: appId });
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [appId]);

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

  return (
    // flex-1 on the container, AND on the iframe — without flex-1 on the
    // iframe itself, the parent's flex layout doesn't allocate space and
    // the iframe collapses to its intrinsic 150px height. `w-full` alone
    // isn't enough because iframes are replaced elements; they need an
    // explicit "fill the available space" rule from the flex parent.
    <div className="flex flex-1 flex-col">
      <iframe
        ref={iframeRef}
        src={appUrl}
        className="flex-1 w-full border-0 block"
        title={appInfo?.name || appId}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  );
}
