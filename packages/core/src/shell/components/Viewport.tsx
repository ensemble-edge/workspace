/**
 * Viewport Component (New - shadcn/ui based)
 *
 * Main content area where apps render.
 * Handles client-side routing and displays the appropriate view.
 */

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { Home, Users, Palette, Settings } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Label,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  RadioGroup,
  RadioGroupItem,
  Skeleton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  toast,
} from '@ensemble-edge/ui';

import {
  currentPath,
  workspaceName,
  isAuthenticated,
  authLoading,
  navigate,
  theme,
  applyTheme,
} from '../state';

/**
 * Route configuration for built-in pages.
 */
interface Route {
  path: string | RegExp;
  component: () => JSX.Element;
}

/**
 * Built-in routes for the shell.
 */
const routes: Route[] = [
  { path: '/', component: HomePage },
  { path: '/people', component: PeoplePage },
  { path: '/brand', component: BrandPage },
  { path: '/settings', component: SettingsPage },
  { path: '/apps', component: AppsPage },
  { path: /^\/apps\/[\w-]+$/, component: AppViewPage },
];

export function Viewport() {
  useSignals();
  const path = currentPath.value;
  const loading = authLoading.value;
  const authenticated = isAuthenticated.value;

  // Redirect to login if not authenticated
  if (!loading && !authenticated && path !== '/login') {
    window.location.href = '/login';
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    );
  }

  // Find matching route
  const route = routes.find((r) => {
    if (typeof r.path === 'string') {
      return r.path === path;
    }
    return r.path.test(path);
  });

  const Component = route?.component ?? NotFoundPage;

  return (
    <div className="flex flex-1 flex-col">
      {loading ? <LoadingState /> : <Component />}
    </div>
  );
}

/**
 * Loading state while auth is initializing.
 */
function LoadingState() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

/**
 * Home page (default landing).
 */
function HomePage() {
  useSignals();
  const name = workspaceName.value;
  const authenticated = isAuthenticated.value;

  const handleNav = (path: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(path);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome to {name}</h1>
        <p className="text-muted-foreground">
          {authenticated
            ? 'Your workspace is ready. Select an app from the sidebar to get started.'
            : 'Please log in to access your workspace.'}
        </p>
      </div>

      {!authenticated && (
        <Button asChild>
          <a href="/login">Log in</a>
        </Button>
      )}

      {authenticated && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={handleNav('/people')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">People</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <CardDescription>Manage team members and permissions</CardDescription>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={handleNav('/brand')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Brand</CardTitle>
              <Palette className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <CardDescription>Customize colors, fonts, and styling</CardDescription>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={handleNav('/settings')}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Settings</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <CardDescription>Configure workspace settings</CardDescription>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

/**
 * People page placeholder.
 */
function PeoplePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">People</h1>
        <p className="text-muted-foreground">
          Manage workspace members, roles, and permissions.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>Invite and manage your team members.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Users className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-muted-foreground">People management coming soon</p>
        </CardContent>
      </Card>
    </div>
  );
}

/* =============================================================================
   Brand Manager Page

   The Brand Manager allows workspace admins to customize the visual identity:
   - Brand Tab: company-level brand colors and logo
   - Workspace Tab: UI configuration (style, colors, fonts, radius, etc.)
   ============================================================================= */

/**
 * Brand page - Full brand identity editor with tabbed sections.
 */
function BrandPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Brand</h1>
        <p className="text-muted-foreground">
          Customize your workspace's visual identity
        </p>
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="brand" className="w-full">
        <TabsList variant="line" className="mb-6">
          <TabsTrigger value="brand">Brand</TabsTrigger>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
        </TabsList>

        <TabsContent value="brand">
          <BrandTab />
        </TabsContent>

        <TabsContent value="workspace">
          <WorkspaceTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* =============================================================================
   Brand Tab - Company-level brand configuration
   ============================================================================= */

/**
 * Brand Tab - Company-level brand colors and identity.
 */
function BrandTab() {
  useSignals();
  const currentTheme = theme.value;
  const [accentColor, setAccentColor] = useState(currentTheme?.colors?.accent ?? '#3B82F6');
  const [baseTheme, setBaseTheme] = useState<'light' | 'dark'>('dark');
  const [saving, setSaving] = useState(false);

  // Generate palette variants from accent color
  const palette = generatePalette(accentColor);

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
          tokens: {
            accent: accentColor,
          },
        }),
      });

      if (!response.ok) throw new Error('Failed to save');
      applyTheme();
      toast.success('Brand settings saved', {
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
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Color Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle>Colors</CardTitle>
          <CardDescription>Primary accent color for your workspace</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Accent Color Picker */}
          <div className="space-y-2">
            <Label>Accent Color</Label>
            <ColorPicker value={accentColor} onChange={setAccentColor} />
            <p className="text-sm text-muted-foreground">
              Used for buttons, links, and interactive elements
            </p>
          </div>

          {/* Palette Preview */}
          <div className="space-y-2">
            <Label>Generated Palette</Label>
            <PaletteSwatches palette={palette} />
          </div>

          {/* Base Theme Selection */}
          <div className="space-y-3">
            <Label>Base Theme</Label>
            <div className="grid grid-cols-2 gap-4">
              <ThemeOption
                value="dark"
                label="Dark"
                description="Dark surfaces on warm canvas"
                selected={baseTheme === 'dark'}
                onClick={() => setBaseTheme('dark')}
              />
              <ThemeOption
                value="light"
                label="Light"
                description="Light cards on warm canvas"
                selected={baseTheme === 'light'}
                onClick={() => setBaseTheme('light')}
              />
            </div>
          </div>
        </CardContent>

        <CardFooter>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardFooter>
      </Card>

      {/* Preview Card */}
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>Live preview of your brand settings</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemePreview accentColor={accentColor} baseTheme={baseTheme} />
        </CardContent>
      </Card>
    </div>
  );
}

/* =============================================================================
   Workspace Tab - UI Configuration (like shadcn themes customizer)
   ============================================================================= */

/**
 * Workspace Tab - UI configuration options similar to shadcn themes customizer.
 * Includes: Style, Base Color, Theme, Chart Color, Heading, Font, Icon Library, Radius, Menu styles
 *
 * Changes are applied in REAL-TIME as the user selects options.
 */
function WorkspaceTab() {
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

  // Apply base color in real-time (updates CSS variables)
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
          category: 'workspace-ui',
          tokens: {
            style,
            baseColor,
            themeMode,
            chartColor,
            headingFont,
            bodyFont,
            iconLibrary,
            radius,
            menuStyle,
            menuAccent,
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

  // Base color options
  const baseColors = [
    { value: 'zinc', label: 'Zinc', color: '#71717a' },
    { value: 'slate', label: 'Slate', color: '#64748b' },
    { value: 'stone', label: 'Stone', color: '#78716c' },
    { value: 'gray', label: 'Gray', color: '#6b7280' },
    { value: 'neutral', label: 'Neutral', color: '#737373' },
  ];

  // Chart color options
  const chartColors = [
    { value: 'blue', label: 'Blue', color: '#3b82f6' },
    { value: 'green', label: 'Green', color: '#22c55e' },
    { value: 'orange', label: 'Orange', color: '#f97316' },
    { value: 'rose', label: 'Rose', color: '#f43f5e' },
    { value: 'violet', label: 'Violet', color: '#8b5cf6' },
  ];

  // Radius options
  const radiusOptions = [
    { value: '0', label: '0' },
    { value: '0.3', label: '0.3' },
    { value: '0.5', label: '0.5' },
    { value: '0.75', label: '0.75' },
    { value: '1', label: '1.0' },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* UI Configuration Card */}
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
                  <div
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
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
                  <div
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
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
                <SelectTrigger>
                  <SelectValue placeholder="Select font" />
                </SelectTrigger>
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
                <SelectTrigger>
                  <SelectValue placeholder="Select font" />
                </SelectTrigger>
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
              <SelectTrigger>
                <SelectValue placeholder="Select icon library" />
              </SelectTrigger>
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
            {/* Visual preview of current radius */}
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
                <SelectTrigger>
                  <SelectValue placeholder="Select style" />
                </SelectTrigger>
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
                <SelectTrigger>
                  <SelectValue placeholder="Select accent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="secondary">Secondary</SelectItem>
                  <SelectItem value="muted">Muted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? 'Saving...' : 'Save Workspace Settings'}
        </Button>
      </div>
    </div>
  );
}

/* =============================================================================
   Color Utility Components and Functions
   ============================================================================= */

/**
 * Color picker component with hex input and visual picker.
 */
function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex h-10 w-full items-center gap-3 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background hover:bg-accent">
          <div
            className="h-6 w-6 rounded border border-border"
            style={{ backgroundColor: value }}
          />
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

/**
 * Calculate relative luminance per WCAG 2.1.
 */
function getRelativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.5;

  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Convert hex to RGB.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Palette interface for color shades.
 */
interface Palette {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
}

/**
 * Palette swatches component.
 */
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
            className={`flex h-10 flex-1 items-center justify-center text-xs font-medium ${
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

/**
 * Generate a full palette from a single accent color.
 */
function generatePalette(hex: string): Palette {
  const hsl = hexToHsl(hex);
  if (!hsl) {
    return {
      50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd',
      400: '#60a5fa', 500: hex, 600: '#2563eb', 700: '#1d4ed8',
      800: '#1e40af', 900: '#1e3a8a',
    };
  }

  const { h, s } = hsl;
  const lightnesses: Record<number, number> = {
    50: 97, 100: 94, 200: 86, 300: 76, 400: 64,
    500: 50, 600: 42, 700: 35, 800: 28, 900: 22,
  };

  return {
    50: hslToHex(h, s, lightnesses[50]),
    100: hslToHex(h, s, lightnesses[100]),
    200: hslToHex(h, s, lightnesses[200]),
    300: hslToHex(h, s, lightnesses[300]),
    400: hslToHex(h, s, lightnesses[400]),
    500: hslToHex(h, s, lightnesses[500]),
    600: hslToHex(h, s, lightnesses[600]),
    700: hslToHex(h, s, lightnesses[700]),
    800: hslToHex(h, s, lightnesses[800]),
    900: hslToHex(h, s, lightnesses[900]),
  };
}

/**
 * Convert hex to HSL.
 */
function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;

  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: l * 100 };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
    case g: h = ((b - r) / d + 2) / 6; break;
    case b: h = ((r - g) / d + 4) / 6; break;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Convert HSL to hex.
 */
function hslToHex(h: number, s: number, l: number): string {
  h /= 360;
  s /= 100;
  l /= 100;

  const hueToRgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hueToRgb(p, q, h + 1/3);
    g = hueToRgb(p, q, h);
    b = hueToRgb(p, q, h - 1/3);
  }

  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Theme option button for light/dark selection.
 */
function ThemeOption({
  value,
  label,
  description,
  selected,
  onClick,
}: {
  value: string;
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start rounded-lg border-2 p-4 text-left transition-colors ${
        selected
          ? 'border-primary bg-primary/5'
          : 'border-muted hover:border-primary/50'
      }`}
    >
      {/* Mini preview */}
      <div className={`mb-3 flex h-20 w-full overflow-hidden rounded-md ${
        value === 'dark' ? 'bg-zinc-900' : 'bg-zinc-100'
      }`}>
        <div className={`w-8 ${value === 'dark' ? 'bg-zinc-800' : 'bg-zinc-200'}`} />
        <div className="flex flex-1 flex-col gap-1 p-2">
          <div className={`h-2 w-12 rounded ${value === 'dark' ? 'bg-zinc-700' : 'bg-zinc-300'}`} />
          <div className={`h-6 rounded ${value === 'dark' ? 'bg-zinc-800' : 'bg-white'}`} />
        </div>
      </div>
      <span className="font-medium">{label}</span>
      <span className="text-sm text-muted-foreground">{description}</span>
    </button>
  );
}

/**
 * Theme preview component showing the brand in context.
 */
function ThemePreview({
  accentColor,
  baseTheme,
}: {
  accentColor: string;
  baseTheme: 'light' | 'dark';
}) {
  const isDark = baseTheme === 'dark';

  return (
    <div className={`overflow-hidden rounded-lg border ${
      isDark ? 'bg-zinc-900 text-zinc-100' : 'bg-white text-zinc-900'
    }`}>
      <div className="flex h-48">
        {/* Mini sidebar */}
        <div className={`w-12 border-r p-2 ${
          isDark ? 'border-zinc-800 bg-zinc-950' : 'border-zinc-200 bg-zinc-50'
        }`}>
          <div className="mb-3 flex h-6 w-6 items-center justify-center rounded text-xs font-bold" style={{ backgroundColor: accentColor, color: '#fff' }}>
            W
          </div>
          <div className={`mb-2 h-2 w-full rounded ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`} />
          <div className="mb-2 h-2 w-full rounded" style={{ backgroundColor: accentColor }} />
          <div className={`h-2 w-full rounded ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`} />
        </div>

        {/* Content area */}
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
          <button
            className="mt-3 rounded-md px-3 py-1.5 text-sm font-medium text-white"
            style={{ backgroundColor: accentColor }}
          >
            Create New
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Settings page placeholder.
 */
function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure workspace settings and preferences.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Workspace Settings</CardTitle>
          <CardDescription>General workspace configuration options.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <Settings className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-muted-foreground">Settings panel coming soon</p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Apps page - list installed guest apps.
 */
function AppsPage() {
  const [apps, setApps] = useState<Array<{
    id: string;
    name: string;
    version: string;
    category: string;
    enabled: boolean;
    icon?: string;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/_ensemble/apps')
      .then((res) => res.json() as Promise<{ data?: typeof apps }>)
      .then((data) => {
        setApps(data.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleAppClick = (appId: string) => {
    navigate(`/apps/${appId}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Apps</h1>
        <p className="text-muted-foreground">
          Manage installed apps and connectors
        </p>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-10 w-10 rounded-lg" />
                <Skeleton className="h-4 w-24" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : apps.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/50">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            <p className="mt-4 text-muted-foreground">No apps installed yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <Card
              key={app.id}
              className="cursor-pointer transition-colors hover:bg-accent"
              onClick={() => handleAppClick(app.id)}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-lg">
                    {app.icon || '📦'}
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">{app.name}</CardTitle>
                    <CardDescription className="text-xs">
                      {app.category} • v{app.version}
                    </CardDescription>
                  </div>
                  <div className={`rounded-full px-2 py-1 text-xs ${
                    app.enabled
                      ? 'bg-green-500/10 text-green-500'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {app.enabled ? 'Active' : 'Disabled'}
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * App view page - render a guest app in an iframe.
 */
function AppViewPage() {
  useSignals();
  const path = currentPath.value;
  const appId = path.split('/')[2];
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [appInfo, setAppInfo] = useState<{ name: string; id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/_ensemble/apps/${appId}/manifest`)
      .then((res) => {
        if (!res.ok) throw new Error('App not found');
        return res.json() as Promise<{ name?: string }>;
      })
      .then((manifest) => {
        setAppInfo({ name: manifest.name || appId, id: appId });
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, [appId]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading {appId}...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center py-8">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-destructive">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <h2 className="mt-4 text-lg font-semibold">Unable to load app</h2>
            <p className="mt-1 text-muted-foreground">{error}</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/apps')}>
              ← Back to Apps
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const appUrl = `/_ensemble/apps/${appId}/`;

  return (
    <div className="flex flex-1">
      <iframe
        ref={iframeRef}
        src={appUrl}
        className="h-full w-full border-0"
        title={appInfo?.name || appId}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  );
}

/**
 * 404 page.
 */
function NotFoundPage() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Card className="max-w-md">
        <CardContent className="flex flex-col items-center py-8">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <h1 className="mt-4 text-xl font-semibold">Page not found</h1>
          <p className="mt-1 text-muted-foreground">
            The page you're looking for doesn't exist.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/')}>
            ← Back to home
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
