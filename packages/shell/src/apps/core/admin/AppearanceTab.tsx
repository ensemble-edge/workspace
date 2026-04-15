/**
 * Appearance Tab — Workspace UI configuration
 *
 * Every change auto-saves and reloads the CSS endpoint so the
 * full theme (both light and dark scales) updates immediately.
 *
 * How theming works:
 * - /_ensemble/brand/css emits :root {} (light) and .dark {} (dark) CSS blocks
 * - Adding/removing the 'dark' class on <html> switches between them
 * - This tab toggles the class and saves the preference
 * - Base color, radius, fonts, chart color, card color are all in the CSS endpoint
 * - On save, we reload the CSS <link> to pick up new values instantly
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
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Slider,
  toast,
} from '@ensemble-edge/ui';

const CHART_COLORS: Record<string, string> = {
  blue: '220 70% 50%', green: '160 60% 45%', orange: '30 80% 55%',
  rose: '340 75% 55%', violet: '280 65% 60%',
};

const FONT_OPTIONS = [
  { value: 'system', label: 'System Default' },
  { value: 'inter', label: 'Inter' },
  { value: 'dm-sans', label: 'DM Sans' },
  { value: 'manrope', label: 'Manrope' },
  { value: 'geist', label: 'Geist' },
  { value: 'roboto', label: 'Roboto' },
];

const FONT_CSS: Record<string, string> = {
  system: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  inter: '"Inter", system-ui, sans-serif',
  'dm-sans': '"DM Sans", system-ui, sans-serif',
  manrope: '"Manrope", system-ui, sans-serif',
  geist: '"Geist", system-ui, sans-serif',
  roboto: '"Roboto", system-ui, sans-serif',
};

export function AppearanceTab() {
  const [baseColor, setBaseColor] = useState('zinc');
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>('dark');
  const [chartColor, setChartColor] = useState('blue');
  const [headingFont, setHeadingFont] = useState('system');
  const [bodyFont, setBodyFont] = useState('system');
  const [radius, setRadius] = useState('0.5');
  const [cardColorLight, setCardColorLight] = useState('');
  const [cardColorDark, setCardColorDark] = useState('');
  const [spacing, setSpacing] = useState('0.25');
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
            case 'chartColor': setChartColor(token.value); break;
            case 'headingFont': setHeadingFont(token.value); break;
            case 'bodyFont': setBodyFont(token.value); break;
            case 'radius': setRadius(token.value); break;
            case 'cardColorLight': setCardColorLight(token.value); break;
            case 'cardColorDark': setCardColorDark(token.value); break;
            case 'spacing': setSpacing(token.value); break;
          }
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  // Auto-save with debounce, then reload CSS to pick up new theme
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

        // Preload new CSS in background, then swap (no flash)
        const newHref = `/_ensemble/brand/css?t=${Date.now()}`;
        const preload = document.createElement('link');
        preload.rel = 'stylesheet';
        preload.href = newHref;
        preload.onload = () => {
          // New CSS is loaded — remove old one
          const oldLink = document.querySelector('link[href*="/_ensemble/brand/css"]:not([href="' + newHref + '"])') as HTMLLinkElement | null;
          if (oldLink) oldLink.remove();
        };
        document.head.appendChild(preload);
      } catch (err) {
        console.error('[Appearance] Save error:', err);
        toast.error('Failed to save setting');
      }
    }, 500);
  }, []);

  // Toggle dark class when theme mode changes
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

  // Apply live-preview for settings that need instant feedback
  // (the CSS reload handles the full theme, but these kick in before the reload completes)
  useEffect(() => {
    document.documentElement.style.setProperty('--radius', `${radius}rem`);
    document.documentElement.style.setProperty('--spacing', `${spacing}rem`);
    document.documentElement.style.setProperty('--chart-1', CHART_COLORS[chartColor] || CHART_COLORS.blue);
    document.documentElement.style.setProperty('--font-heading', FONT_CSS[headingFont] || FONT_CSS.system);
    document.documentElement.style.setProperty('--font-body', FONT_CSS[bodyFont] || FONT_CSS.system);

    // Card color override — apply the one matching current theme
    const isDark = document.documentElement.classList.contains('dark');
    const activeCardColor = isDark ? cardColorDark : cardColorLight;
    if (activeCardColor) {
      const hsl = hexToHsl(activeCardColor);
      if (hsl) {
        document.documentElement.style.setProperty('--card', hsl);
        document.documentElement.style.setProperty('--popover', hsl);
      }
    } else {
      document.documentElement.style.removeProperty('--card');
      document.documentElement.style.removeProperty('--popover');
    }

    // Load Google Fonts dynamically
    const fontsToLoad = [headingFont, bodyFont]
      .filter((f) => f !== 'system')
      .map((f) => FONT_OPTIONS.find((o) => o.value === f)?.label)
      .filter((f): f is string => !!f);

    if (fontsToLoad.length > 0) {
      const uniqueFonts = [...new Set(fontsToLoad)];
      const linkId = 'ensemble-dynamic-fonts';
      let link = document.getElementById(linkId) as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
      }
      link.href = `https://fonts.googleapis.com/css2?${uniqueFonts.map((f) => `family=${f.replace(/ /g, '+')}:wght@300;400;500;600;700`).join('&')}&display=swap`;
    }
  }, [radius, spacing, chartColor, headingFont, bodyFont, cardColorLight, cardColorDark, themeMode]);

  // Update helper — sets state + auto-saves all current values
  const allTokens = () => ({ baseColor, themeMode, chartColor, headingFont, bodyFont, radius, cardColorLight, cardColorDark, spacing });
  const update = (key: string, value: string, setter: (v: string) => void) => {
    setter(value);
    autoSave({ ...allTokens(), [key]: value });
  };

  const baseColors = [
    { value: 'zinc', label: 'Zinc', color: '#71717a' },
    { value: 'slate', label: 'Slate', color: '#64748b' },
    { value: 'stone', label: 'Stone', color: '#78716c' },
    { value: 'gray', label: 'Gray', color: '#6b7280' },
    { value: 'neutral', label: 'Neutral', color: '#737373' },
  ];

  const chartColorOptions = [
    { value: 'blue', label: 'Blue', color: '#3b82f6' },
    { value: 'green', label: 'Green', color: '#22c55e' },
    { value: 'orange', label: 'Orange', color: '#f97316' },
    { value: 'rose', label: 'Rose', color: '#f43f5e' },
    { value: 'violet', label: 'Violet', color: '#8b5cf6' },
  ];

  const radiusOptions = ['0', '0.3', '0.5', '0.75', '1'];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        {/* Theme Mode */}
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
                  className={`flex-1 flex items-center justify-center gap-2 rounded-md border-2 p-3 text-sm font-medium transition-colors ${
                    themeMode === mode.value ? 'border-primary bg-primary/10' : 'border-muted hover:border-primary/50'
                  }`}
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
            <CardTitle>Base Color</CardTitle>
            <CardDescription>Neutral scale — affects backgrounds, cards, borders, and text in both light and dark modes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {baseColors.map((c) => (
                <button
                  key={c.value}
                  onClick={() => update('baseColor', c.value, setBaseColor)}
                  className={`flex items-center gap-2 rounded-md border-2 px-3 py-2 text-sm transition-colors ${
                    baseColor === c.value ? 'border-primary bg-primary/10' : 'border-muted hover:border-primary/50'
                  }`}
                >
                  <div className="h-4 w-4 rounded-full" style={{ backgroundColor: c.color }} />
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Radius */}
        <Card>
          <CardHeader>
            <CardTitle>Radius</CardTitle>
            <CardDescription>Corner rounding for cards, buttons, inputs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {radiusOptions.map((r) => (
                <button
                  key={r}
                  onClick={() => update('radius', r, setRadius)}
                  className={`flex-1 rounded-md border-2 px-3 py-2 text-sm font-medium transition-colors ${
                    radius === r ? 'border-primary bg-primary text-primary-foreground' : 'border-muted hover:border-primary/50'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Spacing (Tailwind v4 --spacing) */}
        <Card>
          <CardHeader>
            <CardTitle>Spacing</CardTitle>
            <CardDescription>Global spacing scale — affects padding, margins, and gaps</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Base Unit</Label>
              <span className="text-xs font-mono text-muted-foreground">{spacing}rem</span>
            </div>
            <Slider
              value={[parseFloat(spacing) * 100]}
              min={15}
              max={40}
              step={5}
              onValueChange={([v]) => update('spacing', (v / 100).toFixed(2), setSpacing)}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Compact</span><span>Default (0.25)</span><span>Spacious</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {/* Card Background */}
        <Card>
          <CardHeader>
            <CardTitle>Card Background</CardTitle>
            <CardDescription>Override card color for light and dark modes (optional)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CardColorPicker
              label="Light mode"
              value={cardColorLight}
              defaultPlaceholder="#ffffff"
              onChange={(v) => update('cardColorLight', v, setCardColorLight)}
              onReset={() => update('cardColorLight', '', setCardColorLight)}
            />
            <CardColorPicker
              label="Dark mode"
              value={cardColorDark}
              defaultPlaceholder="#1a1a1e"
              onChange={(v) => update('cardColorDark', v, setCardColorDark)}
              onReset={() => update('cardColorDark', '', setCardColorDark)}
            />
          </CardContent>
        </Card>

        {/* Typography */}
        <Card>
          <CardHeader>
            <CardTitle>Typography</CardTitle>
            <CardDescription>Font families for the workspace UI</CardDescription>
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

        {/* Chart Color */}
        <Card>
          <CardHeader>
            <CardTitle>Chart Color</CardTitle>
            <CardDescription>Primary color for data visualizations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {chartColorOptions.map((c) => (
                <button
                  key={c.value}
                  onClick={() => update('chartColor', c.value, setChartColor)}
                  className={`flex items-center gap-2 rounded-md border-2 px-3 py-2 text-sm transition-colors ${
                    chartColor === c.value ? 'border-primary bg-primary/10' : 'border-muted hover:border-primary/50'
                  }`}
                >
                  <div className="h-4 w-4 rounded-full" style={{ backgroundColor: c.color }} />
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center">Changes save automatically</p>
      </div>
    </div>
  );
}

function CardColorPicker({ label, value, defaultPlaceholder, onChange, onReset }: {
  label: string; value: string; defaultPlaceholder: string;
  onChange: (v: string) => void; onReset: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Popover>
        <PopoverTrigger asChild>
          <button className="h-10 w-10 rounded-md border border-border shrink-0" style={{ backgroundColor: value || 'hsl(var(--card))' }} />
        </PopoverTrigger>
        <PopoverContent className="w-56">
          <div className="space-y-2">
            <input type="color" value={value || defaultPlaceholder} onChange={(e) => onChange(e.target.value)} className="h-24 w-full cursor-pointer rounded border-0" />
            <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={defaultPlaceholder} className="font-mono text-sm" />
          </div>
        </PopoverContent>
      </Popover>
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{value || 'Base color default'}</p>
        {value && (
          <button className="text-xs text-muted-foreground hover:text-foreground" onClick={onReset}>Reset</button>
        )}
      </div>
    </div>
  );
}

// Inline SVG icons (small, no import needed)
const SunIcon = () => <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>;
const MoonIcon = () => <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>;
const MonitorIcon = () => <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>;

/** Convert hex to HSL string for CSS (e.g., "240 10% 3.9%") */
function hexToHsl(hex: string): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
