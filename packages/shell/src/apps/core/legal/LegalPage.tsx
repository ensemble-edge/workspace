/**
 * Legal Center — CMS page (core:legal).
 *
 * Mounts at /legal-app (the bare /legal URL is the public,
 * server-rendered legal pages). Single-screen CMS:
 *
 *   • Snippet card     — copy-paste fetch examples for operators.
 *   • Legal copy card  — the five legal.* placeholder settings.
 *   • Doc list         — one card per doc; expand to edit (lazy-loaded
 *                        body), autosave on blur, per-locale URL chips,
 *                        active/archived switch.
 *
 * Mirrors the Curalisto quiz-cms patterns: autosave-by-default, a
 * SaveStatus chip as the contract (no Save button), workspace-locale
 * driven editing.
 */

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Textarea,
  Switch,
  Badge,
  SaveStatus,
  useSaveStatus,
  toast,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@ensemble-edge/ui';

import { useHashTab } from '../../../hooks/useHashTab';
import { authedFetch } from '../../../state';

const TABS = ['content', 'settings'] as const;

// ── Types (mirror the server contract in apps/core/legal/types.ts) ──

type LocalizedString = Record<string, string | null | undefined>;

interface LegalDoc {
  id: string;
  slugs: LocalizedString;
  title: LocalizedString;
  description: LocalizedString | null;
  notice: LocalizedString | null;
  bodyMd: LocalizedString;
  lastUpdated: string;
  status: 'active' | 'archived';
  sortOrder: number;
}

interface WorkspaceLocale {
  code: string;
  display_name: string;
  is_default: boolean;
}

const SETTING_FIELDS = [
  { key: 'legal.company_name', label: 'Company name', placeholder: 'Curalisto' },
  { key: 'legal.support_email', label: 'Support email', placeholder: 'hello@curalisto.com' },
  { key: 'legal.notices_email', label: 'Legal notices email', placeholder: 'legal@curalisto.com' },
  { key: 'legal.support_phone', label: 'Support phone', placeholder: '+1 555-555-5555' },
  { key: 'legal.business_address', label: 'Legal business address', placeholder: '123 Main St, Austin, TX 78701' },
] as const;

export function LegalPage() {
  const [locales, setLocales] = useState<WorkspaceLocale[]>([]);
  const [docs, setDocs] = useState<LegalDoc[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);

  const defaultLocale = locales.find((l) => l.is_default)?.code ?? 'en';
  const enabledCodes = locales.map((l) => l.code);

  const loadDocs = useCallback(async (includeArchived: boolean) => {
    const url = includeArchived
      ? '/_ensemble/core/legal/docs?include_archived=1'
      : '/_ensemble/core/legal/docs';
    const r = await authedFetch(url).catch(() => null);
    if (r?.ok) {
      const body = (await r.json()) as { docs: LegalDoc[] };
      setDocs(body.docs ?? []);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [localesRes] = await Promise.all([
        authedFetch('/_ensemble/locales').catch(() => null),
        loadDocs(showArchived),
      ]);
      if (cancelled) return;
      if (localesRes?.ok) {
        const body = (await localesRes.json()) as { locales: WorkspaceLocale[] };
        setLocales(body.locales ?? []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadDocs(showArchived);
  }, [showArchived, loadDocs]);

  const [tab, setTab] = useHashTab('content', TABS);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Legal Center</h1>
        <p className="text-muted-foreground">
          Workspace legal documents — localized, versioned, and published to a public read API.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList variant="line" className="mb-6">
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* ── Content: the document CMS ── */}
        <TabsContent value="content" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Live legal documents. Edits autosave on blur.
            </p>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={showArchived} onCheckedChange={setShowArchived} />
              Show archived
            </label>
          </div>

          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : docs.length === 0 ? (
            <EmptyDocs onSeeded={(seeded) => setDocs(seeded)} />
          ) : (
            <div className="space-y-3">
              {docs.map((doc) => (
                <LegalDocCard
                  key={doc.id}
                  summary={doc}
                  defaultLocale={defaultLocale}
                  enabledCodes={enabledCodes}
                  onChanged={() => void loadDocs(showArchived)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Settings: publish toggle, placeholder values, fetch snippets ── */}
        <TabsContent value="settings" className="space-y-6">
          <PublishCard />
          <LegalCopyCard />
          <SnippetCard defaultLocale={defaultLocale} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ───────────────────────── Empty state ─────────────────────────

function EmptyDocs({ onSeeded }: { onSeeded: (docs: LegalDoc[]) => void }) {
  const [seeding, setSeeding] = useState(false);

  const seed = useCallback(async () => {
    setSeeding(true);
    try {
      const r = await authedFetch('/_ensemble/core/legal/seed', { method: 'POST' });
      if (!r.ok) throw new Error(`seed failed: ${r.status}`);
      const body = (await r.json()) as { docs: LegalDoc[] };
      onSeeded(body.docs ?? []);
      toast.success('Default documents added');
    } catch {
      toast.error('Failed to seed default documents');
    } finally {
      setSeeding(false);
    }
  }, [onSeeded]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>No legal documents yet</CardTitle>
        <CardDescription>
          Start with a basic Privacy Policy and Terms of Use you can edit, or add your own
          documents from scratch. The starter docs are placeholder skeletons — expand them and
          have them reviewed by counsel before publishing.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={() => void seed()} disabled={seeding}>
          {seeding ? 'Adding…' : 'Add starter documents'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ───────────────────────── Publish card ─────────────────────────

function PublishCard() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [indexing, setIndexing] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await authedFetch('/_ensemble/core/legal/settings').catch(() => null);
      if (r?.ok) {
        const body = (await r.json()) as { publicEnabled?: boolean; allowIndexing?: boolean };
        setEnabled(Boolean(body.publicEnabled));
        setIndexing(Boolean(body.allowIndexing));
      }
    })();
  }, []);

  // One PUT helper for either boolean setting; the switches call it with
  // their own key + optimistic setter. Not a hook — a plain async fn — so
  // it's safe to define once and reuse.
  const save = useCallback(
    async (
      key: 'publicEnabled' | 'allowIndexing',
      next: boolean,
      set: (v: boolean) => void,
      okMsg: string,
    ) => {
      set(next); // optimistic
      setSaving(true);
      try {
        const r = await authedFetch('/_ensemble/core/legal/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [key]: next }),
        });
        if (!r.ok) throw new Error(`save failed: ${r.status}`);
        toast.success(okMsg);
      } catch {
        set(!next); // revert
        toast.error('Failed to update setting');
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Publish public legal pages</CardTitle>
            <CardDescription>
              When on, the crawlable <code>/legal/*</code> pages and the{' '}
              <code>/api/legal/*</code> read API are live. When off, both return 404 — the CMS
              here stays available so you can prepare docs before publishing.
            </CardDescription>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={enabled ?? false}
              disabled={enabled === null || saving}
              onCheckedChange={(v) =>
                void save('publicEnabled', v, setEnabled, v ? 'Legal pages published' : 'Legal pages unpublished')
              }
            />
            {enabled ? 'Published' : 'Unpublished'}
          </label>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between border-t pt-4">
          <div>
            <p className="text-sm font-medium">Allow search indexing</p>
            <p className="text-sm text-muted-foreground">
              When off (default), pages emit <code>noindex</code> and search engines skip them.
              When on, pages are crawlable and emit a canonical URL (using your brand domain if
              one is set).
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={indexing ?? false}
              disabled={indexing === null || saving}
              onCheckedChange={(v) =>
                void save('allowIndexing', v, setIndexing, v ? 'Search indexing enabled' : 'Search indexing disabled (noindex)')
              }
            />
            {indexing ? 'Indexable' : 'noindex'}
          </label>
        </div>
      </CardContent>
    </Card>
  );
}

// ───────────────────────── Snippet card ─────────────────────────

function SnippetCard({ defaultLocale }: { defaultLocale: string }) {
  const oneDoc = `// Fetch rendered HTML (default)
const r = await fetch('/api/legal/privacy?lang=${defaultLocale}')
const { title, lastUpdated, content } = await r.json()
document.querySelector('#legal').innerHTML = content

// Or raw markdown
fetch('/api/legal/privacy?lang=${defaultLocale}&format=markdown')`;

  const listDocs = `// Per language: id, slug, title, description, lastUpdated, sortOrder.
const r = await fetch('/api/legal/active?lang=${defaultLocale}')
const { docs } = await r.json()
const html = docs.map(d => \`<a href="/legal/\${d.slug}">\${d.title}</a>\`).join(' · ')`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>How to fetch legal copy</CardTitle>
        <CardDescription>
          Read-only endpoints any landing page or guest app can consume.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs text-muted-foreground">One document — /api/legal/:slug</Label>
          <pre className="mt-1 overflow-x-auto rounded-md bg-muted p-3 text-xs">{oneDoc}</pre>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">List all active — /api/legal/active</Label>
          <pre className="mt-1 overflow-x-auto rounded-md bg-muted p-3 text-xs">{listDocs}</pre>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────── Legal copy card ───────────────────────

function LegalCopyCard() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [inFlight, setInFlight] = useState(false);
  const [error, setError] = useState<unknown>();
  const [dirty, setDirty] = useState(false);
  const state = useSaveStatus({ dirty, inFlight, error });

  useEffect(() => {
    (async () => {
      const r = await authedFetch('/_ensemble/core/legal/settings').catch(() => null);
      if (r?.ok) {
        const body = (await r.json()) as { settings: Record<string, string> };
        setValues(body.settings ?? {});
      }
    })();
  }, []);

  const saveField = useCallback(async (key: string, value: string) => {
    setInFlight(true);
    setError(undefined);
    try {
      const r = await authedFetch('/_ensemble/core/legal/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
      if (!r.ok) throw new Error(`save failed: ${r.status}`);
      setDirty(false);
    } catch (e) {
      setError(e);
      toast.error('Failed to save legal copy');
    } finally {
      setInFlight(false);
    }
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Legal copy</CardTitle>
          {state !== 'clean' && <SaveStatus state={state} />}
        </div>
        <CardDescription>
          Values substituted into the legal documents at render time. Tokens:{' '}
          <code>[COMPANY NAME]</code>, <code>[EMAIL]</code>, <code>[LEGAL NOTICES EMAIL]</code>,{' '}
          <code>[PHONE]</code>, <code>[LEGAL BUSINESS ADDRESS]</code>. Empty fields render as
          nothing. <code>[DATE]</code> is handled automatically from each doc's "Last updated" date.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {SETTING_FIELDS.map((f) => (
          <div key={f.key}>
            <Label htmlFor={f.key}>{f.label}</Label>
            <Input
              id={f.key}
              value={values[f.key] ?? ''}
              placeholder={f.placeholder}
              onChange={(e) => {
                setValues((v) => ({ ...v, [f.key]: e.target.value }));
                setDirty(true);
              }}
              onBlur={(e) => {
                if (dirty) void saveField(f.key, e.target.value);
              }}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ──────────────────────── Doc card ────────────────────────

function LegalDocCard({
  summary,
  defaultLocale,
  enabledCodes,
  onChanged,
}: {
  summary: LegalDoc;
  defaultLocale: string;
  enabledCodes: string[];
  onChanged: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [doc, setDoc] = useState<LegalDoc | null>(null);
  const [draft, setDraft] = useState<LegalDoc | null>(null);
  const [inFlight, setInFlight] = useState(false);
  const [error, setError] = useState<unknown>();
  const [dirty, setDirty] = useState(false);
  const state = useSaveStatus({ dirty, inFlight, error });

  const archived = summary.status !== 'active';
  const title = summary.title[defaultLocale] || summary.title[Object.keys(summary.title)[0]] || summary.id;

  // Lazy-load the full doc (with body) only when the card expands.
  const expand = useCallback(async () => {
    if (!expanded && !doc) {
      const r = await authedFetch(`/_ensemble/core/legal/docs/${summary.id}`).catch(() => null);
      if (r?.ok) {
        const body = (await r.json()) as { doc: LegalDoc };
        setDoc(body.doc);
        setDraft(body.doc);
      }
    }
    setExpanded((x) => !x);
  }, [expanded, doc, summary.id]);

  const save = useCallback(async (next: LegalDoc) => {
    setInFlight(true);
    setError(undefined);
    try {
      const r = await authedFetch(`/_ensemble/core/legal/docs/${next.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slugs: next.slugs,
          title: next.title,
          description: next.description,
          notice: next.notice,
          bodyMd: next.bodyMd,
          lastUpdated: next.lastUpdated,
          status: next.status,
          sortOrder: next.sortOrder,
        }),
      });
      if (r.status === 409) {
        const body = (await r.json()) as { slug?: string };
        throw new Error(`Slug "${body.slug}" is already in use`);
      }
      if (!r.ok) throw new Error(`save failed: ${r.status}`);
      setDirty(false);
      onChanged();
    } catch (e) {
      setError(e);
      toast.error(e instanceof Error ? e.message : 'Failed to save document');
    } finally {
      setInFlight(false);
    }
  }, [onChanged]);

  const toggleStatus = useCallback(async (active: boolean) => {
    const nextStatus = active ? 'active' : 'archived';
    try {
      const r = await authedFetch(`/_ensemble/core/legal/docs/${summary.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!r.ok) throw new Error(`status update failed: ${r.status}`);
      onChanged();
    } catch {
      toast.error('Failed to update status');
    }
  }, [summary.id, onChanged]);

  const patchDraft = (mutate: (d: LegalDoc) => LegalDoc) => {
    setDraft((d) => (d ? mutate(d) : d));
    setDirty(true);
  };

  const commit = () => {
    if (dirty && draft) void save(draft);
  };

  return (
    <Card className={archived ? 'opacity-60' : undefined}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <CardTitle className="truncate">{title}</CardTitle>
              <span className="text-xs text-muted-foreground">{summary.id}</span>
              {archived && <Badge variant="secondary">archived</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              Last updated {summary.lastUpdated} · sort {summary.sortOrder}
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              {Object.entries(summary.slugs)
                .filter(([, s]) => s)
                .map(([locale, slug]) => (
                  <a
                    key={locale}
                    href={`/legal/${slug}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs hover:underline"
                  >
                    /legal/{slug} {locale.toUpperCase()}
                  </a>
                ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs">
              <Switch
                checked={!archived}
                onCheckedChange={(v) => void toggleStatus(v)}
              />
              Active
            </label>
            <div className="flex items-center gap-2">
              {state !== 'clean' && <SaveStatus state={state} />}
              <Button variant="outline" size="sm" onClick={() => void expand()}>
                {expanded ? 'Close' : 'Edit'}
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>

      {expanded && draft && (
        <CardContent className="space-y-5 border-t pt-5">
          <LocaleEditor
            label="URL slug"
            hint="Lowercase letters, numbers, hyphens. One per locale."
            codes={enabledCodes}
            defaultLocale={defaultLocale}
            value={draft.slugs}
            onChange={(slugs) => patchDraft((d) => ({ ...d, slugs }))}
            onBlur={commit}
            rows={1}
          />
          <LocaleEditor
            label="Title"
            codes={enabledCodes}
            defaultLocale={defaultLocale}
            value={draft.title}
            onChange={(title) => patchDraft((d) => ({ ...d, title }))}
            onBlur={commit}
            rows={1}
          />
          <LocaleEditor
            label="Description"
            hint="One-line summary. Surfaced in list views and public ToC tooltips."
            codes={enabledCodes}
            defaultLocale={defaultLocale}
            value={draft.description ?? {}}
            onChange={(description) => patchDraft((d) => ({ ...d, description }))}
            onBlur={commit}
            rows={2}
          />
          <LocaleEditor
            label="Notice"
            hint="Optional prominent callout shown at the top of the doc (e.g. an arbitration / class-action-waiver warning). Markdown supported. Leave blank for no notice."
            codes={enabledCodes}
            defaultLocale={defaultLocale}
            value={draft.notice ?? {}}
            onChange={(notice) => patchDraft((d) => ({ ...d, notice }))}
            onBlur={commit}
            rows={3}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor={`lastUpdated-${draft.id}`}>Last updated</Label>
              <Input
                id={`lastUpdated-${draft.id}`}
                type="date"
                value={draft.lastUpdated}
                onChange={(e) => patchDraft((d) => ({ ...d, lastUpdated: e.target.value }))}
                onBlur={commit}
              />
            </div>
            <div>
              <Label htmlFor={`sort-${draft.id}`}>Sort order</Label>
              <Input
                id={`sort-${draft.id}`}
                type="number"
                value={String(draft.sortOrder)}
                onChange={(e) => patchDraft((d) => ({ ...d, sortOrder: Number(e.target.value) || 0 }))}
                onBlur={commit}
              />
            </div>
          </div>
          <LocaleEditor
            label="Body (markdown)"
            hint="Headings, lists, links, bold/italic supported. Rendered to HTML at request time."
            codes={enabledCodes}
            defaultLocale={defaultLocale}
            value={draft.bodyMd}
            onChange={(bodyMd) => patchDraft((d) => ({ ...d, bodyMd }))}
            onBlur={commit}
            rows={14}
          />
        </CardContent>
      )}
    </Card>
  );
}

// ───────────────── Per-locale textarea group ─────────────────

function LocaleEditor({
  label,
  hint,
  codes,
  defaultLocale,
  value,
  onChange,
  onBlur,
  rows,
}: {
  label: string;
  hint?: string;
  codes: string[];
  defaultLocale: string;
  value: LocalizedString;
  onChange: (next: LocalizedString) => void;
  onBlur: () => void;
  rows: number;
}) {
  // Default locale first, then the rest.
  const ordered = [defaultLocale, ...codes.filter((c) => c !== defaultLocale)];
  return (
    <div>
      <Label>{label}</Label>
      {hint && <p className="mb-1 text-xs text-muted-foreground">{hint}</p>}
      <div className="space-y-2">
        {ordered.map((code) => (
          <div key={code} className="flex items-start gap-2">
            <span className="mt-2 w-10 shrink-0 font-mono text-xs text-muted-foreground">
              {code.toUpperCase()}
            </span>
            <Textarea
              rows={rows}
              value={value[code] ?? ''}
              onChange={(e) => onChange({ ...value, [code]: e.target.value })}
              onBlur={onBlur}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
