/**
 * Typography Tab — Font selection with live preview.
 */

import * as React from 'react';
import { useState, useEffect } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Button,
  Label,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@ensemble-edge/ui';

const FONT_OPTIONS = [
  { value: 'system', label: 'System Default', css: 'system-ui, -apple-system, sans-serif' },
  { value: 'dm-sans', label: 'DM Sans', css: '"DM Sans", sans-serif' },
  { value: 'inter', label: 'Inter', css: '"Inter", sans-serif' },
  { value: 'manrope', label: 'Manrope', css: '"Manrope", sans-serif' },
  { value: 'spectral', label: 'Spectral', css: '"Spectral", serif' },
  { value: 'gloock', label: 'Gloock', css: '"Gloock", serif' },
  { value: 'playfair', label: 'Playfair Display', css: '"Playfair Display", serif' },
  { value: 'geist', label: 'Geist', css: '"Geist", sans-serif' },
  { value: 'roboto', label: 'Roboto', css: '"Roboto", sans-serif' },
  { value: 'jetbrains-mono', label: 'JetBrains Mono', css: '"JetBrains Mono", monospace' },
  { value: 'fira-code', label: 'Fira Code', css: '"Fira Code", monospace' },
];

export function TypographyTab() {
  const [displayFont, setDisplayFont] = useState('system');
  const [headingFont, setHeadingFont] = useState('system');
  const [bodyFont, setBodyFont] = useState('system');
  const [monoFont, setMonoFont] = useState('jetbrains-mono');
  const [saving, setSaving] = useState(false);

  // Load saved typography tokens
  useEffect(() => {
    fetch('/_ensemble/core/brand/tokens/typography')
      .then((r) => r.json() as Promise<{ data?: Array<{ key: string; value: string }> }>)
      .then((res) => {
        for (const token of res.data || []) {
          switch (token.key) {
            case 'display_font': setDisplayFont(token.value); break;
            case 'heading_font': setHeadingFont(token.value); break;
            case 'body_font': setBodyFont(token.value); break;
            case 'mono_font': setMonoFont(token.value); break;
          }
        }
      })
      .catch(() => {});
  }, []);

  const getFontCss = (value: string) =>
    FONT_OPTIONS.find((f) => f.value === value)?.css || 'system-ui, sans-serif';

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/_ensemble/brand/tokens', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'typography',
          tokens: {
            display_font: displayFont,
            heading_font: headingFont,
            body_font: bodyFont,
            mono_font: monoFont,
          },
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success('Typography saved');
    } catch {
      toast.error('Failed to save typography');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Font Selection */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Font Families</CardTitle>
              <CardDescription>Choose fonts for different contexts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Display Font</Label>
                <Select value={displayFont} onValueChange={setDisplayFont}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">For hero text, large headings</p>
              </div>

              <div className="space-y-2">
                <Label>Heading Font</Label>
                <Select value={headingFont} onValueChange={setHeadingFont}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">For section headings (h1-h3)</p>
              </div>

              <div className="space-y-2">
                <Label>Body Font</Label>
                <Select value={bodyFont} onValueChange={setBodyFont}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">For paragraphs and UI text</p>
              </div>

              <div className="space-y-2">
                <Label>Mono Font</Label>
                <Select value={monoFont} onValueChange={setMonoFont}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.filter((f) => f.css.includes('monospace') || f.value === 'system').map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">For code and data</p>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Typography'}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Live Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>Live preview of your font choices</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Display</p>
              <p className="text-4xl font-bold" style={{ fontFamily: getFontCss(displayFont) }}>
                The quick brown fox
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Heading</p>
              <p className="text-2xl font-semibold" style={{ fontFamily: getFontCss(headingFont) }}>
                Section Heading Example
              </p>
              <p className="text-lg font-medium mt-1" style={{ fontFamily: getFontCss(headingFont) }}>
                Subsection heading style
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Body</p>
              <p className="text-base" style={{ fontFamily: getFontCss(bodyFont) }}>
                This is body text. It should be clear and readable at small sizes.
                The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Mono</p>
              <p className="text-sm" style={{ fontFamily: getFontCss(monoFont) }}>
                const brand = await fetch('/_ensemble/brand/css');
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
