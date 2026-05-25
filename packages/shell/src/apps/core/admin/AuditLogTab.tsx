/**
 * Settings → Audit Log tab.
 *
 * Skinny one-line-per-event row list. Each row leads with a timestamp,
 * then the action + actor. Click a row to expand into a detail panel
 * showing resource info + raw JSON details, with a copy-to-clipboard
 * button for the full event payload.
 *
 * Read-only — events are written by audit-log.ts elsewhere in the app.
 * The reads come from the existing /_ensemble/core/audit/events route.
 */

import * as React from 'react';
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
  Button,
  Badge,
  Input,
  toast,
} from '@ensemble-edge/ui';
import { authedFetch } from '../../../state';
import { ChevronRight, Copy, RefreshCw } from 'lucide-react';

interface AuditEvent {
  id: string;
  actor_id: string | null;
  actor_handle: string | null;
  app_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details_json: string | null;
  ip_address: string | null;
  created_at: string;
}

const ACTION_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  'auth.login': 'default',
  'auth.logout': 'secondary',
  'auth.failed_login': 'destructive',
  'api_key.created': 'default',
  'api_key.revoked': 'destructive',
  'api_key.regenerated': 'default',
  'credentials.updated': 'outline',
  'ai_tier.provisioned': 'default',
  'workspace.bootstrapped': 'outline',
};

function fmtTimestamp(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
    time: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  };
}

function prettyAction(action: string): string {
  // 'api_key.created' → 'API key · created'
  return action
    .split('.')
    .map((seg) => seg.replace(/_/g, ' '))
    .join(' · ');
}

export function AuditLogTab() {
  const [events, setEvents] = React.useState<AuditEvent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState('');
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const q = filter.trim() ? `?action=${encodeURIComponent(filter.trim())}` : '';
      const r = await authedFetch(`/_ensemble/core/audit/events${q}`);
      if (r.ok) {
        const body = await r.json() as { data: AuditEvent[] };
        setEvents(body.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [filter]);

  React.useEffect(() => { reload(); }, [reload]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Audit Log</CardTitle>
              <CardDescription>
                Workspace events — logins, API key changes, credential updates, and
                other admin actions. Click any row to see the full event payload.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="ml-1.5 hidden sm:inline">Refresh</span>
            </Button>
          </div>
          <div className="mt-3">
            <Input
              placeholder="Filter by action (e.g. auth.login, api_key)"
              value={filter}
              onChange={(e) => setFilter(e.currentTarget.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="text-sm text-muted-foreground p-6">Loading…</p>
          ) : events.length === 0 ? (
            <div className="text-center py-12 px-6">
              <p className="text-sm text-muted-foreground">No events match.</p>
              {filter && (
                <Button variant="link" size="sm" onClick={() => setFilter('')}>
                  Clear filter
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y border-y">
              {events.map((ev) => (
                <EventRow
                  key={ev.id}
                  event={ev}
                  expanded={expandedId === ev.id}
                  onToggle={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EventRow({
  event, expanded, onToggle,
}: { event: AuditEvent; expanded: boolean; onToggle: () => void }) {
  const { date, time } = fmtTimestamp(event.created_at);
  const badgeVariant = ACTION_BADGE_VARIANT[event.action] ?? 'outline';

  async function copyPayload() {
    const payload = {
      ...event,
      details: event.details_json ? safeParse(event.details_json) : null,
    };
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    toast.success('Copied event payload');
  }

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-6 py-2.5 flex items-center gap-3 hover:bg-muted/40 transition-colors text-left"
      >
        <ChevronRight
          className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`}
        />
        <span className="text-xs font-mono text-muted-foreground shrink-0 tabular-nums">
          <span className="hidden sm:inline">{date} </span>{time}
        </span>
        <Badge variant={badgeVariant} className="shrink-0 text-xs">
          {prettyAction(event.action)}
        </Badge>
        <span className="text-sm text-muted-foreground truncate flex-1 min-w-0">
          {event.actor_handle ?? '—'}
          {event.resource_type && (
            <>
              {' '}
              <span className="text-muted-foreground/60">on</span>{' '}
              {event.resource_type}
              {event.resource_id && (
                <span className="text-muted-foreground/60 font-mono ml-1">
                  {event.resource_id.slice(0, 8)}…
                </span>
              )}
            </>
          )}
        </span>
      </button>
      {expanded && (
        <div className="px-6 pb-4 pt-1 bg-muted/30">
          <div className="flex items-start justify-between gap-3 mb-3">
            <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-muted-foreground">When</dt>
              <dd className="font-mono">{event.created_at}</dd>
              <dt className="text-muted-foreground">Action</dt>
              <dd className="font-mono">{event.action}</dd>
              <dt className="text-muted-foreground">Actor</dt>
              <dd>
                {event.actor_handle ?? <em className="text-muted-foreground">unknown</em>}
                {event.actor_id && (
                  <span className="text-muted-foreground font-mono ml-2 text-[10px]">
                    ({event.actor_id})
                  </span>
                )}
              </dd>
              {event.resource_type && (
                <>
                  <dt className="text-muted-foreground">Resource</dt>
                  <dd className="font-mono">
                    {event.resource_type}
                    {event.resource_id && ` · ${event.resource_id}`}
                  </dd>
                </>
              )}
              {event.ip_address && (
                <>
                  <dt className="text-muted-foreground">IP</dt>
                  <dd className="font-mono">{event.ip_address}</dd>
                </>
              )}
              {event.app_id && (
                <>
                  <dt className="text-muted-foreground">App</dt>
                  <dd className="font-mono">{event.app_id}</dd>
                </>
              )}
            </dl>
            <Button variant="ghost" size="sm" onClick={copyPayload} className="shrink-0">
              <Copy className="h-3.5 w-3.5" />
              <span className="ml-1.5 hidden sm:inline">Copy</span>
            </Button>
          </div>
          {event.details_json && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Details</p>
              <pre className="text-[11px] font-mono bg-background border rounded p-3 overflow-x-auto">
                {prettyPrintDetails(event.details_json)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function safeParse(json: string): unknown {
  try { return JSON.parse(json); } catch { return json; }
}

function prettyPrintDetails(json: string): string {
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}
