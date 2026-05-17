/**
 * WordmarkEditor — segmented wordmark builder (controlled component).
 *
 * Stored shape (JSON-stringified in brand_token `wordmark_text`):
 *   [{ text: 'Cura', color: '#137774' }, { text: 'listo', color: '#F2795D' }]
 *
 * Each segment has required `text` and optional `color` (falls back to
 * the workspace accent at render time). The UI is a list of rows —
 * text input + color swatch — with add/remove. The live preview shows
 * how the wordmark renders, concatenated.
 *
 * MVP intentionally avoids contenteditable: simpler to reason about,
 * easier to debug, no cursor/selection edge cases.
 *
 * Controlled component — parent owns the JSON string value and the
 * save trigger (LogosTab batches all logo + wordmark saves into one
 * brand_tokens PUT).
 */

import * as React from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';

import {
  Button, Input, Label,
} from '@ensemble-edge/ui';

export interface WordmarkSegment {
  text: string;
  color?: string;
}

const HEX_RE = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

export function isValidWordmarkColor(c: string): boolean {
  if (!c) return true;
  return HEX_RE.test(c.trim());
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

/**
 * Controlled editor. Parent passes the raw JSON `value` and gets back
 * a new JSON string via `onChange` whenever segments change.
 */
export function WordmarkEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
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
          <WordmarkPreview segments={segments} />
        </div>
      )}

      <div className="space-y-2">
        {segments.map((seg, i) => (
          <SegmentRow
            key={i}
            segment={seg}
            onChange={(patch) => update(i, patch)}
            onRemove={() => removeSegment(i)}
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
}: {
  segment: WordmarkSegment;
  onChange: (patch: Partial<WordmarkSegment>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border p-2">
      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Input
          value={segment.text}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="segment text"
          className="h-8"
        />
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Label className="text-xs text-muted-foreground">Color</Label>
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

function WordmarkPreview({ segments }: { segments: WordmarkSegment[] }) {
  return (
    <span className="text-2xl font-bold tracking-tight">
      {segments.map((s, i) => (
        <span key={i} style={s.color ? { color: s.color } : undefined}>
          {s.text}
        </span>
      ))}
    </span>
  );
}
