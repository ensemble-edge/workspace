/**
 * Logos Tab — Brand mark uploads and preview.
 *
 * v0.1.14: Uploads go to R2 via POST /_ensemble/brand/upload, which
 * returns a workspace-served URL stored as a brand_token. An
 * "or paste an image URL" field remains for operators who'd rather
 * host their own assets.
 */

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Image, Upload } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  toast,
} from '@ensemble-edge/ui';

const LOGO_FIELDS = [
  { key: 'wordmark', label: 'Wordmark', description: 'Full company name logo' },
  { key: 'wordmark_dark', label: 'Wordmark (Dark)', description: 'For dark backgrounds' },
  { key: 'icon_mark', label: 'Icon Mark', description: 'Square icon/symbol (used in sidebar)' },
  { key: 'icon_mark_dark', label: 'Icon Mark (Dark)', description: 'For dark backgrounds' },
  { key: 'favicon', label: 'Favicon', description: 'Browser tab icon (auto-generated from icon if empty)' },
  { key: 'social_avatar', label: 'Social Avatar', description: 'Square image for social profiles' },
  { key: 'og_image', label: 'OG Image', description: '1200x630 for social sharing previews' },
];

export function LogosTab() {
  const [logos, setLogos] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/_ensemble/core/brand/tokens/identity')
      .then((r) => r.json() as Promise<{ data?: Array<{ key: string; value: string }> }>)
      .then((res) => {
        const loaded: Record<string, string> = {};
        for (const token of res.data || []) {
          if (token.key.startsWith('logo_')) {
            loaded[token.key.replace('logo_', '')] = token.value;
          }
        }
        setLogos(loaded);
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const tokens: Record<string, string> = {};
      for (const [key, value] of Object.entries(logos)) {
        if (value) tokens[`logo_${key}`] = value;
      }
      const res = await fetch('/_ensemble/brand/tokens', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'identity', tokens }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success('Logos saved');
    } catch {
      toast.error('Failed to save logos');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {LOGO_FIELDS.map((field) => (
          <Card key={field.key}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{field.label}</CardTitle>
              <CardDescription>{field.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Preview */}
              <div className="flex items-center justify-center h-24 rounded-md border border-dashed bg-muted/50">
                {logos[field.key] ? (
                  <img src={logos[field.key]} alt={field.label} className="max-h-20 max-w-full object-contain" />
                ) : (
                  <div className="flex flex-col items-center text-muted-foreground">
                    <Image className="h-8 w-8 mb-1" />
                    <span className="text-xs">No image set</span>
                  </div>
                )}
              </div>

              <LogoUploader
                kind={field.key}
                value={logos[field.key] || ''}
                onChange={(v) => setLogos((p) => ({ ...p, [field.key]: v }))}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save Logos'}
      </Button>
    </div>
  );
}

/**
 * Inline uploader: file picker + paste-URL fallback. Uploads the file
 * to /_ensemble/brand/upload and propagates the returned URL upward via
 * onChange so the parent's "Save Logos" still writes brand_tokens as a
 * single batched PUT.
 */
function LogoUploader({
  kind,
  value,
  onChange,
}: {
  kind: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', kind);
      const r = await fetch('/_ensemble/brand/upload', {
        method: 'POST',
        body: form,
        credentials: 'include',
      });
      const body = (await r.json()) as { ok?: boolean; url?: string; error?: string };
      if (!r.ok || !body.url) {
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }
      onChange(body.url);
      toast.success('Uploaded');
    } catch (e) {
      toast.error('Upload failed', {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setUploading(false);
      // Reset so re-selecting the same file fires onChange again.
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-2">
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
          accept="image/png,image/jpeg,image/svg+xml,image/webp,image/x-icon,image/vnd.microsoft.icon"
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
