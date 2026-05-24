/**
 * WordmarkEditor — segmented wordmark builder (controlled component).
 *
 * Stored shape (JSON-stringified in brand_token `wordmark_text`):
 *   [{ text: 'Cura', color: '#137774' }, { text: 'listo', color: 'primary-main' }]
 *
 * Each segment has required `text` and optional `color`. v0.1.60: the
 * color field now accepts THREE forms:
 *   1. Literal hex: "#137774"
 *   2. Palette rung ref: "primary-main", "accent-bright", "neutral-faded"
 *   3. Gradient ref: "gradient-sunrise"
 *
 * The resolver (resolveSegmentColor below + the Wordmark React
 * component + the server-side Satori renderer) handles all three.
 *
 * Controlled component — parent owns the JSON string value and the
 * save trigger (LogosTab batches all logo + wordmark saves into one
 * brand_tokens PUT).
 */

import * as React from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';

import {
  Button, Input,
  BrandTokenPicker,
} from '@ensemble-edge/ui';
import type { ResolvedPalettes, PickableGradient } from '@ensemble-edge/ui';

import { resolveFamilyStack } from './font-utils';

export interface WordmarkSegment {
  text: string;
  color?: string;
}

const HEX_RE = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;
const RUNG_RE = /^(primary|secondary|accent|neutral)-(dark|main|bright|pastel|faded)$/;
const GRADIENT_RE = /^gradient-[a-z0-9-]+$/;

export function isValidWordmarkColor(c: string): boolean {
  if (!c) return true;
  const t = c.trim();
  return HEX_RE.test(t) || RUNG_RE.test(t) || GRADIENT_RE.test(t);
}

export function parseWordmarkSegments(raw: string): WordmarkSegment[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((s) => typeof s === 'object' && s !== null && typeof (s as { text?: unknown }).text === 'string')
      .map((s) => {
        const seg = s as { text: string; color?: string };
        return { text: seg.text, color: typeof seg.color === 'string' ? seg.color : undefined };
      });
  } catch {
    return [];
  }
}

export function serializeWordmarkSegments(segments: WordmarkSegment[]): string {
  const cleaned = segments
    .map((s) => ({ text: s.text, color: s.color?.trim() || undefined }))
    .filter((s) => s.text);
  if (cleaned.length === 0) return '';
  return JSON.stringify(cleaned);
}

/** v0.1.60: resolve a stored segment color value to render-ready
 *  CSS. Returns either a flat color string or a background style
 *  spec for gradient-on-text (background-clip). */
export interface ResolvedSegmentStyle {
  color?: string;
  background?: string;
  webkitBackgroundClip?: string;
  backgroundClip?: string;
  /** When using background-clip:text, color must be transparent. */
  webkitTextFillColor?: string;
}

function resolveSegmentColor(
  raw: string | undefined,
  palettes: ResolvedPalettes | undefined,
  gradients: PickableGradient[],
): ResolvedSegmentStyle {
  if (!raw) return {};
  const t = raw.trim();
  // Gradient ref → background-clip:text technique
  if (GRADIENT_RE.test(t)) {
    const slug = t.replace(/^gradient-/, '');
    const g = gradients.find((x) => x.slug === slug);
    if (g) {
      return {
        background: g.css,
        webkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        webkitTextFillColor: 'transparent',
      };
    }
    // Unknown gradient — fall through to text-color:transparent
    // (operator sees nothing, which signals the bad ref clearly).
    return { color: 'transparent' };
  }
  // Palette rung ref → resolve to hex
  if (palettes && RUNG_RE.test(t)) {
    const m = RUNG_RE.exec(t)!;
    const role = m[1] as keyof ResolvedPalettes;
    const rung = m[2] as keyof ResolvedPalettes[typeof role];
    return { color: palettes[role][rung] };
  }
  // Literal hex
  if (HEX_RE.test(t)) return { color: t };
  return {};
}

export interface WordmarkTypography {
  family?: string;
  weight?: string;
  style?: 'normal' | 'italic';
  letterSpacing?: string;
  textTransform?: 'none' | 'uppercase' | 'lowercase';
}

export function WordmarkEditor({
  value,
  onChange,
  typography,
  palettes,
  gradients = [],
}: {
  value: string;
  onChange: (next: string) => void;
  /** Live typography tokens — preview re-renders as these change. */
  typography?: WordmarkTypography;
  /** v0.1.60: resolved palettes for the segment color picker. */
  palettes?: ResolvedPalettes;
  /** v0.1.60: available gradients for the segment color picker. */
  gradients?: PickableGradient[];
}) {
  const segments = parseWordmarkSegments(value);

  function commit(next: WordmarkSegment[]) {
    onChange(serializeWordmarkSegments(next));
  }

  function update(i: number, patch: Partial<WordmarkSegment>) {
    commit(segments.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function removeSegment(i: number) {
    commit(segments.filter((_, idx) => idx !== i));
  }

  function addSegment() {
    commit([...segments, { text: '', color: undefined }]);
  }

  return (
    <div className="space-y-3">
      {segments.length > 0 && (
        <div className="rounded-md border bg-muted/30 p-4">
          <p className="text-xs text-muted-foreground mb-2">Preview</p>
          <WordmarkPreview
            segments={segments}
            typography={typography}
            palettes={palettes}
            gradients={gradients}
          />
        </div>
      )}

      <div className="space-y-2">
        {segments.map((seg, i) => (
          <SegmentRow
            key={i}
            segment={seg}
            onChange={(patch) => update(i, patch)}
            onRemove={() => removeSegment(i)}
            palettes={palettes}
            gradients={gradients}
          />
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addSegment}>
          <Plus className="h-3 w-3 mr-1" /> Add segment
        </Button>
      </div>
    </div>
  );
}

function SegmentRow({
  segment,
  onChange,
  onRemove,
  palettes,
  gradients,
}: {
  segment: WordmarkSegment;
  onChange: (patch: Partial<WordmarkSegment>) => void;
  onRemove: () => void;
  palettes?: ResolvedPalettes;
  gradients: PickableGradient[];
}) {
  // v0.1.60: when palettes are available, use BrandTokenPicker so
  // operators pick from palette rungs / gradients / hex. The picker
  // requires palettes; fall back to a plain hex input when palettes
  // aren't ready yet (loading state).
  return (
    <div className="flex items-center gap-2 rounded-md border p-2">
      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 space-y-1.5 min-w-0">
        <Input
          value={segment.text}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="segment text"
          className="h-8"
        />
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {palettes ? (
          <BrandTokenPicker
            value={segment.color ?? ''}
            onChange={(v) => onChange({ color: v })}
            palettes={palettes}
            gradients={gradients}
            allowHex
            allowGradient
            label="Pick segment color"
          />
        ) : (
          <>
            <input
              type="color"
              value={segment.color || '#000000'}
              onChange={(e) => onChange({ color: e.target.value })}
              className="h-8 w-10 rounded border cursor-pointer"
              title="Pick color"
            />
            <Input
              value={segment.color ?? ''}
              onChange={(e) => onChange({ color: e.target.value })}
              placeholder="#137774"
              className="h-8 w-24 font-mono text-xs"
            />
          </>
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 shrink-0"
        onClick={onRemove}
        title="Remove segment"
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

function WordmarkPreview({
  segments,
  typography,
  palettes,
  gradients,
}: {
  segments: WordmarkSegment[];
  typography?: WordmarkTypography;
  palettes?: ResolvedPalettes;
  gradients: PickableGradient[];
}) {
  const hasTypography = !!typography?.family;
  const previewStyle: React.CSSProperties = hasTypography
    ? {
        fontFamily: resolveFamilyStack(typography!.family!),
        fontWeight: typography!.weight ? Number(typography!.weight) : 700,
        fontStyle: typography!.style ?? 'normal',
        letterSpacing: typography!.letterSpacing || '0em',
        textTransform: typography!.textTransform ?? 'none',
        fontSize: '1.5rem',
        lineHeight: 1.2,
      }
    : {
        ...(typography?.letterSpacing ? { letterSpacing: typography.letterSpacing } : {}),
        ...(typography?.textTransform ? { textTransform: typography.textTransform } : {}),
      };
  const className = hasTypography
    ? 'tracking-tight'
    : 'text-2xl font-bold tracking-tight';

  return (
    <span className={className} style={previewStyle}>
      {segments.map((s, i) => {
        // v0.1.60: resolve each segment via the new color resolver so
        // gradient refs render with background-clip:text, palette
        // refs resolve to hex, and literal hex passes through.
        const resolved = resolveSegmentColor(s.color, palettes, gradients);
        return (
          <span
            key={i}
            style={{
              color: resolved.color,
              background: resolved.background,
              WebkitBackgroundClip: resolved.webkitBackgroundClip as React.CSSProperties['WebkitBackgroundClip'],
              backgroundClip: resolved.backgroundClip as React.CSSProperties['backgroundClip'],
              WebkitTextFillColor: resolved.webkitTextFillColor,
            }}
          >
            {s.text}
          </span>
        );
      })}
    </span>
  );
}
