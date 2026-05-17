/**
 * Setup Checklist
 *
 * Fetches /_ensemble/setup/status and renders a 3-item checklist on the
 * home page. Self-hides once all `required` items are 'done' — optional
 * items (email, AI) being incomplete should not nag the operator forever.
 *
 * Items link to /auth#credentials so the AuthPage hash-tab router opens
 * the Credentials tab directly.
 */

import * as React from 'react';
import { Check, Circle, ArrowRight } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Badge,
} from '@ensemble-edge/ui';

import { navigate } from '../../../state';
import { authedFetch } from '../../../state';

type SetupStatus = 'done' | 'pending';

interface SetupItem {
  id: string;
  title: string;
  description: string;
  status: SetupStatus;
  href: string;
  required: boolean;
}

interface SetupResponse {
  items: SetupItem[];
}

export function SetupChecklist() {
  const [items, setItems] = React.useState<SetupItem[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await authedFetch('/_ensemble/setup/status', {
          credentials: 'include',
        });
        if (!r.ok) {
          // 401/403 just means we shouldn't render — not an error worth
          // surfacing on the home page.
          if (!cancelled) setItems([]);
          return;
        }
        const data = (await r.json()) as SetupResponse;
        if (!cancelled) setItems(data.items ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load setup');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Don't render anything until we know — avoids a flash before
  // self-hiding when all required items are done.
  if (items === null && !error) return null;
  if (error) return null;
  if (!items || items.length === 0) return null;

  const allRequiredDone = items.every((i) => !i.required || i.status === 'done');
  if (allRequiredDone) {
    // Hide entirely if even the optional ones are done too. If any
    // optional remain, keep showing as a nudge — but only if the
    // required ones are done (don't double-nag).
    const allDone = items.every((i) => i.status === 'done');
    if (allDone) return null;
  }

  const handleGo = (href: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(href);
  };

  const doneCount = items.filter((i) => i.status === 'done').length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Complete your setup</CardTitle>
            <CardDescription>
              Configure these integrations to unlock the full workspace experience.
            </CardDescription>
          </div>
          <Badge variant="secondary">
            {doneCount} / {items.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <ChecklistRow key={item.id} item={item} onGo={handleGo(item.href)} />
        ))}
      </CardContent>
    </Card>
  );
}

function ChecklistRow({
  item,
  onGo,
}: {
  item: SetupItem;
  onGo: (e: React.MouseEvent) => void;
}) {
  const done = item.status === 'done';
  return (
    <div className="flex items-start gap-3 rounded-md border p-3">
      <div className="mt-0.5">
        {done ? (
          <Check className="h-5 w-5 text-green-600" aria-label="Done" />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground" aria-label="Pending" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium leading-none">{item.title}</p>
          {!item.required && (
            <Badge variant="outline" className="text-xs">
              Optional
            </Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
      </div>
      {!done && (
        <Button variant="ghost" size="sm" onClick={onGo}>
          Configure
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
