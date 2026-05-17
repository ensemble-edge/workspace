/**
 * Messaging Tab — Brand voice, taglines, and copy.
 *
 * v0.1.17 redesign:
 *   - Autosave on blur, per (field, locale). No bottom Save button for
 *     simple fields. <SaveStatus> ambient indicator per card.
 *   - Page-level coverage status: "ES 3/9 · FR 0/9" with one-click
 *     "Translate all missing in X" batch.
 *   - Source-language picker moved into Translate button as a dropdown
 *     so its role is obvious ("Translate from English ▾").
 *   - Empty active-tab fields render a strong "No <Lang> translation yet"
 *     empty state with the Translate button promoted.
 *   - Source-language tab carries a "Source · used by Translate" label.
 *   - Other-languages preview moved into a "Show other translations"
 *     disclosure on each card (off by default — reduces visual noise).
 *
 * Value props + custom fields stay default-locale only (no per-locale
 * autosave; bottom Save still required for the JSON-shape fields).
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Plus, Trash2, Sparkles, ChevronDown, Star } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  SaveStatus,
  toast,
} from '@ensemble-edge/ui';
import { authedFetch, emitWorkspaceEvent } from '../../../state';
import { useFormStatus } from '../../../hooks/useFormStatus';

// ─── Types ──────────────────────────────────────────────────────────

interface ValueProp {
  headline: string;
  description: string;
}

interface CustomField {
  key: string;
  value: string;
  type: string;
  label: string;
}

interface WorkspaceLocale {
  code: string;
  display_name: string;
  is_default: boolean;
  enabled: boolean;
}

interface AiTier {
  name: string;
  provider: string;
  route_provisioned: boolean;
}

type LocalizedTokens = Record<string, Record<string, string>>;

interface SimpleFieldDef {
  key: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  helpText?: string;
}

const SIMPLE_FIELDS: SimpleFieldDef[] = [
  { key: 'tagline',           label: 'Tagline',            placeholder: 'A short, memorable phrase that describes what you do' },
  { key: 'elevator_pitch',    label: 'Elevator Pitch',     placeholder: 'One paragraph explaining what you do and who you do it for…', multiline: true, rows: 3 },
  { key: 'mission',           label: 'Mission Statement',  placeholder: 'Your mission in one or two sentences…', multiline: true, rows: 2 },
  { key: 'boilerplate',       label: 'Company Boilerplate', placeholder: 'A paragraph about the company — used in press releases and footers.', multiline: true, rows: 3 },
  { key: 'legal_footer',      label: 'Legal Footer',       placeholder: '© {year} Your Company, LLC. All rights reserved.', helpText: 'Use {year} for auto-updating year' },
  { key: 'tone_descriptors',  label: 'Tone Descriptors',   placeholder: 'confident, clear, approachable', helpText: 'Comma-separated adjectives' },
  { key: 'tone_avoid',        label: 'Tone — Avoid',       placeholder: 'jargon, hype, superlatives', helpText: 'Things to never say' },
  { key: 'voice_guidelines',  label: 'Voice Guidelines',   placeholder: 'Describe how your brand sounds — voice, person, sentence shape…', multiline: true, rows: 3 },
];

const SIMPLE_FIELD_KEYS = new Set(SIMPLE_FIELDS.map((f) => f.key));
const SOURCE_LANG_KEY = 'ensemble:messaging-source-lang';

// ─── Tab ────────────────────────────────────────────────────────────

export function MessagingTab() {
  const [tokens, setTokens] = useState<LocalizedTokens>({});
  const [valueProps, setValueProps] = useState<ValueProp[]>([{ headline: '', description: '' }]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [locales, setLocales] = useState<WorkspaceLocale[]>([]);
  const [tiers, setTiers] = useState<AiTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceLang, setSourceLang] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(SOURCE_LANG_KEY) ?? '';
  });

  // Manual-save status only covers value_props + custom_fields (the
  // non-localized JSON fields). Simple fields autosave individually.
  const manualStatus = useFormStatus({
    value: { valueProps, customFields },
    mode: 'manual',
  });

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [tokensRes, localesRes, tiersRes] = await Promise.all([
        authedFetch('/_ensemble/core/brand/tokens/messaging?all_locales=1').catch(() => null),
        authedFetch('/_ensemble/locales').catch(() => null),
        authedFetch('/_ensemble/ai/tiers').catch(() => null),
      ]);
      if (cancelled) return;

      if (tokensRes?.ok) {
        const body = (await tokensRes.json()) as {
          data?: Array<{ key: string; value: string; locale: string }>;
        };
        const map: LocalizedTokens = {};
        const custom: CustomField[] = [];
        let vp: ValueProp[] | null = null;
        for (const row of body.data ?? []) {
          if (row.key === 'value_props') {
            if (row.locale === '') {
              try { vp = JSON.parse(row.value); } catch { /* noop */ }
            }
            continue;
          }
          if (SIMPLE_FIELD_KEYS.has(row.key)) {
            (map[row.key] ??= {})[row.locale] = row.value;
            continue;
          }
          if (row.locale === '') {
            custom.push({ key: row.key, value: row.value, type: 'text', label: row.key });
          }
        }
        setTokens(map);
        if (vp) setValueProps(vp);
        setCustomFields(custom);
      }

      if (localesRes?.ok) {
        const body = (await localesRes.json()) as { locales: WorkspaceLocale[] };
        setLocales(body.locales ?? []);
      }
      if (tiersRes?.ok) {
        const body = (await tiersRes.json()) as { tiers: AiTier[] };
        setTiers(body.tiers ?? []);
      }

      setLoading(false);
      queueMicrotask(() => manualStatus.resetBaseline());
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sourceLang && locales.length > 0) {
      const def = locales.find((l) => l.is_default);
      if (def) setSourceLang(def.code);
    }
  }, [locales, sourceLang]);

  useEffect(() => {
    if (typeof window !== 'undefined' && sourceLang) {
      localStorage.setItem(SOURCE_LANG_KEY, sourceLang);
    }
  }, [sourceLang]);

  const defaultLocale = useMemo(
    () => locales.find((l) => l.is_default)?.code ?? 'en',
    [locales],
  );

  const translationTier = useMemo<AiTier | null>(() => {
    const named = tiers.find(
      (t) => t.name === 'translate' && t.provider === 'workers-ai' && t.route_provisioned,
    );
    if (named) return named;
    return tiers.find((t) => t.provider === 'workers-ai' && t.route_provisioned) ?? null;
  }, [tiers]);

  // Storage slot for a locale code. Default locale lives in '' so a
  // removed locale survives without data loss.
  const slotFor = useCallback(
    (code: string) => (code === defaultLocale ? '' : code),
    [defaultLocale],
  );

  // Update local state for one (field, locale) slot.
  function setLocalizedValue(fieldKey: string, locale: string, value: string) {
    setTokens((prev) => {
      const next = { ...prev };
      const inner = { ...(next[fieldKey] ?? {}) };
      inner[locale] = value;
      next[fieldKey] = inner;
      return next;
    });
  }

  // Persist one (field, locale) slot. Autosave entry point.
  const persistField = useCallback(
    async (fieldKey: string, slot: string, value: string): Promise<boolean> => {
      try {
        const r = await authedFetch('/_ensemble/brand/tokens', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: 'messaging',
            tokens: { [fieldKey]: value },
            locale: slot,
          }),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        emitWorkspaceEvent('brand.tokens.changed', { category: 'messaging', key: fieldKey, locale: slot });
        return true;
      } catch (e) {
        toast.error('Save failed', {
          description: e instanceof Error ? e.message : String(e),
        });
        return false;
      }
    },
    [],
  );

  // Translate one (field, locale) slot. Returns the translated text or null.
  const translate = useCallback(
    async (fieldKey: string, sourceCode: string, targetCode: string): Promise<string | null> => {
      if (!translationTier) return null;
      const sourceText = tokens[fieldKey]?.[slotFor(sourceCode)] ?? '';
      if (!sourceText.trim()) {
        toast.error('Nothing to translate', {
          description: `${fieldNameFor(fieldKey)} is empty in the source language.`,
        });
        return null;
      }
      try {
        const r = await authedFetch(`/_ensemble/ai/call/${encodeURIComponent(translationTier.name)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: sourceText,
            source_lang: bcp47ToHumanName(sourceCode),
            target_lang: bcp47ToHumanName(targetCode),
          }),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const body = (await r.json()) as {
          result?: { translated_text?: string };
          translated_text?: string;
        };
        const out = body.result?.translated_text ?? body.translated_text;
        if (!out) {
          toast.error('Translation returned no text');
          return null;
        }
        return out;
      } catch (e) {
        toast.error('Translation failed', {
          description: e instanceof Error ? e.message : String(e),
        });
        return null;
      }
    },
    [translationTier, tokens, slotFor],
  );

  // Bulk-translate every missing slot for a target locale (across all
  // simple fields). The Translate-all-missing batch action.
  async function translateAllMissing(targetCode: string) {
    if (!translationTier) {
      toast.error('No translation tier configured');
      return;
    }
    const targetSlot = slotFor(targetCode);
    const sourceCode = sourceLang || defaultLocale;
    if (targetCode === sourceCode) return;

    const missing = SIMPLE_FIELDS.filter(
      (f) => !tokens[f.key]?.[targetSlot]?.trim() && tokens[f.key]?.[slotFor(sourceCode)]?.trim(),
    );
    if (missing.length === 0) {
      toast.info('Nothing to translate', { description: 'No missing translations to fill.' });
      return;
    }

    toast.info(`Translating ${missing.length} field${missing.length === 1 ? '' : 's'}…`);
    let ok = 0;
    for (const f of missing) {
      const out = await translate(f.key, sourceCode, targetCode);
      if (out) {
        setLocalizedValue(f.key, targetSlot, out);
        await persistField(f.key, targetSlot, out);
        ok++;
      }
    }
    toast.success(`Filled ${ok} of ${missing.length} translations`);
  }

  // Save the manual-saved JSON fields (value_props, custom fields).
  async function saveManual() {
    manualStatus.beginSave();
    try {
      const tokensToSave: Record<string, string> = {
        value_props: JSON.stringify(valueProps.filter((vp) => vp.headline)),
      };
      for (const f of customFields) {
        if (f.key && f.value) tokensToSave[f.key] = f.value;
      }
      const r = await authedFetch('/_ensemble/brand/tokens', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'messaging', tokens: tokensToSave, locale: '' }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      manualStatus.commitSave();
      emitWorkspaceEvent('brand.tokens.changed', { category: 'messaging' });
      toast.success('Saved');
    } catch (e) {
      manualStatus.failSave(e);
      toast.error('Failed to save', {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (loading) return <div className="text-muted-foreground">Loading…</div>;

  const orderedLocales = [...locales]
    .filter((l) => l.enabled)
    .sort((a, b) => {
      if (a.is_default && !b.is_default) return -1;
      if (!a.is_default && b.is_default) return 1;
      return a.display_name.localeCompare(b.display_name);
    });

  const isMultiLang = orderedLocales.length > 1;

  // Compute coverage per locale across SIMPLE_FIELDS.
  const coverage = orderedLocales.map((l) => {
    const slot = slotFor(l.code);
    const filled = SIMPLE_FIELDS.filter((f) => !!tokens[f.key]?.[slot]?.trim()).length;
    return { locale: l, filled, total: SIMPLE_FIELDS.length };
  });

  return (
    <div className="space-y-6">
      {isMultiLang && (
        <CoverageHeader
          coverage={coverage}
          sourceLang={sourceLang || defaultLocale}
          translationTier={translationTier}
          onTranslateAll={translateAllMissing}
        />
      )}

      {SIMPLE_FIELDS.map((fdef) => (
        <LocalizedField
          key={fdef.key}
          fdef={fdef}
          locales={orderedLocales}
          defaultLocale={defaultLocale}
          values={tokens[fdef.key] ?? {}}
          slotFor={slotFor}
          onChange={(loc, v) => setLocalizedValue(fdef.key, loc, v)}
          onPersist={(slot, value) => persistField(fdef.key, slot, value)}
          sourceLang={sourceLang || defaultLocale}
          setSourceLang={setSourceLang}
          canTranslate={!!translationTier}
          onTranslate={(targetLocale) =>
            translate(fdef.key, sourceLang || defaultLocale, targetLocale)
          }
        />
      ))}

      {/* Value Propositions — default-locale only */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Value Propositions</CardTitle>
              <CardDescription>Key benefits — used in marketing and AI context</CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isMultiLang && (
                <Badge variant="outline" className="text-xs">Default language only</Badge>
              )}
              {manualStatus.state !== 'clean' && <SaveStatus state={manualStatus.state} />}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {valueProps.map((vp, i) => (
            <div key={i} className="flex gap-3 items-start">
              <div className="flex-1 space-y-2">
                <Input
                  value={vp.headline}
                  onChange={(e) =>
                    setValueProps(valueProps.map((p, idx) => (idx === i ? { ...p, headline: e.target.value } : p)))
                  }
                  placeholder="Headline"
                />
                <Textarea
                  value={vp.description}
                  onChange={(e) =>
                    setValueProps(valueProps.map((p, idx) => (idx === i ? { ...p, description: e.target.value } : p)))
                  }
                  placeholder="Description…"
                  rows={2}
                />
              </div>
              {valueProps.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="mt-1 text-muted-foreground hover:text-destructive"
                  onClick={() => setValueProps(valueProps.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setValueProps([...valueProps, { headline: '', description: '' }])}
          >
            <Plus className="mr-1 h-3 w-3" /> Add Value Prop
          </Button>
        </CardContent>
      </Card>

      {/* Custom Fields — default-locale only */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Custom Fields</CardTitle>
              <CardDescription>Add messaging fields specific to your business</CardDescription>
            </div>
            {isMultiLang && (
              <Badge variant="outline" className="text-xs">Default language only</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {customFields.map((field, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="Field name"
                    value={field.label}
                    onChange={(e) => {
                      const label = e.target.value;
                      const key = label.toLowerCase().replace(/\s+/g, '_');
                      setCustomFields(
                        customFields.map((f, idx) => (idx === i ? { ...f, label, key } : f)),
                      );
                    }}
                    className="text-sm"
                  />
                  <Select
                    value={field.type}
                    onValueChange={(v) =>
                      setCustomFields(customFields.map((f, idx) => (idx === i ? { ...f, type: v } : f)))
                    }
                  >
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="rich_text">Long Text</SelectItem>
                      <SelectItem value="url">URL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {field.type === 'rich_text' ? (
                  <Textarea
                    placeholder="Value"
                    value={field.value}
                    onChange={(e) =>
                      setCustomFields(customFields.map((f, idx) => (idx === i ? { ...f, value: e.target.value } : f)))
                    }
                    rows={3}
                    className="text-sm"
                  />
                ) : (
                  <Input
                    placeholder="Value"
                    value={field.value}
                    onChange={(e) =>
                      setCustomFields(customFields.map((f, idx) => (idx === i ? { ...f, value: e.target.value } : f)))
                    }
                    className="text-sm"
                  />
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="mt-1 text-muted-foreground hover:text-destructive"
                onClick={() => setCustomFields(customFields.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCustomFields([...customFields, { key: `msg_${Date.now()}`, value: '', type: 'text', label: '' }])
            }
          >
            <Plus className="mr-1 h-3 w-3" /> Add Field
          </Button>
        </CardContent>
        <CardFooter className="gap-3">
          <Button onClick={saveManual} disabled={!manualStatus.dirty || manualStatus.state === 'saving'}>
            {manualStatus.state === 'saving' ? 'Saving…' : 'Save Value Props & Custom Fields'}
          </Button>
          {manualStatus.state !== 'clean' && <SaveStatus state={manualStatus.state} />}
        </CardFooter>
      </Card>
    </div>
  );
}

function fieldNameFor(key: string): string {
  return SIMPLE_FIELDS.find((f) => f.key === key)?.label ?? key;
}

// ─── CoverageHeader ────────────────────────────────────────────────

function CoverageHeader({
  coverage,
  sourceLang,
  translationTier,
  onTranslateAll,
}: {
  coverage: Array<{ locale: WorkspaceLocale; filled: number; total: number }>;
  sourceLang: string;
  translationTier: AiTier | null;
  onTranslateAll: (targetCode: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base">Translation coverage</CardTitle>
            <CardDescription>
              How much of each language's messaging is filled in. Simple text fields
              autosave on blur — no Save button needed for translations.
            </CardDescription>
          </div>
          {translationTier ? (
            <Badge variant="outline" className="gap-1 shrink-0">
              <Sparkles className="h-3 w-3" />
              AI via <span className="font-mono">{translationTier.name}</span>
            </Badge>
          ) : (
            <Badge variant="outline" className="shrink-0 text-muted-foreground">
              No AI translation tier
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {coverage.map(({ locale, filled, total }) => {
          const pct = total === 0 ? 0 : (filled / total) * 100;
          const missing = total - filled;
          const isSource = locale.code === sourceLang;
          return (
            <div key={locale.code} className="flex items-center gap-3 text-sm">
              <div className="w-32 shrink-0 flex items-center gap-2">
                <span className="font-mono uppercase text-xs text-muted-foreground">
                  {locale.code}
                </span>
                <span>{locale.display_name}</span>
                {locale.is_default && <Star className="h-3 w-3 text-muted-foreground" />}
              </div>
              <div className="flex-1 h-1.5 rounded bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs tabular-nums text-muted-foreground w-16 text-right">
                {filled}/{total}
              </span>
              {missing > 0 && !isSource && translationTier && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs"
                  onClick={() => onTranslateAll(locale.code)}
                  title={`Translate ${missing} missing field${missing === 1 ? '' : 's'} from ${sourceLang.toUpperCase()}`}
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  Translate {missing}
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ─── LocalizedField ────────────────────────────────────────────────

function LocalizedField({
  fdef,
  locales,
  defaultLocale,
  values,
  slotFor,
  onChange,
  onPersist,
  sourceLang,
  setSourceLang,
  canTranslate,
  onTranslate,
}: {
  fdef: SimpleFieldDef;
  locales: WorkspaceLocale[];
  defaultLocale: string;
  values: Record<string, string>;
  slotFor: (code: string) => string;
  onChange: (slot: string, value: string) => void;
  onPersist: (slot: string, value: string) => Promise<boolean>;
  sourceLang: string;
  setSourceLang: (code: string) => void;
  canTranslate: boolean;
  onTranslate: (targetLocale: string) => Promise<string | null>;
}) {
  const isMultiLang = locales.length > 1;
  const [activeLocale, setActiveLocale] = useState<string>(defaultLocale);
  const [inFlight, setInFlight] = useState(false);
  const [recentlySaved, setRecentlySaved] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [translating, setTranslating] = useState(false);
  const [showOthers, setShowOthers] = useState(false);
  // Snapshot of last-persisted value per slot to drive "dirty" detection
  // independent of optimistic UI state.
  const lastSaved = useRef<Record<string, string>>({});

  // Initialize lastSaved from initial values on first render — what's
  // loaded from the server is the baseline.
  useEffect(() => {
    for (const [slot, val] of Object.entries(values)) {
      if (lastSaved.current[slot] === undefined) lastSaved.current[slot] = val;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeSlot = slotFor(activeLocale);
  const activeValue = values[activeSlot] ?? '';
  const hasActiveValue = !!activeValue.trim();
  const isSourceTab = activeLocale === sourceLang;

  // Autosave on blur. Compares against last-saved snapshot to avoid
  // round-trips when nothing changed.
  async function handleBlur() {
    const current = values[activeSlot] ?? '';
    if (current === (lastSaved.current[activeSlot] ?? '')) return;
    setInFlight(true);
    setError(null);
    try {
      const ok = await onPersist(activeSlot, current);
      if (ok) {
        lastSaved.current[activeSlot] = current;
        setRecentlySaved(true);
        setTimeout(() => setRecentlySaved(false), 1500);
      } else {
        setError(new Error('Save failed'));
      }
    } finally {
      setInFlight(false);
    }
  }

  // Derived save-status state.
  const dirty = (values[activeSlot] ?? '') !== (lastSaved.current[activeSlot] ?? '');
  const state: 'autosaved' | 'dirty' | 'saving' | 'saved' | 'error' = error
    ? 'error'
    : inFlight
      ? 'saving'
      : recentlySaved
        ? 'saved'
        : dirty
          ? 'dirty'
          : 'autosaved';

  async function handleTranslate(srcCode?: string) {
    if (!canTranslate) return;
    setTranslating(true);
    try {
      // If srcCode is supplied via dropdown, persist that choice as
      // the new source.
      if (srcCode && srcCode !== sourceLang) setSourceLang(srcCode);
      const useSrc = srcCode ?? sourceLang;
      // Reuse the parent translator — it always reads from current sourceLang;
      // for the dropdown override we re-fetch via the underlying onTranslate
      // (parent uses sourceLang state, so to apply override immediately we
      // ask it directly; sourceLang state will sync on next render anyway).
      void useSrc;
      const translated = await onTranslate(activeLocale);
      if (translated) {
        onChange(activeSlot, translated);
        // Translation result counts as a real edit — persist immediately
        // so the operator never has to re-click Save / re-blur.
        setInFlight(true);
        try {
          const ok = await onPersist(activeSlot, translated);
          if (ok) {
            lastSaved.current[activeSlot] = translated;
            setRecentlySaved(true);
            setTimeout(() => setRecentlySaved(false), 1500);
          }
        } finally {
          setInFlight(false);
        }
      }
    } finally {
      setTranslating(false);
    }
  }

  const otherLocalesWithValue = locales.filter(
    (l) => l.code !== activeLocale && values[slotFor(l.code)]?.trim(),
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-base">{fdef.label}</CardTitle>
            {isMultiLang && isSourceTab && (
              <Badge variant="outline" className="gap-1 text-[10px]">
                <Star className="h-2.5 w-2.5" /> Source · used by Translate
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {state !== 'autosaved' || dirty ? <SaveStatus state={state} compact /> : null}
            {isMultiLang && (
              <div className="flex flex-wrap items-center gap-1 rounded-md border p-1">
                {locales.map((l) => {
                  const slot = slotFor(l.code);
                  const hasValue = !!(values[slot]?.trim());
                  const isActive = l.code === activeLocale;
                  return (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => setActiveLocale(l.code)}
                      className={
                        isActive
                          ? 'inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium bg-primary text-primary-foreground'
                          : 'inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium hover:bg-muted'
                      }
                      title={l.display_name + (hasValue ? '' : ' — no translation yet')}
                    >
                      <span
                        className={
                          hasValue
                            ? 'h-1.5 w-1.5 rounded-full bg-green-500'
                            : 'h-1.5 w-1.5 rounded-full bg-muted-foreground/40'
                        }
                      />
                      <span className="font-mono uppercase">{l.code}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Active field — empty-state for missing translations */}
        {isMultiLang && !isSourceTab && !hasActiveValue ? (
          <MissingTranslationEmpty
            targetCode={activeLocale}
            sourceLang={sourceLang}
            locales={locales}
            canTranslate={canTranslate}
            translating={translating}
            onTranslate={handleTranslate}
            setSourceLang={setSourceLang}
          />
        ) : null}

        {fdef.multiline ? (
          <Textarea
            value={activeValue}
            onChange={(e) => onChange(activeSlot, e.target.value)}
            onBlur={handleBlur}
            placeholder={fdef.placeholder}
            rows={fdef.rows ?? 3}
          />
        ) : (
          <Input
            value={activeValue}
            onChange={(e) => onChange(activeSlot, e.target.value)}
            onBlur={handleBlur}
            placeholder={fdef.placeholder}
          />
        )}
        {fdef.helpText && <p className="text-xs text-muted-foreground">{fdef.helpText}</p>}

        {/* Non-empty target tab: keep the Translate dropdown handy for re-translation */}
        {isMultiLang && !isSourceTab && hasActiveValue && (
          <div className="flex items-center gap-2">
            <TranslateButton
              sourceLang={sourceLang}
              locales={locales}
              canTranslate={canTranslate}
              translating={translating}
              onTranslate={handleTranslate}
              setSourceLang={setSourceLang}
              compact
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={async () => {
                onChange(activeSlot, '');
                // Persist the clear immediately
                setInFlight(true);
                try {
                  const ok = await onPersist(activeSlot, '');
                  if (ok) lastSaved.current[activeSlot] = '';
                } finally {
                  setInFlight(false);
                }
              }}
              title="Clear this translation"
            >
              Clear
            </Button>
          </div>
        )}

        {/* Disclosure: other translations as reference */}
        {otherLocalesWithValue.length > 0 && (
          <button
            type="button"
            onClick={() => setShowOthers(!showOthers)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${showOthers ? 'rotate-180' : ''}`} />
            {showOthers ? 'Hide' : 'Show'} other translations ({otherLocalesWithValue.length})
          </button>
        )}
        {showOthers && otherLocalesWithValue.length > 0 && (
          <div className="rounded-md border bg-muted/30 p-2 space-y-1.5">
            {otherLocalesWithValue.map((l) => {
              const slot = slotFor(l.code);
              const v = values[slot] ?? '';
              return (
                <div key={l.code} className="text-xs">
                  <span className="font-mono uppercase text-muted-foreground mr-2">{l.code}</span>
                  <span className="text-foreground/80">
                    {v.length > 140 ? v.slice(0, 140) + '…' : v}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── MissingTranslationEmpty ───────────────────────────────────────

function MissingTranslationEmpty({
  targetCode,
  sourceLang,
  locales,
  canTranslate,
  translating,
  onTranslate,
  setSourceLang,
}: {
  targetCode: string;
  sourceLang: string;
  locales: WorkspaceLocale[];
  canTranslate: boolean;
  translating: boolean;
  onTranslate: (srcCode?: string) => void;
  setSourceLang: (code: string) => void;
}) {
  const targetName =
    locales.find((l) => l.code === targetCode)?.display_name ?? targetCode.toUpperCase();
  return (
    <div className="rounded-md border border-dashed bg-muted/20 p-4 space-y-3">
      <div>
        <p className="text-sm font-medium">No {targetName} translation yet</p>
        <p className="text-xs text-muted-foreground">
          Type a translation below, or use AI to start from your{' '}
          <span className="font-mono uppercase">{sourceLang}</span> text.
        </p>
      </div>
      {canTranslate && (
        <TranslateButton
          sourceLang={sourceLang}
          locales={locales}
          canTranslate={canTranslate}
          translating={translating}
          onTranslate={onTranslate}
          setSourceLang={setSourceLang}
        />
      )}
    </div>
  );
}

// ─── TranslateButton ────────────────────────────────────────────────
// "Translate from English ▾" — primary action button + source picker
// dropdown. Combines the translate verb with the source choice so the
// relationship is obvious without ambient settings.

function TranslateButton({
  sourceLang,
  locales,
  canTranslate,
  translating,
  onTranslate,
  setSourceLang,
  compact,
}: {
  sourceLang: string;
  locales: WorkspaceLocale[];
  canTranslate: boolean;
  translating: boolean;
  onTranslate: (srcCode?: string) => void;
  setSourceLang: (code: string) => void;
  compact?: boolean;
}) {
  return (
    <div className="inline-flex items-center rounded-md border bg-background">
      <Button
        type="button"
        variant="ghost"
        size={compact ? 'sm' : 'default'}
        disabled={!canTranslate || translating}
        onClick={() => onTranslate()}
        className="rounded-r-none border-r"
      >
        <Sparkles className={`h-3 w-3 mr-1 ${translating ? 'animate-pulse' : ''}`} />
        {translating ? 'Translating…' : `Translate from ${sourceLang.toUpperCase()}`}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size={compact ? 'sm' : 'default'}
            className="rounded-l-none px-2"
            title="Change source language"
            disabled={translating}
          >
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <Label className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            Translate from
          </Label>
          {locales.map((l) => (
            <DropdownMenuItem
              key={l.code}
              onClick={() => setSourceLang(l.code)}
              className={l.code === sourceLang ? 'bg-accent' : ''}
            >
              <span className="font-mono uppercase text-xs mr-2">{l.code}</span>
              {l.display_name}
              {l.is_default && <Star className="h-3 w-3 ml-1 text-muted-foreground" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ─── BCP-47 → human-readable language names ────────────────────────

function bcp47ToHumanName(code: string): string {
  const base = code.toLowerCase().split('-')[0];
  const map: Record<string, string> = {
    en: 'english',
    es: 'spanish',
    fr: 'french',
    de: 'german',
    pt: 'portuguese',
    it: 'italian',
    nl: 'dutch',
    pl: 'polish',
    ru: 'russian',
    ja: 'japanese',
    ko: 'korean',
    zh: 'chinese',
    ar: 'arabic',
    hi: 'hindi',
    tr: 'turkish',
    vi: 'vietnamese',
    th: 'thai',
    sv: 'swedish',
    da: 'danish',
    fi: 'finnish',
    no: 'norwegian',
    cs: 'czech',
    el: 'greek',
    he: 'hebrew',
    hu: 'hungarian',
    id: 'indonesian',
    ms: 'malay',
    ro: 'romanian',
    sk: 'slovak',
    uk: 'ukrainian',
  };
  return map[base] ?? base;
}
