/**
 * Appearance Tab — Workspace UI configuration
 *
 * Controls how THIS workspace's shell looks:
 * Style, Base Color, Theme, Chart Color, Typography,
 * Icon Library, Radius, Menu styles.
 *
 * All changes apply in REAL-TIME. Saved to 'custom' brand_tokens category.
 * Loaded optimistically via /_ensemble/brand/css (in HTML <head>).
 */

import * as React from 'react';
import { useState, useEffect } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Label,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@ensemble-edge/ui';

export function AppearanceTab() {
  const [style, setStyle] = useState('default');
  const [baseColor, setBaseColor] = useState('zinc');
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('dark');
  const [chartColor, setChartColor] = useState('blue');
  const [headingFont, setHeadingFont] = useState('system');
  const [bodyFont, setBodyFont] = useState('system');
  const [iconLibrary, setIconLibrary] = useState('lucide');
  const [radius, setRadius] = useState('0.5');
  const [menuStyle, setMenuStyle] = useState('default');
  const [menuAccent, setMenuAccent] = useState('primary');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load saved custom tokens from DB on mount
  useEffect(() => {
    fetch('/_ensemble/core/brand/tokens/custom')
      .then((res) => res.json() as Promise<{ data?: Array<{ key: string; value: string }> }>)
      .then((result) => {
        const tokens = result.data || [];
        for (const token of tokens) {
          switch (token.key) {
            case 'style': setStyle(token.value); break;
            case 'baseColor': setBaseColor(token.value); break;
            case 'themeMode': setThemeMode(token.value as 'light' | 'dark'); break;
            case 'chartColor': setChartColor(token.value); break;
            case 'headingFont': setHeadingFont(token.value); break;
            case 'bodyFont': setBodyFont(token.value); break;
            case 'iconLibrary': setIconLibrary(token.value); break;
            case 'radius': setRadius(token.value); break;
            case 'menuStyle': setMenuStyle(token.value); break;
            case 'menuAccent': setMenuAccent(token.value); break;
          }
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  // Apply theme mode in real-time
  useEffect(() => {
    if (themeMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [themeMode]);

  // Apply radius in real-time
  useEffect(() => {
    document.documentElement.style.setProperty('--radius', `${radius}rem`);
  }, [radius]);

  // Apply base color in real-time
  useEffect(() => {
    const colors: Record<string, { bg: string; fg: string; border: string }> = {
      zinc: { bg: '240 10% 3.9%', fg: '0 0% 98%', border: '240 3.7% 15.9%' },
      slate: { bg: '222.2 84% 4.9%', fg: '210 40% 98%', border: '217.2 32.6% 17.5%' },
      stone: { bg: '20 14.3% 4.1%', fg: '60 9.1% 97.8%', border: '12 6.5% 15.1%' },
      gray: { bg: '224 71.4% 4.1%', fg: '210 20% 98%', border: '215 27.9% 16.9%' },
      neutral: { bg: '0 0% 3.9%', fg: '0 0% 98%', border: '0 0% 14.9%' },
    };
    const c = colors[baseColor] || colors.zinc;
    document.documentElement.style.setProperty('--background', c.bg);
    document.documentElement.style.setProperty('--foreground', c.fg);
    document.documentElement.style.setProperty('--border', c.border);
    document.documentElement.style.setProperty('--muted', c.border);
  }, [baseColor]);

  // Apply chart color in real-time
  useEffect(() => {
    const chartHsl: Record<string, string> = {
      blue: '220 70% 50%',
      green: '160 60% 45%',
      orange: '30 80% 55%',
      rose: '340 75% 55%',
      violet: '280 65% 60%',
    };
    document.documentElement.style.setProperty('--chart-1', chartHsl[chartColor] || chartHsl.blue);
  }, [chartColor]);

  // Apply font changes in real-time
  useEffect(() => {
    const fonts: Record<string, string> = {
      system: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      inter: '"Inter", system-ui, sans-serif',
      manrope: '"Manrope", system-ui, sans-serif',
      geist: '"Geist", system-ui, sans-serif',
      'cal-sans': '"Cal Sans", system-ui, sans-serif',
      roboto: '"Roboto", system-ui, sans-serif',
    };
    document.documentElement.style.setProperty('--font-heading', fonts[headingFont] || fonts.system);
    document.documentElement.style.setProperty('--font-body', fonts[bodyFont] || fonts.system);
    document.body.style.fontFamily = fonts[bodyFont] || fonts.system;
  }, [headingFont, bodyFont]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/_ensemble/brand/tokens', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'custom',
          tokens: {
            style, baseColor, themeMode, chartColor,
            headingFont, bodyFont, iconLibrary, radius,
            menuStyle, menuAccent,
          },
        }),
      });

      if (!response.ok) throw new Error('Failed to save');
      toast.success('Workspace settings saved', {
        description: 'Your UI preferences have been applied.',
      });
    } catch {
      toast.error('Failed to save', {
        description: 'Could not save workspace settings. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  const baseColors = [
    { value: 'zinc', label: 'Zinc', color: '#71717a' },
    { value: 'slate', label: 'Slate', color: '#64748b' },
    { value: 'stone', label: 'Stone', color: '#78716c' },
    { value: 'gray', label: 'Gray', color: '#6b7280' },
    { value: 'neutral', label: 'Neutral', color: '#737373' },
  ];

  const chartColors = [
    { value: 'blue', label: 'Blue', color: '#3b82f6' },
    { value: 'green', label: 'Green', color: '#22c55e' },
    { value: 'orange', label: 'Orange', color: '#f97316' },
    { value: 'rose', label: 'Rose', color: '#f43f5e' },
    { value: 'violet', label: 'Violet', color: '#8b5cf6' },
  ];

  const radiusOptions = [
    { value: '0', label: '0' },
    { value: '0.3', label: '0.3' },
    { value: '0.5', label: '0.5' },
    { value: '0.75', label: '0.75' },
    { value: '1', label: '1.0' },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        {/* Style */}
        <Card>
          <CardHeader>
            <CardTitle>Style</CardTitle>
            <CardDescription>Choose the overall visual style</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={style} onValueChange={setStyle} className="grid grid-cols-2 gap-4">
              <div>
                <RadioGroupItem value="default" id="style-default" className="peer sr-only" />
                <Label
                  htmlFor="style-default"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <span className="text-sm font-medium">Default</span>
                </Label>
              </div>
              <div>
                <RadioGroupItem value="new-york" id="style-newyork" className="peer sr-only" />
                <Label
                  htmlFor="style-newyork"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <span className="text-sm font-medium">New York</span>
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Base Color */}
        <Card>
          <CardHeader>
            <CardTitle>Base Color</CardTitle>
            <CardDescription>The neutral color scale for backgrounds and borders</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {baseColors.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setBaseColor(c.value)}
                  className={`flex items-center gap-2 rounded-md border-2 px-3 py-2 text-sm transition-colors ${
                    baseColor === c.value
                      ? 'border-primary bg-primary/10'
                      : 'border-muted hover:border-primary/50'
                  }`}
                >
                  <div className="h-4 w-4 rounded-full" style={{ backgroundColor: c.color }} />
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Theme Mode */}
        <Card>
          <CardHeader>
            <CardTitle>Theme</CardTitle>
            <CardDescription>Light or dark mode</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Button
                variant={themeMode === 'light' ? 'default' : 'outline'}
                onClick={() => setThemeMode('light')}
                className="flex-1"
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
                Light
              </Button>
              <Button
                variant={themeMode === 'dark' ? 'default' : 'outline'}
                onClick={() => setThemeMode('dark')}
                className="flex-1"
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
                Dark
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Chart Color */}
        <Card>
          <CardHeader>
            <CardTitle>Chart Color</CardTitle>
            <CardDescription>Primary color for charts and data visualizations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {chartColors.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setChartColor(c.value)}
                  className={`flex items-center gap-2 rounded-md border-2 px-3 py-2 text-sm transition-colors ${
                    chartColor === c.value
                      ? 'border-primary bg-primary/10'
                      : 'border-muted hover:border-primary/50'
                  }`}
                >
                  <div className="h-4 w-4 rounded-full" style={{ backgroundColor: c.color }} />
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {/* Typography */}
        <Card>
          <CardHeader>
            <CardTitle>Typography</CardTitle>
            <CardDescription>Font settings for headings and body text</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Heading Font</Label>
              <Select value={headingFont} onValueChange={setHeadingFont}>
                <SelectTrigger><SelectValue placeholder="Select font" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">System Default</SelectItem>
                  <SelectItem value="inter">Inter</SelectItem>
                  <SelectItem value="manrope">Manrope</SelectItem>
                  <SelectItem value="geist">Geist</SelectItem>
                  <SelectItem value="cal-sans">Cal Sans</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Body Font</Label>
              <Select value={bodyFont} onValueChange={setBodyFont}>
                <SelectTrigger><SelectValue placeholder="Select font" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">System Default</SelectItem>
                  <SelectItem value="inter">Inter</SelectItem>
                  <SelectItem value="geist">Geist</SelectItem>
                  <SelectItem value="roboto">Roboto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Icon Library */}
        <Card>
          <CardHeader>
            <CardTitle>Icon Library</CardTitle>
            <CardDescription>Choose the icon set used throughout the UI</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={iconLibrary} onValueChange={setIconLibrary}>
              <SelectTrigger><SelectValue placeholder="Select icon library" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lucide">Lucide Icons</SelectItem>
                <SelectItem value="heroicons">Heroicons</SelectItem>
                <SelectItem value="phosphor">Phosphor Icons</SelectItem>
                <SelectItem value="tabler">Tabler Icons</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Radius */}
        <Card>
          <CardHeader>
            <CardTitle>Radius</CardTitle>
            <CardDescription>Border radius for buttons and cards</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {radiusOptions.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setRadius(r.value)}
                  className={`flex-1 rounded-md border-2 px-3 py-2 text-sm font-medium transition-colors ${
                    radius === r.value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-muted hover:border-primary/50'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className="mt-4 flex gap-4">
              <div
                className="h-12 w-12 border-2 border-primary bg-primary/20"
                style={{ borderRadius: `${radius}rem` }}
              />
              <div
                className="h-12 flex-1 border-2 border-primary bg-primary/20"
                style={{ borderRadius: `${radius}rem` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Menu Styles */}
        <Card>
          <CardHeader>
            <CardTitle>Menu</CardTitle>
            <CardDescription>Sidebar and navigation menu appearance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Menu Style</Label>
              <Select value={menuStyle} onValueChange={setMenuStyle}>
                <SelectTrigger><SelectValue placeholder="Select style" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="floating">Floating</SelectItem>
                  <SelectItem value="inset">Inset</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Menu Accent</Label>
              <Select value={menuAccent} onValueChange={setMenuAccent}>
                <SelectTrigger><SelectValue placeholder="Select accent" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="secondary">Secondary</SelectItem>
                  <SelectItem value="muted">Muted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? 'Saving...' : 'Save Workspace Settings'}
        </Button>
      </div>
    </div>
  );
}
