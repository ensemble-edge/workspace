/**
 * Appearance Tab — Workspace UI configuration
 *
 * Simple, opinionated controls that always produce good results:
 * - Theme: light / dark / system
 * - Base color: zinc / slate / stone / gray / neutral (curated scales)
 * - Radius: corner rounding
 * - Typography: heading + body fonts
 * - Spacing: canvas padding + card padding
 *
 * No arbitrary color pickers — the base color presets are designed
 * by shadcn/ui with proper contrast ratios for all elements.
 */

import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
  toast,
} from '@ensemble-edge/ui';

import { useHashTab } from '../../../hooks/useHashTab';

const COLOR_PRESETS = [
  { value: '#2563eb', label: 'Blue' },
  { value: '#7c3aed', label: 'Violet' },
  { value: '#db2777', label: 'Pink' },
  { value: '#ea580c', label: 'Orange' },
  { value: '#16a34a', label: 'Green' },
  { value: '#dc2626', label: 'Red' },
  { value: '#ca8a04', label: 'Yellow' },
  { value: '#0891b2', label: 'Cyan' },
];

const FONT_OPTIONS = [
  { value: 'system', label: 'System Default' },
  { value: 'inter', label: 'Inter' },
  { value: 'dm-sans', label: 'DM Sans' },
  { value: 'manrope', label: 'Manrope' },
  { value: 'geist', label: 'Geist' },
  { value: 'roboto', label: 'Roboto' },
];

export function AppearanceTab() {
  const [baseColor, setBaseColor] = useState('zinc');
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>('dark');
  const [headingFont, setHeadingFont] = useState('system');
  const [bodyFont, setBodyFont] = useState('system');
  const [radius, setRadius] = useState('0.5');
  const [contentPadding, setContentPadding] = useState('1.5');
  const [cardPadding, setCardPadding] = useState('1.5');
  const [cardColor, setCardColor] = useState('');
  const [accentColor, setAccentColor] = useState('#2563eb');
  const [buttonColor, setButtonColor] = useState('');
  const [loaded, setLoaded] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Load saved settings
  useEffect(() => {
    fetch('/_ensemble/core/brand/tokens/custom')
      .then((res) => res.json() as Promise<{ data?: Array<{ key: string; value: string }> }>)
      .then((result) => {
        for (const token of result.data || []) {
          switch (token.key) {
            case 'baseColor': setBaseColor(token.value); break;
            case 'themeMode': setThemeMode(token.value as 'light' | 'dark' | 'system'); break;
            case 'headingFont': setHeadingFont(token.value); break;
            case 'bodyFont': setBodyFont(token.value); break;
            case 'radius': setRadius(token.value); break;
            case 'contentPadding': setContentPadding(token.value); break;
            case 'cardPadding': setCardPadding(token.value); break;
            case 'cardColor': setCardColor(token.value); break;
            case 'accentColor': setAccentColor(token.value); break;
            case 'buttonColor': setButtonColor(token.value); break;
          }
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  // Auto-save with debounce, then reload CSS
  const autoSave = useCallback((tokens: Record<string, string>) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch('/_ensemble/brand/tokens', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: 'custom', tokens }),
        });
        if (!res.ok) throw new Error('Save failed');

        // Preload new CSS, then swap
        const newHref = `/_ensemble/brand/css?t=${Date.now()}`;
        const preload = document.createElement('link');
        preload.rel = 'stylesheet';
        preload.href = newHref;
        preload.onload = () => {
          const old = document.querySelector('link[href*="/_ensemble/brand/css"]:not([href="' + newHref + '"])') as HTMLLinkElement | null;
          if (old) old.remove();
        };
        document.head.appendChild(preload);
      } catch {
        toast.error('Failed to save setting');
      }
    }, 500);
  }, []);

  // Toggle dark class for instant preview
  useEffect(() => {
    let resolved: 'light' | 'dark' = 'dark';
    if (themeMode === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    } else {
      resolved = themeMode;
    }
    if (resolved === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [themeMode]);

  // Live-preview for non-color settings
  useEffect(() => {
    document.documentElement.style.setProperty('--radius', `${radius}rem`);
    document.documentElement.style.setProperty('--content-padding', `${contentPadding}rem`);
    document.documentElement.style.setProperty('--card-padding', `${cardPadding}rem`);

    // Accent color → sets both HSL vars AND resolved color vars
    if (accentColor) {
      const hsl = hexToHsl(accentColor);
      if (hsl) {
        const isLight = isLightColor(accentColor);
        const fg = isLight ? '0 0% 9%' : '0 0% 98%';
        const fgColor = isLight ? 'hsl(0 0% 9%)' : 'hsl(0 0% 98%)';
        // Set the HSL triplet vars (for brand/css compat)
        document.documentElement.style.setProperty('--primary', hsl);
        document.documentElement.style.setProperty('--primary-foreground', fg);
        document.documentElement.style.setProperty('--sidebar-primary', hsl);
        document.documentElement.style.setProperty('--sidebar-primary-foreground', fg);
        document.documentElement.style.setProperty('--ring', hsl);
        // Also set the resolved Tailwind v4 color vars directly
        document.documentElement.style.setProperty('--color-primary', `hsl(${hsl})`);
        document.documentElement.style.setProperty('--color-primary-foreground', fgColor);
        document.documentElement.style.setProperty('--color-sidebar-primary', `hsl(${hsl})`);
        document.documentElement.style.setProperty('--color-sidebar-primary-foreground', fgColor);
        document.documentElement.style.setProperty('--color-ring', `hsl(${hsl})`);
        document.documentElement.style.setProperty('--color-accent', accentColor);
      }
    }

    // Card color override with auto foreground
    if (cardColor) {
      const hsl = hexToHsl(cardColor);
      if (hsl) {
        const isLight = isLightColor(cardColor);
        const fg = isLight ? '0 0% 9%' : '0 0% 98%';
        const mutedFg = isLight ? '0 0% 40%' : '0 0% 65%';
        document.documentElement.style.setProperty('--card', hsl);
        document.documentElement.style.setProperty('--card-foreground', fg);
        document.documentElement.style.setProperty('--popover', hsl);
        document.documentElement.style.setProperty('--popover-foreground', fg);
        document.documentElement.style.setProperty('--muted-foreground', mutedFg);
      }
    } else {
      document.documentElement.style.removeProperty('--card');
      document.documentElement.style.removeProperty('--card-foreground');
      document.documentElement.style.removeProperty('--popover');
      document.documentElement.style.removeProperty('--popover-foreground');
      document.documentElement.style.removeProperty('--muted-foreground');
    }
    // Button color (falls back to accent if not set)
    const btnColor = buttonColor || accentColor;
    document.documentElement.style.setProperty('--button-bg', btnColor);
    document.documentElement.style.setProperty('--button-fg', isLightColor(btnColor) ? 'hsl(0 0% 9%)' : 'hsl(0 0% 98%)');
  }, [radius, contentPadding, cardPadding, cardColor, accentColor, buttonColor]);

  // Dynamic Google Font loading
  useEffect(() => {
    const FONT_CSS: Record<string, string> = {
      system: 'system-ui, -apple-system, sans-serif',
      inter: '"Inter", system-ui, sans-serif',
      'dm-sans': '"DM Sans", system-ui, sans-serif',
      manrope: '"Manrope", system-ui, sans-serif',
      geist: '"Geist", system-ui, sans-serif',
      roboto: '"Roboto", system-ui, sans-serif',
    };
    document.documentElement.style.setProperty('--font-heading', FONT_CSS[headingFont] || FONT_CSS.system);
    document.documentElement.style.setProperty('--font-body', FONT_CSS[bodyFont] || FONT_CSS.system);

    const fontsToLoad = [headingFont, bodyFont]
      .filter((f) => f !== 'system')
      .map((f) => FONT_OPTIONS.find((o) => o.value === f)?.label)
      .filter((f): f is string => !!f);
    if (fontsToLoad.length > 0) {
      const linkId = 'ensemble-dynamic-fonts';
      let link = document.getElementById(linkId) as HTMLLinkElement | null;
      if (!link) { link = document.createElement('link'); link.id = linkId; link.rel = 'stylesheet'; document.head.appendChild(link); }
      link.href = `https://fonts.googleapis.com/css2?${[...new Set(fontsToLoad)].map((f) => `family=${f.replace(/ /g, '+')}:wght@300;400;500;600;700`).join('&')}&display=swap`;
    }
  }, [headingFont, bodyFont]);

  const allTokens = () => ({ baseColor, themeMode, headingFont, bodyFont, radius, contentPadding, cardPadding, cardColor, accentColor, buttonColor });
  const update = (key: string, value: string, setter: (v: string) => void) => {
    setter(value);
    autoSave({ ...allTokens(), [key]: value });
  };

  // Selection style — uses button color (or accent) for selected state
  const btnBg = buttonColor || accentColor;
  const btnFg = isLightColor(btnBg) ? '#000' : '#fff';
  const selStyle = (selected: boolean): React.CSSProperties | undefined =>
    selected ? { backgroundColor: btnBg, color: btnFg, borderColor: btnBg } : undefined;
  const selClass = (selected: boolean) =>
    selected
      ? 'border-2'
      : 'border-input bg-card hover:bg-accent hover:text-accent-foreground border-2';

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        {/* Theme */}
        <Card>
          <CardHeader>
            <CardTitle>Theme</CardTitle>
            <CardDescription>Light, dark, or follow system preference</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              {([
                { value: 'light', label: 'Light', icon: <SunIcon /> },
                { value: 'dark', label: 'Dark', icon: <MoonIcon /> },
                { value: 'system', label: 'System', icon: <MonitorIcon /> },
              ] as const).map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => update('themeMode', mode.value, setThemeMode as (v: string) => void)}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 p-3 text-sm font-medium transition-all ${selClass(themeMode === mode.value)}`}
                  style={selStyle(themeMode === mode.value)}
                >
                  {mode.icon}
                  <span>{mode.label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Base Color */}
        <Card>
          <CardHeader>
            <CardTitle>Color</CardTitle>
            <CardDescription>Base neutral palette for the workspace</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {([
                { value: 'zinc', label: 'Zinc', swatch: 'bg-zinc-500' },
                { value: 'slate', label: 'Slate', swatch: 'bg-slate-500' },
                { value: 'stone', label: 'Stone', swatch: 'bg-stone-500' },
                { value: 'gray', label: 'Gray', swatch: 'bg-gray-500' },
                { value: 'neutral', label: 'Neutral', swatch: 'bg-neutral-500' },
              ]).map((c) => (
                <button
                  key={c.value}
                  onClick={() => update('baseColor', c.value, setBaseColor)}
                  className={`flex items-center gap-2 rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition-all ${selClass(baseColor === c.value)}`}
                  style={selStyle(baseColor === c.value)}
                >
                  <div className={`h-4 w-4 rounded-full ${c.swatch}`} />
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Button Color — above Accent */}
        <ColorPresetCard
          title="Button Color"
          description="Primary button background (text auto-adjusts)"
          value={buttonColor}
          presets={COLOR_PRESETS}
          onChange={(v) => update('buttonColor', v, setButtonColor)}
          fallbackLabel="Using accent color"
          onReset={() => update('buttonColor', '', setButtonColor)}
          fallbackValue={accentColor}
        />

        {/* Accent Color */}
        <ColorPresetCard
          title="Accent Color"
          description="Badge, tabs, slider, hover states, focus rings"
          value={accentColor}
          presets={COLOR_PRESETS}
          onChange={(v) => update('accentColor', v, setAccentColor)}
        />

        {/* Radius */}
        <Card>
          <CardHeader>
            <CardTitle>Radius</CardTitle>
            <CardDescription>Corner rounding</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {['0', '0.3', '0.5', '0.75', '1'].map((r) => (
                <button
                  key={r}
                  onClick={() => update('radius', r, setRadius)}
                  className={`flex-1 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all ${selClass(radius === r)}`}
                  style={selStyle(radius === r)}
                >
                  {r}
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
            <CardDescription>Font families</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Heading Font</Label>
              <Select value={headingFont} onValueChange={(v) => update('headingFont', v, setHeadingFont)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Body Font</Label>
              <Select value={bodyFont} onValueChange={(v) => update('bodyFont', v, setBodyFont)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Spacing */}
        <Card>
          <CardHeader>
            <CardTitle>Spacing</CardTitle>
            <CardDescription>Canvas and card padding</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Canvas Padding</Label>
                <span className="text-xs font-mono text-muted-foreground">{contentPadding}rem</span>
              </div>
              <Slider
                value={[parseFloat(contentPadding) * 4]}
                min={2} max={12} step={1}
                onValueChange={([v]) => update('contentPadding', (v / 4).toFixed(2), setContentPadding)}
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Card Padding</Label>
                <span className="text-xs font-mono text-muted-foreground">{cardPadding}rem</span>
              </div>
              <Slider
                value={[parseFloat(cardPadding) * 4]}
                min={2} max={12} step={1}
                onValueChange={([v]) => update('cardPadding', (v / 4).toFixed(2), setCardPadding)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Card Color */}
        <Card>
          <CardHeader>
            <CardTitle>Card Color</CardTitle>
            <CardDescription>Card/surface background (text auto-adjusts)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <label className="h-10 w-10 rounded-lg border border-input shrink-0 cursor-pointer overflow-hidden">
                <input type="color" value={cardColor || '#ffffff'} onChange={(e) => update('cardColor', e.target.value, setCardColor)} className="h-14 w-14 -mt-1 -ml-1 cursor-pointer border-0" />
              </label>
              <div className="flex-1">
                <p className="text-sm font-mono">{cardColor || 'Using base color default'}</p>
                {cardColor && (
                  <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => update('cardColor', '', setCardColor)}>Reset to default</button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center">Changes save automatically</p>
      </div>
    </div>
  );
}

function ColorPresetCard({ title, description, value, presets, onChange, fallbackLabel, onReset, fallbackValue }: {
  title: string; description: string; value: string;
  presets: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
  fallbackLabel?: string; onReset?: () => void; fallbackValue?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {presets.map((c) => (
            <button
              key={c.value}
              onClick={() => onChange(c.value)}
              className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all ${
                value === c.value ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-input hover:border-blue-300'
              }`}
            >
              <div className="h-4 w-4 rounded-full" style={{ backgroundColor: c.value }} />
              <span>{c.label}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-3">
          <label className="h-8 w-8 rounded-lg border border-input shrink-0 cursor-pointer overflow-hidden">
            <input type="color" value={value || fallbackValue || '#000000'} onChange={(e) => onChange(e.target.value)} className="h-12 w-12 -mt-1 -ml-1 cursor-pointer border-0" />
          </label>
          <span className="text-xs font-mono text-muted-foreground">{value || fallbackLabel || ''}</span>
          {onReset && value && (
            <button className="text-xs text-muted-foreground hover:text-foreground ml-auto" onClick={onReset}>Reset</button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const SunIcon = () => <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>;
const MoonIcon = () => <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>;
const MonitorIcon = () => <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>;

/** Convert hex to HSL string for CSS (e.g., "240 10% 3.9%") */
function hexToHsl(hex: string): string | null {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  if (isNaN(r)) return null;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Check if a hex color is "light" (luminance > 0.5) */
function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.5;
}
