/**
 * BrandTokenPicker — token-first picker for theme bindings and
 * other contexts where the operator should pick a palette rung
 * rather than a raw hex.
 *
 * v0.1.55. Differs from the workspace's general-purpose ColorPicker
 * in that the primary mode is "pick from the workspace's known
 * tokens" — palette rungs (primary-main, neutral-faded, etc.) —
 * with optional escape hatches:
 *
 *   - `allowHex`     → enable a "Custom hex" tab that uses ColorPicker
 *   - `allowAuto`    → enable an "Auto (APCA)" option (for text bindings)
 *   - `allowSystem`  → enable the system tokens 'white' and 'black'
 *                      (used by gradient stops which are token-only)
 *
 * Returns the stored value: a rung-ref string ("primary-main"), a
 * literal hex string, or the literal "auto" / "white" / "black".
 */
import * as React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Button } from '../ui/button';
import { ColorPickerPanel } from '../ui/color-picker';
import { cn } from '../../lib/utils';

export type PaletteRole = 'primary' | 'secondary' | 'accent' | 'neutral';
export type RungName = 'dark' | 'main' | 'bright' | 'pastel' | 'faded';
export type PaletteRungRef = `${PaletteRole}-${RungName}`;
export type ResolvedPalettes = Record<PaletteRole, Record<RungName, string>>;

/** v0.1.60: gradient option in the picker. When `allowGradient` is
 *  true, the host passes the workspace's defined gradients (slug +
 *  name + a resolved CSS string for preview) and operators can pick
 *  one. Stored value becomes "gradient-<slug>". */
export interface PickableGradient {
  /** Stable slug. Stored value is "gradient-<slug>". */
  slug: string;
  /** Operator-facing display name (for the picker chip label). */
  name: string;
  /** Resolved CSS gradient string for the chip swatch preview. */
  css: string;
}

export interface BrandTokenPickerProps {
  /** Current stored value — token ref, hex, gradient ref, auto, or
   *  system token. Examples: "primary-main", "gradient-sunrise",
   *  "#FF6B35", "auto", "white". */
  value: string;
  /** Called with the new stored value. */
  onChange: (next: string) => void;
  /** Resolved palettes so we can show actual color chips next to ref labels. */
  palettes: ResolvedPalettes;
  /** Enable a "Custom hex" tab. Default false. */
  allowHex?: boolean;
  /** Enable "Auto (APCA)" option. Default false. */
  allowAuto?: boolean;
  /** Enable system tokens 'white' and 'black'. Default false. */
  allowSystem?: boolean;
  /** v0.1.60: enable gradient refs. Host must pass `gradients` too. */
  allowGradient?: boolean;
  /** Available gradients to pick from. Required when allowGradient is
   *  true; ignored otherwise. */
  gradients?: PickableGradient[];
  /** Optional restriction to specific palette roles (used by gradient
   *  stops where neutral might be excluded). Default: all four. */
  allowedRoles?: PaletteRole[];
  /** Trigger label override. */
  label?: string;
  className?: string;
}

const ALL_RUNGS: RungName[] = ['dark', 'main', 'bright', 'pastel', 'faded'];
const ALL_ROLES: PaletteRole[] = ['primary', 'secondary', 'accent', 'neutral'];

function isRungRef(v: string): v is PaletteRungRef {
  return /^(primary|secondary|accent|neutral)-(dark|main|bright|pastel|faded)$/.test(v);
}

function isHex(v: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);
}

/** True when value matches "gradient-<slug>". v0.1.60. */
function isGradientRef(v: string): boolean {
  return /^gradient-[a-z0-9-]+$/.test(v);
}

function gradientSlug(v: string): string {
  return v.replace(/^gradient-/, '');
}

interface DisplayInfo {
  label: string;
  /** Hex for a flat swatch, or a CSS gradient string. */
  swatch: string;
  /** Whether the swatch is a gradient (vs flat color/hex). */
  isGradient: boolean;
  isToken: boolean;
}

function resolveDisplay(
  value: string,
  palettes: ResolvedPalettes,
  gradients: PickableGradient[],
): DisplayInfo {
  if (value === 'auto') return { label: 'auto', swatch: 'transparent', isGradient: false, isToken: false };
  if (value === 'white') return { label: 'white', swatch: '#ffffff', isGradient: false, isToken: true };
  if (value === 'black') return { label: 'black', swatch: '#000000', isGradient: false, isToken: true };
  if (isRungRef(value)) {
    const [role, rung] = value.split('-') as [PaletteRole, RungName];
    return { label: value, swatch: palettes[role][rung], isGradient: false, isToken: true };
  }
  if (isGradientRef(value)) {
    const slug = gradientSlug(value);
    const g = gradients.find((x) => x.slug === slug);
    return {
      label: value,
      swatch: g?.css ?? '#000000',
      isGradient: true,
      isToken: true,
    };
  }
  if (isHex(value)) return { label: value.toUpperCase(), swatch: value, isGradient: false, isToken: false };
  return { label: value, swatch: '#000000', isGradient: false, isToken: false };
}

export function BrandTokenPicker({
  value,
  onChange,
  palettes,
  allowHex = false,
  allowAuto = false,
  allowSystem = false,
  allowGradient = false,
  gradients = [],
  allowedRoles = ALL_ROLES,
  label,
  className,
}: BrandTokenPickerProps) {
  const display = resolveDisplay(value, palettes, gradients);

  // Swatch styling differs by display type. Gradients get a `background`
  // shorthand (handles linear/radial CSS strings); flat colors get
  // `backgroundColor`.
  const swatchStyle: React.CSSProperties = display.isGradient
    ? { background: display.swatch }
    : { backgroundColor: display.swatch };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label ?? `Pick color token (current: ${display.label})`}
          className={cn(
            'inline-flex items-center gap-2 px-2 py-1.5 rounded-md border border-border bg-background',
            'hover:bg-muted/50 outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 transition-colors',
            'text-left min-w-0',
            className,
          )}
        >
          <span
            className="w-4 h-4 rounded border border-black/10 shrink-0"
            style={swatchStyle}
          />
          <span
            className={cn(
              'font-mono text-xs truncate',
              display.isToken ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {display.label}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[320px] p-3 max-h-[420px] overflow-y-auto">
        {/* Auto + system tokens row */}
        {(allowAuto || allowSystem) && (
          <div className="flex flex-wrap gap-1.5 mb-3 pb-3 border-b">
            {allowAuto && (
              <TokenChip
                active={value === 'auto'}
                label="auto"
                swatch="transparent"
                onClick={() => onChange('auto')}
                title="APCA-picked at render time"
              />
            )}
            {allowSystem && (
              <>
                <TokenChip
                  active={value === 'white'}
                  label="white"
                  swatch="#ffffff"
                  onClick={() => onChange('white')}
                />
                <TokenChip
                  active={value === 'black'}
                  label="black"
                  swatch="#000000"
                  onClick={() => onChange('black')}
                />
              </>
            )}
          </div>
        )}

        {/* Palette grid — one row per role */}
        <div className="space-y-2">
          {allowedRoles.map((role) => (
            <div key={role} className="space-y-1">
              <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-medium">
                {role}
              </p>
              <div className="grid grid-cols-5 gap-1">
                {ALL_RUNGS.map((rung) => {
                  const ref: PaletteRungRef = `${role}-${rung}`;
                  const isSelected = value === ref;
                  return (
                    <button
                      key={rung}
                      type="button"
                      aria-label={ref}
                      onClick={() => onChange(ref)}
                      className={cn(
                        'flex flex-col items-center gap-0.5 p-1 rounded outline-none',
                        'hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-foreground/30 transition-colors',
                        isSelected && 'ring-2 ring-foreground/40 bg-muted/30',
                      )}
                    >
                      <span
                        className="w-full h-5 rounded border border-black/10"
                        style={{ backgroundColor: palettes[role][rung] }}
                      />
                      <span className="text-[9px] text-muted-foreground capitalize">{rung}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Gradients section — v0.1.60. Renders when allowGradient is
            on AND there's at least one gradient defined. Each chip
            shows a small banner of the resolved gradient + the name. */}
        {allowGradient && gradients.length > 0 && (
          <div className="mt-3 pt-3 border-t space-y-1">
            <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-medium">
              gradients
            </p>
            <div className="grid grid-cols-1 gap-1">
              {gradients.map((g) => {
                const ref = `gradient-${g.slug}`;
                const isSelected = value === ref;
                return (
                  <button
                    key={g.slug}
                    type="button"
                    aria-label={ref}
                    onClick={() => onChange(ref)}
                    className={cn(
                      'flex items-center gap-2 p-1.5 rounded outline-none text-left',
                      'hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-foreground/30 transition-colors',
                      isSelected && 'ring-2 ring-foreground/40 bg-muted/30',
                    )}
                  >
                    <span
                      className="h-6 w-16 rounded border border-black/10 shrink-0"
                      style={{ background: g.css }}
                    />
                    <span className="flex flex-col min-w-0">
                      <span className="text-xs font-medium text-foreground truncate">{g.name}</span>
                      <span className="font-mono text-[9px] text-muted-foreground truncate">{ref}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Optional custom hex section */}
        {allowHex && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-medium mb-2">
              Custom hex
            </p>
            <ColorPickerPanel
              value={isHex(value) ? value : '#000000'}
              onChange={(hex) => onChange(hex)}
            />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function TokenChip({
  active, label, swatch, onClick, title,
}: { active: boolean; label: string; swatch: string; onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-mono',
        'hover:bg-muted/50 outline-none focus-visible:ring-2 focus-visible:ring-foreground/30',
        active ? 'border-foreground/40 bg-muted/30' : 'border-border bg-background',
      )}
    >
      <span
        className="w-3 h-3 rounded border border-black/10"
        style={{ backgroundColor: swatch }}
      />
      {label}
    </button>
  );
}

export default BrandTokenPicker;
