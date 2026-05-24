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
import { ColorPicker } from '../ui/color-picker';
import { cn } from '../../lib/utils';

export type PaletteRole = 'primary' | 'secondary' | 'accent' | 'neutral';
export type RungName = 'dark' | 'main' | 'bright' | 'pastel' | 'faded';
export type PaletteRungRef = `${PaletteRole}-${RungName}`;
export type ResolvedPalettes = Record<PaletteRole, Record<RungName, string>>;

export interface BrandTokenPickerProps {
  /** Current stored value — token ref, hex, or "auto"/"white"/"black". */
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

function resolveDisplay(value: string, palettes: ResolvedPalettes): { label: string; swatch: string; isToken: boolean } {
  if (value === 'auto') return { label: 'auto', swatch: 'transparent', isToken: false };
  if (value === 'white') return { label: 'white', swatch: '#ffffff', isToken: true };
  if (value === 'black') return { label: 'black', swatch: '#000000', isToken: true };
  if (isRungRef(value)) {
    const [role, rung] = value.split('-') as [PaletteRole, RungName];
    return { label: value, swatch: palettes[role][rung], isToken: true };
  }
  if (isHex(value)) return { label: value.toUpperCase(), swatch: value, isToken: false };
  return { label: value, swatch: '#000000', isToken: false };
}

export function BrandTokenPicker({
  value,
  onChange,
  palettes,
  allowHex = false,
  allowAuto = false,
  allowSystem = false,
  allowedRoles = ALL_ROLES,
  label,
  className,
}: BrandTokenPickerProps) {
  const display = resolveDisplay(value, palettes);

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
            style={{ backgroundColor: display.swatch }}
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

        {/* Optional custom hex section */}
        {allowHex && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-medium mb-2">
              Custom hex
            </p>
            <ColorPicker
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
