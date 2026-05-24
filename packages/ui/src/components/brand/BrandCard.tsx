/**
 * BrandCard — unified display unit for a workspace's brand color system.
 *
 * v0.1.55. Single component, two consumers, two modes:
 *
 *   Consumers:
 *     - Brand Overview tab (display mode)
 *     - /brand public guide (display mode)
 *     - Brand Colors editor tab (edit mode — hosts inline editors)
 *
 *   Modes:
 *     - display: click-to-copy swatches, no inputs, no pickers
 *     - edit: name/gradient-name become inline-editable inputs;
 *             Main faces and rung swatches open ColorPicker popovers
 *
 * The component receives a "resolved" data structure (every rung +
 * theme binding pre-resolved to hex) via the `data` prop. Resolution
 * lives in @ensemble-edge/core (services/brand-colors/resolver.ts);
 * this component is render-only.
 *
 * Sections (in order):
 *   1. Brand palettes — 3-up grid of Primary, Secondary, Accent
 *   2. Neutral — single horizontal strip with five rungs
 *   3. Gradients — stacked named banners (hidden when empty)
 *   4. Semantic — 4-up grid of state-color pairs
 *
 * Every swatch is click-to-copy with toast confirmation. Hover
 * affordances follow the card spec (brightness 0.97 on filled
 * faces, translateY -1px on chips).
 */
import * as React from 'react';
import { useState } from 'react';
import { toast } from '../ui/sonner';
import { Input } from '../ui/input';
import { ColorPicker } from '../ui/color-picker';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { cn } from '../../lib/utils';

/* ──────────────────────────────────────────────────────────────
 * Public types — match the resolved shape returned by
 * GET /_ensemble/core/brand/colors-doc/resolved
 * ──────────────────────────────────────────────────────────── */

export type RungName = 'dark' | 'main' | 'bright' | 'pastel' | 'faded';
export type PaletteRole = 'primary' | 'secondary' | 'accent' | 'neutral';
export type ResolvedPalette = Record<RungName, string>;
export type ResolvedPalettes = Record<PaletteRole, ResolvedPalette>;

export interface BrandCardPalette {
  /** Operator-facing display name like "Ownly Coral". */
  name: string;
  /** Operator-typed Main hex. */
  main: string;
  hueMode?: 'branded' | 'warm' | 'cool' | 'true';
}

export interface BrandCardGradient {
  slug: string;
  name: string;
  mode: 'linear' | 'radial';
  angle: 0 | 45 | 90 | 135 | 180;
  /** Resolved stops — each carries both the original token and
   *  the concrete hex (so the card can show "primary-pastel" as
   *  label and #FFD4C5 as swatch). */
  resolvedStops: Array<{ token: string; hex: string }>;
}

export interface BrandCardSemanticPair {
  main: string;
  light: string;
}

export interface BrandCardData {
  palettes: {
    primary: BrandCardPalette;
    secondary: BrandCardPalette;
    accent: BrandCardPalette;
    neutral: BrandCardPalette;
  };
  resolvedPalettes: ResolvedPalettes;
  /** On-color foreground per palette role — Faded rung or fallback. */
  onColor: Record<PaletteRole, { hex: string; usedFallback: boolean }>;
  gradients: BrandCardGradient[];
  semantic: {
    success: BrandCardSemanticPair;
    info: BrandCardSemanticPair;
    warning: BrandCardSemanticPair;
    error: BrandCardSemanticPair;
  };
}

export type BrandCardMode = 'display' | 'edit';
export type BrandCardSize = 'default' | 'compact';

export interface BrandCardProps {
  data: BrandCardData;
  mode?: BrandCardMode;
  size?: BrandCardSize;
  /** edit-mode only: handlers for inline edits. Display mode ignores
   *  these. The host (ColorsTab) wires these to its draft state. */
  onPaletteNameChange?: (role: PaletteRole, name: string) => void;
  onPaletteMainChange?: (role: PaletteRole, hex: string) => void;
  onRungOverride?: (role: PaletteRole, rung: Exclude<RungName, 'main'>, hex: string | null) => void;
  onGradientNameChange?: (slug: string, name: string) => void;
  onSemanticChange?: (
    role: 'success' | 'info' | 'warning' | 'error',
    which: 'main' | 'light',
    hex: string,
  ) => void;
  className?: string;
}

/* ──────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────── */

async function copyToClipboard(value: string, label: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`Copied ${label}`);
  } catch {
    toast.error('Copy failed');
  }
}

function gradientCssString(g: BrandCardGradient): string {
  const stops = g.resolvedStops.map((s) => s.hex).join(', ');
  if (g.mode === 'radial') return `radial-gradient(circle, ${stops})`;
  return `linear-gradient(${g.angle}deg, ${stops})`;
}

/** Compact "color label" — token reference if available, else hex. */
function colorLabel(token: string, hex: string): { primary: string; isToken: boolean } {
  if (token === 'white' || token === 'black') return { primary: token, isToken: true };
  if (/^(primary|secondary|accent|neutral)-/.test(token)) return { primary: token, isToken: true };
  return { primary: hex.toUpperCase(), isToken: false };
}

/* ──────────────────────────────────────────────────────────────
 * Swatch — base clickable color tile (click-to-copy)
 * ──────────────────────────────────────────────────────────── */

interface SwatchProps {
  color: string;
  label?: string;          // What to copy + show in toast
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
  onClick?: () => void;
  children?: React.ReactNode;
}

function Swatch({ color, label, className, style, ariaLabel, onClick, children }: SwatchProps) {
  const handleClick = () => {
    if (onClick) {
      onClick();
      return;
    }
    if (label) copyToClipboard(label, label);
  };
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={ariaLabel ?? (label ? `Copy hex ${label}` : 'Color swatch')}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      className={cn(
        'cursor-pointer transition-transform border-[0.5px] border-black/10 outline-none',
        'hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-foreground/30',
        className,
      )}
      style={{ backgroundColor: color, ...style }}
    >
      {children}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * PaletteCard — Primary / Secondary / Accent
 * ──────────────────────────────────────────────────────────── */

interface PaletteCardProps {
  role: PaletteRole;
  palette: BrandCardPalette;
  resolved: ResolvedPalette;
  onColor: { hex: string; usedFallback: boolean };
  mode: BrandCardMode;
  onNameChange?: (name: string) => void;
  onMainChange?: (hex: string) => void;
  onRungOverride?: (rung: Exclude<RungName, 'main'>, hex: string | null) => void;
}

function PaletteCard({
  role, palette, resolved, onColor, mode, onNameChange, onMainChange, onRungOverride,
}: PaletteCardProps) {
  const isEdit = mode === 'edit';
  const main = resolved.main;
  const fg = onColor.hex;
  const rungs: Array<{ name: Exclude<RungName, 'main'>; hex: string; label: string }> = [
    { name: 'dark',   hex: resolved.dark,   label: 'Dark' },
    { name: 'bright', hex: resolved.bright, label: 'Bright' },
    { name: 'pastel', hex: resolved.pastel, label: 'Pastel' },
    { name: 'faded',  hex: resolved.faded,  label: 'Faded' },
  ];

  return (
    <div className="rounded-2xl overflow-hidden bg-background border-[0.5px] border-black/[0.07]">
      {/* Main face — aspect 16/11, dominant color */}
      {isEdit ? (
        <Popover>
          <PopoverTrigger asChild>
            <div
              role="button"
              tabIndex={0}
              aria-label={`Open color picker for ${role} main`}
              className="aspect-[16/11] p-[18px] flex flex-col justify-between cursor-pointer transition-[filter] hover:brightness-[0.97] outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
              style={{ backgroundColor: main, color: fg }}
            >
              <PaletteFaceContent role={role} palette={palette} mode={mode} onNameChange={onNameChange} fg={fg} />
              <PaletteFaceFooter role={role} hex={main} fg={fg} />
            </div>
          </PopoverTrigger>
          <PopoverContent className="p-3 w-[280px]" align="start">
            <ColorPicker
              label={`${palette.name} main`}
              value={palette.main}
              onChange={(hex) => onMainChange?.(hex)}
            />
          </PopoverContent>
        </Popover>
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-label={`Copy hex ${main}`}
          onClick={() => copyToClipboard(main, main)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              copyToClipboard(main, main);
            }
          }}
          className="aspect-[16/11] p-[18px] flex flex-col justify-between cursor-pointer transition-[filter] hover:brightness-[0.97] outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
          style={{ backgroundColor: main, color: fg }}
        >
          <PaletteFaceContent role={role} palette={palette} mode={mode} fg={fg} />
          <PaletteFaceFooter role={role} hex={main} fg={fg} />
        </div>
      )}

      {/* Rung strip — Dark / Bright / Pastel / Faded (Main is the face) */}
      <div className="grid grid-cols-4 gap-2 p-3 bg-background">
        {rungs.map((r) => (
          <RungChip key={r.name} role={role} rung={r.name} hex={r.hex} label={r.label} mode={mode} onOverride={onRungOverride} />
        ))}
      </div>
    </div>
  );
}

function PaletteFaceContent({
  role, palette, mode, onNameChange, fg,
}: {
  role: PaletteRole;
  palette: BrandCardPalette;
  mode: BrandCardMode;
  fg: string;
  onNameChange?: (name: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {mode === 'edit' && onNameChange ? (
        <Input
          value={palette.name}
          onChange={(e) => onNameChange(e.currentTarget.value)}
          onClick={(e) => e.stopPropagation()}
          className="bg-transparent border-0 px-0 h-auto text-[26px] font-normal leading-[1.05] tracking-tight focus-visible:ring-0 hover:bg-black/5"
          style={{
            color: fg,
            fontFamily: 'var(--brand-font-display, var(--brand-font-heading, inherit))',
          }}
        />
      ) : (
        <p
          className="text-[26px] font-normal leading-[1.05] tracking-tight"
          style={{
            color: fg,
            fontFamily: 'var(--brand-font-display, var(--brand-font-heading, inherit))',
          }}
        >
          {palette.name}
        </p>
      )}
      <p
        className="text-[10px] font-medium tracking-[0.12em] opacity-70"
        style={{
          color: fg,
          // Mockup spec: role label is lowercase, not uppercase.
          // Matches the editorial feel — the palette name is the
          // shouted thing, the role is the quiet identifier.
          textTransform: 'lowercase',
          fontFamily: 'var(--brand-font-eyebrow, var(--brand-font-body, inherit))',
        }}
      >
        {role}
      </p>
    </div>
  );
}

function PaletteFaceFooter({ role, hex, fg }: { role: PaletteRole; hex: string; fg: string }) {
  return (
    <div
      className="flex items-end justify-between text-[11px]"
      style={{
        color: fg,
        fontFamily: 'var(--brand-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
      }}
    >
      <span className="opacity-90">{role}-main</span>
      <span className="opacity-90">{hex.toUpperCase()}</span>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * Rung chip — one of Dark / Bright / Pastel / Faded
 * ──────────────────────────────────────────────────────────── */

interface RungChipProps {
  role: PaletteRole;
  rung: Exclude<RungName, 'main'>;
  hex: string;
  label: string;
  mode: BrandCardMode;
  onOverride?: (rung: Exclude<RungName, 'main'>, hex: string | null) => void;
  /** When false, suppress the bottom-of-card meta line (rung label + hex)
   *  — used inside NeutralStrip where the parent renders its own meta. */
  showMeta?: boolean;
  /** Chip height. Mockup: 24px on brand-palette cards, 36px on neutral. */
  chipHeight?: number;
}

function RungChip({ role, rung, hex, label, mode, onOverride, showMeta = true, chipHeight = 24 }: RungChipProps) {
  const chipStyle: React.CSSProperties = { backgroundColor: hex, height: chipHeight };
  if (mode === 'edit' && onOverride) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Edit ${role}-${rung}`}
            className="flex flex-col gap-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 rounded"
          >
            <span
              className="rounded-md border-[0.5px] border-black/10 cursor-pointer hover:-translate-y-px transition-transform"
              style={chipStyle}
            />
            {showMeta && (
              <span className="flex flex-col gap-0">
                <span
                  className="text-[10px] font-medium text-foreground tracking-[0.04em]"
                  style={{ fontFamily: 'var(--brand-font-label, var(--brand-font-body, inherit))' }}
                >
                  {label}
                </span>
                <span
                  className="text-[9.5px] text-muted-foreground"
                  style={{ fontFamily: 'var(--brand-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)' }}
                >
                  {hex.toUpperCase()}
                </span>
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="p-3 w-[280px]" align="start">
          <ColorPicker
            label={`${role}-${rung} override`}
            description="Reset returns to the OkLCh-derived value."
            value={hex}
            onChange={(next) => onOverride(rung, next)}
            onReset={() => onOverride(rung, null)}
          />
        </PopoverContent>
      </Popover>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <Swatch
        color={hex}
        label={hex.toUpperCase()}
        className="rounded-md"
        style={{ height: chipHeight }}
      />
      {showMeta && (
        <>
          <span
            className="text-[10px] font-medium text-foreground tracking-[0.04em]"
            style={{ fontFamily: 'var(--brand-font-label, var(--brand-font-body, inherit))' }}
          >
            {label}
          </span>
          <span
            className="text-[9.5px] text-muted-foreground"
            style={{ fontFamily: 'var(--brand-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)' }}
          >
            {hex.toUpperCase()}
          </span>
        </>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * NeutralStrip — single horizontal card with five rungs
 * ──────────────────────────────────────────────────────────── */

interface NeutralStripProps {
  palette: BrandCardPalette;
  resolved: ResolvedPalette;
  mode: BrandCardMode;
  onNameChange?: (name: string) => void;
  onHueModeChange?: (hueMode: 'branded' | 'warm' | 'cool' | 'true') => void;
  onRungOverride?: (rung: Exclude<RungName, 'main'>, hex: string | null) => void;
}

function NeutralStrip({ palette, resolved, mode, onNameChange, onRungOverride }: NeutralStripProps) {
  const isEdit = mode === 'edit';
  return (
    <div className="rounded-2xl border-[0.5px] border-black/[0.07] bg-background p-5">
      <div className="grid grid-cols-[180px_1fr] gap-6 items-center">
        <div className="flex flex-col gap-1">
          {isEdit && onNameChange ? (
            <Input
              value={palette.name}
              onChange={(e) => onNameChange(e.currentTarget.value)}
              className="bg-transparent border-0 px-0 h-auto text-[22px] font-normal tracking-tight focus-visible:ring-0 hover:bg-black/5"
              style={{ fontFamily: 'var(--brand-font-display, var(--brand-font-heading, inherit))' }}
            />
          ) : (
            <p
              className="text-[22px] font-normal tracking-tight leading-none"
              style={{ fontFamily: 'var(--brand-font-display, var(--brand-font-heading, inherit))' }}
            >
              {palette.name}
            </p>
          )}
          <p
            className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground mt-1.5"
            style={{
              textTransform: 'lowercase',
              fontFamily: 'var(--brand-font-eyebrow, var(--brand-font-body, inherit))',
            }}
          >
            neutral
          </p>
          <p className="text-xs text-muted-foreground">
            Surfaces · borders · muted text. Derived from primary by default.
          </p>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {(['dark', 'main', 'bright', 'pastel', 'faded'] as const).map((rung) => (
            <div key={rung} className="flex flex-col gap-1">
              {rung === 'main' ? (
                <Swatch
                  color={resolved.main}
                  label={resolved.main.toUpperCase()}
                  className="h-[36px] rounded-md"
                  style={{ boxShadow: '0 0 0 1.5px var(--foreground, #18181B)' }}
                />
              ) : (
                <RungChip
                  role="neutral"
                  rung={rung}
                  hex={resolved[rung]}
                  label={rung.charAt(0).toUpperCase() + rung.slice(1)}
                  mode={mode}
                  onOverride={onRungOverride}
                  showMeta={false}
                  chipHeight={36}
                />
              )}
              <span className="text-[11px] font-medium text-foreground capitalize">{rung}</span>
              <span className="font-mono text-[9.5px] text-muted-foreground">{resolved[rung].toUpperCase()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * GradientBanner — single named gradient
 * ──────────────────────────────────────────────────────────── */

interface GradientBannerProps {
  gradient: BrandCardGradient;
  onColor: { hex: string; usedFallback: boolean };
  mode: BrandCardMode;
  onNameChange?: (name: string) => void;
}

function GradientBanner({ gradient, onColor, mode, onNameChange }: GradientBannerProps) {
  const css = gradientCssString(gradient);
  const isEdit = mode === 'edit';
  return (
    <div className="rounded-2xl overflow-hidden border-[0.5px] border-black/[0.07] bg-background">
      <div
        role="button"
        tabIndex={0}
        aria-label={`Copy gradient ${gradient.slug}`}
        onClick={() => copyToClipboard(css, `gradient-${gradient.slug}`)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            copyToClipboard(css, `gradient-${gradient.slug}`);
          }
        }}
        className="h-[90px] flex items-center px-5 cursor-pointer transition-[filter] hover:brightness-[0.97] outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
        style={{ background: css, color: onColor.hex }}
      >
        {isEdit && onNameChange ? (
          <Input
            value={gradient.name}
            onChange={(e) => onNameChange(e.currentTarget.value)}
            onClick={(e) => e.stopPropagation()}
            className="bg-transparent border-0 px-0 h-auto text-[32px] font-normal tracking-tight focus-visible:ring-0 hover:bg-black/5"
            style={{
              color: onColor.hex,
              fontFamily: 'var(--brand-font-display, var(--brand-font-heading, inherit))',
            }}
          />
        ) : (
          <p
            className="text-[32px] font-normal tracking-tight leading-none"
            style={{
              color: onColor.hex,
              fontFamily: 'var(--brand-font-display, var(--brand-font-heading, inherit))',
            }}
          >
            {gradient.name}
          </p>
        )}
      </div>
      <div
        className="flex items-center justify-between px-4 py-2.5 text-[11px] border-t border-black/[0.07]"
        style={{ fontFamily: 'var(--brand-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)' }}
      >
        <span className="text-muted-foreground">gradient-{gradient.slug}</span>
        <div className="flex items-center gap-2 flex-wrap">
          {gradient.resolvedStops.map((s, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="text-muted-foreground">→</span>}
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="w-[10px] h-[10px] rounded-sm border-[0.5px] border-black/10"
                  style={{ backgroundColor: s.hex }}
                />
                <span className="text-muted-foreground">{colorLabel(s.token, s.hex).primary}</span>
              </span>
            </React.Fragment>
          ))}
        </div>
        <span className="text-muted-foreground bg-black/5 px-2 py-0.5 rounded">
          {gradient.mode === 'radial' ? 'radial' : `linear · ${gradient.angle}°`}
        </span>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * SemanticCell — one Success/Info/Warning/Error card
 * ──────────────────────────────────────────────────────────── */

interface SemanticCellProps {
  role: 'success' | 'info' | 'warning' | 'error';
  pair: BrandCardSemanticPair;
  mode: BrandCardMode;
  onChange?: (which: 'main' | 'light', hex: string) => void;
}

const SEM_LABEL: Record<SemanticCellProps['role'], string> = {
  success: 'Success',
  info: 'Info',
  warning: 'Warning',
  error: 'Error',
};

function SemanticCell({ role, pair, mode, onChange }: SemanticCellProps) {
  const isEdit = mode === 'edit';
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-[2fr_1fr] gap-1 h-[40px]">
        {isEdit && onChange ? (
          <>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={`Edit ${role} main`}
                  className="rounded-md border-[0.5px] border-black/10 outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 cursor-pointer hover:-translate-y-px transition-transform"
                  style={{ backgroundColor: pair.main }}
                />
              </PopoverTrigger>
              <PopoverContent className="p-3 w-[280px]" align="start">
                <ColorPicker label={`${SEM_LABEL[role]} main`} value={pair.main} onChange={(hex) => onChange('main', hex)} />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={`Edit ${role} light`}
                  className="rounded-md border-[0.5px] border-black/10 outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 cursor-pointer hover:-translate-y-px transition-transform"
                  style={{ backgroundColor: pair.light }}
                />
              </PopoverTrigger>
              <PopoverContent className="p-3 w-[280px]" align="start">
                <ColorPicker label={`${SEM_LABEL[role]} light`} value={pair.light} onChange={(hex) => onChange('light', hex)} />
              </PopoverContent>
            </Popover>
          </>
        ) : (
          <>
            <Swatch color={pair.main} label={pair.main.toUpperCase()} className="rounded-md" />
            <Swatch color={pair.light} label={pair.light.toUpperCase()} className="rounded-md" />
          </>
        )}
      </div>
      <p className="text-[13px] font-medium">{SEM_LABEL[role]}</p>
      <p
        className="text-[11px] text-muted-foreground"
        style={{ fontFamily: 'var(--brand-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)' }}
      >
        {pair.main.toUpperCase()} · {pair.light.toUpperCase()}
      </p>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * BrandCard — top-level
 * ──────────────────────────────────────────────────────────── */

export function BrandCard({
  data,
  mode = 'display',
  size = 'default',
  onPaletteNameChange,
  onPaletteMainChange,
  onRungOverride,
  onGradientNameChange,
  onSemanticChange,
  className,
}: BrandCardProps) {
  const hasGradients = data.gradients.length > 0;

  // Compact size variant: smaller paddings, no rung strip in palette
  // cards, single-line gradient previews, semantic without surrounding
  // cards. We toggle classNames inline rather than maintaining a
  // separate component tree.
  const isCompact = size === 'compact';

  return (
    <div className={cn('space-y-10', isCompact && 'space-y-6', className)}>
      {/* Section 1 — Brand palettes */}
      <section>
        <header className="flex items-baseline justify-between mb-3.5">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground" style={{ fontFamily: 'var(--brand-font-eyebrow, var(--brand-font-body, inherit))' }}>
            Brand palettes
          </h2>
          <span className="text-[11px] text-muted-foreground" style={{ fontFamily: 'var(--brand-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)' }}>
            primary · secondary · accent
          </span>
        </header>
        <div className={cn(
          'grid gap-3.5',
          isCompact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-3',
        )}>
          {(['primary', 'secondary', 'accent'] as const).map((role) => (
            <PaletteCard
              key={role}
              role={role}
              palette={data.palettes[role]}
              resolved={data.resolvedPalettes[role]}
              onColor={data.onColor[role]}
              mode={mode}
              onNameChange={onPaletteNameChange ? (name) => onPaletteNameChange(role, name) : undefined}
              onMainChange={onPaletteMainChange ? (hex) => onPaletteMainChange(role, hex) : undefined}
              onRungOverride={onRungOverride ? (rung, hex) => onRungOverride(role, rung, hex) : undefined}
            />
          ))}
        </div>
      </section>

      {/* Section 2 — Neutral */}
      <section>
        <header className="flex items-baseline justify-between mb-3.5">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground" style={{ fontFamily: 'var(--brand-font-eyebrow, var(--brand-font-body, inherit))' }}>
            Neutral
          </h2>
          <span className="text-[11px] text-muted-foreground" style={{ fontFamily: 'var(--brand-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)' }}>
            {data.palettes.neutral.hueMode ? `hue · ${data.palettes.neutral.hueMode}` : ''}
          </span>
        </header>
        <NeutralStrip
          palette={data.palettes.neutral}
          resolved={data.resolvedPalettes.neutral}
          mode={mode}
          onNameChange={onPaletteNameChange ? (name) => onPaletteNameChange('neutral', name) : undefined}
          onRungOverride={onRungOverride ? (rung, hex) => onRungOverride('neutral', rung, hex) : undefined}
        />
      </section>

      {/* Section 3 — Gradients — hidden entirely when empty */}
      {hasGradients && (
        <section>
          <header className="flex items-baseline justify-between mb-3.5">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground" style={{ fontFamily: 'var(--brand-font-eyebrow, var(--brand-font-body, inherit))' }}>
              Gradients
            </h2>
            <span className="text-[11px] text-muted-foreground" style={{ fontFamily: 'var(--brand-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)' }}>
              {data.gradients.length} of 5
            </span>
          </header>
          <div className="space-y-3">
            {data.gradients.map((g) => {
              // On-color for the gradient banner. Prefer the first
              // stop's parent palette's Faded rung when the stop is a
              // palette ref (keeps the on-color in-family with the
              // banner), else fall back to WCAG luminance check vs
              // white/black. Matches the spec's "in-family color"
              // rule on §4.
              const firstStop = g.resolvedStops[0];
              const firstHex = firstStop?.hex ?? '#000000';
              const firstToken = firstStop?.token ?? '';
              const paletteMatch = /^(primary|secondary|accent|neutral)-/.exec(firstToken);
              let onColorHex: string;
              if (paletteMatch) {
                const role = paletteMatch[1] as PaletteRole;
                onColorHex = data.resolvedPalettes[role].faded;
                // Validate contrast — if Faded is too close to the
                // banner's midpoint hex, fall back to white/black.
                const mid = data.resolvedPalettes[role].main;
                if (wcagRatio(onColorHex, mid) < 3.0) {
                  onColorHex = isHexDark(firstHex) ? '#FAFAFA' : '#0A0A0A';
                }
              } else {
                onColorHex = isHexDark(firstHex) ? '#FAFAFA' : '#0A0A0A';
              }
              const onColor = { hex: onColorHex, usedFallback: !paletteMatch };
              return (
                <GradientBanner
                  key={g.slug}
                  gradient={g}
                  onColor={onColor}
                  mode={mode}
                  onNameChange={onGradientNameChange ? (name) => onGradientNameChange(g.slug, name) : undefined}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Section 4 — Semantic */}
      <section>
        <header className="flex items-baseline justify-between mb-3.5">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground" style={{ fontFamily: 'var(--brand-font-eyebrow, var(--brand-font-body, inherit))' }}>
            Semantic
          </h2>
          <span className="text-[11px] text-muted-foreground" style={{ fontFamily: 'var(--brand-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)' }}>state · main + light</span>
        </header>
        <div className={cn(
          'grid gap-3',
          isCompact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4',
        )}>
          {(['success', 'info', 'warning', 'error'] as const).map((role) => (
            <SemanticCell
              key={role}
              role={role}
              pair={data.semantic[role]}
              mode={mode}
              onChange={onSemanticChange ? (which, hex) => onSemanticChange(role, which, hex) : undefined}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

export default BrandCard;

/* ──────────────────────────────────────────────────────────────
 * Small WCAG helpers used by the gradient on-color check.
 * Kept local to avoid pulling culori into the UI bundle.
 * ──────────────────────────────────────────────────────────── */

function hexToLinear(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  const r = parseInt(m[1].slice(0, 2), 16) / 255;
  const g = parseInt(m[1].slice(2, 4), 16) / 255;
  const b = parseInt(m[1].slice(4, 6), 16) / 255;
  const lin = (v: number) => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  return [lin(r), lin(g), lin(b)];
}

function relLuminance(hex: string): number {
  const [r, g, b] = hexToLinear(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function wcagRatio(a: string, b: string): number {
  const la = relLuminance(a);
  const lb = relLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

function isHexDark(hex: string): boolean {
  return relLuminance(hex) < 0.5;
}
