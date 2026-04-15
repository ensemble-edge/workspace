/**
 * Audit Page — Activity log viewer with filtering.
 */

import * as React from 'react';
import { useState, useEffect } from 'react';
import { ScrollText, RefreshCw } from 'lucide-react';

import {
  Card,
  CardContent,
  Button,
  Input,
  Badge,
  Skeleton,
} from '@ensemble-edge/ui';

interface AuditEvent {
  id: string;
  actor_id: string;
  actor_handle: string | null;
  app_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details_json: string | null;
  ip_address: string | null;
  created_at: string;
}

export function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const fetchEvents = (actionFilter?: string) => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '100' });
    if (actionFilter) params.set('action', actionFilter);

    fetch(`/_ensemble/core/audit/events?${params}`)
      .then((res) => res.json() as Promise<{ data?: AuditEvent[] }>)
      .then((result) => {
        setEvents(result.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchEvents(); }, []);

  const handleFilter = () => {
    fetchEvents(filter || undefined);
  };

  const actionColors: Record<string, string> = {
    'workspace.bootstrapped': 'bg-green-500/10 text-green-500',
    'user.login': 'bg-blue-500/10 text-blue-500',
    'user.logout': 'bg-muted text-muted-foreground',
    'member.invited': 'bg-amber-500/10 text-amber-500',
    'brand.updated': 'bg-purple-500/10 text-purple-500',
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
          <p className="text-muted-foreground">
            Activity history for this workspace
          </p>
        </div>
        <Button variant="outline" onClick={() => fetchEvents(filter || undefined)}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        <Input
          placeholder="Filter by action (e.g. user.login)"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleFilter()}
          className="max-w-sm"
        />
        <Button variant="outline" onClick={handleFilter}>Filter</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-4 p-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <ScrollText className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">No audit events yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {events.map((event) => (
                <div key={event.id} className="flex items-start gap-4 p-4 hover:bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={actionColors[event.action] || 'bg-muted text-muted-foreground'}>
                        {event.action}
                      </Badge>
                      {event.actor_handle && (
                        <span className="text-sm font-medium">@{event.actor_handle}</span>
                      )}
                      {event.resource_type && (
                        <span className="text-sm text-muted-foreground">
                          on {event.resource_type}{event.resource_id ? ` #${event.resource_id.slice(0, 8)}` : ''}
                        </span>
                      )}
                    </div>
                    {event.details_json && (
                      <p className="mt-1 text-xs text-muted-foreground font-mono truncate">
                        {event.details_json}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatTime(event.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
