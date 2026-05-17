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
  Button, Input, Label, toast,
} from '@ensemble-edge/ui';

import { authedFetch } from '../../../state';
import { WordmarkEditor } from './WordmarkEditor';

type Variant = 'base' | 'dark' | 'svg' | 'dark_svg';

interface SlotDef {
  key: string;
  label: string;
  description: string;
  /** Which variants are settable for this slot. */
  variants: Variant[];
}

const SLOTS: SlotDef[] = [
  {
    key: 'wordmark',
    label: 'Wordmark',
    description: 'Full company name logo',
    variants: ['base', 'dark', 'svg', 'dark_svg'],
  },
  {
    key: 'icon_mark',
    label: 'Icon Mark',
    description: 'Square icon/symbol (used in sidebar)',
    variants: ['base', 'dark', 'svg', 'dark_svg'],
  },
  {
    key: 'favicon',
    label: 'Favicon',
    description: 'Browser tab icon. Falls back to icon mark if empty.',
    variants: ['base', 'dark', 'svg', 'dark_svg'],
  },
  {
    key: 'social_avatar',
    label: 'Social Avatar',
    description: 'Square image for social profiles (raster only)',
    variants: ['base'],
  },
  {
    key: 'og_image',
    label: 'OG Image',
    description: '1200×630 for social sharing previews (raster only)',
    variants: ['base'],
  },
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    authedFetch('/_ensemble/core/brand/tokens/identity')
      .then((r) => r.json() as Promise<{ data?: Array<{ key: string; value: string }> }>)
      .then((res) => {
        const loaded: Record<string, string> = {};
        for (const t of res.data || []) {
          // Logos tab owns: all logo_* image variants AND wordmark_text
          // (the structured styled-wordmark JSON). The wordmark slot
          // toggles between the two; both are core brand identity.
          if (t.key.startsWith('logo_') || t.key === 'wordmark_text') {
            loaded[t.key] = t.value;
          }
        }
        setTokens(loaded);
      })
      .catch(() => {});
  }, []);

  function setToken(key: string, value: string) {
    setTokens((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
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
      toast.success('Logos saved');
    } catch {
      toast.error('Failed to save logos');
    } finally {
      setSaving(false);
    }
  }

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
            />
          ) : (
            <SlotCard
              key={slot.key}
              slot={slot}
              tokens={tokens}
              onChange={setToken}
            />
          )
        ))}
      </div>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save Logos'}
      </Button>
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
}: {
  slot: SlotDef;
  tokens: Record<string, string>;
  onChange: (key: string, value: string) => void;
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
          <WordmarkEditor
            value={textValue}
            onChange={(next) => onChange('wordmark_text', next)}
          />
        ) : (
          <ImageVariantBlock slot={slot} tokens={tokens} onChange={onChange} />
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
}: {
  slot: SlotDef;
  tokens: Record<string, string>;
  onChange: (key: string, value: string) => void;
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
    onChange(tokenKey(slot.key, v), '');
  }

  const baseValue = tokens[tokenKey(slot.key, 'base')] || '';
  const remainingVariants = optionalVariants.filter((v) => !expanded.has(v));

  return (
    <div className="space-y-4">
      <VariantSlot
        slotKey={slot.key}
        variant="base"
        value={baseValue}
        onChange={(v) => onChange(tokenKey(slot.key, 'base'), v)}
      />
      {[...expanded].map((variant) => (
        <VariantSlot
          key={variant}
          slotKey={slot.key}
          variant={variant}
          value={tokens[tokenKey(slot.key, variant)] || ''}
          onChange={(v) => onChange(tokenKey(slot.key, variant), v)}
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
}: {
  slot: SlotDef;
  tokens: Record<string, string>;
  onChange: (key: string, value: string) => void;
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
    onChange(tokenKey(slot.key, v), '');
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
          value={baseValue}
          onChange={(v) => onChange(tokenKey(slot.key, 'base'), v)}
        />

        {[...expanded].map((variant) => (
          <VariantSlot
            key={variant}
            slotKey={slot.key}
            variant={variant}
            value={tokens[tokenKey(slot.key, variant)] || ''}
            onChange={(v) => onChange(tokenKey(slot.key, variant), v)}
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
  value,
  onChange,
  onRemove,
}: {
  slotKey: string;
  variant: Variant;
  value: string;
  onChange: (url: string) => void;
  onRemove?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const isSvg = variant === 'svg' || variant === 'dark_svg';
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
        <span className="text-xs font-medium">{VARIANT_LABEL[variant]}</span>
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
