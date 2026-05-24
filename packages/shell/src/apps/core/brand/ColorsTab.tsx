/**
 * Colors Tab — v0.1.55 rewrite.
 *
 * The editor for the workspace's BrandColorsDoc. Renders the new
 * unified <BrandCard mode="edit"> for the palette/neutral/gradients/
 * semantic display, plus a separate Themes section underneath for
 * the light/dark theme bindings (which aren't part of the BrandCard
 * by spec — they're configuration that *affects* what the card
 * shows, not part of the card itself).
 *
 * Architecture:
 *   - Operator's edits go into local `draft` state
 *   - "Save" PUT to /_ensemble/core/brand/colors-doc commits + emits
 *     brand.tokens.changed with the diff payload
 *   - Discard reverts draft to last-saved
 *
 * Server resolves palettes + themes + gradients via the resolver,
 * but for live editing we need to re-resolve locally as the operator
 * types. We call /resolved on load and then re-call on save.
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Sun, Moon, Wand2, Plus, Trash2, Undo2 } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SaveStatus,
  BrandCard,
  BrandTokenPicker,
  toast,
} from '@ensemble-edge/ui';
import type {
  BrandCardData, BrandCardGradient,
  ResolvedPalettes,
} from '@ensemble-edge/ui';

import { authedFetch, emitWorkspaceEvent } from '../../../state';
import { useFormStatus } from '../../../hooks/useFormStatus';

/* ──────────────────────────────────────────────────────────────
 * Local mirror of core's BrandColorsDoc types
 *
 * We could import from @ensemble-edge/core but shell ↔ core type
 * imports historically cause workspace-build issues. Local
 * declarations stay structurally compatible with the server.
 * ──────────────────────────────────────────────────────────── */

type RungName = 'dark' | 'main' | 'bright' | 'pastel' | 'faded';
type PaletteRole = 'primary' | 'secondary' | 'accent' | 'neutral';
type PaletteRungRef = `${PaletteRole}-${RungName}`;

interface Palette {
  name: string;
  main: string;
  overrides?: Partial<Record<Exclude<RungName, 'main'>, string>>;
}

interface NeutralPalette extends Palette {
  hueMode: 'branded' | 'warm' | 'cool' | 'true' | 'custom';
}

interface Gradient {
  slug: string;
  name: string;
  stops: string[];
  mode: 'linear' | 'radial';
  angle: 0 | 45 | 90 | 135 | 180;
}

interface ThemeBindings {
  canvas: string;
  surface: string;
  'text-primary': string;
  'text-muted': string;
  brand: string;
  'brand-bg': string;
  border: string;
}

interface Theme {
  bindings: ThemeBindings;
}

interface SemanticPair { main: string; light: string; }
interface SemanticColors {
  success: SemanticPair;
  info: SemanticPair;
  warning: SemanticPair;
  error: SemanticPair;
}

interface BrandColorsDoc {
  version: 1;
  palettes: {
    primary: Palette;
    secondary: Palette;
    accent: Palette;
    neutral: NeutralPalette;
  };
  gradients: Gradient[];
  themes: { light: Theme; dark?: Theme };
  semantic: SemanticColors;
}

interface ResolvedTheme {
  canvas: string;
  surface: string;
  'text-primary': string;
  'text-muted': string;
  brand: string;
  'brand-bg': string;
  border: string;
}

interface ResolvedDocResponse {
  doc: BrandColorsDoc;
  palettes: ResolvedPalettes;
  themeLight: ResolvedTheme;
  themeDark: ResolvedTheme | null;
  gradients: BrandCardGradient[];
  onColor: Record<PaletteRole, { hex: string; usedFallback: boolean }>;
}

/* ──────────────────────────────────────────────────────────────
 * Slug helper for new gradients
 * ──────────────────────────────────────────────────────────── */

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || `gradient-${Math.random().toString(36).slice(2, 6)}`;
}

/* ──────────────────────────────────────────────────────────────
 * Theme binding labels (display names for the seven roles)
 * ──────────────────────────────────────────────────────────── */

const THEME_BINDING_LABELS: Array<{ key: keyof ThemeBindings; label: string; description: string; allowAuto: boolean }> = [
  { key: 'canvas',       label: 'Canvas',       description: 'Page background',                              allowAuto: false },
  { key: 'surface',      label: 'Surface',      description: 'Cards, modals, raised areas',                  allowAuto: false },
  { key: 'text-primary', label: 'Text',         description: 'Default foreground text',                      allowAuto: true  },
  { key: 'text-muted',   label: 'Text muted',   description: 'Secondary, helper text',                       allowAuto: true  },
  { key: 'brand',        label: 'Brand',        description: 'Brand foreground (button fills, link color)',  allowAuto: false },
  { key: 'brand-bg',     label: 'Brand bg',     description: 'Subtle brand-tinted surfaces',                 allowAuto: false },
  { key: 'border',       label: 'Border',       description: 'Hairline borders, dividers',                   allowAuto: false },
];

/* ──────────────────────────────────────────────────────────────
 * Main component
 * ──────────────────────────────────────────────────────────── */

export function ColorsTab() {
  const [resolved, setResolved] = useState<ResolvedDocResponse | null>(null);
  const [draft, setDraft] = useState<BrandColorsDoc | null>(null);
  const [saved, setSaved] = useState<BrandColorsDoc | null>(null);
  const status = useFormStatus({ value: draft, mode: 'manual' });
  // One-shot undo for "Generate from light" — when set, the Undo
  // button reverts dark theme to this snapshot.
  const [undoDarkSnapshot, setUndoDarkSnapshot] = useState<Theme | null | undefined>(undefined);

  /** Reload from server (initial mount + after save). */
  const reload = useCallback(async () => {
    try {
      const r = await authedFetch('/_ensemble/core/brand/colors-doc/resolved');
      const data = await r.json() as ResolvedDocResponse;
      setResolved(data);
      setDraft(data.doc);
      setSaved(data.doc);
      status.resetBaseline(data.doc);
    } catch (err) {
      toast.error('Failed to load brand colors', {
        description: err instanceof Error ? err.message : String(err),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { reload(); }, [reload]);

  /* ──────────────────────────────────────────────────────────
   * Live-resolve draft for the BrandCard preview
   *
   * The card needs `palettes`, `gradients` (with resolved stops),
   * and `onColor`. We compute these locally from `draft` so the
   * preview updates as the operator types, without a server round-
   * trip per keystroke. The resolution math is duplicated client-
   * side via tiny helpers — kept simple because Satori isn't in
   * scope on the client; we just need approximate OkLCh rung math.
   * ────────────────────────────────────────────────────────── */
  const cardData: BrandCardData | null = useMemo(() => {
    if (!draft || !resolved) return null;
    // For each palette, build a Resolved object from draft.main +
    // overrides + a local OkLCh derivation. We rely on the server's
    // last-resolved palette as a fallback when overrides are absent
    // and the operator hasn't changed Main since last load.
    const localResolve = (role: PaletteRole): Record<RungName, string> => {
      const p = draft.palettes[role];
      const serverPalette = resolved.palettes[role];
      // If the operator hasn't changed Main since last load, use the
      // server-resolved rungs (which used the same OkLCh math we
      // would here). Cheaper + identical for the no-change path.
      if (p.main.toLowerCase() === resolved.doc.palettes[role].main.toLowerCase()
          && JSON.stringify(p.overrides ?? {}) === JSON.stringify(resolved.doc.palettes[role].overrides ?? {})) {
        return serverPalette;
      }
      // Otherwise derive client-side via the same OkLCh offsets.
      return clientDeriveRungs(p.main, p.overrides);
    };
    // Resolve primary/secondary/accent normally.
    const primary = localResolve('primary');
    const secondary = localResolve('secondary');
    const accent = localResolve('accent');
    // Neutral has hueMode-driven Main resolution. Match the server's
    // resolveNeutral() logic locally so the BrandCard preview reflects
    // hue-mode flips in real time.
    const neutralPalette = draft.palettes.neutral as NeutralPalette;
    const neutralServer = resolved.palettes.neutral;
    const neutralServerDoc = resolved.doc.palettes.neutral as NeutralPalette;
    const neutralUnchanged =
      neutralPalette.hueMode === neutralServerDoc.hueMode &&
      neutralPalette.main.toLowerCase() === neutralServerDoc.main.toLowerCase() &&
      JSON.stringify(neutralPalette.overrides ?? {}) === JSON.stringify(neutralServerDoc.overrides ?? {});
    let neutral: Record<RungName, string>;
    if (neutralUnchanged) {
      neutral = neutralServer;
    } else {
      const effectiveMain =
        neutralPalette.hueMode === 'custom'
          ? (neutralPalette.main || clientNeutralMainFromHueMode('branded', primary.main))
          : clientNeutralMainFromHueMode(neutralPalette.hueMode, primary.main);
      // v0.1.58: neutral uses the dedicated derivation (fixed L
      // anchors at the extremes), not the brand-palette logic.
      neutral = clientDeriveNeutralRungs(effectiveMain, neutralPalette.overrides);
    }
    const palettes: ResolvedPalettes = { primary, secondary, accent, neutral };
    const gradients: BrandCardGradient[] = draft.gradients.map((g) => ({
      slug: g.slug,
      name: g.name,
      mode: g.mode,
      angle: g.angle,
      resolvedStops: g.stops.map((s) => ({ token: s, hex: resolveStopLocal(s, palettes) })),
    }));
    const onColor: BrandCardData['onColor'] = {
      primary: onColorLocal(palettes.primary.main, palettes.primary.faded),
      secondary: onColorLocal(palettes.secondary.main, palettes.secondary.faded),
      accent: onColorLocal(palettes.accent.main, palettes.accent.faded),
      neutral: onColorLocal(palettes.neutral.main, palettes.neutral.faded),
    };
    return {
      palettes: draft.palettes,
      resolvedPalettes: palettes,
      onColor,
      gradients,
      semantic: draft.semantic,
    };
  }, [draft, resolved]);

  if (!draft || !resolved || !cardData) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading brand colors…</div>;
  }

  /* ──────────────────────────────────────────────────────────
   * Edit handlers — wired into BrandCard's mode="edit" props
   * ────────────────────────────────────────────────────────── */

  function updatePaletteName(role: PaletteRole, name: string) {
    setDraft((d) => d && ({ ...d, palettes: { ...d.palettes, [role]: { ...d.palettes[role], name } } }));
  }
  function updatePaletteMain(role: PaletteRole, hex: string) {
    setDraft((d) => d && ({ ...d, palettes: { ...d.palettes, [role]: { ...d.palettes[role], main: hex } } }));
  }
  function updateRungOverride(role: PaletteRole, rung: Exclude<RungName, 'main'>, hex: string | null) {
    setDraft((d) => {
      if (!d) return d;
      const p = d.palettes[role];
      const overrides = { ...(p.overrides ?? {}) };
      if (hex === null) {
        delete overrides[rung];
        toast.success(`${role}-${rung} reverted to derived value`);
      } else {
        overrides[rung] = hex;
      }
      return { ...d, palettes: { ...d.palettes, [role]: { ...p, overrides } } };
    });
  }
  function updateNeutralHueMode(mode: 'branded' | 'warm' | 'cool' | 'true' | 'custom') {
    setDraft((d) => d && ({ ...d, palettes: { ...d.palettes, neutral: { ...d.palettes.neutral, hueMode: mode } } }));
  }
  function updateGradientName(slug: string, name: string) {
    setDraft((d) => d && ({ ...d, gradients: d.gradients.map((g) => g.slug === slug ? { ...g, name } : g) }));
  }
  function updateSemantic(role: 'success' | 'info' | 'warning' | 'error', which: 'main' | 'light', hex: string) {
    setDraft((d) => d && ({ ...d, semantic: { ...d.semantic, [role]: { ...d.semantic[role], [which]: hex } } }));
  }

  /* ──────────────────────────────────────────────────────────
   * Gradient builder
   * ────────────────────────────────────────────────────────── */

  function addGradient() {
    setDraft((d) => {
      if (!d) return d;
      if (d.gradients.length >= 5) {
        toast.error('Maximum 5 gradients reached', {
          description: 'Override a palette rung or compose from existing stops instead.',
        });
        return d;
      }
      const newG: Gradient = {
        slug: slugify(`gradient ${d.gradients.length + 1}`),
        name: `Gradient ${d.gradients.length + 1}`,
        stops: ['primary-main', 'primary-pastel'],
        mode: 'linear',
        angle: 90,
      };
      return { ...d, gradients: [...d.gradients, newG] };
    });
  }
  function removeGradient(slug: string) {
    setDraft((d) => d && ({ ...d, gradients: d.gradients.filter((g) => g.slug !== slug) }));
  }
  function updateGradient(slug: string, patch: Partial<Gradient>) {
    setDraft((d) => d && ({ ...d, gradients: d.gradients.map((g) => g.slug === slug ? { ...g, ...patch } : g) }));
  }

  /* ──────────────────────────────────────────────────────────
   * Theme bindings
   * ────────────────────────────────────────────────────────── */

  function updateThemeBinding(theme: 'light' | 'dark', key: keyof ThemeBindings, value: string) {
    setDraft((d) => {
      if (!d) return d;
      if (theme === 'dark' && !d.themes.dark) {
        // Auto-create dark theme on first edit
        return {
          ...d,
          themes: {
            ...d.themes,
            dark: { bindings: { ...d.themes.light.bindings, canvas: value === undefined ? d.themes.light.bindings.canvas : value, [key]: value } },
          },
        };
      }
      const t = theme === 'light' ? d.themes.light : d.themes.dark!;
      return {
        ...d,
        themes: {
          ...d.themes,
          [theme]: { bindings: { ...t.bindings, [key]: value } },
        },
      };
    });
  }

  async function generateDarkFromLight() {
    try {
      // Snapshot the current dark theme for undo before overwriting.
      // Read the snapshot via functional state to avoid the narrowing
      // issue at this point in the function (draft is non-null inside
      // the component's render scope, but TS can't infer that across
      // a callback boundary; setDraft's reader form sidesteps it).
      let snapshot: Theme | undefined;
      setDraft((d) => {
        snapshot = d?.themes.dark;
        return d;
      });
      setUndoDarkSnapshot(snapshot);
      const res = await authedFetch('/_ensemble/core/brand/colors-doc/generate-dark', { method: 'POST' });
      const body = await res.json() as { theme: Theme; warnings: unknown[] };
      setDraft((d) => d && ({ ...d, themes: { ...d.themes, dark: body.theme } }));
      const warningCount = Array.isArray(body.warnings) ? body.warnings.length : 0;
      toast.success(`Generated 7 bindings from light theme${warningCount ? ` · ${warningCount} contrast warning${warningCount > 1 ? 's' : ''}` : ''}`, {
        description: 'Click Undo to revert.',
        action: {
          label: 'Undo',
          onClick: () => {
            setDraft((d) => d && ({ ...d, themes: { ...d.themes, dark: snapshot } }));
            setUndoDarkSnapshot(undefined);
          },
        },
      });
    } catch (err) {
      toast.error('Failed to generate dark theme', {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  function removeDarkTheme() {
    setDraft((d) => d && ({ ...d, themes: { ...d.themes, dark: undefined } }));
  }

  /* ──────────────────────────────────────────────────────────
   * Save
   * ────────────────────────────────────────────────────────── */

  async function handleSave() {
    status.beginSave();
    try {
      const res = await authedFetch('/_ensemble/core/brand/colors-doc', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc: draft }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json() as { ok: boolean; diff?: unknown };
      status.commitSave();
      emitWorkspaceEvent('brand.tokens.changed', { category: 'colors', diff: body.diff });
      toast.success('Colors saved');
      // Reload resolved data so the server's authoritative resolution
      // (including any rung-deriving math we approximated locally) is
      // what we hand to the BrandCard.
      await reload();
    } catch (err) {
      status.failSave(err);
      toast.error('Failed to save colors', {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  function handleDiscard() {
    if (saved) {
      setDraft(saved);
      status.resetBaseline(saved);
      toast.success('Reverted unsaved changes');
    }
  }

  const saving = status.state === 'saving';

  /* ──────────────────────────────────────────────────────────
   * Render
   * ────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-10">
      {/* Section 0 — header */}
      <div className="flex items-end justify-between border-b pb-5">
        <div>
          <h1 className="text-2xl font-normal tracking-tight">Brand colors</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Type the Main hex and a name. Dark, Bright, Pastel, and Faded derive automatically.
            Palettes are referenced by role (<code>primary-bright</code>) so renaming doesn't break consumer code.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {status.dirty && (
            <Button type="button" variant="ghost" size="sm" onClick={handleDiscard}>
              Discard
            </Button>
          )}
          {status.state !== 'clean' && <SaveStatus state={status.state} />}
          <Button onClick={handleSave} disabled={!status.dirty || saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Section 1 — Brand palettes + Neutral + Gradients + Semantic
          rendered by BrandCard in edit mode. v0.1.57: the Neutral
          hue selector is now inline in NeutralStrip (was a separate
          Card below); the BrandCard owns the entire Neutral surface
          including hue mode + Main override. */}
      <BrandCard
        data={cardData}
        mode="edit"
        onPaletteNameChange={updatePaletteName}
        onPaletteMainChange={updatePaletteMain}
        onRungOverride={updateRungOverride}
        onNeutralHueModeChange={updateNeutralHueMode}
        onGradientNameChange={updateGradientName}
        onSemanticChange={updateSemantic}
      />

      {/* Gradients editor — adds advanced controls below the BrandCard's
          display of gradients. The BrandCard's mode="edit" lets the
          operator rename gradients inline; the controls here let them
          add, remove, reorder stops, change angle. */}
      <GradientsEditor
        gradients={draft.gradients}
        palettes={cardData.resolvedPalettes}
        onAdd={addGradient}
        onRemove={removeGradient}
        onUpdate={updateGradient}
        onNameChange={updateGradientName}
      />

      {/* Themes — separate from BrandCard by spec (themes are
          configuration, not part of the brand card itself) */}
      <ThemesSection
        light={draft.themes.light}
        dark={draft.themes.dark}
        palettes={cardData.resolvedPalettes}
        onUpdateBinding={updateThemeBinding}
        onGenerateDark={generateDarkFromLight}
        onRemoveDark={removeDarkTheme}
      />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * GradientsEditor — angle / mode / stops controls
 * ──────────────────────────────────────────────────────────── */

function GradientsEditor({
  gradients,
  palettes,
  onAdd,
  onRemove,
  onUpdate,
  onNameChange,
}: {
  gradients: Gradient[];
  palettes: ResolvedPalettes;
  onAdd: () => void;
  onRemove: (slug: string) => void;
  onUpdate: (slug: string, patch: Partial<Gradient>) => void;
  onNameChange?: (slug: string, name: string) => void;
}) {
  const atCap = gradients.length >= 5;
  return (
    <section className="space-y-3.5">
      <header className="flex items-baseline justify-between">
        <h2
          className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground"
          style={{ fontFamily: 'var(--brand-font-eyebrow, var(--brand-font-body, inherit))' }}
        >
          Gradients
        </h2>
        <div className="flex items-center gap-3">
          <span
            className="text-[11px] text-muted-foreground"
            style={{ fontFamily: 'var(--brand-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)' }}
          >
            {gradients.length} of 5
          </span>
          {atCap ? (
            <Button type="button" variant="outline" size="sm" disabled title="Maximum 5 gradients reached" className="h-7 px-2 text-xs">
              <Plus className="h-3.5 w-3.5 mr-1" /> Add gradient
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={onAdd} className="h-7 px-2 text-xs">
              <Plus className="h-3.5 w-3.5 mr-1" /> Add gradient
            </Button>
          )}
        </div>
      </header>
      <p className="text-xs text-muted-foreground max-w-[680px]">
        Compose from your palette rungs + system tokens <code>white</code> / <code>black</code>.
        Stops are token-only — override a palette rung if you need a custom color. Each gradient's
        live preview sits directly above its controls.
      </p>
      {gradients.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-4">
          No gradients defined yet. Click <strong>Add gradient</strong> above to compose one from your palette rungs.
        </p>
      ) : (
        <div className="space-y-4">
          {gradients.map((g) => (
            <GradientRow
              key={g.slug}
              gradient={g}
              palettes={palettes}
              onUpdate={onUpdate}
              onRemove={onRemove}
              onNameChange={onNameChange}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function GradientRow({
  gradient,
  palettes,
  onUpdate,
  onRemove,
  onNameChange,
}: {
  gradient: Gradient;
  palettes: ResolvedPalettes;
  onUpdate: (slug: string, patch: Partial<Gradient>) => void;
  onRemove: (slug: string) => void;
  onNameChange?: (slug: string, name: string) => void;
}) {
  const stops = gradient.stops;
  const canAddStop = stops.length < 4;
  const canRemoveStop = stops.length > 2;

  function setStop(idx: number, value: string) {
    const next = [...stops];
    next[idx] = value;
    onUpdate(gradient.slug, { stops: next });
  }
  function addStop() {
    if (!canAddStop) return;
    onUpdate(gradient.slug, { stops: [...stops, 'primary-faded'] });
  }
  function removeStop(idx: number) {
    if (!canRemoveStop) return;
    onUpdate(gradient.slug, { stops: stops.filter((_, i) => i !== idx) });
  }

  // Resolved stops → CSS gradient string for the banner preview.
  const resolvedStops = stops.map((s) => resolveStopLocal(s, palettes));
  const cssGradient = gradient.mode === 'radial'
    ? `radial-gradient(circle, ${resolvedStops.join(', ')})`
    : `linear-gradient(${gradient.angle}deg, ${resolvedStops.join(', ')})`;
  // On-color foreground for the banner name — pick black/white by
  // first stop's luminance (matches the same heuristic the brand
  // guide uses for its banners).
  const firstHex = resolvedStops[0] ?? '#000000';
  const lum = relLum(firstHex);
  const onColor = lum < 0.5 ? '#FAFAFA' : '#0A0A0A';

  return (
    <div className="rounded-2xl overflow-hidden border-[0.5px] border-black/[0.07] bg-background">
      {/* v0.1.60: live banner preview at the top of each row so the
          gradient and its controls are visually adjacent — operator
          sees the resulting gradient directly above the controls
          that drive it. Replaces the old layout where banners lived
          in the BrandCard above and controls in a separate card. */}
      <div
        className="h-[90px] flex items-center px-5"
        style={{ background: cssGradient, color: onColor }}
      >
        {onNameChange ? (
          <Input
            value={gradient.name}
            onChange={(e) => onNameChange(gradient.slug, e.currentTarget.value)}
            className="bg-transparent border-0 px-0 h-auto text-[28px] font-normal tracking-tight focus-visible:ring-0 hover:bg-black/5"
            style={{
              color: onColor,
              fontFamily: 'var(--brand-font-display, var(--brand-font-heading, inherit))',
            }}
          />
        ) : (
          <p
            className="text-[28px] font-normal tracking-tight leading-none"
            style={{
              color: onColor,
              fontFamily: 'var(--brand-font-display, var(--brand-font-heading, inherit))',
            }}
          >
            {gradient.name}
          </p>
        )}
      </div>

      {/* Controls strip — all on one row (mode + angle + remove). */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-black/[0.07] flex-wrap">
        <span
          className="text-[11px] text-muted-foreground"
          style={{ fontFamily: 'var(--brand-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)' }}
        >
          gradient-{gradient.slug}
        </span>
        <div className="flex items-center gap-3">
          <Select value={gradient.mode} onValueChange={(v) => onUpdate(gradient.slug, { mode: v as 'linear' | 'radial' })}>
            <SelectTrigger className="w-[100px] h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="linear">Linear</SelectItem>
              <SelectItem value="radial">Radial</SelectItem>
            </SelectContent>
          </Select>
          {gradient.mode === 'linear' && (
            <Select value={String(gradient.angle)} onValueChange={(v) => onUpdate(gradient.slug, { angle: Number(v) as Gradient['angle'] })}>
              <SelectTrigger className="w-[80px] h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0°</SelectItem>
                <SelectItem value="45">45°</SelectItem>
                <SelectItem value="90">90°</SelectItem>
                <SelectItem value="135">135°</SelectItem>
                <SelectItem value="180">180°</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(gradient.slug)} className="h-7 px-2 text-xs">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Stops row — each stop's BrandTokenPicker. */}
      <div className="px-4 pb-4 space-y-2">
        <Label className="text-xs text-muted-foreground">Stops</Label>
        <div className="flex flex-wrap items-center gap-2">
          {stops.map((stop, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span className="text-muted-foreground text-xs">→</span>}
              <BrandTokenPicker
                value={stop}
                onChange={(v) => setStop(idx, v)}
                palettes={palettes}
                allowSystem
              />
              {canRemoveStop && (
                <Button type="button" variant="ghost" size="sm" onClick={() => removeStop(idx)} className="h-7 px-2">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </React.Fragment>
          ))}
          {canAddStop && (
            <Button type="button" variant="ghost" size="sm" onClick={addStop} className="h-7 px-2">
              <Plus className="h-3.5 w-3.5 mr-1" /> Stop
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * Themes section — light + dark theme binding editors
 * ──────────────────────────────────────────────────────────── */

function ThemesSection({
  light,
  dark,
  palettes,
  onUpdateBinding,
  onGenerateDark,
  onRemoveDark,
}: {
  light: Theme;
  dark: Theme | undefined;
  palettes: ResolvedPalettes;
  onUpdateBinding: (theme: 'light' | 'dark', key: keyof ThemeBindings, value: string) => void;
  onGenerateDark: () => void;
  onRemoveDark: () => void;
}) {
  return (
    <section>
      <header className="mb-3.5">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Themes
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Light and Dark canvases bind seven role tokens to palette rungs (or literal hex).
          Logo lockups on dark backgrounds require a Dark theme — without one, only light-bg lockups render.
        </p>
      </header>
      <div className="grid gap-3 lg:grid-cols-2">
        <ThemeCard
          mode="light"
          theme={light}
          palettes={palettes}
          onUpdate={(key, val) => onUpdateBinding('light', key, val)}
        />
        <ThemeCard
          mode="dark"
          theme={dark}
          palettes={palettes}
          onUpdate={(key, val) => onUpdateBinding('dark', key, val)}
          onGenerate={onGenerateDark}
          onRemove={onRemoveDark}
        />
      </div>
    </section>
  );
}

function ThemeCard({
  mode,
  theme,
  palettes,
  onUpdate,
  onGenerate,
  onRemove,
}: {
  mode: 'light' | 'dark';
  theme: Theme | undefined;
  palettes: ResolvedPalettes;
  onUpdate: (key: keyof ThemeBindings, value: string) => void;
  onGenerate?: () => void;
  onRemove?: () => void;
}) {
  const Icon = mode === 'light' ? Sun : Moon;
  const isConfigured = !!theme;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="h-4 w-4" /> {mode === 'light' ? 'Light theme' : 'Dark theme'}
          </CardTitle>
          {mode === 'dark' && onGenerate && (
            <div className="flex items-center gap-1">
              {isConfigured && onRemove && (
                <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="h-7 px-2 text-xs">
                  Remove
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" onClick={onGenerate} className="h-7 px-2 text-xs">
                <Wand2 className="h-3.5 w-3.5 mr-1" />
                {isConfigured ? 'Regenerate' : 'Generate from light'}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!isConfigured && mode === 'dark' ? (
          <p className="text-sm text-muted-foreground italic">
            No dark theme configured. Click <strong>Generate from light</strong> to synthesize one,
            or any binding below to start filling it in manually.
          </p>
        ) : (
          <div className="space-y-3">
            {theme && <ThemePreview theme={theme} palettes={palettes} />}
            <div className="space-y-2">
              {THEME_BINDING_LABELS.map(({ key, label, description, allowAuto }) => {
                const value = theme?.bindings[key] ?? (mode === 'dark' && key === 'canvas' ? '#0a0a0a' : '#ffffff');
                return (
                  <div key={key} className="grid grid-cols-[100px_1fr] items-center gap-3 py-1.5 border-t first:border-t-0">
                    <div>
                      <Label className="text-xs">{label}</Label>
                      <p className="text-[10px] text-muted-foreground">{description}</p>
                    </div>
                    <BrandTokenPicker
                      value={value}
                      onChange={(v) => onUpdate(key, v)}
                      palettes={palettes}
                      allowAuto={allowAuto}
                      allowHex
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────────
 * ThemePreview — mini panel showing the theme rendered live
 *
 * Renders a small visual approximation of "what a page in this
 * theme looks like" so the operator can validate their bindings at
 * a glance. ~120px tall; canvas → surface → brand button + text
 * primary + text muted line. Updates instantly as bindings change
 * because every value is resolved from current draft.
 * ──────────────────────────────────────────────────────────── */

function ThemePreview({ theme, palettes }: { theme: Theme; palettes: ResolvedPalettes }) {
  const canvas = resolveBindingLocal(theme.bindings.canvas, palettes);
  const surface = resolveBindingLocal(theme.bindings.surface, palettes);
  const brand = resolveBindingLocal(theme.bindings.brand, palettes);
  const brandBg = resolveBindingLocal(theme.bindings['brand-bg'], palettes);
  const border = resolveBindingLocal(theme.bindings.border, palettes);
  const textPrimary = theme.bindings['text-primary'] === 'auto'
    ? autoForegroundLocal(canvas)
    : resolveBindingLocal(theme.bindings['text-primary'], palettes);
  const textMuted = theme.bindings['text-muted'] === 'auto'
    ? autoForegroundLocal(canvas, 0.65)
    : resolveBindingLocal(theme.bindings['text-muted'], palettes);
  // On-color for the brand button: pick higher APCA between brand
  // canvas-equivalent and a near-white. Simplification: use the
  // canvas's opposite-luminance.
  const brandFg = autoForegroundLocal(brand);

  return (
    <div
      className="rounded-md overflow-hidden"
      style={{
        backgroundColor: canvas,
        border: `1px solid ${border}`,
      }}
    >
      <div className="p-3 flex items-center gap-3">
        <div
          className="rounded-sm flex-1 p-3 flex items-center justify-between"
          style={{
            backgroundColor: surface,
            border: `1px solid ${border}`,
          }}
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium" style={{ color: textPrimary }}>Heading</span>
            <span className="text-[10px]" style={{ color: textMuted }}>Muted helper copy</span>
          </div>
          <button
            type="button"
            disabled
            className="text-[11px] font-medium px-2.5 py-1 rounded-md cursor-default"
            style={{ backgroundColor: brand, color: brandFg }}
          >
            Action
          </button>
        </div>
        <div
          className="rounded-sm px-2 py-1.5"
          style={{ backgroundColor: brandBg, border: `1px solid ${border}` }}
        >
          <span className="text-[10px] font-medium" style={{ color: textPrimary }}>brand-bg</span>
        </div>
      </div>
    </div>
  );
}

/** Resolve a ThemeBindingValue to a hex. Mirrors the server resolver
 *  for the live preview path. "auto" is handled by the caller. */
function resolveBindingLocal(value: string, palettes: ResolvedPalettes): string {
  if (value === 'auto') return '#000000';
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) return value;
  const m = /^(primary|secondary|accent|neutral)-(dark|main|bright|pastel|faded)$/.exec(value);
  if (m) return palettes[m[1] as PaletteRole][m[2] as RungName];
  return '#000000';
}

/** Pick a near-white or near-black foreground for a canvas with
 *  optional opacity-equivalent damping for muted text. */
function autoForegroundLocal(canvasHex: string, mutedness = 1): string {
  const lum = relLum(canvasHex);
  if (lum >= 0.5) {
    // light canvas → dark text
    const factor = 1 - mutedness * 0.45; // 1.0 → 0.55, 0.65 → 0.71
    return `rgba(10, 10, 10, ${factor})`;
  } else {
    const factor = 1 - mutedness * 0.4; // 1.0 → 0.6, 0.65 → 0.74
    return `rgba(250, 250, 250, ${factor})`;
  }
}

function relLum(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const r = parseInt(m[1].slice(0, 2), 16) / 255;
  const g = parseInt(m[1].slice(2, 4), 16) / 255;
  const b = parseInt(m[1].slice(4, 6), 16) / 255;
  const lin = (v: number) => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/* ──────────────────────────────────────────────────────────────
 * Client-side OkLCh derivation (mirrors core/derive.ts)
 *
 * We approximate the server's rung math here so the editor preview
 * updates as the operator types Main without a server round-trip.
 * On save, the server re-resolves authoritatively and we reload.
 *
 * For sites using the workspace's typography correctly the small
 * numeric difference between client-derived and server-derived
 * rungs is invisible. The display label uses the client-derived
 * hex until save commits.
 * ──────────────────────────────────────────────────────────── */

const RUNG_OFFSETS: Record<Exclude<RungName, 'main'>, { dL: number; cMul: number }> = {
  dark:   { dL: -0.18, cMul: 0.85 },
  bright: { dL:  0.10, cMul: 1.08 },
  pastel: { dL:  0.28, cMul: 0.50 },
  faded:  { dL:  0.40, cMul: 0.22 },
};

/** sRGB hex → linear sRGB tuple [r, g, b] ∈ [0, 1]. */
function srgbToLinear(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  const r = parseInt(m[1].slice(0, 2), 16) / 255;
  const g = parseInt(m[1].slice(2, 4), 16) / 255;
  const b = parseInt(m[1].slice(4, 6), 16) / 255;
  const lin = (v: number) => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  return [lin(r), lin(g), lin(b)];
}

/** Linear sRGB → sRGB hex. */
function linearToSrgbHex([r, g, b]: [number, number, number]): string {
  const gamma = (v: number) => v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const toHex = (v: number) => Math.round(clamp(gamma(clamp(v))) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Linear sRGB → OkLab (M1·M2). */
function linearToOklab([r, g, b]: [number, number, number]): [number, number, number] {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ];
}

/** OkLab → linear sRGB. */
function oklabToLinear([L, a, b]: [number, number, number]): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** OkLab → OkLCh. */
function oklabToOklch([L, a, b]: [number, number, number]): { L: number; C: number; h: number } {
  const C = Math.sqrt(a * a + b * b);
  const h = Math.atan2(b, a) * 180 / Math.PI;
  return { L, C, h: h < 0 ? h + 360 : h };
}

/** OkLCh → OkLab. */
function oklchToOklab({ L, C, h }: { L: number; C: number; h: number }): [number, number, number] {
  const rad = h * Math.PI / 180;
  return [L, C * Math.cos(rad), C * Math.sin(rad)];
}

/**
 * Client mirror of services/brand-colors/derive.ts's
 * neutralMainFromHueMode. Computes Neutral's Main hex from the
 * hue mode. Used by the live preview so flipping Hue updates the
 * neutral strip immediately without waiting for save.
 */
function clientNeutralMainFromHueMode(
  hueMode: 'branded' | 'warm' | 'cool' | 'true' | 'custom',
  primaryMainHex: string,
): string {
  if (hueMode === 'true') return '#737373';
  if (hueMode === 'custom') hueMode = 'branded'; // fallback
  // Mirror the OkLCh L=0.45, C=0.012 anchor the server uses.
  const presetHue: Record<'branded' | 'warm' | 'cool', number | null> = {
    branded: null, warm: 60, cool: 240,
  };
  const hue = presetHue[hueMode];
  let h = 0;
  if (hue !== null) {
    h = hue;
  } else {
    // Pull hue from primary via the client's existing OkLab math.
    const lab = linearToOklab(srgbToLinear(primaryMainHex));
    const lch = oklabToOklch(lab);
    h = lch.h;
  }
  const labFromLch = oklchToOklab({ L: 0.45, C: 0.012, h });
  return linearToSrgbHex(oklabToLinear(labFromLch));
}

function clientDeriveRung(mainHex: string, rung: Exclude<RungName, 'main'>): string {
  const lab = linearToOklab(srgbToLinear(mainHex));
  const lch = oklabToOklch(lab);
  const offset = RUNG_OFFSETS[rung];
  const nextL = Math.min(0.97, Math.max(0.05, lch.L + offset.dL));
  const nextC = Math.max(0, lch.C * offset.cMul);
  const nextLab = oklchToOklab({ L: nextL, C: nextC, h: lch.h });
  return linearToSrgbHex(oklabToLinear(nextLab));
}

function clientDeriveRungs(mainHex: string, overrides: Palette['overrides']): Record<RungName, string> {
  return {
    dark:   overrides?.dark   ?? clientDeriveRung(mainHex, 'dark'),
    main:   mainHex,
    bright: overrides?.bright ?? clientDeriveRung(mainHex, 'bright'),
    pastel: overrides?.pastel ?? clientDeriveRung(mainHex, 'pastel'),
    faded:  overrides?.faded  ?? clientDeriveRung(mainHex, 'faded'),
  };
}

/**
 * Client mirror of services/brand-colors/derive.ts's
 * deriveNeutralRungs. Fixed L anchors at the extremes; only Bright
 * scales with Main. Used by the live preview so the operator sees
 * the correct neutral output (Faded ≈ #FAF8F4 for Curalisto) as
 * they type, not the brand-palette-derived intermediate values.
 */
const NEUTRAL_L_ANCHORS = { dark: 0.14, pastel: 0.83, faded: 0.97 } as const;
const NEUTRAL_C_MUL = { dark: 0.70, bright: 0.85, pastel: 0.50, faded: 0.15 } as const;

function clientDeriveNeutralRung(mainHex: string, rung: Exclude<RungName, 'main'>, L_main: number, C: number, h: number): string {
  let L: number;
  let cMul: number;
  if (rung === 'dark')   { L = NEUTRAL_L_ANCHORS.dark;   cMul = NEUTRAL_C_MUL.dark; }
  else if (rung === 'pastel') { L = NEUTRAL_L_ANCHORS.pastel; cMul = NEUTRAL_C_MUL.pastel; }
  else if (rung === 'faded')  { L = NEUTRAL_L_ANCHORS.faded;  cMul = NEUTRAL_C_MUL.faded; }
  else /* bright */ { L = (L_main + NEUTRAL_L_ANCHORS.pastel) / 2; cMul = NEUTRAL_C_MUL.bright; }
  const nextC = Math.max(0, C * cMul);
  const lab = oklchToOklab({ L, C: nextC, h });
  return linearToSrgbHex(oklabToLinear(lab));
}

function clientDeriveNeutralRungs(mainHex: string, overrides: Palette['overrides']): Record<RungName, string> {
  const lab = linearToOklab(srgbToLinear(mainHex));
  const lch = oklabToOklch(lab);
  return {
    dark:   overrides?.dark   ?? clientDeriveNeutralRung(mainHex, 'dark',   lch.L, lch.C, lch.h),
    main:   mainHex,
    bright: overrides?.bright ?? clientDeriveNeutralRung(mainHex, 'bright', lch.L, lch.C, lch.h),
    pastel: overrides?.pastel ?? clientDeriveNeutralRung(mainHex, 'pastel', lch.L, lch.C, lch.h),
    faded:  overrides?.faded  ?? clientDeriveNeutralRung(mainHex, 'faded',  lch.L, lch.C, lch.h),
  };
}

function resolveStopLocal(stop: string, palettes: ResolvedPalettes): string {
  if (stop === 'white') return '#ffffff';
  if (stop === 'black') return '#000000';
  const m = /^(primary|secondary|accent|neutral)-(dark|main|bright|pastel|faded)$/.exec(stop);
  if (m) return palettes[m[1] as PaletteRole][m[2] as RungName];
  return '#000000';
}

/** Client mirror of the server's on-color foreground rule:
 *  Faded rung when its contrast against Main is ≥ ~3.5; else
 *  high-contrast white or black. Uses WCAG 2.x ratio (simpler
 *  than APCA, and adequate for the "is the Faded rung readable
 *  on Main" check). */
function onColorLocal(mainHex: string, fadedHex: string): { hex: string; usedFallback: boolean } {
  const ratio = wcagRatio(fadedHex, mainHex);
  if (ratio >= 3.5) return { hex: fadedHex, usedFallback: false };
  const whiteRatio = wcagRatio('#FAFAFA', mainHex);
  const blackRatio = wcagRatio('#0A0A0A', mainHex);
  return { hex: whiteRatio >= blackRatio ? '#FAFAFA' : '#0A0A0A', usedFallback: true };
}

function wcagRatio(fg: string, bg: string): number {
  const luminance = (hex: string) => {
    const [r, g, b] = srgbToLinear(hex);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const a = luminance(fg);
  const b = luminance(bg);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}
