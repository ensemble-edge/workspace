/**
 * Logos Tab — Brand mark uploads and preview.
 * Uses URL input for now (R2 upload will be added later).
 */

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Image, Upload } from 'lucide-react';

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

              {/* URL Input (R2 upload coming later) */}
              <div className="space-y-1">
                <Label className="text-xs">Image URL</Label>
                <Input
                  placeholder="https://example.com/logo.svg"
                  value={logos[field.key] || ''}
                  onChange={(e) => setLogos((p) => ({ ...p, [field.key]: e.target.value }))}
                  className="text-sm"
                />
              </div>
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
