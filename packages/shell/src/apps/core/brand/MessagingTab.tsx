/**
 * Messaging Tab — Brand voice, taglines, and copy.
 *
 * v0.1.15.1: per-field language tabs. Each simple field is a card with
 * a tab strip across the top — one tab per enabled language with a
 * filled/empty indicator dot. Operators tab through *one field's*
 * translations at a time. Missing translations get a "Translate from
 * {source}" button when an AI tier with provider `workers-ai` is
 * configured (preferring one named `translate`).
 *
 * Multi-language scope is intentionally narrow:
 *   - Simple text fields are localized.
 *   - value_props (JSON-encoded array) stays default-locale only —
 *     translating the JSON structure is a different problem.
 *   - Custom fields stay default-locale only for the same reason.
 *
 * Storage: brand_tokens.locale = '' for the default language slot;
 * non-default languages get rows with explicit BCP-47 codes. The empty
 * string slot survives a language being removed (data isn't lost).
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Trash2, Sparkles } from 'lucide-react';

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
  toast,
} from '@ensemble-edge/ui';
import { authedFetch } from '../../../state';

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

/** Token shape per locale: `{ tagline: { '': 'EN value', 'es': 'ES value' } }`. */
type LocalizedTokens = Record<string, Record<string, string>>;

interface SimpleFieldDef {
  key: string;
  label: string;
  description?: string;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  helpText?: string;
}

const SIMPLE_FIELDS: SimpleFieldDef[] = [
  { key: 'tagline',           label: 'Tagline',            placeholder: 'The intelligent capital platform' },
  { key: 'elevator_pitch',    label: 'Elevator Pitch',     placeholder: 'One paragraph explaining what you do…', multiline: true, rows: 3 },
  { key: 'mission',           label: 'Mission Statement',  placeholder: 'Our mission is to…', multiline: true, rows: 2 },
  { key: 'boilerplate',       label: 'Company Boilerplate', placeholder: 'Ownly Group is an Austin-based fintech…', multiline: true, rows: 3 },
  { key: 'legal_footer',      label: 'Legal Footer',       placeholder: '© {year} The Ownly Group, LLC. All rights reserved.', helpText: 'Use {year} for auto-updating year' },
  { key: 'tone_descriptors',  label: 'Tone Descriptors',   placeholder: 'confident, clear, approachable', helpText: 'Comma-separated adjectives' },
  { key: 'tone_avoid',        label: 'Tone — Avoid',       placeholder: 'jargon without explanation, hype', helpText: 'Things to never say' },
  { key: 'voice_guidelines',  label: 'Voice Guidelines',   placeholder: "First person plural ('we'). Active voice…", multiline: true, rows: 3 },
];

const SIMPLE_FIELD_KEYS = new Set(SIMPLE_FIELDS.map((f) => f.key));
const SPECIAL_KEYS = new Set(['value_props']);

// localStorage key for the source-language preference (per-browser, not per-workspace).
const SOURCE_LANG_KEY = 'ensemble:messaging-source-lang';

// ─── Tab ────────────────────────────────────────────────────────────

export function MessagingTab() {
  // Localized tokens map: outer key = field key, inner = locale code.
  const [tokens, setTokens] = useState<LocalizedTokens>({});
  const [valueProps, setValueProps] = useState<ValueProp[]>([{ headline: '', description: '' }]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [locales, setLocales] = useState<WorkspaceLocale[]>([]);
  const [tiers, setTiers] = useState<AiTier[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sourceLang, setSourceLang] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(SOURCE_LANG_KEY) ?? '';
  });

  // Initial load — three calls in parallel: tokens, locales, ai tiers.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [tokensRes, localesRes, tiersRes] = await Promise.all([
        authedFetch('/_ensemble/core/brand/tokens/messaging?all_locales=1').catch(() => null),
        authedFetch('/_ensemble/locales').catch(() => null),
        authedFetch('/_ensemble/ai/tiers').catch(() => null),
      ]);
      if (cancelled) return;

      // Tokens
      if (tokensRes?.ok) {
        const body = (await tokensRes.json()) as {
          data?: Array<{ key: string; value: string; locale: string }>;
        };
        const map: LocalizedTokens = {};
        const custom: CustomField[] = [];
        let vp: ValueProp[] | null = null;
        for (const row of body.data ?? []) {
          if (row.key === 'value_props') {
            // Default-locale only.
            if (row.locale === '') {
              try { vp = JSON.parse(row.value); } catch { /* noop */ }
            }
            continue;
          }
          if (SIMPLE_FIELD_KEYS.has(row.key)) {
            (map[row.key] ??= {})[row.locale] = row.value;
            continue;
          }
          // Anything else is a custom field. We keep custom-field
          // localization out-of-scope for v0.1.15.1 — only default-locale.
          if (row.locale === '' && !SPECIAL_KEYS.has(row.key)) {
            custom.push({ key: row.key, value: row.value, type: 'text', label: row.key });
          }
        }
        setTokens(map);
        if (vp) setValueProps(vp);
        setCustomFields(custom);
      }

      // Locales
      if (localesRes?.ok) {
        const body = (await localesRes.json()) as { locales: WorkspaceLocale[] };
        setLocales(body.locales ?? []);
      }

      // AI tiers (translation discovery)
      if (tiersRes?.ok) {
        const body = (await tiersRes.json()) as { tiers: AiTier[] };
        setTiers(body.tiers ?? []);
      }

      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Set initial source-language to the workspace default once locales load,
  // if the operator hasn't already chosen one.
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

  // Discover a translation-capable tier. Prefer the name 'translate';
  // fall back to any provisioned `workers-ai` tier.
  const translationTier = useMemo<AiTier | null>(() => {
    const named = tiers.find(
      (t) => t.name === 'translate' && t.provider === 'workers-ai' && t.route_provisioned,
    );
    if (named) return named;
    return (
      tiers.find((t) => t.provider === 'workers-ai' && t.route_provisioned) ?? null
    );
  }, [tiers]);

  function setLocalizedValue(fieldKey: string, locale: string, value: string) {
    setTokens((prev) => {
      const next = { ...prev };
      const inner = { ...(next[fieldKey] ?? {}) };
      // Empty string means "delete this translation" — semantically the
      // same as not having a row. Stored as empty so the server-side
      // PUT can do a delete on this slot.
      inner[locale] = value;
      next[fieldKey] = inner;
      return next;
    });
  }

  async function translate(fieldKey: string, targetLocale: string): Promise<string | null> {
    if (!translationTier) return null;
    const sourceText = tokens[fieldKey]?.[sourceLang === defaultLocale ? '' : sourceLang]
      ?? tokens[fieldKey]?.[''] ?? '';
    if (!sourceText.trim()) {
      toast.error('Nothing to translate', {
        description: `${fieldNameFor(fieldKey)} is empty in the source language.`,
      });
      return null;
    }
    const sourceCode = sourceLang || defaultLocale;
    try {
      const r = await authedFetch(`/_ensemble/ai/call/${encodeURIComponent(translationTier.name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sourceText,
          source_lang: bcp47ToHumanName(sourceCode),
          target_lang: bcp47ToHumanName(targetLocale),
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const body = (await r.json()) as {
        result?: { translated_text?: string };
        translated_text?: string;
      };
      const out = body.result?.translated_text ?? body.translated_text;
      if (!out) {
        toast.error('Translation returned no text', {
          description: 'Check the tier configuration in Settings → Connections.',
        });
        return null;
      }
      toast.success('Translated');
      return out;
    } catch (e) {
      toast.error('Translation failed', {
        description: e instanceof Error ? e.message : String(e),
      });
      return null;
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Build per-locale token batches so each PUT writes to the right
      // locale slot. The empty-string locale carries default-locale
      // values plus the special non-localized fields (value_props,
      // custom fields).
      const byLocale = new Map<string, Record<string, string>>();
      const ensure = (loc: string): Record<string, string> => {
        let m = byLocale.get(loc);
        if (!m) { m = {}; byLocale.set(loc, m); }
        return m;
      };

      // Simple localized fields: emit each (locale, value) we hold.
      for (const fdef of SIMPLE_FIELDS) {
        const inner = tokens[fdef.key] ?? {};
        for (const [loc, val] of Object.entries(inner)) {
          ensure(loc)[fdef.key] = val;
        }
      }

      // Default-locale-only fields
      ensure('')['value_props'] = JSON.stringify(valueProps.filter((vp) => vp.headline));
      for (const f of customFields) {
        if (f.key && f.value) ensure('')[f.key] = f.value;
      }

      // Fire all the PUTs. They're independent — we don't need them in
      // a specific order because the server upserts per (key, locale).
      const results = await Promise.all(
        [...byLocale.entries()].map(([locale, tokensForLocale]) =>
          authedFetch('/_ensemble/brand/tokens', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              category: 'messaging',
              tokens: tokensForLocale,
              locale,
            }),
          }),
        ),
      );

      if (results.some((r) => !r.ok)) throw new Error('One or more saves failed');
      toast.success('Messaging saved');
    } catch (e) {
      toast.error('Failed to save', {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSaving(false);
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

  const sourceOptions = orderedLocales;

  return (
    <div className="space-y-6">
      {orderedLocales.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Working with multiple languages</CardTitle>
                <CardDescription>
                  Each field below has a tab per language. Edit translations in place. Use the
                  source-language picker to pick which language the "Translate" button copies from.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Label className="text-xs text-muted-foreground">Translate from</Label>
                <Select value={sourceLang || defaultLocale} onValueChange={setSourceLang}>
                  <SelectTrigger className="h-8 w-auto min-w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceOptions.map((l) => (
                      <SelectItem key={l.code} value={l.code}>
                        {l.display_name}
                        <span className="ml-2 text-xs text-muted-foreground font-mono">{l.code}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {translationTier ? (
              <p className="text-xs text-muted-foreground mt-2">
                <Sparkles className="inline h-3 w-3 mr-1" />
                AI translation via tier <span className="font-mono">{translationTier.name}</span>
                {' '}(provider <span className="font-mono">{translationTier.provider}</span>).
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-2">
                No translation-capable AI tier configured. Add a tier with provider{' '}
                <span className="font-mono">workers-ai</span> under Settings → Connections to
                enable one-click translation.
              </p>
            )}
          </CardHeader>
        </Card>
      )}

      {SIMPLE_FIELDS.map((fdef) => (
        <LocalizedField
          key={fdef.key}
          fdef={fdef}
          locales={orderedLocales}
          defaultLocale={defaultLocale}
          values={tokens[fdef.key] ?? {}}
          onChange={(loc, v) => setLocalizedValue(fdef.key, loc, v)}
          sourceLang={sourceLang || defaultLocale}
          canTranslate={!!translationTier}
          onTranslate={(targetLocale) => translate(fdef.key, targetLocale)}
        />
      ))}

      {/* Value Propositions — default-locale only */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Value Propositions</CardTitle>
              <CardDescription>Key benefits — used in marketing and AI context</CardDescription>
            </div>
            {orderedLocales.length > 1 && (
              <span className="text-xs text-muted-foreground">Default language only</span>
            )}
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
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Custom Fields</CardTitle>
              <CardDescription>Add messaging fields specific to your business</CardDescription>
            </div>
            {orderedLocales.length > 1 && (
              <span className="text-xs text-muted-foreground">Default language only</span>
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
        <CardFooter>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Messaging'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

function fieldNameFor(key: string): string {
  return SIMPLE_FIELDS.find((f) => f.key === key)?.label ?? key;
}

// ─── LocalizedField ────────────────────────────────────────────────

function LocalizedField({
  fdef,
  locales,
  defaultLocale,
  values,
  onChange,
  sourceLang,
  canTranslate,
  onTranslate,
}: {
  fdef: SimpleFieldDef;
  locales: WorkspaceLocale[];
  defaultLocale: string;
  values: Record<string, string>;
  onChange: (locale: string, value: string) => void;
  sourceLang: string;
  canTranslate: boolean;
  onTranslate: (targetLocale: string) => Promise<string | null>;
}) {
  // Map a locale code to the storage key. Default locale always lives
  // in the empty-string row (preserves "removed locale = data survives"
  // semantics).
  const slotFor = (code: string): string => (code === defaultLocale ? '' : code);

  // Active tab — defaults to the workspace default locale.
  const [activeLocale, setActiveLocale] = useState<string>(defaultLocale);
  const [translating, setTranslating] = useState(false);

  const activeSlot = slotFor(activeLocale);
  const activeValue = values[activeSlot] ?? '';

  async function handleTranslate() {
    if (!canTranslate) return;
    setTranslating(true);
    try {
      const translated = await onTranslate(activeLocale);
      if (translated) onChange(activeSlot, translated);
    } finally {
      setTranslating(false);
    }
  }

  // Show other locales as faint previews under the active field so
  // operators can scan their other translations without changing tabs.
  const otherLocales = locales.filter((l) => l.code !== activeLocale);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base">{fdef.label}</CardTitle>
            {fdef.description && <CardDescription>{fdef.description}</CardDescription>}
          </div>
          {locales.length > 1 && (
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
      </CardHeader>
      <CardContent className="space-y-3">
        {fdef.multiline ? (
          <Textarea
            value={activeValue}
            onChange={(e) => onChange(activeSlot, e.target.value)}
            placeholder={fdef.placeholder}
            rows={fdef.rows ?? 3}
          />
        ) : (
          <Input
            value={activeValue}
            onChange={(e) => onChange(activeSlot, e.target.value)}
            placeholder={fdef.placeholder}
          />
        )}
        {fdef.helpText && <p className="text-xs text-muted-foreground">{fdef.helpText}</p>}

        {activeLocale !== sourceLang && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canTranslate || translating}
              onClick={handleTranslate}
              title={
                !canTranslate
                  ? 'Configure a workers-ai tier under Settings → Connections to enable'
                  : `Translate ${sourceLang} → ${activeLocale} via AI`
              }
            >
              <Sparkles className={`h-3 w-3 mr-1 ${translating ? 'animate-pulse' : ''}`} />
              {translating ? 'Translating…' : `Translate from ${sourceLang.toUpperCase()}`}
            </Button>
            {activeValue && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange(activeSlot, '')}
                title="Clear this translation"
              >
                Clear
              </Button>
            )}
          </div>
        )}

        {otherLocales.length > 0 && otherLocales.some((l) => values[slotFor(l.code)]?.trim()) && (
          <div className="rounded-md border bg-muted/30 p-2 space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Other languages</p>
            {otherLocales.map((l) => {
              const slot = slotFor(l.code);
              const v = values[slot]?.trim();
              if (!v) return null;
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

// ─── BCP-47 → human-readable language names ────────────────────────
// Cloudflare Workers AI translation models (m2m100, nllb) accept
// human-readable language names, not BCP-47 codes. This is a small
// shim mapping common codes to the names the models recognize.

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
