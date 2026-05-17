/**
 * Typography Tab — Per-role font family + weight + style.
 *
 * v0.1.17 rewrite:
 *   - Pick from ~1500 Google Fonts via typeahead Combobox.
 *   - Pinned system defaults at top of every picker.
 *   - Per-role Weight Select (populated from the chosen family's variants).
 *   - Per-role Style toggle (Normal / Italic), gated on family support.
 *   - Live preview rendered in the actual chosen face.
 *
 * Storage shape (new, in brand_tokens category 'typography'):
 *   typography_<role>_family / _weight / _style    for role in:
 *     display, heading, body, mono
 *
 * Legacy enum slugs (`display_font='inter'`) are migrated on read.
 */

import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SaveStatus,
  FontCombobox,
  toast,
} from '@ensemble-edge/ui';
import type { FontComboboxOption } from '@ensemble-edge/ui';

import { authedFetch, emitWorkspaceEvent } from '../../../state';
import { useFormStatus } from '../../../hooks/useFormStatus';
import { FALLBACK_GOOGLE_FONTS } from './fallback-fonts';
import {
  SYSTEM_FONTS,
  DEFAULT_WEIGHT_FOR_ROLE,
  WEIGHT_LABELS,
  weightsForFamily,
  familySupportsItalic,
  readRoleTokens,
  writeRoleTokens,
  resolveFamilyStack,
  isSystemFont,
  type FontRole,
} from './font-utils';

interface GoogleFontEntry {
  family: string;
  category: string;
  variants: string[];
  popularity?: number;
}

const ROLES: Array<{ key: FontRole; label: string; description: string; preview: string }> = [
  { key: 'display', label: 'Display',   description: 'Large headlines and hero text', preview: 'Make something beautiful' },
  { key: 'heading', label: 'Heading',   description: 'Section headers and titles',    preview: 'The quick brown fox' },
  { key: 'body',    label: 'Body',      description: 'Long-form reading text',        preview: 'The quick brown fox jumps over the lazy dog. Used for paragraphs, descriptions, and most reading.' },
  { key: 'mono',    label: 'Monospace', description: 'Code and tabular data',         preview: 'const x = 42;' },
];

const RECENT_KEY = 'ensemble:brand:recent-fonts';

export function TypographyTab() {
  // Per-role state: family/weight/style triples.
  const [byRole, setByRole] = useState<Record<FontRole, { family: string; weight: string; style: 'normal' | 'italic' }>>({
    display:  { family: 'System Sans', weight: '700', style: 'normal' },
    heading:  { family: 'System Sans', weight: '600', style: 'normal' },
    body:     { family: 'System Sans', weight: '400', style: 'normal' },
    mono:     { family: 'System Mono', weight: '400', style: 'normal' },
  });
  const [catalog, setCatalog] = useState<GoogleFontEntry[]>([]);
  // Whether the current catalog is the bundled fallback (curated ~40)
  // rather than the live full Google Fonts list (~1934). When true,
  // we trigger a one-shot upgrade fetch the first time the operator
  // types in a font picker — so typeahead reaches *every* family even
  // though the visible default list is intentionally short.
  const [catalogIsFallback, setCatalogIsFallback] = useState(false);
  const upgradingRef = React.useRef(false);

  const upgradeCatalog = React.useCallback(() => {
    if (!catalogIsFallback || upgradingRef.current) return;
    upgradingRef.current = true;
    // `?refresh=1` bypasses any poisoned-empty KV cache entry. The
    // initial page load fetch hit the cache (or empty); the upgrade
    // forces a fresh upstream attempt.
    authedFetch('/_ensemble/core/fonts/google?refresh=1')
      .then((r) => r.json() as Promise<{ fonts: GoogleFontEntry[]; count?: number }>)
      .then((res) => {
        const fonts = res.fonts ?? [];
        console.info('[fonts] upgrade fetch returned', fonts.length, 'families');
        if (fonts.length > 0) {
          setCatalog(fonts);
          setCatalogIsFallback(false);
        } else {
          // Allow another retry next time the operator types.
          upgradingRef.current = false;
        }
      })
      .catch((err) => {
        console.warn('[fonts] upgrade fetch failed:', err);
        upgradingRef.current = false;
      });
  }, [catalogIsFallback]);
  const [recent, setRecent] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      return (JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[]).slice(0, 8);
    } catch { return []; }
  });

  const status = useFormStatus({ value: byRole, mode: 'manual' });
  const saving = status.state === 'saving';

  // Load typography tokens (with legacy migration) + Google Fonts catalog.
  useEffect(() => {
    Promise.all([
      authedFetch('/_ensemble/core/brand/tokens/typography')
        .then((r) => r.json() as Promise<{ data?: Array<{ key: string; value: string }> }>)
        .catch(() => ({ data: [] })),
      authedFetch('/_ensemble/core/fonts/google')
        .then((r) => r.json() as Promise<{ fonts: GoogleFontEntry[] }>)
        .catch(() => ({ fonts: [] })),
    ]).then(([tokRes, fontsRes]) => {
      const map: Record<string, string> = {};
      for (const t of tokRes.data ?? []) map[t.key] = t.value;
      const next: typeof byRole = { ...byRole };
      for (const role of ['display', 'heading', 'body', 'mono'] as FontRole[]) {
        const rt = readRoleTokens(role, map);
        if (rt) next[role] = rt;
      }
      setByRole(next);
      // If the proxy endpoint returned no fonts (KV miss + upstream
      // unreachable, parse error, etc.), fall back to the bundled
      // top-40 catalog so the picker is never empty.
      const fonts = fontsRes.fonts ?? [];
      if (fonts.length === 0) {
        setCatalog(FALLBACK_GOOGLE_FONTS);
        setCatalogIsFallback(true);
        console.warn('[fonts] live catalog empty; using bundled fallback (~40 families).');
      } else {
        setCatalog(fonts);
        setCatalogIsFallback(false);
      }
      // After async load, snapshot the *loaded* byRole shape as the
      // dirty-tracking baseline. Pass explicitly because the closure-
      // captured `value` in the hook is still the pre-load defaults
      // until React re-renders.
      status.resetBaseline(next);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setRole(role: FontRole, patch: Partial<(typeof byRole)[FontRole]>) {
    setByRole((prev) => ({ ...prev, [role]: { ...prev[role], ...patch } }));
  }

  function bumpRecent(family: string) {
    if (isSystemFont(family)) return;
    const next = [family, ...recent.filter((f) => f !== family)].slice(0, 8);
    setRecent(next);
    if (typeof window !== 'undefined') {
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* noop */ }
    }
  }

  async function handleSave() {
    status.beginSave();
    try {
      const tokens: Record<string, string> = {};
      for (const role of ['display', 'heading', 'body', 'mono'] as FontRole[]) {
        Object.assign(tokens, writeRoleTokens(role, byRole[role]));
        // Best-effort: clear the legacy slug key so future loads don't
        // see two sources of truth. Empty value → server-side delete.
        tokens[`${role}_font`] = '';
      }
      const r = await authedFetch('/_ensemble/brand/tokens', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'typography', tokens }),
      });
      if (!r.ok) throw new Error('Failed to save');
      status.commitSave();
      emitWorkspaceEvent('brand.tokens.changed', { category: 'typography' });
      toast.success('Typography saved');
    } catch (e) {
      status.failSave(e);
      toast.error('Failed to save typography');
    }
  }

  // Catalog → FontCombobox option shape, memoized.
  const systemOptions: FontComboboxOption[] = useMemo(
    () => SYSTEM_FONTS.map((s) => ({ family: s.family, category: s.category, hint: 'System' })),
    [],
  );

  const googleOptions: FontComboboxOption[] = useMemo(
    () =>
      // Sort by popularity rank (lower = more popular). Keep families
      // without popularity (rare) at the end so the picker never goes
      // blank — better than dropping them entirely.
      [...catalog]
        .sort((a, b) => (a.popularity ?? 9999) - (b.popularity ?? 9999))
        .map((f) => ({ family: f.family, category: f.category })),
    [catalog],
  );

  const variantsByFamily = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const f of catalog) map.set(f.family, f.variants);
    return map;
  }, [catalog]);

  return (
    <div className="space-y-6">
      {ROLES.map(({ key, label, description, preview }) => (
        <RoleCard
          key={key}
          role={key}
          label={label}
          description={description}
          preview={preview}
          value={byRole[key]}
          onChange={(patch) => setRole(key, patch)}
          onFamilyPicked={bumpRecent}
          onFirstSearch={upgradeCatalog}
          systemOptions={systemOptions}
          googleOptions={googleOptions}
          variantsByFamily={variantsByFamily}
          recent={recent}
        />
      ))}

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={!status.dirty || saving}>
          {saving ? 'Saving…' : 'Save Typography'}
        </Button>
        {status.state !== 'clean' && <SaveStatus state={status.state} />}
      </div>
    </div>
  );
}

// ─── RoleCard ──────────────────────────────────────────────────────

function RoleCard({
  role,
  label,
  description,
  preview,
  value,
  onChange,
  onFamilyPicked,
  onFirstSearch,
  systemOptions,
  googleOptions,
  variantsByFamily,
  recent,
}: {
  role: FontRole;
  label: string;
  description: string;
  preview: string;
  value: { family: string; weight: string; style: 'normal' | 'italic' };
  onChange: (patch: Partial<{ family: string; weight: string; style: 'normal' | 'italic' }>) => void;
  onFamilyPicked: (family: string) => void;
  onFirstSearch?: () => void;
  systemOptions: FontComboboxOption[];
  googleOptions: FontComboboxOption[];
  variantsByFamily: Map<string, string[]>;
  recent: string[];
}) {
  // Available weights/style support for the *currently selected* family.
  const variants = variantsByFamily.get(value.family);
  const availableWeights = useMemo(() => weightsForFamily(variants), [variants]);
  const supportsItalic = useMemo(() => familySupportsItalic(variants), [variants]);

  // If the chosen weight isn't available for the new family, snap to
  // the closest weight (or the role default).
  useEffect(() => {
    if (!availableWeights.includes(value.weight)) {
      const fallback = availableWeights.includes(DEFAULT_WEIGHT_FOR_ROLE[role])
        ? DEFAULT_WEIGHT_FOR_ROLE[role]
        : availableWeights[0];
      onChange({ weight: fallback });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.family, availableWeights.join(',')]);

  const stack = resolveFamilyStack(value.family);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
          <div className="space-y-1.5">
            <Label>Family</Label>
            <FontCombobox
              value={value.family}
              onChange={(family) => { onChange({ family }); onFamilyPicked(family); }}
              systemFonts={systemOptions}
              googleFonts={googleOptions}
              recent={recent}
              onFirstSearch={onFirstSearch}
              placeholder="Pick a font…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Weight</Label>
            <Select value={value.weight} onValueChange={(w) => onChange({ weight: w })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {availableWeights.map((w) => (
                  <SelectItem key={w} value={w}>
                    {w} — {WEIGHT_LABELS[w] ?? 'Custom'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Style</Label>
            <div className="flex rounded-md border p-1">
              <button
                type="button"
                className={
                  value.style === 'normal'
                    ? 'flex-1 rounded px-2 py-1 text-xs font-medium bg-primary text-primary-foreground'
                    : 'flex-1 rounded px-2 py-1 text-xs font-medium hover:bg-muted'
                }
                onClick={() => onChange({ style: 'normal' })}
              >
                Normal
              </button>
              <button
                type="button"
                className={
                  value.style === 'italic'
                    ? 'flex-1 rounded px-2 py-1 text-xs font-medium bg-primary text-primary-foreground'
                    : 'flex-1 rounded px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50'
                }
                onClick={() => onChange({ style: 'italic' })}
                disabled={!supportsItalic}
                title={supportsItalic ? 'Italic' : 'This family has no italic variants'}
              >
                Italic
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-md border bg-muted/30 p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Preview</p>
          <p
            style={{
              fontFamily: stack,
              fontWeight: Number(value.weight),
              fontStyle: value.style,
              fontSize: role === 'display' ? '36px' : role === 'heading' ? '24px' : role === 'mono' ? '14px' : '16px',
              lineHeight: 1.3,
            }}
            className="m-0 break-words"
          >
            {preview}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
