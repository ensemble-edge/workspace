/**
 * Logos Tab — Brand mark uploads and preview.
 *
 * v0.1.15: Each slot has one collapsed "default" upload. Operators can
 * opt into dark-mode and SVG-master variants per slot via [+ Add ...]
 * affordances. The resolver in @ensemble-edge/core/services/brand-images
 * picks the best variant per consumer context (web/email/favicon/etc).
 *
 * Slots:
 *   wordmark, icon_mark, favicon      — support light + dark + SVG
 *   social_avatar, og_image           — raster-only, light-only
 *
 * Storage keys per slot `<k>`:
 *   logo_<k>             base
 *   logo_<k>_dark        dark variant
 *   logo_<k>_svg         vector master (mode-neutral)
 *   logo_<k>_dark_svg    dark vector
 */

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Image, Upload, Plus, X, Type, Image as ImageIcon } from 'lucide-react';

import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
  Button, Input, Label, SaveStatus, FontCombobox,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Slider, Switch,
  toast,
} from '@ensemble-edge/ui';
import type { FontComboboxOption } from '@ensemble-edge/ui';

import { authedFetch, emitWorkspaceEvent } from '../../../state';
import { useFormStatus } from '../../../hooks/useFormStatus';
import { WordmarkEditor } from './WordmarkEditor';
import { FALLBACK_GOOGLE_FONTS } from './fallback-fonts';
import {
  SYSTEM_FONTS,
  DEFAULT_WEIGHT_FOR_ROLE,
  WEIGHT_LABELS,
  LETTER_SPACING_PRESETS,
  weightsForFamily,
  familySupportsItalic,
  resolveFamilyStack,
} from './font-utils';

interface GoogleFontEntry {
  family: string;
  category: string;
  variants: string[];
  popularity?: number;
}

type Variant = 'base' | 'dark' | 'svg' | 'dark_svg';

interface SlotDef {
  key: string;
  label: string;
  description: string;
  /** Which variants are settable for this slot. */
  variants: Variant[];
  /**
   * When true, this slot ONLY accepts SVG masters. Every derived
   * format/size/theme is generated from the SVG on demand by the
   * brand-asset generation engine.
   */
  svgOnly?: boolean;
  /** Author-guideline tooltip shown next to the upload card. */
  guideline?: string;
}

const SVG_AUTHOR_GUIDELINE =
  'Upload an SVG master.\n' +
  '• Use your brand colors as authored — we generate mono-black, mono-white, and mono-brand finishes from this source.\n' +
  '• Use currentColor for the primary mark fill so it theme-swaps automatically.\n' +
  '• For accent fills, use CSS class names: brand-primary, brand-secondary, brand-accent — they swap to match the active palette.\n' +
  '• ViewBox should be tight (no excess whitespace) — we add safe-area padding when needed.\n' +
  '• No embedded raster images or external font references — convert text to paths.\n' +
  '• Minimum 64×64 viewBox; recommended 512×512 or 1024×1024.';

const SLOTS: SlotDef[] = [
  {
    key: 'wordmark',
    label: 'Wordmark',
    description:
      'Full company name logo. Use styled text (typography-driven) or upload an SVG. ' +
      'Every PNG / favicon / dark variant is generated on demand from this source.',
    // Wordmark uniquely supports text-OR-SVG; the variants array is
    // unused for the SVG side because we only accept a single master.
    variants: ['svg'],
    svgOnly: true,
    guideline: SVG_AUTHOR_GUIDELINE,
  },
  {
    key: 'icon_mark',
    label: 'Icon Mark',
    description:
      'Square icon/symbol. SVG only — the favicon suite, social avatar, ' +
      'and every other raster size are generated from this one master.',
    variants: ['svg'],
    svgOnly: true,
    guideline: SVG_AUTHOR_GUIDELINE,
  },
  // Favicon slot intentionally removed in v0.1.31. Favicons are
  // generated automatically from the icon mark.
  // Social avatar + OG image moved to the Social/Sharing tab in
  // v0.1.47 — they're raster-output-only assets with no vector
  // source pipeline, conceptually separate from the SVG-master
  // brand logo system.
];

const VARIANT_LABEL: Record<Variant, string> = {
  base:     'Light',
  dark:     'Dark',
  svg:      'SVG master',
  dark_svg: 'Dark SVG',
};

function tokenKey(slot: string, variant: Variant): string {
  switch (variant) {
    case 'base':     return `logo_${slot}`;
    case 'dark':     return `logo_${slot}_dark`;
    case 'svg':      return `logo_${slot}_svg`;
    case 'dark_svg': return `logo_${slot}_dark_svg`;
  }
}

export function LogosTab() {
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [fontCatalog, setFontCatalog] = useState<GoogleFontEntry[]>([]);
  const [catalogIsFallback, setCatalogIsFallback] = useState(false);
  const upgradingRef = React.useRef(false);
  const status = useFormStatus({ value: tokens, mode: 'manual' });

  // Load the Google Fonts catalog once for the wordmark Family picker.
  // Falls back to the bundled top-40 list when the proxy returns empty.
  useEffect(() => {
    authedFetch('/_ensemble/core/fonts/google')
      .then((r) => r.json() as Promise<{ fonts: GoogleFontEntry[] }>)
      .then((res) => {
        const fonts = res.fonts ?? [];
        if (fonts.length === 0) {
          setFontCatalog(FALLBACK_GOOGLE_FONTS);
          setCatalogIsFallback(true);
          console.warn('[fonts] live catalog empty; using bundled fallback (~40 families).');
        } else {
          setFontCatalog(fonts);
          setCatalogIsFallback(false);
        }
      })
      .catch(() => {
        // Network/parse error — same fallback.
        setFontCatalog(FALLBACK_GOOGLE_FONTS);
        setCatalogIsFallback(true);
      });
  }, []);

  // Hybrid typeahead: when the operator starts searching in the wordmark
  // font picker and we're still on the curated fallback, retry the proxy
  // so search reaches the full ~1900-font catalog.
  const upgradeCatalog = React.useCallback(() => {
    if (!catalogIsFallback || upgradingRef.current) return;
    upgradingRef.current = true;
    authedFetch('/_ensemble/core/fonts/google?refresh=1')
      .then((r) => r.json() as Promise<{ fonts: GoogleFontEntry[]; count?: number }>)
      .then((res) => {
        const fonts = res.fonts ?? [];
        console.info('[fonts] upgrade fetch returned', fonts.length, 'families');
        if (fonts.length > 0) {
          setFontCatalog(fonts);
          setCatalogIsFallback(false);
        } else {
          upgradingRef.current = false;
        }
      })
      .catch((err) => {
        console.warn('[fonts] upgrade fetch failed:', err);
        upgradingRef.current = false;
      });
  }, [catalogIsFallback]);

  useEffect(() => {
    authedFetch('/_ensemble/core/brand/tokens/identity')
      .then((r) => r.json() as Promise<{ data?: Array<{ key: string; value: string }> }>)
      .then((res) => {
        const loaded: Record<string, string> = {};
        for (const t of res.data || []) {
          // Logos tab owns: all logo_* image variants AND wordmark_text
          // (the structured styled-wordmark JSON). The wordmark slot
          // toggles between the two; both are core brand identity.
          // Logos tab owns: image variants AND wordmark text/typography.
          if (
            t.key.startsWith('logo_') ||
            t.key === 'wordmark_text' ||
            t.key === 'wordmark_family' ||
            t.key === 'wordmark_weight' ||
            t.key === 'wordmark_style' ||
            t.key === 'wordmark_letter_spacing' ||
            t.key === 'wordmark_text_transform'
          ) {
            loaded[t.key] = t.value;
          }
        }
        setTokens(loaded);
        // Snapshot the loaded state as the new baseline. Pass the
        // value explicitly because the closure-captured `value` here
        // is still the pre-fetch empty {} — state setters batch and
        // the hook hasn't re-rendered yet.
        status.resetBaseline(loaded);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setToken(key: string, value: string) {
    setTokens((prev) => ({ ...prev, [key]: value }));
  }

  /**
   * Autosave a single token immediately. Used by upload flows so the
   * R2 artifact and its brand_token row are persisted as one logical
   * action — refreshing the page after an upload now remembers the
   * file (was the v0.1.30 bug: R2 had the file, brand_tokens didn't
   * know about it, refresh wiped the in-memory pointer).
   *
   * Updates the dirty-tracking baseline so the SaveStatus indicator
   * stays clean and the bottom "Save Logos" button doesn't light up.
   */
  async function persistToken(key: string, value: string) {
    setTokens((prev) => {
      const next = { ...prev, [key]: value };
      // Update the dirty baseline so this autosaved change doesn't
      // count as an unsaved edit.
      status.resetBaseline(next);
      return next;
    });
    try {
      const res = await authedFetch('/_ensemble/brand/tokens', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'identity', tokens: { [key]: value } }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      emitWorkspaceEvent('brand.tokens.changed', { category: 'identity' });
    } catch (e) {
      toast.error('Autosave failed', {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async function handleSave() {
    status.beginSave();
    try {
      const toWrite: Record<string, string> = {};
      for (const [k, v] of Object.entries(tokens)) {
        if (v) toWrite[k] = v;
      }
      const res = await authedFetch('/_ensemble/brand/tokens', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'identity', tokens: toWrite }),
      });
      if (!res.ok) throw new Error('Failed to save');
      status.commitSave();
      emitWorkspaceEvent('brand.tokens.changed', { category: 'identity' });
      toast.success('Logos saved');
    } catch (e) {
      status.failSave(e);
      toast.error('Failed to save logos');
    }
  }

  const saving = status.state === 'saving';

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {SLOTS.map((slot) => (
          slot.key === 'wordmark' ? (
            <WordmarkCard
              key={slot.key}
              slot={slot}
              tokens={tokens}
              onChange={setToken}
              onPersist={persistToken}
              fontCatalog={fontCatalog}
              onFirstSearch={upgradeCatalog}
            />
          ) : (
            <SlotCard
              key={slot.key}
              slot={slot}
              tokens={tokens}
              onChange={setToken}
              onPersist={persistToken}
            />
          )
        ))}
      </div>

      {/* v0.1.47: composition policy editors. Each card drives a slice
          of logo_policy via autosave (toggle + position = immediate PUT,
          sliders = local state while dragging + debounced PUT on
          mouse-up). The variants matrix on Brand Overview and the
          public brand guide already read from this policy — these
          editors fill the missing write side. */}
      <CompositionPolicyEditors />

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={!status.dirty || saving}>
          {saving ? 'Saving…' : 'Save Logos'}
        </Button>
        {status.state !== 'clean' && <SaveStatus state={status.state} />}
      </div>
    </div>
  );
}

/**
 * Wordmark slot has two interchangeable modes:
 *   - Styled text: structured `wordmark_text` token (segments + colors)
 *   - Image: same variant slots as other logos (light/dark/SVG)
 *
 * Operators usually pick one; the renderer (server-side, in core)
 * prefers styled text when set, falls back to image, falls back to
 * plain workspace name. Both can coexist if the operator wants
 * separate text and image representations for different contexts.
 */
function WordmarkCard({
  slot,
  tokens,
  onChange,
  onPersist,
  fontCatalog,
  onFirstSearch,
}: {
  slot: SlotDef;
  tokens: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onPersist: (key: string, value: string) => Promise<void>;
  fontCatalog: GoogleFontEntry[];
  onFirstSearch?: () => void;
}) {
  const textValue = tokens['wordmark_text'] || '';
  const imageValue = tokens[tokenKey(slot.key, 'base')] || '';

  // Initial mode: prefer whichever one already has content. If both empty,
  // default to "text" (the lighter-weight option).
  const [mode, setMode] = useState<'text' | 'image'>(() => {
    if (textValue) return 'text';
    if (imageValue) return 'image';
    return 'text';
  });

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{slot.label}</CardTitle>
            <CardDescription>
              {slot.description}. Pick styled text (renders live wherever the workspace name
              appears) or an image (used where text rendering is brittle — emails, OG cards).
              Both can coexist; styled text wins where both apply.
            </CardDescription>
          </div>
          <div className="flex items-center gap-1 rounded-md border p-1 shrink-0">
            <Button
              type="button"
              size="sm"
              variant={mode === 'text' ? 'default' : 'ghost'}
              className="h-7 px-2"
              onClick={() => setMode('text')}
            >
              <Type className="h-3 w-3 mr-1" /> Styled text
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === 'image' ? 'default' : 'ghost'}
              className="h-7 px-2"
              onClick={() => setMode('image')}
            >
              <ImageIcon className="h-3 w-3 mr-1" /> Image
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {mode === 'text' ? (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Font, weight, letter-spacing, style, and case for the wordmark
              are configured in <strong>Brand → Typography</strong>. This
              preview reflects whatever is set there.
            </p>
            <WordmarkEditor
              value={textValue}
              onChange={(next) => onChange('wordmark_text', next)}
              typography={{
                family: tokens['wordmark_family'] || undefined,
                weight: tokens['wordmark_weight'] || undefined,
                style: (tokens['wordmark_style'] as 'normal' | 'italic') || 'normal',
                letterSpacing: tokens['wordmark_letter_spacing'] || undefined,
                textTransform: (tokens['wordmark_text_transform'] as 'none' | 'uppercase' | 'lowercase') || undefined,
              }}
            />
          </div>
        ) : (
          <ImageVariantBlock slot={slot} tokens={tokens} onChange={onChange} onPersist={onPersist} />
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Image-mode block for the Wordmark slot — same variant-slot UI as
 * other logos, factored out so WordmarkCard can render it conditionally.
 */
function ImageVariantBlock({
  slot,
  tokens,
  onChange,
  onPersist,
}: {
  slot: SlotDef;
  tokens: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onPersist: (key: string, value: string) => Promise<void>;
}) {
  const optionalVariants: Variant[] = slot.variants.filter((v) => v !== 'base');
  const [expanded, setExpanded] = useState<Set<Variant>>(() => {
    const s = new Set<Variant>();
    for (const v of optionalVariants) {
      if (tokens[tokenKey(slot.key, v)]) s.add(v);
    }
    return s;
  });
  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const v of optionalVariants) {
        if (tokens[tokenKey(slot.key, v)] && !next.has(v)) {
          next.add(v);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens]);

  function expandVariant(v: Variant) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(v);
      return next;
    });
  }
  function collapseVariant(v: Variant) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.delete(v);
      return next;
    });
    onPersist(tokenKey(slot.key, v), '');
  }

  const baseValue = tokens[tokenKey(slot.key, 'base')] || '';
  const remainingVariants = optionalVariants.filter((v) => !expanded.has(v));

  return (
    <div className="space-y-4">
      <VariantSlot
        slotKey={slot.key}
        variant="base"
        slotDef={slot}
        value={baseValue}
        onChange={(v) => onPersist(tokenKey(slot.key, 'base'), v)}
      />
      {[...expanded].map((variant) => (
        <VariantSlot
          key={variant}
          slotKey={slot.key}
          variant={variant}
          slotDef={slot}
          value={tokens[tokenKey(slot.key, variant)] || ''}
          onChange={(v) => onPersist(tokenKey(slot.key, variant), v)}
          onRemove={() => collapseVariant(variant)}
        />
      ))}
      {remainingVariants.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {remainingVariants.map((v) => (
            <Button
              key={v}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => expandVariant(v)}
            >
              <Plus className="h-3 w-3 mr-1" /> Add {VARIANT_LABEL[v]}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

function SlotCard({
  slot,
  tokens,
  onChange,
  onPersist,
}: {
  slot: SlotDef;
  tokens: Record<string, string>;
  /** In-memory token update for non-upload edits. */
  onChange: (key: string, value: string) => void;
  /**
   * Persisted token update for upload flows — writes to brand_tokens
   * immediately so the file is saved as soon as the upload completes.
   * No more "uploaded but forgot to hit Save."
   */
  onPersist: (key: string, value: string) => Promise<void>;
}) {
  const optionalVariants: Variant[] = slot.variants.filter((v) => v !== 'base');

  // Visible if either the operator opened it or a value exists.
  const [expanded, setExpanded] = useState<Set<Variant>>(() => {
    const s = new Set<Variant>();
    for (const v of optionalVariants) {
      if (tokens[tokenKey(slot.key, v)]) s.add(v);
    }
    return s;
  });

  // Sync expansion when tokens load asynchronously (initial fetch).
  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const v of optionalVariants) {
        if (tokens[tokenKey(slot.key, v)] && !next.has(v)) {
          next.add(v);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens]);

  function expandVariant(v: Variant) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(v);
      return next;
    });
  }

  function collapseVariant(v: Variant) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.delete(v);
      return next;
    });
    // Clearing a variant persists immediately too — symmetrical with
    // upload-autosave so removed variants stay removed across refresh.
    onPersist(tokenKey(slot.key, v), '');
  }

  const baseValue = tokens[tokenKey(slot.key, 'base')] || '';
  const remainingVariants = optionalVariants.filter((v) => !expanded.has(v));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{slot.label}</CardTitle>
        <CardDescription>{slot.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <VariantSlot
          slotKey={slot.key}
          variant="base"
          slotDef={slot}
          value={baseValue}
          onChange={(v) => onPersist(tokenKey(slot.key, 'base'), v)}
        />

        {[...expanded].map((variant) => (
          <VariantSlot
            key={variant}
            slotKey={slot.key}
            variant={variant}
            slotDef={slot}
            value={tokens[tokenKey(slot.key, variant)] || ''}
            onChange={(v) => onPersist(tokenKey(slot.key, variant), v)}
            onRemove={() => collapseVariant(variant)}
          />
        ))}

        {remainingVariants.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {remainingVariants.map((v) => (
              <Button
                key={v}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => expandVariant(v)}
              >
                <Plus className="h-3 w-3 mr-1" /> Add {VARIANT_LABEL[v]}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function VariantSlot({
  slotKey,
  variant,
  slotDef,
  value,
  onChange,
  onRemove,
}: {
  slotKey: string;
  variant: Variant;
  /** Slot metadata, including svgOnly flag and author guideline text. */
  slotDef: SlotDef;
  value: string;
  /**
   * Called with the canonical URL after a successful upload. Parent
   * routes this to `onPersist` so the brand_tokens row is written
   * immediately — operators no longer have to remember to hit Save.
   */
  onChange: (url: string) => void;
  onRemove?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // SVG-required slots (wordmark, icon_mark, lockup) accept ONLY SVG;
  // legacy variant-named slots ('svg' / 'dark_svg') also force SVG.
  // Raster-output-only slots (social_avatar, og_image) accept the
  // full raster allowlist.
  const isSvg = slotDef.svgOnly || variant === 'svg' || variant === 'dark_svg';
  const accept = isSvg
    ? 'image/svg+xml'
    : 'image/png,image/jpeg,image/webp,image/x-icon,image/vnd.microsoft.icon';

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', `${slotKey}_${variant}`);
      const r = await authedFetch('/_ensemble/brand/upload', {
        method: 'POST',
        body: form,
        credentials: 'include',
      });
      const body = (await r.json()) as { ok?: boolean; url?: string; error?: string };
      if (!r.ok || !body.url) {
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }
      onChange(body.url);
      toast.success(`${VARIANT_LABEL[variant]} uploaded`);
    } catch (e) {
      toast.error('Upload failed', {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const isDark = variant === 'dark' || variant === 'dark_svg';

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium">
            {slotDef.svgOnly ? 'SVG master' : VARIANT_LABEL[variant]}
          </span>
          {slotDef.guideline && (
            <span
              title={slotDef.guideline}
              className="text-muted-foreground cursor-help text-[10px] border rounded px-1 py-0.5"
            >
              ?
            </span>
          )}
        </div>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={onRemove}
            disabled={uploading}
            title={`Remove ${VARIANT_LABEL[variant]} variant`}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      <div
        className={
          isDark
            ? 'flex items-center justify-center h-20 rounded-md border border-dashed bg-zinc-900'
            : 'flex items-center justify-center h-20 rounded-md border border-dashed bg-muted/50'
        }
      >
        {value ? (
          <img src={value} alt="" className="max-h-16 max-w-full object-contain" />
        ) : (
          <div className="flex flex-col items-center text-muted-foreground">
            <Image className="h-6 w-6 mb-1" />
            <span className="text-xs">No image set</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="h-3 w-3 mr-1" />
          {uploading ? 'Uploading…' : 'Upload'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange('')}
            disabled={uploading}
          >
            Clear
          </Button>
        )}
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Or paste an image URL</Label>
        <Input
          placeholder="https://example.com/logo.svg"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="text-sm"
        />
      </div>
    </div>
  );
}


// ─── Composition policy editors (v0.1.47) ────────────────────────────
//
// Three cards that let operators tune the lockup compositions and the
// backgrounded variant. Each card autosaves: toggle/position flips
// PUT immediately, sliders update local state while dragging and PUT
// on mouse-up (debounced so a fast drag doesn't fire dozens of writes).
//
// Live preview tiles inside each card render the actual lockup at the
// configured settings via the brand-render endpoint, so operators see
// what each slider does in real time.

type CompositionPolicy = {
  allowed: boolean;
  iconScale?: number;
  spacing?: number;
  iconPosition?: 'top' | 'bottom';
  iconSide?: 'left' | 'right';
  /**
   * v0.1.50+ cross-axis offset of the smaller element. -1..1, default 0.
   * Horizontal: vertical position of the shorter element.
   * Stacked: horizontal position of the narrower element.
   */
  crossAlign?: number;
};

type LogoPolicyShape = {
  compositions: {
    'wordmark-only': { allowed: boolean };
    'icon-only': { allowed: boolean };
    'stacked': CompositionPolicy;
    'horizontal': CompositionPolicy;
  };
  backgrounded?: {
    allowed: boolean;
    lightAllowed: boolean;
    darkAllowed: boolean;
    padding: number;
  };
};


/**
 * v0.1.48 rewrite — Composition policy editors.
 *
 * Save model: explicit Save button per card with a dirty-state hint
 * ("Unsaved changes" / "Saving…" / "Saved"). Matches the manual-save
 * UX everywhere else in Brand (Colors, Typography, Identity).
 *
 * Live preview model: each card holds a local DRAFT of its slice of
 * the policy. Slider changes update the draft (smooth, no network).
 * The preview <img> URL embeds the draft as query overrides, so the
 * server renders with the draft values without anything being saved.
 * Save commits the draft to the server. Refresh-before-save reloads
 * the last saved values, so an abandoned edit is non-destructive.
 *
 * The preview URL is plain GET (cacheable by the browser per-URL),
 * and the image's `key` prop is tied to the override-signature so
 * React updates the <img> element when the URL changes — no manual
 * cache-bust needed.
 */
function CompositionPolicyEditors() {
  const [savedPolicy, setSavedPolicy] = useState<LogoPolicyShape | null>(null);
  const [workspaceSlug, setWorkspaceSlug] = useState<string>('');
  const [aliasPath, setAliasPath] = useState<string>('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    authedFetch('/_ensemble/core/brand/logo-policy')
      .then((r) => r.json() as Promise<{ policy: LogoPolicyShape; workspaceSlug?: string; assetAliasPath?: string }>)
      .then((res) => {
        setSavedPolicy(res.policy);
        setWorkspaceSlug(res.workspaceSlug || 'workspace');
        setAliasPath(res.assetAliasPath || '');
      })
      .catch(() => { /* card hidden */ });
  }, [reloadKey]);

  if (!savedPolicy) return null;

  /**
   * Save just the slice this card owns. Server merges with the rest
   * of the policy, so concurrent edits to different cards don't
   * stomp each other.
   */
  async function saveSlice(slice: Partial<LogoPolicyShape>): Promise<boolean> {
    if (!savedPolicy) return false;
    const merged: LogoPolicyShape = {
      ...savedPolicy,
      ...slice,
      compositions: {
        ...savedPolicy.compositions,
        ...slice.compositions,
      },
    };
    try {
      const res = await authedFetch('/_ensemble/core/brand/logo-policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string; detail?: string };
        throw new Error(body.detail || body.error || `HTTP ${res.status}`);
      }
      setSavedPolicy(merged);
      return true;
    } catch (e) {
      toast.error('Could not save', {
        description: e instanceof Error ? e.message : String(e),
      });
      return false;
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <LockupCard
        kind="horizontal"
        savedConfig={savedPolicy.compositions.horizontal}
        workspaceSlug={workspaceSlug}
        aliasPath={aliasPath}
        onSave={(c) => saveSlice({ compositions: { ...savedPolicy!.compositions, horizontal: c } })}
        // Force re-render of local draft when savedPolicy changes
        // (e.g. after Save commits or a sibling card saves).
        key={`h-${reloadKey}`}
      />
      <LockupCard
        kind="stacked"
        savedConfig={savedPolicy.compositions.stacked}
        workspaceSlug={workspaceSlug}
        aliasPath={aliasPath}
        onSave={(c) => saveSlice({ compositions: { ...savedPolicy!.compositions, stacked: c } })}
        key={`s-${reloadKey}`}
      />
      <BackgroundSettingsCard
        savedConfig={savedPolicy.backgrounded ?? { allowed: true, lightAllowed: true, darkAllowed: true, padding: 0.5 }}
        workspaceSlug={workspaceSlug}
        aliasPath={aliasPath}
        onSave={(c) => saveSlice({ backgrounded: c })}
        key={`b-${reloadKey}`}
      />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * Lockup card (horizontal + stacked share this shape)
 * ──────────────────────────────────────────────────────────── */

function LockupCard({
  kind,
  savedConfig,
  workspaceSlug,
  aliasPath,
  onSave,
}: {
  kind: 'horizontal' | 'stacked';
  savedConfig: CompositionPolicy;
  workspaceSlug: string;
  aliasPath: string;
  onSave: (config: CompositionPolicy) => Promise<boolean>;
}) {
  // Local draft — sliders + toggles write here without server roundtrips.
  const [draft, setDraft] = useState<CompositionPolicy>(savedConfig);
  const [saving, setSaving] = useState(false);

  // Reset draft when savedConfig changes (after a successful save or
  // initial load).
  useEffect(() => { setDraft(savedConfig); }, [savedConfig]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(savedConfig);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  }

  const title = kind === 'horizontal' ? 'Horizontal lockup' : 'Stacked lockup';
  const description = kind === 'horizontal'
    ? 'Icon and wordmark side by side. Common for headers, signatures, and nav bars.'
    : 'Icon above (or below) the wordmark. Common for app launchers, splash screens, and badges.';

  // Default slider/position config per kind.
  const defaults = kind === 'horizontal'
    ? { iconScale: 1.2, spacing: 0.4 }
    : { iconScale: 1.5, spacing: 0.4 };

  // Build preview URL with draft overrides so the preview updates
  // every render — no cache-bust trickery needed, the URL itself
  // changes when the draft changes.
  const compShort = kind;
  const tail = `${workspaceSlug}-${compShort}-full-color-transparent.svg`;
  const base = aliasPath
    ? `/${aliasPath}/brand/render/${tail}`
    : `/_ensemble/brand/render/${tail}`;
  const params = new URLSearchParams();
  params.set('iconScale', String(draft.iconScale ?? defaults.iconScale));
  params.set('spacing', String(draft.spacing ?? defaults.spacing));
  params.set('crossAlign', String(draft.crossAlign ?? 0));
  if (kind === 'horizontal') params.set('iconSide', draft.iconSide ?? 'left');
  else params.set('iconPosition', draft.iconPosition ?? 'top');
  const previewUrl = `${base}?${params.toString()}`;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 flex-1">
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Switch
            checked={draft.allowed}
            onCheckedChange={(v) => setDraft({ ...draft, allowed: v })}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Configuration is hidden when the lockup is disabled —
            no point tuning sliders for a banned composition. The
            preview, position toggle, and sliders only render when
            draft.allowed is true. The Save row stays visible when
            the card is dirty (e.g. just toggled off) so the on→off
            transition can be committed without flipping back on. */}
        {draft.allowed && (
          <>
            {/* Live preview */}
            <div className="flex items-center justify-center h-32 rounded-md border bg-muted/30 overflow-hidden">
              <img
                src={previewUrl}
                alt={`${title} preview`}
                className="max-h-28 max-w-full object-contain"
              />
            </div>

            {/* Position toggle */}
            <div className="space-y-1.5">
              <Label className="text-xs">Icon position</Label>
              <div className="grid grid-cols-2 rounded-md border p-1 gap-1">
                {kind === 'horizontal' ? (
                  <>
                    <PositionButton
                      active={(draft.iconSide ?? 'left') === 'left'}
                      onClick={() => setDraft({ ...draft, iconSide: 'left' })}
                      label="Left"
                    />
                    <PositionButton
                      active={(draft.iconSide ?? 'left') === 'right'}
                      onClick={() => setDraft({ ...draft, iconSide: 'right' })}
                      label="Right"
                    />
                  </>
                ) : (
                  <>
                    <PositionButton
                      active={(draft.iconPosition ?? 'top') === 'top'}
                      onClick={() => setDraft({ ...draft, iconPosition: 'top' })}
                      label="Top"
                    />
                    <PositionButton
                      active={(draft.iconPosition ?? 'top') === 'bottom'}
                      onClick={() => setDraft({ ...draft, iconPosition: 'bottom' })}
                      label="Bottom"
                    />
                  </>
                )}
              </div>
            </div>

            {/* Sliders. v0.1.50: icon-size minimum lowered from 0.5
                to 0.2 because the prior floor was still huge relative
                to the wordmark — operators couldn't actually shrink
                the icon to match cap-height. Spacing max tightened
                from 1.5em to 0.8em — beyond that the lockup is
                visually a *gap with two logos*, not a lockup. */}
            <SmoothSlider
              label="Icon size"
              help="Relative to wordmark height"
              value={draft.iconScale ?? defaults.iconScale}
              min={0.2} max={kind === 'horizontal' ? 2 : 2.5} step={0.01}
              format={(v) => `${v.toFixed(2)}×`}
              onChange={(v) => setDraft({ ...draft, iconScale: v })}
            />
            <SmoothSlider
              label="Spacing"
              help="Gap between icon and wordmark (em-relative)"
              value={draft.spacing ?? defaults.spacing}
              min={0} max={0.8} step={0.01}
              format={(v) => `${v.toFixed(2)}em`}
              onChange={(v) => setDraft({ ...draft, spacing: v })}
            />
            {/* v0.1.50: cross-axis alignment. For horizontal, this is
                vertical offset of the shorter element (top/center/
                bottom). For stacked, horizontal offset of the
                narrower element (left/center/right). Range -1..1
                stored numerically so operators can fine-tune for
                optical alignment, not just snap to discrete options. */}
            <SmoothSlider
              label={kind === 'horizontal' ? 'Vertical alignment' : 'Horizontal alignment'}
              help={kind === 'horizontal'
                ? 'Vertical position of the shorter element (top / centered / bottom)'
                : 'Horizontal position of the narrower element (left / centered / right)'}
              value={draft.crossAlign ?? 0}
              min={-1} max={1} step={0.01}
              format={(v) => {
                if (Math.abs(v) < 0.02) return 'Centered';
                if (kind === 'horizontal') return v < 0 ? `${(-v).toFixed(2)} ↑` : `${v.toFixed(2)} ↓`;
                return v < 0 ? `${(-v).toFixed(2)} ←` : `${v.toFixed(2)} →`;
              }}
              onChange={(v) => setDraft({ ...draft, crossAlign: v })}
            />
          </>
        )}

        {/* Save row — visible when dirty regardless of allowed state
            so toggle-off transitions can be committed. When clean and
            disabled, the card is just the header + toggle. */}
        {(draft.allowed || dirty) && (
          <SaveRow dirty={dirty} saving={saving} onSave={handleSave} />
        )}
      </CardContent>
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────────
 * Background settings card (v0.1.54 rename)
 *
 * Was: BackgroundedCard — controlled a *separate* "Backgrounded"
 *      variant that lived alongside the regular background axis.
 *
 * Now: BackgroundSettingsCard — controls how the regular light/dark
 *      background variants render across every composition. The
 *      padding here applies to wordmark-only/icon-only/stacked/
 *      horizontal whenever they sit on a light or dark background.
 *
 * The `allowed` field on the saved config is vestigial — the
 * backgrounds axis itself governs whether light/dark variants exist
 * (via lightAllowed/darkAllowed below). We always treat it as true
 * server-side so older policies don't break.
 * ──────────────────────────────────────────────────────────── */

interface BackgroundedConfig {
  allowed: boolean;
  lightAllowed: boolean;
  darkAllowed: boolean;
  padding: number;
}

function BackgroundSettingsCard({
  savedConfig,
  workspaceSlug,
  aliasPath,
  onSave,
}: {
  savedConfig: BackgroundedConfig;
  workspaceSlug: string;
  aliasPath: string;
  onSave: (config: BackgroundedConfig) => Promise<boolean>;
}) {
  // Force allowed=true on load — the master toggle is gone; the
  // light/dark sub-toggles govern whether each variant exists.
  const [draft, setDraft] = useState<BackgroundedConfig>({ ...savedConfig, allowed: true });
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<'light' | 'dark'>(
    savedConfig.lightAllowed ? 'light' : 'dark',
  );

  useEffect(() => { setDraft({ ...savedConfig, allowed: true }); }, [savedConfig]);

  const dirty = JSON.stringify(draft) !== JSON.stringify({ ...savedConfig, allowed: true });

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  }

  // Preview shows the stacked composition on the active background
  // — most operators see this as the canonical "what does my logo
  // look like on a brand color" view. (Icon-only on tile is also
  // common, but stacked exercises both icon AND wordmark padding.)
  const tail = `${workspaceSlug}-stacked-full-color-${previewMode}.svg`;
  const base = aliasPath
    ? `/${aliasPath}/brand/render/${tail}`
    : `/_ensemble/brand/render/${tail}`;
  // Live-preview override: bypasses cache so slider drags update
  // immediately without waiting on the content-hashed render path.
  const params = new URLSearchParams();
  params.set('backgroundedPadding', String(draft.padding));
  const previewUrl = `${base}?${params.toString()}`;

  return (
    <Card>
      <CardHeader>
        <div className="space-y-1">
          <CardTitle className="text-base">Background settings</CardTitle>
          <CardDescription>
            Controls how every logo variant renders on a brand-color background
            (light or dark). The padding here applies to wordmark, icon, stacked,
            and horizontal lockups whenever they sit on a background. Operators
            who want zero padding (full-bleed) can slide padding to 0.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Live preview — stacked composition on the active background. */}
        <div className="flex items-center justify-center h-32 rounded-md border bg-muted/30 overflow-hidden">
          <img
            src={previewUrl}
            alt="Background preview"
            className="max-h-28 max-w-full object-contain"
          />
        </div>

        {/* Light/Dark sub-variant toggles + preview-mode selector */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium">Light background</p>
                <p className="text-[10px] text-muted-foreground">Uses brand-background-light</p>
              </div>
              <Switch
                checked={draft.lightAllowed}
                onCheckedChange={(v) => setDraft({ ...draft, lightAllowed: v })}
              />
            </div>
            <Button
              type="button"
              variant={previewMode === 'light' ? 'default' : 'outline'}
              size="sm"
              className="w-full h-7 text-xs"
              onClick={() => setPreviewMode('light')}
            >
              Preview
            </Button>
          </div>
          <div className="rounded-md border p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium">Dark background</p>
                <p className="text-[10px] text-muted-foreground">Uses brand-background-dark</p>
              </div>
              <Switch
                checked={draft.darkAllowed}
                onCheckedChange={(v) => setDraft({ ...draft, darkAllowed: v })}
              />
            </div>
            <Button
              type="button"
              variant={previewMode === 'dark' ? 'default' : 'outline'}
              size="sm"
              className="w-full h-7 text-xs"
              onClick={() => setPreviewMode('dark')}
            >
              Preview
            </Button>
          </div>
        </div>

        <SmoothSlider
          label="Padding"
          help="Space between the logo and the background edge (applies to every composition with a background)"
          value={draft.padding}
          min={0} max={2} step={0.01}
          format={(v) => `${v.toFixed(2)}em`}
          onChange={(v) => setDraft({ ...draft, padding: v })}
        />

        <SaveRow dirty={dirty} saving={saving} onSave={handleSave} />
      </CardContent>
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────────
 * Shared primitives
 * ──────────────────────────────────────────────────────────── */

function PositionButton({
  active, onClick, label,
}: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      className={
        active
          ? 'rounded px-2 py-1 text-xs font-medium bg-primary text-primary-foreground'
          : 'rounded px-2 py-1 text-xs font-medium hover:bg-muted text-muted-foreground'
      }
      onClick={onClick}
    >
      {label}
    </button>
  );
}

/**
 * Slider with a local-state cursor that updates on every drag frame
 * (smooth) and propagates the value upward via onChange on every
 * change too (so the preview <img> URL updates immediately). The
 * "controlled vs uncontrolled" pattern: parent owns the canonical
 * draft state, slider mirrors it.
 */
function SmoothSlider({
  label, help, value, min, max, step, format, onChange,
}: {
  label: string;
  help: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <span className="text-xs font-mono text-muted-foreground">{format(value)}</span>
      </div>
      <Slider
        value={[value]}
        min={min} max={max} step={step}
        onValueChange={(v) => onChange(v[0])}
      />
      <p className="text-[10px] text-muted-foreground">{help}</p>
    </div>
  );
}

function SaveRow({
  dirty, saving, onSave,
}: { dirty: boolean; saving: boolean; onSave: () => void }) {
  return (
    <div className="flex items-center justify-between pt-2 border-t">
      <span className="text-xs text-muted-foreground">
        {saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'Saved'}
      </span>
      <Button
        type="button"
        size="sm"
        onClick={onSave}
        disabled={!dirty || saving}
      >
        {saving ? 'Saving…' : 'Save'}
      </Button>
    </div>
  );
}
