/**
 * Appearance Tab — Workspace UI configuration
 *
 * Layout:
 * 1. Theme Presets — one-click complete themes (Default, Warm, Ocean, etc.)
 * 2. Theme Mode — light / dark / system
 * 3. Primary Color — buttons, badges, checkboxes, links
 * 4. Accent Color — hover states, sidebar highlights
 * 5. Background — canvas + sidebar color overrides
 * 6. Card Color — card/surface override
 * 7. Radius — corner rounding
 * 8. Typography — heading + body fonts
 * 9. Spacing — canvas + card padding
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

// Theme preset data (shared with CSS endpoint)
const THEME_PRESETS = [
  { id: 'brand', label: 'Brand', description: 'Your brand colors', swatch: 'brand',
    primary: '', accent: '', canvas: '', sidebar: '', card: '' },
  { id: 'default', label: 'Default', description: 'Clean and neutral', swatch: '#71717a',
    primary: '#18181b', accent: '', canvas: '#ffffff', sidebar: '#f9f9f9', card: '#ffffff' },
  { id: 'warm', label: 'Warm', description: 'Cream canvas, linen cards', swatch: '#92400e',
    primary: '#92400e', accent: '#b45309', canvas: '#faf8f5', sidebar: '#f0ebe4', card: '#f5f0ea' },
  { id: 'ocean', label: 'Ocean', description: 'Blue-tinted, navy sidebar', swatch: '#1e40af',
    primary: '#2563eb', accent: '#2563eb', canvas: '#f0f7ff', sidebar: '#1a2744', card: '#eaf2fc' },
  { id: 'forest', label: 'Forest', description: 'Sage greens, natural tones', swatch: '#166534',
    primary: '#166534', accent: '#16a34a', canvas: '#f2f5f0', sidebar: '#1a2e22', card: '#ebf0e8' },
  { id: 'sunset', label: 'Sunset', description: 'Warm amber, terracotta', swatch: '#c2410c',
    primary: '#c2410c', accent: '#ea580c', canvas: '#fff8f0', sidebar: '#2d1f1a', card: '#fef0e4' },
  { id: 'midnight', label: 'Midnight', description: 'Deep purple, lavender accents', swatch: '#7c3aed',
    primary: '#7c3aed', accent: '#8b5cf6', canvas: '#f5f3ff', sidebar: '#1a1530', card: '#eeebf8' },
];

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

const BG_PRESETS = [
  { value: '#ffffff', label: 'White' },
  { value: '#faf8f5', label: 'Cream' },
  { value: '#f0f7ff', label: 'Ice' },
  { value: '#f2f5f0', label: 'Sage' },
  { value: '#fff8f0', label: 'Sand' },
  { value: '#f5f3ff', label: 'Lavender' },
  { value: '#18181b', label: 'Zinc' },
  { value: '#09090b', label: 'Black' },
];

const CARD_PRESETS = [
  { value: '#ffffff', label: 'White' },
  { value: '#f5f5f4', label: 'Warm' },
  { value: '#e2e8f0', label: 'Silver' },
  { value: '#cbd5e1', label: 'Mist' },
  { value: '#334155', label: 'Slate' },
  { value: '#1e293b', label: 'Navy' },
  { value: '#18181b', label: 'Zinc' },
  { value: '#09090b', label: 'Black' },
];

const SEMANTIC_PRESETS = {
  success: [
    { value: '#16a34a', label: 'Green' }, { value: '#5B8A72', label: 'Sage' },
    { value: '#15803d', label: 'Forest' }, { value: '#059669', label: 'Emerald' },
    { value: '#0d9488', label: 'Teal' }, { value: '#10b981', label: 'Mint' },
  ],
  warning: [
    { value: '#ca8a04', label: 'Amber' }, { value: '#d97706', label: 'Gold' },
    { value: '#ea580c', label: 'Orange' }, { value: '#f59e0b', label: 'Yellow' },
    { value: '#CB9661', label: 'Sand' }, { value: '#b45309', label: 'Bronze' },
  ],
  error: [
    { value: '#dc2626', label: 'Red' }, { value: '#C62828', label: 'Crimson' },
    { value: '#e11d48', label: 'Rose' }, { value: '#b91c1c', label: 'Dark' },
    { value: '#ef4444', label: 'Bright' }, { value: '#f43f5e', label: 'Pink' },
  ],
  info: [
    { value: '#2563eb', label: 'Blue' }, { value: '#6B8FAD', label: 'Steel' },
    { value: '#0891b2', label: 'Cyan' }, { value: '#3b82f6', label: 'Sky' },
    { value: '#6366f1', label: 'Indigo' }, { value: '#0284c7', label: 'Ocean' },
  ],
};

const FONT_OPTIONS = [
  { value: 'system', label: 'System Default' },
  { value: 'inter', label: 'Inter' },
  { value: 'dm-sans', label: 'DM Sans' },
  { value: 'manrope', label: 'Manrope' },
  { value: 'geist', label: 'Geist' },
  { value: 'roboto', label: 'Roboto' },
];

export function AppearanceTab() {
  const [themePreset, setThemePreset] = useState('default');
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>('dark');
  const [buttonColor, setButtonColor] = useState('');
  const [accentColor, setAccentColor] = useState('');
  const [canvasColor, setCanvasColor] = useState('');
  const [sidebarColor, setSidebarColor] = useState('');
  const [cardColor, setCardColor] = useState('');
  const [successColor, setSuccessColor] = useState('');
  const [warningColor, setWarningColor] = useState('');
  const [errorColor, setErrorColor] = useState('');
  const [infoColor, setInfoColor] = useState('');
  const [radius, setRadius] = useState('0.5');
  const [headingFont, setHeadingFont] = useState('system');
  const [bodyFont, setBodyFont] = useState('system');
  const [contentPadding, setContentPadding] = useState('1.5');
  const [cardPadding, setCardPadding] = useState('1.5');
  const [brandColors, setBrandColors] = useState({ primary: '#3b82f6', secondary: '#1e293b', accent: '#ef4444' });
  const [loaded, setLoaded] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Load saved settings + brand colors
  useEffect(() => {
    // Load brand colors for the "Brand" preset
    fetch('/_ensemble/core/brand/tokens/colors')
      .then((r) => r.json() as Promise<{ data?: Array<{ key: string; value: string }> }>)
      .then((result) => {
        const bc = { ...brandColors };
        for (const t of result.data || []) {
          if (t.key === 'brand-primary') bc.primary = t.value;
          if (t.key === 'brand-secondary') bc.secondary = t.value;
          if (t.key === 'brand-accent') bc.accent = t.value;
        }
        setBrandColors(bc);
      })
      .catch(() => {});

    fetch('/_ensemble/core/brand/tokens/custom')
      .then((res) => res.json() as Promise<{ data?: Array<{ key: string; value: string }> }>)
      .then((result) => {
        for (const token of result.data || []) {
          switch (token.key) {
            case 'themePreset': setThemePreset(token.value); break;
            case 'themeMode': setThemeMode(token.value as 'light' | 'dark' | 'system'); break;
            case 'buttonColor': setButtonColor(token.value); break;
            case 'accentColor': setAccentColor(token.value); break;
            case 'canvasColor': setCanvasColor(token.value); break;
            case 'sidebarColor': setSidebarColor(token.value); break;
            case 'cardColor': setCardColor(token.value); break;
            case 'successColor': setSuccessColor(token.value); break;
            case 'warningColor': setWarningColor(token.value); break;
            case 'errorColor': setErrorColor(token.value); break;
            case 'infoColor': setInfoColor(token.value); break;
            case 'radius': setRadius(token.value); break;
            case 'headingFont': setHeadingFont(token.value); break;
            case 'bodyFont': setBodyFont(token.value); break;
            case 'contentPadding': setContentPadding(token.value); break;
            case 'cardPadding': setCardPadding(token.value); break;
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

  // Toggle dark class
  useEffect(() => {
    let resolved: 'light' | 'dark' = 'dark';
    if (themeMode === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    } else {
      resolved = themeMode;
    }
    if (resolved === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [themeMode]);

  // Live-preview: spatial + fonts
  useEffect(() => {
    const el = document.documentElement;
    el.style.setProperty('--radius', `${radius}rem`);
    el.style.setProperty('--content-padding', `${contentPadding}rem`);
    el.style.setProperty('--card-padding', `${cardPadding}rem`);
  }, [radius, contentPadding, cardPadding]);

  // Live-preview: primary color
  useEffect(() => {
    if (buttonColor) {
      const hsl = hexToHsl(buttonColor);
      if (hsl) {
        const fg = isLightColor(buttonColor) ? '0 0% 9%' : '0 0% 98%';
        document.documentElement.style.setProperty('--primary', hsl);
        document.documentElement.style.setProperty('--primary-foreground', fg);
        document.documentElement.style.setProperty('--ring', hsl);
        document.documentElement.style.setProperty('--sidebar-primary', hsl);
        document.documentElement.style.setProperty('--sidebar-primary-foreground', fg);
      }
    }
  }, [buttonColor]);

  // Live-preview: canvas + sidebar + card colors
  useEffect(() => {
    const el = document.documentElement;
    if (canvasColor) {
      const hsl = hexToHsl(canvasColor);
      if (hsl) {
        el.style.setProperty('--background', hsl);
        el.style.setProperty('--foreground', isLightColor(canvasColor) ? '0 0% 9%' : '0 0% 98%');
      }
    }
    if (sidebarColor) {
      const hsl = hexToHsl(sidebarColor);
      if (hsl) {
        el.style.setProperty('--sidebar-background', hsl);
        el.style.setProperty('--sidebar-foreground', isLightColor(sidebarColor) ? '0 0% 20%' : '0 0% 90%');
      }
    }
    if (cardColor) {
      const hsl = hexToHsl(cardColor);
      if (hsl) {
        const fg = isLightColor(cardColor) ? '0 0% 9%' : '0 0% 98%';
        el.style.setProperty('--card', hsl);
        el.style.setProperty('--card-foreground', fg);
        el.style.setProperty('--popover', hsl);
        el.style.setProperty('--popover-foreground', fg);
        el.style.setProperty('--muted-foreground', isLightColor(cardColor) ? '0 0% 40%' : '0 0% 65%');
      }
    }
  }, [canvasColor, sidebarColor, cardColor]);

  // Dynamic Google Font loading
  useEffect(() => {
    const FONT_CSS: Record<string, string> = {
      system: 'system-ui, sans-serif', inter: '"Inter", sans-serif',
      'dm-sans': '"DM Sans", sans-serif', manrope: '"Manrope", sans-serif',
      geist: '"Geist", sans-serif', roboto: '"Roboto", sans-serif',
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

  const allTokens = () => ({
    themePreset, themeMode, buttonColor, accentColor,
    canvasColor, sidebarColor, cardColor,
    successColor, warningColor, errorColor, infoColor,
    radius, headingFont, bodyFont, contentPadding, cardPadding,
  });

  const update = (key: string, value: string, setter: (v: string) => void) => {
    setter(value);
    if (value === '') {
      // Resetting — clear inline styles and do immediate save+reload
      resetInlineStyles();
      saveAndReload({ ...allTokens(), [key]: value });
    } else {
      autoSave({ ...allTokens(), [key]: value });
    }
  };

  // Clear all inline style overrides and force CSS reload
  const resetInlineStyles = () => {
    const el = document.documentElement;
    const props = [
      '--primary', '--primary-foreground', '--ring',
      '--sidebar-primary', '--sidebar-primary-foreground',
      '--sidebar-background', '--sidebar-foreground',
      '--background', '--foreground',
      '--card', '--card-foreground', '--popover', '--popover-foreground',
      '--muted-foreground',
    ];
    props.forEach((p) => el.style.removeProperty(p));
  };

  // Save immediately (no debounce) and reload CSS
  const saveAndReload = async (tokens: Record<string, string>) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    try {
      const res = await fetch('/_ensemble/brand/tokens', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'custom', tokens }),
      });
      if (!res.ok) throw new Error('Save failed');
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
      toast.error('Failed to save');
    }
  };

  // Apply a theme preset
  const applyPreset = (presetId: string) => {
    setThemePreset(presetId);
    setSuccessColor(''); setWarningColor(''); setErrorColor(''); setInfoColor('');

    if (presetId === 'brand') {
      // Brand preset: populate from brand colors
      setButtonColor(brandColors.primary);
      setAccentColor(brandColors.accent);
      setCanvasColor('');
      setSidebarColor(brandColors.secondary);
      setCardColor('');
      resetInlineStyles();
      saveAndReload({
        ...allTokens(),
        themePreset: 'brand',
        buttonColor: brandColors.primary,
        accentColor: brandColors.accent,
        canvasColor: '', sidebarColor: brandColors.secondary, cardColor: '',
        successColor: '', warningColor: '', errorColor: '', infoColor: '',
      });
    } else {
      // Standard preset: clear overrides
      setButtonColor(''); setAccentColor('');
      setCanvasColor(''); setSidebarColor(''); setCardColor('');
      resetInlineStyles();
      saveAndReload({
        ...allTokens(),
        themePreset: presetId,
        buttonColor: '', accentColor: '',
        canvasColor: '', sidebarColor: '', cardColor: '',
        successColor: '', warningColor: '', errorColor: '', infoColor: '',
      });
    }
  };

  // Get the display value for a color picker — shows the preset default if no override
  const activePreset = THEME_PRESETS.find((t) => t.id === themePreset);
  const hasOverrides = !!(buttonColor || accentColor || canvasColor || sidebarColor || cardColor || successColor || warningColor || errorColor || infoColor);
  const displayValue = (override: string, presetKey: keyof typeof THEME_PRESETS[0]) =>
    override || (activePreset ? (activePreset as Record<string, string>)[presetKey as string] : '') || '';

  const selClass = (selected: boolean) =>
    selected
      ? 'border-2 bg-primary text-primary-foreground'
      : 'border-input bg-card hover:bg-primary/10 border-2';

  return (
    <div className="space-y-6">
      {/* Theme Presets */}
      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>Complete workspace theme — sets all colors at once</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {THEME_PRESETS.map((t) => (
              <button
                key={t.id}
                onClick={() => applyPreset(t.id)}
                className={`flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-all ${
                  themePreset === t.id ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-input hover:border-blue-300'
                }`}
              >
                <div className="h-8 w-8 rounded-lg ring-1 ring-inset ring-black/10 overflow-hidden"
                  style={t.swatch === 'brand'
                    ? { background: `linear-gradient(135deg, ${brandColors.primary} 33%, ${brandColors.secondary} 66%, ${brandColors.accent})` }
                    : { backgroundColor: t.swatch }
                  } />
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {t.label}
                    {themePreset === t.id && hasOverrides && (
                      <span className="ml-1 text-xs font-normal text-muted-foreground">(customized)</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{t.description}</p>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {/* Mode */}
          <Card>
            <CardHeader>
              <CardTitle>Mode</CardTitle>
              <CardDescription>Light, dark, or follow system</CardDescription>
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
                    className={`flex-1 flex items-center justify-center gap-2 rounded-lg p-3 text-sm font-medium transition-all ${selClass(themeMode === mode.value)}`}
                  >
                    {mode.icon}
                    <span>{mode.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Primary Color */}
          <ColorPresetCard
            title="Primary Color"
            description="Buttons, badges, checkboxes, links, and focus rings"
            value={buttonColor}
            displayValue={displayValue(buttonColor, 'primary')}
            presets={COLOR_PRESETS}
            onChange={(v) => update('buttonColor', v, setButtonColor)}
            fallbackLabel={activePreset ? `${activePreset.label} default` : ''}
            onReset={() => update('buttonColor', '', setButtonColor)}
          />

          {/* Accent Color */}
          <ColorPresetCard
            title="Accent Color"
            description="Sidebar highlights and hover states"
            value={accentColor}
            displayValue={displayValue(accentColor, 'accent')}
            presets={COLOR_PRESETS}
            onChange={(v) => update('accentColor', v, setAccentColor)}
            fallbackLabel={activePreset ? `${activePreset.label} default` : ''}
            onReset={() => update('accentColor', '', setAccentColor)}
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
                    className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${selClass(radius === r)}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Background Colors */}
          <Card>
            <CardHeader>
              <CardTitle>Background</CardTitle>
              <CardDescription>Canvas and sidebar background colors</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ColorRow
                label="Canvas"
                value={canvasColor}
                presets={BG_PRESETS}
                onChange={(v) => update('canvasColor', v, setCanvasColor)}
                onReset={() => update('canvasColor', '', setCanvasColor)}
              />
              <ColorRow
                label="Sidebar"
                value={sidebarColor}
                presets={BG_PRESETS}
                onChange={(v) => update('sidebarColor', v, setSidebarColor)}
                onReset={() => update('sidebarColor', '', setSidebarColor)}
              />
            </CardContent>
          </Card>

          {/* Card Color */}
          <ColorPresetCard
            title="Card Color"
            description="Card and surface backgrounds"
            value={cardColor}
            displayValue={displayValue(cardColor, 'card')}
            presets={CARD_PRESETS}
            onChange={(v) => update('cardColor', v, setCardColor)}
            fallbackLabel={activePreset ? `${activePreset.label} default` : ''}
            onReset={() => update('cardColor', '', setCardColor)}
          />

          {/* Semantic Colors */}
          <Card>
            <CardHeader>
              <CardTitle>Semantic Colors</CardTitle>
              <CardDescription>Status indicators, toasts, and validation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ColorRow label="Success" value={successColor} presets={SEMANTIC_PRESETS.success}
                onChange={(v) => update('successColor', v, setSuccessColor)}
                onReset={() => update('successColor', '', setSuccessColor)} />
              <ColorRow label="Warning" value={warningColor} presets={SEMANTIC_PRESETS.warning}
                onChange={(v) => update('warningColor', v, setWarningColor)}
                onReset={() => update('warningColor', '', setWarningColor)} />
              <ColorRow label="Error" value={errorColor} presets={SEMANTIC_PRESETS.error}
                onChange={(v) => update('errorColor', v, setErrorColor)}
                onReset={() => update('errorColor', '', setErrorColor)} />
              <ColorRow label="Info" value={infoColor} presets={SEMANTIC_PRESETS.info}
                onChange={(v) => update('infoColor', v, setInfoColor)}
                onReset={() => update('infoColor', '', setInfoColor)} />
            </CardContent>
          </Card>

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
                <Slider value={[parseFloat(contentPadding) * 4]} min={2} max={12} step={1}
                  onValueChange={([v]) => update('contentPadding', (v / 4).toFixed(2), setContentPadding)} />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Card Padding</Label>
                  <span className="text-xs font-mono text-muted-foreground">{cardPadding}rem</span>
                </div>
                <Slider value={[parseFloat(cardPadding) * 4]} min={2} max={12} step={1}
                  onValueChange={([v]) => update('cardPadding', (v / 4).toFixed(2), setCardPadding)} />
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground text-center">Changes save automatically</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function ColorPresetCard({ title, description, value, displayValue, presets, onChange, fallbackLabel, onReset }: {
  title: string; description: string; value: string; displayValue?: string;
  presets: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
  fallbackLabel?: string; onReset?: () => void;
}) {
  const shown = displayValue || value;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {presets.map((c) => (
            <button key={c.value} onClick={() => onChange(c.value)}
              className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all ${
                (value || shown) === c.value ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-input hover:border-blue-300'
              }`}>
              <div className="h-4 w-4 rounded-full ring-1 ring-inset ring-black/10" style={{ backgroundColor: c.value }} />
              <span>{c.label}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-3">
          <label className="h-8 w-8 rounded-lg border border-input shrink-0 cursor-pointer overflow-hidden">
            <input type="color" value={shown || '#000000'} onChange={(e) => onChange(e.target.value)} className="h-12 w-12 -mt-1 -ml-1 cursor-pointer border-0" />
          </label>
          <span className="text-xs font-mono text-muted-foreground">
            {value ? value : (shown ? `${shown} (${fallbackLabel || 'default'})` : fallbackLabel || '')}
          </span>
          {onReset && value && (
            <button className="text-xs text-muted-foreground hover:text-foreground ml-auto" onClick={onReset}>Reset</button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ColorRow({ label, value, presets, onChange, onReset }: {
  label: string; value: string;
  presets: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {value && <button className="text-xs text-muted-foreground hover:text-foreground" onClick={onReset}>Reset</button>}
      </div>
      <div className="flex items-center gap-2">
        <label className="h-8 w-8 rounded-lg border border-input shrink-0 cursor-pointer overflow-hidden">
          <input type="color" value={value || '#ffffff'} onChange={(e) => onChange(e.target.value)} className="h-12 w-12 -mt-1 -ml-1 cursor-pointer border-0" />
        </label>
        <div className="flex flex-wrap gap-1 flex-1">
          {presets.slice(0, 6).map((c) => (
            <button key={c.value} onClick={() => onChange(c.value)}
              className={`h-6 w-6 rounded ring-1 ring-inset ring-black/10 ${value === c.value ? 'ring-2 ring-blue-500' : ''}`}
              style={{ backgroundColor: c.value }} title={c.label} />
          ))}
        </div>
        <span className="text-xs font-mono text-muted-foreground w-16 text-right">{value || 'default'}</span>
      </div>
    </div>
  );
}

const SunIcon = () => <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>;
const MoonIcon = () => <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>;
const MonitorIcon = () => <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>;

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

function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5;
}
