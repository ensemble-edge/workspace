/**
 * Brand Page — Company Brand Identity Editor
 *
 * Define your company's visual identity in one place:
 * - Primary accent color + auto-generated full palette
 * - Base theme selection (light/dark)
 * - Logo upload (future)
 * - Live preview
 *
 * The brand CSS is exported at /_ensemble/brand/css so any
 * website or project can consume it with a single <link> tag.
 */

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useSignals } from '@preact/signals-react/runtime';

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
  Popover,
  PopoverContent,
  PopoverTrigger,
  toast,
} from '@ensemble-edge/ui';

import { theme, applyTheme } from '../../../state';
import { generatePalette, getRelativeLuminance, hexToHsl } from './color-utils';
import type { Palette } from './color-utils';

export function BrandPage() {
  useSignals();
  const currentTheme = theme.value;
  const [accentColor, setAccentColor] = useState(currentTheme?.colors?.accent ?? '#3B82F6');
  const [baseTheme, setBaseTheme] = useState<'light' | 'dark'>('dark');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load saved brand tokens from DB on mount
  useEffect(() => {
    fetch('/_ensemble/core/brand/tokens/colors')
      .then((res) => res.json() as Promise<{ data?: Array<{ key: string; value: string }> }>)
      .then((result) => {
        for (const token of result.data || []) {
          if (token.key === 'accent') setAccentColor(token.value);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const palette = generatePalette(accentColor);
  const hsl = hexToHsl(accentColor);

  // Apply live preview when accent changes
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accentColor);
    document.documentElement.style.setProperty('--color-accent', accentColor);
  }, [accentColor]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/_ensemble/brand/tokens', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'colors',
          tokens: { accent: accentColor },
        }),
      });

      if (!response.ok) throw new Error('Failed to save');
      applyTheme();
      toast.success('Brand saved', {
        description: 'Your brand colors have been updated.',
      });
    } catch {
      toast.error('Failed to save', {
        description: 'Could not save brand settings. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Brand</h1>
        <p className="text-muted-foreground">
          Define your company's visual identity. This generates CSS that any project can use.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column: Controls */}
        <div className="space-y-6">
          {/* Accent Color */}
          <Card>
            <CardHeader>
              <CardTitle>Accent Color</CardTitle>
              <CardDescription>
                Your primary brand color. Everything else is generated from this.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ColorPicker value={accentColor} onChange={setAccentColor} />

              {/* Color info */}
              {hsl && (
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">HEX</span>
                    <p className="font-mono font-medium">{accentColor}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">HSL</span>
                    <p className="font-mono font-medium">{Math.round(hsl.h)}° {Math.round(hsl.s)}% {Math.round(hsl.l)}%</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Luminance</span>
                    <p className="font-mono font-medium">{(getRelativeLuminance(accentColor) * 100).toFixed(1)}%</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Generated Palette */}
          <Card>
            <CardHeader>
              <CardTitle>Color Palette</CardTitle>
              <CardDescription>
                Auto-generated from your accent color. 10 shades from light to dark.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PaletteSwatches palette={palette} />
            </CardContent>
          </Card>

          {/* Base Theme */}
          <Card>
            <CardHeader>
              <CardTitle>Base Theme</CardTitle>
              <CardDescription>Light or dark foundation for your brand</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <ThemeOption
                  value="dark"
                  label="Dark"
                  description="Dark surfaces, light text"
                  selected={baseTheme === 'dark'}
                  onClick={() => setBaseTheme('dark')}
                />
                <ThemeOption
                  value="light"
                  label="Light"
                  description="Light surfaces, dark text"
                  selected={baseTheme === 'light'}
                  onClick={() => setBaseTheme('light')}
                />
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? 'Saving...' : 'Save Brand'}
          </Button>
        </div>

        {/* Right column: Preview + Export */}
        <div className="space-y-6">
          {/* Live Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>How your brand looks in context</CardDescription>
            </CardHeader>
            <CardContent>
              <ThemePreview accentColor={accentColor} baseTheme={baseTheme} />
            </CardContent>
          </Card>

          {/* CSS Export Info */}
          <Card>
            <CardHeader>
              <CardTitle>Use Everywhere</CardTitle>
              <CardDescription>
                Add this to any website to use your brand colors
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md bg-muted p-4">
                <code className="text-sm font-mono text-muted-foreground">
                  {'<link rel="stylesheet"'}<br />
                  {'  href="/_ensemble/brand/css" />'}
                </code>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                This stylesheet includes your accent color, generated palette,
                typography, and spacing — ready to use with CSS variables.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* =============================================================================
   Sub-components
   ============================================================================= */

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex h-10 w-full items-center gap-3 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background hover:bg-accent">
          <div className="h-6 w-6 rounded border border-border" style={{ backgroundColor: value }} />
          <span className="font-mono">{value}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="space-y-3">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-32 w-full cursor-pointer rounded-md border-0"
          />
          <Input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="#000000"
            className="font-mono"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PaletteSwatches({ palette }: { palette: Palette }) {
  const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
  return (
    <div className="flex gap-1 overflow-hidden rounded-md">
      {shades.map((shade) => {
        const color = palette[shade];
        const luminance = getRelativeLuminance(color);
        const textColor = luminance < 0.5 ? '#ffffff' : '#000000';
        return (
          <div
            key={shade}
            className={`flex h-12 flex-1 items-center justify-center text-xs font-medium ${
              shade === 500 ? 'ring-2 ring-ring ring-offset-2' : ''
            }`}
            style={{ backgroundColor: color, color: textColor }}
            title={color}
          >
            {shade}
          </div>
        );
      })}
    </div>
  );
}

function ThemeOption({ value, label, description, selected, onClick }: {
  value: string; label: string; description: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start rounded-lg border-2 p-4 text-left transition-colors ${
        selected ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'
      }`}
    >
      <div className={`mb-3 flex h-16 w-full overflow-hidden rounded-md ${
        value === 'dark' ? 'bg-zinc-900' : 'bg-zinc-100'
      }`}>
        <div className={`w-6 ${value === 'dark' ? 'bg-zinc-800' : 'bg-zinc-200'}`} />
        <div className="flex flex-1 flex-col gap-1 p-2">
          <div className={`h-2 w-8 rounded ${value === 'dark' ? 'bg-zinc-700' : 'bg-zinc-300'}`} />
          <div className={`h-4 rounded ${value === 'dark' ? 'bg-zinc-800' : 'bg-white'}`} />
        </div>
      </div>
      <span className="font-medium">{label}</span>
      <span className="text-sm text-muted-foreground">{description}</span>
    </button>
  );
}

function ThemePreview({ accentColor, baseTheme }: { accentColor: string; baseTheme: 'light' | 'dark' }) {
  const isDark = baseTheme === 'dark';
  return (
    <div className={`overflow-hidden rounded-lg border ${
      isDark ? 'bg-zinc-900 text-zinc-100' : 'bg-white text-zinc-900'
    }`}>
      <div className="flex h-48">
        <div className={`w-12 border-r p-2 ${
          isDark ? 'border-zinc-800 bg-zinc-950' : 'border-zinc-200 bg-zinc-50'
        }`}>
          <div className="mb-3 flex h-6 w-6 items-center justify-center rounded text-xs font-bold" style={{ backgroundColor: accentColor, color: '#fff' }}>W</div>
          <div className={`mb-2 h-2 w-full rounded ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`} />
          <div className="mb-2 h-2 w-full rounded" style={{ backgroundColor: accentColor }} />
          <div className={`h-2 w-full rounded ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`} />
        </div>
        <div className="flex-1 p-4">
          <div className="mb-2 text-sm font-semibold">Dashboard</div>
          <div className="grid grid-cols-2 gap-2">
            <div className={`rounded-md p-2 ${isDark ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
              <div className="text-xs text-muted-foreground">Users</div>
              <div className="text-lg font-bold" style={{ color: accentColor }}>247</div>
            </div>
            <div className={`rounded-md p-2 ${isDark ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
              <div className="text-xs text-muted-foreground">Active</div>
              <div className="text-lg font-bold" style={{ color: accentColor }}>82%</div>
            </div>
          </div>
          <button className="mt-3 rounded-md px-3 py-1.5 text-sm font-medium text-white" style={{ backgroundColor: accentColor }}>
            Create New
          </button>
        </div>
      </div>
    </div>
  );
}
