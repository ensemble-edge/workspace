/**
 * Languages tab — manage which content locales the workspace supports.
 *
 * English is always present (server enforces). Operators can add others
 * (BCP-47 codes), promote one to default, and remove non-defaults.
 * Consumers (translation guest app, per-locale brand tokens, future
 * Accept-Language negotiation) land in v0.1.16+.
 */

import * as React from 'react';
import { useEffect, useState } from 'react';
import { Globe, Plus, Star, Trash2 } from 'lucide-react';

import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
  Button, Input, Label, Badge,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  toast,
} from '@ensemble-edge/ui';

import { authedFetch } from '../../../state';

interface WorkspaceLocale {
  code: string;
  display_name: string;
  is_default: boolean;
  enabled: boolean;
  created_at: string;
}

// Top-10 quick picks (covers most multi-region rollouts).
const QUICK_PICKS: Array<{ code: string; display_name: string }> = [
  { code: 'es',    display_name: 'Español' },
  { code: 'fr',    display_name: 'Français' },
  { code: 'de',    display_name: 'Deutsch' },
  { code: 'pt-BR', display_name: 'Português (Brasil)' },
  { code: 'ja',    display_name: '日本語' },
  { code: 'zh-CN', display_name: '中文 (简体)' },
  { code: 'zh-TW', display_name: '中文 (繁體)' },
  { code: 'ar',    display_name: 'العربية' },
  { code: 'hi',    display_name: 'हिन्दी' },
  { code: 'ru',    display_name: 'Русский' },
];

export function LanguagesTab() {
  const [locales, setLocales] = useState<WorkspaceLocale[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const r = await authedFetch('/_ensemble/locales');
      if (r.ok) {
        const body = (await r.json()) as { locales: WorkspaceLocale[] };
        setLocales(body.locales ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function makeDefault(code: string) {
    try {
      const r = await authedFetch(`/_ensemble/locales/${encodeURIComponent(code)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ make_default: true }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }
      toast.success(`${code} is now the default`);
      await refresh();
    } catch (e) {
      toast.error('Failed to set default', {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async function removeLocale(code: string) {
    if (!confirm(`Remove "${code}" from this workspace? Content tagged with this locale will no longer be served until you add it back.`)) {
      return;
    }
    try {
      const r = await authedFetch(`/_ensemble/locales/${encodeURIComponent(code)}`, {
        method: 'DELETE',
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }
      toast.success(`Removed ${code}`);
      await refresh();
    } catch (e) {
      toast.error('Failed to remove', {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (loading) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" /> Content languages
          </CardTitle>
          <CardDescription>
            Languages this workspace serves content in. English is always
            available; add others and pick which one is the default for new
            content.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border divide-y">
            {locales.map((l) => (
              <LocaleRow
                key={l.code}
                locale={l}
                onMakeDefault={() => makeDefault(l.code)}
                onRemove={() => removeLocale(l.code)}
              />
            ))}
          </div>

          <AddLocaleControl
            existing={new Set(locales.map((l) => l.code))}
            onAdded={refresh}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function LocaleRow({
  locale,
  onMakeDefault,
  onRemove,
}: {
  locale: WorkspaceLocale;
  onMakeDefault: () => void;
  onRemove: () => void;
}) {
  const canRemove = locale.code !== 'en' && !locale.is_default;
  return (
    <div className="flex items-center gap-3 p-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{locale.display_name}</span>
          <span className="text-xs text-muted-foreground font-mono">({locale.code})</span>
          {locale.is_default && (
            <Badge variant="outline" className="gap-1">
              <Star className="h-3 w-3" /> Default
            </Badge>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {!locale.is_default && (
          <Button size="sm" variant="ghost" onClick={onMakeDefault}>
            Make default
          </Button>
        )}
        {canRemove && (
          <Button size="sm" variant="ghost" onClick={onRemove}>
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

function AddLocaleControl({
  existing,
  onAdded,
}: {
  existing: Set<string>;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'pick' | 'custom'>('pick');
  const [picked, setPicked] = useState<string>('');
  const [customCode, setCustomCode] = useState('');
  const [customName, setCustomName] = useState('');
  const [busy, setBusy] = useState(false);

  const availableQuickPicks = QUICK_PICKS.filter((p) => !existing.has(p.code));

  async function submit() {
    let code = '';
    let display_name = '';
    if (mode === 'pick') {
      const pick = availableQuickPicks.find((p) => p.code === picked);
      if (!pick) {
        toast.error('Pick a language');
        return;
      }
      code = pick.code;
      display_name = pick.display_name;
    } else {
      code = customCode.trim();
      display_name = customName.trim();
      if (!code || !display_name) {
        toast.error('Enter both code and display name');
        return;
      }
    }
    setBusy(true);
    try {
      const r = await authedFetch('/_ensemble/locales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, display_name }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }
      toast.success(`Added ${display_name}`);
      setOpen(false);
      setPicked('');
      setCustomCode('');
      setCustomName('');
      onAdded();
    } catch (e) {
      toast.error('Failed to add language', {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-3 w-3 mr-1" /> Add language
      </Button>
    );
  }

  return (
    <div className="rounded-md border p-3 space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <button
          type="button"
          className={mode === 'pick' ? 'underline font-medium' : 'text-muted-foreground'}
          onClick={() => setMode('pick')}
        >
          Quick pick
        </button>
        <span className="text-muted-foreground">·</span>
        <button
          type="button"
          className={mode === 'custom' ? 'underline font-medium' : 'text-muted-foreground'}
          onClick={() => setMode('custom')}
        >
          Custom BCP-47
        </button>
      </div>

      {mode === 'pick' ? (
        <div className="space-y-1.5">
          <Label htmlFor="lang-pick">Language</Label>
          <Select value={picked} onValueChange={setPicked}>
            <SelectTrigger id="lang-pick">
              <SelectValue placeholder="Choose a language" />
            </SelectTrigger>
            <SelectContent>
              {availableQuickPicks.map((p) => (
                <SelectItem key={p.code} value={p.code}>
                  {p.display_name}
                  <span className="ml-2 text-xs text-muted-foreground font-mono">
                    {p.code}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {availableQuickPicks.length === 0 && (
            <p className="text-xs text-muted-foreground">
              All quick-pick languages are already added. Switch to Custom BCP-47 for others.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="space-y-1.5">
            <Label htmlFor="lang-code">BCP-47 code</Label>
            <Input
              id="lang-code"
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value)}
              placeholder="e.g. nl, ko, sv, fi-FI"
            />
            <p className="text-xs text-muted-foreground">
              Examples: <span className="font-mono">nl</span> (Dutch),{' '}
              <span className="font-mono">ko</span> (Korean),{' '}
              <span className="font-mono">fr-CH</span> (French/Switzerland).
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lang-name">Display name</Label>
            <Input
              id="lang-name"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. Nederlands"
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={submit} disabled={busy}>
          {busy ? 'Adding…' : 'Add'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
