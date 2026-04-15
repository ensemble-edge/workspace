/**
 * Apps Page — List installed guest apps.
 */

import * as React from 'react';
import { useState, useEffect } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@ensemble-edge/ui';

import { navigate } from '../../../state';

export function AppsPage() {
  const [apps, setApps] = useState<Array<{
    id: string;
    name: string;
    version: string;
    category: string;
    enabled: boolean;
    icon?: string;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/_ensemble/apps')
      .then((res) => res.json() as Promise<{ data?: typeof apps }>)
      .then((data) => {
        setApps(data.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleAppClick = (appId: string) => {
    navigate(`/apps/${appId}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Apps</h1>
        <p className="text-muted-foreground">
          Manage installed apps and connectors
        </p>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-10 w-10 rounded-lg" />
                <Skeleton className="h-4 w-24" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : apps.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/50">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            <p className="mt-4 text-muted-foreground">No apps installed yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <Card
              key={app.id}
              className="cursor-pointer transition-colors hover:bg-accent"
              onClick={() => handleAppClick(app.id)}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-lg">
                    {app.icon || '\uD83D\uDCE6'}
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">{app.name}</CardTitle>
                    <CardDescription className="text-xs">
                      {app.category} &bull; v{app.version}
                    </CardDescription>
                  </div>
                  <div className={`rounded-full px-2 py-1 text-xs ${
                    app.enabled
                      ? 'bg-green-500/10 text-green-500'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {app.enabled ? 'Active' : 'Disabled'}
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
