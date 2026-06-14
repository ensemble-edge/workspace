/**
 * App Manager — one place to govern every app (built-in + guest).
 *
 * Lists all apps from the registry (/_ensemble/core/apps), shows tier +
 * surface kind + status, lets an operator enable/disable governable apps,
 * and surfaces the recommended CF routes block (routes-hint) so routing
 * is configured from what the platform tells you — not hand-derived.
 */

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Switch,
  Skeleton,
  toast,
} from '@ensemble-edge/ui';

import { authedFetch } from '../../../state';

interface AppMount {
  host: string;
  path: string;
}
interface AppEntry {
  id: string;
  tier: 'core' | 'guest';
  name: string;
  icon: string;
  description: string;
  basePath: string;
  surfaceKind: 'operator' | 'public' | 'consumer';
  status: 'active' | 'inactive' | 'needs_config';
  mounts: AppMount[];
  governable: boolean;
}

const SURFACE_LABEL: Record<AppEntry['surfaceKind'], string> = {
  operator: 'Operator tool',
  public: 'Public pages',
  consumer: 'Consumer',
};

export function AppsPage() {
  const [apps, setApps] = useState<AppEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await authedFetch('/_ensemble/core/apps').catch(() => null);
    if (r?.ok) {
      const body = (await r.json()) as { apps: AppEntry[] };
      setApps(body.apps ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = useCallback(async (app: AppEntry, active: boolean) => {
    setBusy(app.id);
    // optimistic
    setApps((prev) => prev.map((a) => (a.id === app.id ? { ...a, status: active ? 'active' : 'inactive' } : a)));
    try {
      const r = await authedFetch(`/_ensemble/core/apps/${encodeURIComponent(app.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: active ? 'active' : 'inactive' }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `failed: ${r.status}`);
      }
      toast.success(`${app.name} ${active ? 'enabled' : 'disabled'}`);
    } catch (e) {
      // revert
      setApps((prev) => prev.map((a) => (a.id === app.id ? { ...a, status: active ? 'inactive' : 'active' } : a)));
      toast.error(e instanceof Error ? e.message : 'Failed to update app');
    } finally {
      setBusy(null);
    }
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Apps</h1>
        <p className="text-muted-foreground">
          Every app in this workspace — built-in and guest. Enable, disable, and see where each
          one is routed.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-64" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {apps.map((app) => (
              <Card key={app.id} className={app.status !== 'active' ? 'opacity-60' : undefined}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base">{app.name}</CardTitle>
                        <Badge variant={app.tier === 'core' ? 'secondary' : 'outline'}>{app.tier}</Badge>
                        <Badge variant="outline">{SURFACE_LABEL[app.surfaceKind]}</Badge>
                        {app.status !== 'active' && <Badge variant="outline">disabled</Badge>}
                      </div>
                      <CardDescription className="mt-1">{app.description}</CardDescription>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {app.mounts.map((m, i) => (
                          <span key={i} className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                            {m.host === '*' ? '(workspace host)' : m.host}
                            {m.path}
                          </span>
                        ))}
                      </div>
                    </div>
                    {app.governable ? (
                      <label className="flex shrink-0 items-center gap-2 text-sm">
                        <Switch
                          checked={app.status === 'active'}
                          disabled={busy === app.id}
                          onCheckedChange={(v) => void toggle(app, v)}
                        />
                        {app.status === 'active' ? 'Enabled' : 'Disabled'}
                      </label>
                    ) : (
                      <span className="shrink-0 text-xs text-muted-foreground">always on</span>
                    )}
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>

          <RoutingSetupCard />
        </>
      )}
    </div>
  );
}

// ─────────────────────── Routing setup ───────────────────────

function RoutingSetupCard() {
  const [hint, setHint] = useState<{ hosts: string[]; wrangler: string; note: string } | null>(null);

  useEffect(() => {
    (async () => {
      const r = await authedFetch('/_ensemble/core/apps/routes-hint').catch(() => null);
      if (r?.ok) setHint((await r.json()) as { hosts: string[]; wrangler: string; note: string });
    })();
  }, []);

  if (!hint) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Routing setup</CardTitle>
        <CardDescription>
          The Cloudflare zone routes this workspace's public surfaces need. The platform derives
          these from each app's mounts — you don't hand-author them. Paste into the worker's
          <code> wrangler.toml</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {hint.hosts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No brand-domain mounts configured — public pages serve on the workspace host, which
            needs no extra zone routes. Add a brand domain in Settings → Domains, then mount an
            app on it.
          </p>
        ) : (
          <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{hint.wrangler}</pre>
        )}
        <p className="text-xs text-muted-foreground">{hint.note}</p>
      </CardContent>
    </Card>
  );
}
