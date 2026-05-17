/**
 * Sessions tab — configure how long signed-in sessions stay valid.
 *
 * Changes only affect newly-issued sessions. Existing sessions
 * continue under their original expiry until refresh or sign-out.
 */

import * as React from 'react';
import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
  Button, Label,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  toast,
} from '@ensemble-edge/ui';

import { authedFetch } from '../../../state';

interface TtlOption {
  value: number;
  label: string;
}

export function SessionsTab() {
  const [currentValue, setCurrentValue] = useState<number | null>(null);
  const [draftValue, setDraftValue] = useState<number | null>(null);
  const [options, setOptions] = useState<TtlOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [settingRes, optionsRes] = await Promise.all([
          authedFetch('/_ensemble/settings/session_ttl_seconds'),
          authedFetch('/_ensemble/settings/session/options'),
        ]);
        if (settingRes.ok) {
          const body = (await settingRes.json()) as { value: string };
          const n = Number(body.value);
          if (Number.isFinite(n)) {
            setCurrentValue(n);
            setDraftValue(n);
          }
        }
        if (optionsRes.ok) {
          const body = (await optionsRes.json()) as { options: TtlOption[] };
          setOptions(body.options ?? []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    if (draftValue === null) return;
    setSaving(true);
    try {
      const r = await authedFetch('/_ensemble/settings/session_ttl_seconds', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: String(draftValue) }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }
      setCurrentValue(draftValue);
      toast.success('Session lifetime saved', {
        description: 'New sign-ins use the new value. Existing sessions are unchanged.',
      });
    } catch (e) {
      toast.error('Failed to save', {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-muted-foreground">Loading…</div>;

  const dirty = draftValue !== currentValue;

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" /> Session lifetime
          </CardTitle>
          <CardDescription>
            How long a signed-in session stays valid before the user has to sign in again.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="session-ttl">Lifetime</Label>
            <Select
              value={draftValue !== null ? String(draftValue) : ''}
              onValueChange={(v) => setDraftValue(Number(v))}
            >
              <SelectTrigger id="session-ttl" className="max-w-xs">
                <SelectValue placeholder="Choose a lifetime" />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.value} value={String(o.value)}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Changes only affect new sign-ins. Existing sessions continue under their
            original expiry until refresh or sign-out.
          </p>
        </CardContent>
        <CardFooter>
          <Button onClick={save} disabled={!dirty || saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
