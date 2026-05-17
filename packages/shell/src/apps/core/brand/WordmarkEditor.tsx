/**
 * WordmarkEditor — segmented wordmark builder.
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
 */

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';

import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
  Button, Input, Label, toast,
} from '@ensemble-edge/ui';

import { authedFetch } from '../../../state';

export interface WordmarkSegment {
  text: string;
  color?: string;
}

const HEX_RE = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

function isValidColor(c: string): boolean {
  if (!c) return true; // empty means "use default"
  return HEX_RE.test(c.trim());
}

function parseSegments(raw: string): WordmarkSegment[] {
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

export function WordmarkEditor() {
  const [segments, setSegments] = useState<WordmarkSegment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    authedFetch('/_ensemble/core/brand/tokens/identity')
      .then((r) => r.json() as Promise<{ data?: Array<{ key: string; value: string }> }>)
      .then((res) => {
        const raw = (res.data ?? []).find((t) => t.key === 'wordmark_text');
        setSegments(parseSegments(raw?.value ?? ''));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  function update(i: number, patch: Partial<WordmarkSegment>) {
    setSegments((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function removeSegment(i: number) {
    setSegments((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addSegment() {
    setSegments((prev) => [...prev, { text: '', color: undefined }]);
  }

  async function save() {
    // Drop empty-text segments before save.
    const cleaned = segments
      .map((s) => ({ text: s.text, color: s.color?.trim() || undefined }))
      .filter((s) => s.text);

    // Validate colors.
    for (const s of cleaned) {
      if (s.color && !isValidColor(s.color)) {
        toast.error(`Invalid color "${s.color}"`, {
          description: 'Use a hex like #137774.',
        });
        return;
      }
    }

    setSaving(true);
    try {
      const tokens: Record<string, string> = {
        wordmark_text: JSON.stringify(cleaned),
      };
      const r = await authedFetch('/_ensemble/brand/tokens', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'identity', tokens }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      toast.success('Wordmark saved');
    } catch (e) {
      toast.error('Failed to save wordmark', {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Styled wordmark</CardTitle>
        <CardDescription>
          Split your wordmark into colored segments. For example, "Cura" in #137774 and
          "listo" in #F2795D renders as a two-color wordmark wherever the workspace shows
          your brand name (sidebar, login, emails, brand guide).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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

        <div>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save wordmark'}
          </Button>
        </div>
      </CardContent>
    </Card>
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
