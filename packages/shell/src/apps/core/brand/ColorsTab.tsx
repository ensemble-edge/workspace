/**
 * Colors Tab — Named color groups with visual swatch editor.
 *
 * Each group (e.g., "Slate", "Gold", "Vermillion") has a name,
 * a base color, and auto-generated shades that can be manually overridden.
 * Semantic colors (success/error/warning/info) are a built-in group.
 */

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';

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
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
  toast,
} from '@ensemble-edge/ui';

import { generatePalette, getRelativeLuminance } from './color-utils';

interface ColorGroup {
  slug: string;
  label: string;
  colors: Record<string, string>;
}

interface SavedToken {
  key: string;
  value: string;
  group_slug: string | null;
  label: string | null;
}

export function ColorsTab() {
  // Brand core colors (required — auto-generate palettes)
  const [brandPrimary, setBrandPrimary] = useState('#3b82f6');
  const [brandSecondary, setBrandSecondary] = useState('#1e293b');
  const [brandAccent, setBrandAccent] = useState('#ef4444');

  const [groups, setGroups] = useState<ColorGroup[]>([]);
  const [semanticColors, setSemanticColors] = useState({
    success: '#5B8A72',
    'success-light': '#E8F5EE',
    info: '#6B8FAD',
    'info-light': '#EBF2F7',
    warning: '#CB9661',
    'warning-light': '#FEF3E7',
    error: '#C62828',
    'error-light': '#FDEAEA',
  });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load saved color groups + tokens from DB
  useEffect(() => {
    Promise.all([
      fetch('/_ensemble/core/brand/groups').then((r) => r.json() as Promise<{ data?: Array<{ slug: string; label: string; category: string }> }>),
      fetch('/_ensemble/core/brand/tokens/colors').then((r) => r.json() as Promise<{ data?: SavedToken[] }>),
    ]).then(([groupsRes, tokensRes]) => {
      const savedGroups = (groupsRes.data || []).filter((g) => g.category === 'colors');
      const savedTokens = tokensRes.data || [];

      // Build color groups from saved tokens
      const groupMap = new Map<string, ColorGroup>();
      for (const g of savedGroups) {
        groupMap.set(g.slug, { slug: g.slug, label: g.label, colors: {} });
      }

      for (const token of savedTokens) {
        if (token.group_slug && groupMap.has(token.group_slug)) {
          const shade = token.key.split('.').slice(1).join('.');
          if (shade) {
            groupMap.get(token.group_slug)!.colors[shade] = token.value;
          }
        } else if (token.key.startsWith('semantic.')) {
          const semanticKey = token.key.replace('semantic.', '');
          setSemanticColors((prev) => ({ ...prev, [semanticKey]: token.value }));
        } else if (token.key === 'brand-primary') {
          setBrandPrimary(token.value);
        } else if (token.key === 'brand-secondary') {
          setBrandSecondary(token.value);
        } else if (token.key === 'brand-accent') {
          setBrandAccent(token.value);
        }
      }

      const loadedGroups = Array.from(groupMap.values());
      setGroups(loadedGroups.length > 0 ? loadedGroups : getDefaultGroups());
      setLoaded(true);
    }).catch(() => {
      setGroups(getDefaultGroups());
      setLoaded(true);
    });
  }, []);

  // Save a brand core color + auto-generate its palette as a color group
  const updateBrandColor = async (key: string, value: string, setter: (v: string) => void) => {
    setter(value);
    try {
      // Save the token
      await fetch('/_ensemble/brand/tokens', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'colors', tokens: { [key]: value } }),
      });
      // Auto-generate palette and save as color group
      const palette = generatePalette(value);
      const slug = key.replace('brand-', '');
      const label = slug.charAt(0).toUpperCase() + slug.slice(1);
      await fetch('/_ensemble/core/brand/colors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group: slug, label, colors: palette }),
      });
      // Update local groups state
      setGroups((prev) => {
        const existing = prev.findIndex((g) => g.slug === slug);
        const newGroup: ColorGroup = { slug, label, colors: palette };
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = newGroup;
          return updated;
        }
        return [newGroup, ...prev];
      });

      // If workspace theme is "brand", reload CSS so changes propagate
      const newLink = document.createElement('link');
      newLink.rel = 'stylesheet';
      newLink.href = `/_ensemble/brand/css?t=${Date.now()}`;
      newLink.onload = () => {
        const old = document.querySelector('link[href*="/_ensemble/brand/css"]:not([href="' + newLink.href + '"])') as HTMLLinkElement | null;
        if (old) old.remove();
      };
      document.head.appendChild(newLink);
    } catch {
      toast.error('Failed to save brand color');
    }
  };

  const addGroup = () => {
    const slug = `color-${Date.now()}`;
    setGroups([...groups, { slug, label: 'New Color', colors: { '500': '#6366f1' } }]);
  };

  const removeGroup = (slug: string) => {
    setGroups(groups.filter((g) => g.slug !== slug));
  };

  const updateGroupLabel = (slug: string, label: string) => {
    setGroups(groups.map((g) => g.slug === slug ? { ...g, label } : g));
  };

  const updateGroupColor = (slug: string, shade: string, value: string) => {
    setGroups(groups.map((g) =>
      g.slug === slug ? { ...g, colors: { ...g.colors, [shade]: value } } : g
    ));
  };

  const addShade = (slug: string) => {
    const group = groups.find((g) => g.slug === slug);
    if (!group) return;
    const existingShades = Object.keys(group.colors).map(Number).filter((n) => !isNaN(n));
    const nextShade = existingShades.length > 0 ? Math.max(...existingShades) + 100 : 100;
    updateGroupColor(slug, String(nextShade), '#888888');
  };

  const removeShade = (slug: string, shade: string) => {
    setGroups(groups.map((g) => {
      if (g.slug !== slug) return g;
      const { [shade]: _, ...rest } = g.colors;
      return { ...g, colors: rest };
    }));
  };

  const generateFromBase = (slug: string) => {
    const group = groups.find((g) => g.slug === slug);
    if (!group) return;
    // Find the "500" shade or first shade as base
    const base = group.colors['500'] || Object.values(group.colors)[0] || '#6366f1';
    const palette = generatePalette(base);
    const newColors: Record<string, string> = {};
    for (const [shade, hex] of Object.entries(palette)) {
      newColors[shade] = hex;
    }
    setGroups(groups.map((g) => g.slug === slug ? { ...g, colors: newColors } : g));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save each color group
      for (const group of groups) {
        const res = await fetch('/_ensemble/core/brand/colors', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            group: group.slug,
            label: group.label,
            colors: group.colors,
          }),
        });
        if (!res.ok) throw new Error(`Failed to save ${group.label}`);
      }

      // Save semantic colors
      const semRes = await fetch('/_ensemble/brand/tokens', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'colors',
          tokens: Object.fromEntries(
            Object.entries(semanticColors).map(([k, v]) => [`semantic.${k}`, v])
          ),
        }),
      });
      if (!semRes.ok) throw new Error('Failed to save semantic colors');

      toast.success('Colors saved', { description: 'All color groups have been updated.' });
    } catch (err) {
      toast.error('Failed to save', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Brand Core Colors — required */}
      <Card>
        <CardHeader>
          <CardTitle>Brand Colors</CardTitle>
          <CardDescription>Your brand's core identity — palettes are auto-generated from each pick</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 lg:grid-cols-3">
            <BrandColorPicker label="Primary" description="Main brand color" value={brandPrimary}
              onChange={(v) => updateBrandColor('brand-primary', v, setBrandPrimary)} />
            <BrandColorPicker label="Secondary" description="Supporting color" value={brandSecondary}
              onChange={(v) => updateBrandColor('brand-secondary', v, setBrandSecondary)} />
            <BrandColorPicker label="Accent" description="Action / highlight" value={brandAccent}
              onChange={(v) => updateBrandColor('brand-accent', v, setBrandAccent)} />
          </div>
        </CardContent>
      </Card>

      {/* Color Groups (auto-generated + custom) */}
      {groups.map((group) => (
        <Card key={group.slug}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <Input
                  value={group.label}
                  onChange={(e) => updateGroupLabel(group.slug, e.target.value)}
                  className="text-lg font-semibold h-auto border-0 p-0 shadow-none focus-visible:ring-0 max-w-[200px]"
                  placeholder="Color name"
                />
                <span className="text-sm text-muted-foreground">
                  {Object.keys(group.colors).length} shades
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => generateFromBase(group.slug)}>
                  Generate Palette
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeGroup(group.slug)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Swatch strip */}
            <div className="flex gap-1 overflow-hidden rounded-lg mb-4">
              {Object.entries(group.colors)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([shade, hex]) => {
                  const lum = getRelativeLuminance(hex);
                  return (
                    <div
                      key={shade}
                      className="flex flex-1 h-16 items-end justify-center pb-1 text-xs font-medium min-w-[40px] cursor-pointer relative group/swatch"
                      style={{ backgroundColor: hex, color: lum < 0.5 ? '#fff' : '#000' }}
                      title={`${shade}: ${hex}`}
                    >
                      {shade}
                    </div>
                  );
                })}
            </div>

            {/* Editable color rows */}
            <div className="grid gap-2">
              {Object.entries(group.colors)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([shade, hex]) => (
                  <div key={shade} className="flex items-center gap-3">
                    <div className="w-16 text-sm text-muted-foreground font-mono">{shade}</div>
                    <ColorInput value={hex} onChange={(v) => updateGroupColor(group.slug, shade, v)} />
                    <span className="text-xs text-muted-foreground font-mono w-20">{hex}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                      onClick={() => removeShade(group.slug, shade)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
            </div>

            <Button variant="outline" size="sm" className="mt-3" onClick={() => addShade(group.slug)}>
              <Plus className="mr-1 h-3 w-3" /> Add Shade
            </Button>
          </CardContent>
        </Card>
      ))}

      {/* Semantic Colors */}
      <Card>
        <CardHeader>
          <CardTitle>Semantic Colors</CardTitle>
          <CardDescription>Success, error, warning, and info states</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {(['success', 'info', 'warning', 'error'] as const).map((key) => (
              <div key={key} className="space-y-2">
                <Label className="capitalize">{key}</Label>
                <div className="flex items-center gap-2">
                  <ColorInput
                    value={semanticColors[key]}
                    onChange={(v) => setSemanticColors((p) => ({ ...p, [key]: v }))}
                  />
                  <span className="text-xs font-mono text-muted-foreground">{semanticColors[key]}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground capitalize">{key} Light</Label>
                  <ColorInput
                    value={semanticColors[`${key}-light` as keyof typeof semanticColors] || '#ffffff'}
                    onChange={(v) => setSemanticColors((p) => ({ ...p, [`${key}-light`]: v }))}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={addGroup} variant="outline">
          <Plus className="mr-2 h-4 w-4" /> Add Color Group
        </Button>
        <div className="flex-1" />
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save All Colors'}
        </Button>
      </div>
    </div>
  );
}

/** Inline color picker — small swatch + popover */
function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="h-8 w-8 rounded border border-border shrink-0" style={{ backgroundColor: value }} />
      </PopoverTrigger>
      <PopoverContent className="w-56">
        <div className="space-y-2">
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-24 w-full cursor-pointer rounded border-0" />
          <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="#000000" className="font-mono text-sm" />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function BrandColorPicker({ label, description, value, onChange }: {
  label: string; description: string; value: string; onChange: (v: string) => void;
}) {
  const palette = generatePalette(value);
  const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-base font-semibold">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex h-10 w-full items-center gap-3 rounded-lg border border-input bg-card px-3 text-sm hover:bg-primary/10">
            <div className="h-6 w-6 rounded ring-1 ring-inset ring-black/10" style={{ backgroundColor: value }} />
            <span className="font-mono">{value}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64">
          <div className="space-y-3">
            <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-32 w-full cursor-pointer rounded-md border-0" />
            <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="#000000" className="font-mono text-sm" />
          </div>
        </PopoverContent>
      </Popover>
      <div className="flex gap-0.5 overflow-hidden rounded-md">
        {shades.map((shade) => {
          const hex = palette[shade];
          const lum = getRelativeLuminance(hex);
          return (
            <div key={shade} className="flex h-8 flex-1 items-end justify-center pb-0.5 text-[8px] font-medium"
              style={{ backgroundColor: hex, color: lum < 0.5 ? '#fff' : '#000' }} title={`${shade}: ${hex}`}>
              {shade}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getDefaultGroups(): ColorGroup[] {
  return [
    {
      slug: 'primary',
      label: 'Primary',
      colors: { '100': '#dbeafe', '200': '#bfdbfe', '300': '#93c5fd', '400': '#60a5fa', '500': '#3b82f6', '600': '#2563eb', '700': '#1d4ed8', '800': '#1e40af', '900': '#1e3a8a' },
    },
    {
      slug: 'neutral',
      label: 'Neutral',
      colors: { '100': '#f5f5f5', '200': '#e5e5e5', '300': '#d4d4d4', '400': '#a3a3a3', '500': '#737373', '600': '#525252', '700': '#404040', '800': '#262626', '900': '#171717' },
    },
  ];
}
