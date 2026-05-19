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
  LETTER_SPACING_PRESETS,
  TEXT_TRANSFORM_OPTIONS,
  FONT_SIZE_PRESETS,
  SCALE_RATIO_PRESETS,
  DEFAULT_SCALE_RATIO,
  ROLE_META,
  weightsForFamily,
  familySupportsItalic,
  readRoleTokens,
  writeRoleTokens,
  resolveFamilyStack,
  computeScaleSteps,
  isSystemFont,
  type FontRole,
  type TextTransform,
} from './font-utils';

interface GoogleFontEntry {
  family: string;
  category: string;
  variants: string[];
  popularity?: number;
}

/**
 * Display order for the Typography tab. Wordmark sits first (the brand
 * lockup deserves prime real estate). Mono lives at the bottom — it's
 * a specialist role only some workspaces tune.
 *
 * `preview` is the sample copy each role renders in its preview block.
 * The role's `label` and `usage` come from ROLE_META in font-utils so
 * the brand-guide readout sees identical text.
 */
const ROLES: Array<{ key: FontRole; preview: string }> = [
  { key: 'wordmark',   preview: 'Ensemble' },
  { key: 'display',    preview: 'Make something beautiful' },
  { key: 'heading',    preview: 'The quick brown fox' },
  { key: 'subheading', preview: 'Card title or modal heading' },
  { key: 'body',       preview: 'The quick brown fox jumps over the lazy dog. Used for paragraphs, descriptions, and most reading.' },
  { key: 'eyebrow',    preview: 'Product update' },
  { key: 'label',      preview: 'Save changes' },
  { key: 'caption',    preview: 'Updated 5 minutes ago. Source: Ensemble v0.1.24 release notes.' },
  { key: 'mono',       preview: 'const x = 42;' },
];

const RECENT_KEY = 'ensemble:brand:recent-fonts';

export function TypographyTab() {
  // Per-role state. Wordmark now lives here too (the typography part —
  // LogosTab still owns the wordmark text/image). Subheading defaults
  // inherit Heading; we surface that as "Inherits from Heading" in the
  // UI when family is empty.
  type RoleState = {
    family: string;
    weight: string;
    style: 'normal' | 'italic';
    letterSpacing: string;
    textTransform: TextTransform;
    fontSize: string;
    scaleRatio: string;
  };
  const [byRole, setByRole] = useState<Record<FontRole, RoleState>>({
    wordmark:   { family: '',            weight: '700', style: 'normal', letterSpacing: '0em',    textTransform: 'none',      fontSize: '2rem',     scaleRatio: DEFAULT_SCALE_RATIO },
    display:    { family: 'System Sans', weight: '700', style: 'normal', letterSpacing: '0em',    textTransform: 'none',      fontSize: '3rem',     scaleRatio: DEFAULT_SCALE_RATIO },
    heading:    { family: 'System Sans', weight: '600', style: 'normal', letterSpacing: '0em',    textTransform: 'none',      fontSize: '2.25rem',  scaleRatio: DEFAULT_SCALE_RATIO },
    subheading: { family: '',            weight: '500', style: 'normal', letterSpacing: '0em',    textTransform: 'none',      fontSize: '1.25rem',  scaleRatio: DEFAULT_SCALE_RATIO },
    body:       { family: 'System Sans', weight: '400', style: 'normal', letterSpacing: '0em',    textTransform: 'none',      fontSize: '1rem',     scaleRatio: DEFAULT_SCALE_RATIO },
    eyebrow:    { family: 'System Sans', weight: '600', style: 'normal', letterSpacing: '0.1em',  textTransform: 'uppercase', fontSize: '0.75rem',  scaleRatio: DEFAULT_SCALE_RATIO },
    label:      { family: 'System Sans', weight: '500', style: 'normal', letterSpacing: '0.01em', textTransform: 'none',      fontSize: '0.875rem', scaleRatio: DEFAULT_SCALE_RATIO },
    caption:    { family: 'System Sans', weight: '400', style: 'normal', letterSpacing: '0em',    textTransform: 'none',      fontSize: '0.75rem',  scaleRatio: DEFAULT_SCALE_RATIO },
    mono:       { family: 'System Mono', weight: '400', style: 'normal', letterSpacing: '0em',    textTransform: 'none',      fontSize: '0.875rem', scaleRatio: DEFAULT_SCALE_RATIO },
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

  // Load typography + identity (for wordmark) tokens + Google Fonts catalog.
  // Wordmark typography lives in category 'identity' alongside the wordmark
  // text/image (LogosTab's storage); content roles live in 'typography'.
  useEffect(() => {
    Promise.all([
      authedFetch('/_ensemble/core/brand/tokens/typography')
        .then((r) => r.json() as Promise<{ data?: Array<{ key: string; value: string }> }>)
        .catch(() => ({ data: [] })),
      authedFetch('/_ensemble/core/brand/tokens/identity')
        .then((r) => r.json() as Promise<{ data?: Array<{ key: string; value: string }> }>)
        .catch(() => ({ data: [] })),
      authedFetch('/_ensemble/core/fonts/google')
        .then((r) => r.json() as Promise<{ fonts: GoogleFontEntry[] }>)
        .catch(() => ({ fonts: [] })),
    ]).then(([typoRes, idRes, fontsRes]) => {
      const map: Record<string, string> = {};
      for (const t of typoRes.data ?? []) map[t.key] = t.value;
      for (const t of idRes.data ?? []) map[t.key] = t.value;
      const next: typeof byRole = { ...byRole };
      for (const role of ['wordmark', 'display', 'heading', 'subheading', 'body', 'eyebrow', 'label', 'caption', 'mono'] as FontRole[]) {
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

  function setRole(role: FontRole, patch: Partial<RoleState>) {
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
      // Two PUTs — wordmark typography belongs to the `identity` category
      // (LogosTab co-owns the wordmark text/image there); the other roles
      // belong to `typography`. Saving in parallel.
      const typographyTokens: Record<string, string> = {};
      const contentRoles: FontRole[] = ['display', 'heading', 'subheading', 'body', 'eyebrow', 'label', 'caption', 'mono'];
      for (const role of contentRoles) {
        // Subheading is allowed to remain "inherit from heading" — only
        // write its tokens if the operator explicitly picked a family.
        if (role === 'subheading' && !byRole[role].family) {
          typographyTokens[`typography_${role}_family`] = '';
          typographyTokens[`typography_${role}_weight`] = '';
          typographyTokens[`typography_${role}_style`] = '';
          typographyTokens[`typography_${role}_letter_spacing`] = '';
          typographyTokens[`typography_${role}_text_transform`] = '';
          typographyTokens[`typography_${role}_font_size`] = '';
          typographyTokens[`typography_${role}_scale_ratio`] = '';
          continue;
        }
        Object.assign(typographyTokens, writeRoleTokens(role, byRole[role]));
        // Clear the legacy slug key so future loads don't see two
        // sources of truth. Empty value → server-side delete.
        typographyTokens[`${role}_font`] = '';
      }

      const identityTokens: Record<string, string> = {};
      const wm = byRole.wordmark;
      if (wm.family) {
        Object.assign(identityTokens, writeRoleTokens('wordmark', wm));
      } else {
        // Operator cleared wordmark — explicit empty → inherit display.
        identityTokens['wordmark_family'] = '';
        identityTokens['wordmark_weight'] = '';
        identityTokens['wordmark_style'] = '';
        identityTokens['wordmark_letter_spacing'] = '';
        identityTokens['wordmark_text_transform'] = '';
        identityTokens['wordmark_font_size'] = '';
        identityTokens['wordmark_scale_ratio'] = '';
      }

      // v0.1.51: single atomic endpoint installs Google Fonts to R2
      // (so server-side Satori render has the TTF available) AND
      // commits brand_tokens. Save button stays disabled until both
      // steps complete. If install fails, brand_tokens stays unchanged
      // and the operator sees a clear error.
      const saveRes = await authedFetch('/_ensemble/core/brand/typography/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ typography: typographyTokens, identity: identityTokens }),
      });
      if (!saveRes.ok) {
        const body = await saveRes.json().catch(() => ({})) as { detail?: string };
        throw new Error(body.detail || `HTTP ${saveRes.status}`);
      }
      status.commitSave();
      emitWorkspaceEvent('brand.tokens.changed', { category: 'typography' });
      emitWorkspaceEvent('brand.tokens.changed', { category: 'identity' });
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
      {ROLES.map(({ key, preview }) => {
        const meta = ROLE_META[key];
        // Subheading inherits Heading when its family is empty. Pass the
        // resolved (inherited) value to the preview so the operator sees
        // what the workspace will actually render.
        const inheritsFrom: FontRole | null =
          key === 'subheading' && !byRole.subheading.family ? 'heading'
          : key === 'wordmark' && !byRole.wordmark.family ? 'display'
          : null;
        const effective = inheritsFrom ? byRole[inheritsFrom] : byRole[key];
        return (
          <RoleCard
            key={key}
            role={key}
            label={meta.label}
            description={meta.usage}
            preview={preview}
            value={byRole[key]}
            effective={effective}
            inheritsFrom={inheritsFrom}
            onChange={(patch) => setRole(key, patch)}
            onClearOverride={
              inheritsFrom
                ? undefined
                : (key === 'subheading' || key === 'wordmark')
                  ? () => setRole(key, { family: '', weight: '', style: 'normal', letterSpacing: '0em', textTransform: 'none', fontSize: '', scaleRatio: DEFAULT_SCALE_RATIO })
                  : undefined
            }
            onFamilyPicked={bumpRecent}
            onFirstSearch={upgradeCatalog}
            systemOptions={systemOptions}
            googleOptions={googleOptions}
            variantsByFamily={variantsByFamily}
            recent={recent}
          />
        );
      })}

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

interface RoleValue {
  family: string;
  weight: string;
  style: 'normal' | 'italic';
  letterSpacing: string;
  textTransform: TextTransform;
  fontSize: string;
  scaleRatio: string;
}

function RoleCard({
  role,
  label,
  description,
  preview,
  value,
  effective,
  inheritsFrom,
  onChange,
  onClearOverride,
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
  /** The operator's stored value for this role. May have empty family
   *  if the role inherits from another. */
  value: RoleValue;
  /** The resolved value used for the preview (after inheritance). */
  effective: RoleValue;
  /** Non-null when this role is currently inheriting from another. */
  inheritsFrom: FontRole | null;
  onChange: (patch: Partial<RoleValue>) => void;
  /** Set when the role supports an inherit-from-parent override clear. */
  onClearOverride?: () => void;
  onFamilyPicked: (family: string) => void;
  onFirstSearch?: () => void;
  systemOptions: FontComboboxOption[];
  googleOptions: FontComboboxOption[];
  variantsByFamily: Map<string, string[]>;
  recent: string[];
}) {
  const inheriting = inheritsFrom !== null;
  // Available weights/style support for the *currently selected* family.
  // When inheriting, the controls are disabled but we still want to show
  // the inherited family's variant list so the operator sees what would
  // apply if they took over.
  const variants = variantsByFamily.get(effective.family);
  const availableWeights = useMemo(() => weightsForFamily(variants), [variants]);
  const supportsItalic = useMemo(() => familySupportsItalic(variants), [variants]);

  // If the chosen weight isn't available for the new family, snap to
  // the closest weight (or the role default). Only when NOT inheriting —
  // otherwise we'd be mutating a value the operator hasn't set yet.
  useEffect(() => {
    if (inheriting) return;
    if (!availableWeights.includes(value.weight)) {
      const fallback = availableWeights.includes(DEFAULT_WEIGHT_FOR_ROLE[role])
        ? DEFAULT_WEIGHT_FOR_ROLE[role]
        : availableWeights[0];
      onChange({ weight: fallback });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.family, availableWeights.join(','), inheriting]);

  // Preview always renders the *effective* values (inherited or own).
  const previewStack = resolveFamilyStack(effective.family || 'System Sans');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle>{label}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {inheriting && (
            <span className="shrink-0 text-xs text-muted-foreground rounded-full bg-muted px-2 py-1">
              Inherits from {ROLE_META[inheritsFrom].label}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
          <div className="space-y-1.5">
            <Label>Family</Label>
            <FontCombobox
              value={inheriting ? effective.family : value.family}
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
            <Select
              value={(inheriting ? effective.weight : value.weight)}
              onValueChange={(w) => onChange({ weight: w })}
              disabled={inheriting}
            >
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
            <Label>Letter spacing</Label>
            <Select
              value={inheriting ? effective.letterSpacing : value.letterSpacing}
              onValueChange={(ls) => onChange({ letterSpacing: ls })}
              disabled={inheriting}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LETTER_SPACING_PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Style</Label>
            <Select
              value={inheriting ? effective.style : value.style}
              onValueChange={(s) => onChange({ style: s as 'normal' | 'italic' })}
              disabled={inheriting}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="italic" disabled={!supportsItalic}>
                  Italic{!supportsItalic ? ' (n/a)' : ''}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Case</Label>
            <Select
              value={inheriting ? effective.textTransform : value.textTransform}
              onValueChange={(t) => onChange({ textTransform: t as TextTransform })}
              disabled={inheriting}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEXT_TRANSFORM_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Second row: Size (always) + Scale (only for heading/subheading) */}
        <div className={`grid gap-4 ${(role === 'heading' || role === 'subheading') ? 'md:grid-cols-2' : 'md:grid-cols-1 md:max-w-xs'}`}>
          <div className="space-y-1.5">
            <Label>
              {role === 'heading' ? 'Size (H1 base)'
                : role === 'subheading' ? 'Size (H4 base)'
                : 'Size'}
            </Label>
            <Select
              value={inheriting ? effective.fontSize : value.fontSize}
              onValueChange={(s) => onChange({ fontSize: s })}
              disabled={inheriting}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FONT_SIZE_PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(role === 'heading' || role === 'subheading') && (
            <div className="space-y-1.5">
              <Label>Scale ratio</Label>
              <Select
                value={inheriting ? effective.scaleRatio : value.scaleRatio}
                onValueChange={(r) => onChange({ scaleRatio: r })}
                disabled={inheriting}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SCALE_RATIO_PRESETS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {onClearOverride && !inheriting && (
          <div className="flex justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={onClearOverride}>
              Reset to inherit
            </Button>
          </div>
        )}

        <div className="rounded-md border bg-muted/30 p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Preview</p>
          {(role === 'heading' || role === 'subheading') ? (
            <ScaleSpecimen
              role={role}
              preview={preview}
              stack={previewStack}
              effective={effective}
            />
          ) : (
            <p
              style={{
                fontFamily: previewStack,
                fontWeight: Number(effective.weight) || 400,
                fontStyle: effective.style,
                letterSpacing: effective.letterSpacing,
                textTransform: effective.textTransform,
                fontSize: effective.fontSize,
                lineHeight: 1.3,
              }}
              className="m-0 break-words"
            >
              {preview}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Heading/Subheading get a three-step specimen showing H1/H2/H3 (or
 * H4/H5/H6) computed from the base size + scale ratio. Each row is
 * labeled with its tag so the operator sees the resulting hierarchy.
 */
function ScaleSpecimen({
  role,
  preview,
  stack,
  effective,
}: {
  role: 'heading' | 'subheading';
  preview: string;
  stack: string;
  effective: RoleValue;
}) {
  const [s1, s2, s3] = computeScaleSteps(effective.fontSize, effective.scaleRatio);
  const tags: [string, string, string] = role === 'heading'
    ? ['H1', 'H2', 'H3']
    : ['H4', 'H5', 'H6'];
  const sizes: [string, string, string] = [s1, s2, s3];

  return (
    <div className="space-y-3">
      {tags.map((tag, i) => (
        <div key={tag} className="flex items-baseline gap-3">
          <span className="text-[10px] font-mono text-muted-foreground w-10 shrink-0">{tag}</span>
          <p
            style={{
              fontFamily: stack,
              fontWeight: Number(effective.weight) || 400,
              fontStyle: effective.style,
              letterSpacing: effective.letterSpacing,
              textTransform: effective.textTransform,
              fontSize: sizes[i],
              lineHeight: 1.2,
            }}
            className="m-0 break-words flex-1"
          >
            {preview}
          </p>
        </div>
      ))}
    </div>
  );
}
