/**
 * Social / Sharing Tab — raster-only social-profile assets.
 *
 * v0.1.47: split out of LogosTab. Social avatar + OG image are
 * output-only formats with no useful vector source, so they live
 * in their own tab apart from the SVG-master-driven Logos system.
 *
 * Operator uploads square avatars + 1200×630 social-share images
 * here. The brand spec API + email templates + workspace context
 * read these from the same `logo_*` brand_tokens — no schema
 * change.
 */

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Image as ImageIcon, Upload, X } from 'lucide-react';

import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
  Button, Label, SaveStatus,
  toast,
} from '@ensemble-edge/ui';

import { authedFetch, emitWorkspaceEvent } from '../../../state';
import { useFormStatus } from '../../../hooks/useFormStatus';

const SOCIAL_SLOTS: Array<{
  key: string;
  label: string;
  description: string;
  guidance: string;
}> = [
  {
    key: 'social_avatar',
    label: 'Social avatar',
    description:
      'Square image used for social profile pictures (Twitter/X, LinkedIn, GitHub, ' +
      'Slack workspace, etc.). Typically a tightly-cropped icon on a brand-color background.',
    guidance:
      'Recommended: 1024×1024 px, PNG or JPG. Keep the focal element away from the ' +
      'edges — some platforms crop to a circle.',
  },
  {
    key: 'og_image',
    label: 'OG image',
    description:
      '1200×630 image used for social-link previews (Twitter cards, Facebook OG, ' +
      'iMessage rich links). This is what your brand looks like when someone shares ' +
      'your URL in a chat.',
    guidance:
      'Recommended: 1200×630 px exactly, PNG or JPG. Include the workspace name and ' +
      'a punchy line of copy — most consumers see the preview, not the page.',
  },
];

type SaveBaseline = Record<string, string>;

export function SocialSharingTab() {
  const [tokens, setTokens] = useState<SaveBaseline>({});
  const [loaded, setLoaded] = useState(false);
  const status = useFormStatus({ value: tokens, mode: 'manual' });

  useEffect(() => {
    authedFetch('/_ensemble/core/brand/tokens/identity')
      .then((r) => r.json() as Promise<{ data?: Array<{ key: string; value: string }> }>)
      .then((res) => {
        const loaded: Record<string, string> = {};
        for (const t of res.data || []) {
          if (t.key === 'logo_social_avatar' || t.key === 'logo_og_image') {
            loaded[t.key] = t.value;
          }
        }
        setTokens(loaded);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loaded) return;
    status.resetBaseline(tokens);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  /**
   * Autosave on upload — write to brand_tokens immediately so refresh
   * remembers the file. Mirrors LogosTab's persistToken pattern.
   */
  async function persistToken(key: string, value: string) {
    setTokens((prev) => {
      const next = { ...prev, [key]: value };
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

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {SOCIAL_SLOTS.map((slot) => (
          <SocialSlotCard
            key={slot.key}
            slot={slot}
            value={tokens[`logo_${slot.key}`] || ''}
            onChange={(v) => persistToken(`logo_${slot.key}`, v)}
          />
        ))}
      </div>

      {/* SaveStatus indicator. Since uploads autosave, the only time
          this lights up is during the actual upload network round-trip. */}
      <div className="flex items-center gap-3">
        {status.state !== 'clean' && <SaveStatus state={status.state} />}
      </div>
    </div>
  );
}

function SocialSlotCard({
  slot,
  value,
  onChange,
}: {
  slot: { key: string; label: string; description: string; guidance: string };
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', `${slot.key}_base`);
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
      toast.success(`${slot.label} uploaded`);
    } catch (e) {
      toast.error('Upload failed', {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{slot.label}</CardTitle>
        <CardDescription>{slot.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-center h-32 rounded-md border border-dashed bg-muted/30">
          {value ? (
            <img src={value} alt={slot.label} className="max-h-28 max-w-full object-contain" />
          ) : (
            <div className="flex flex-col items-center text-muted-foreground">
              <ImageIcon className="h-8 w-8 mb-1" />
              <span className="text-xs">No image set</span>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{slot.guidance}</p>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-3 w-3 mr-1" /> {uploading ? 'Uploading…' : value ? 'Replace' : 'Upload'}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={uploading}
              onClick={() => onChange('')}
            >
              <X className="h-3 w-3 mr-1" /> Remove
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
