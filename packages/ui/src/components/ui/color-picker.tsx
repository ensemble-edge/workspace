/**
 * ColorPicker — A reusable color picker built from shadcn/ui primitives.
 *
 * Two exports:
 *
 *   <ColorPickerPanel> — the FLAT picker UI (native color input +
 *       hex text input + optional reset/label/presets). No popover
 *       wrapper. Use this when YOU already provide the surface (e.g.
 *       inside a Popover you control, or inline in a form).
 *
 *   <ColorPicker> — a standalone control that includes its own
 *       swatch-trigger button + popover containing the panel. Use
 *       this when you want a "click this small swatch to edit"
 *       affordance with no other UI.
 *
 * v0.1.57: Split the previous monolith into Panel + standalone so
 * callsites that already provide a Popover don't get a
 * popover-inside-popover (three-click experience). The brand color
 * editors use Panel inside their own Popovers; legacy callsites
 * that used ColorPicker standalone keep working unchanged.
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { Input } from "./input"
import { Label } from "./label"

export interface ColorPreset {
  value: string
  label: string
}

export interface ColorPickerPanelProps {
  /** Current hex color value */
  value: string
  /** Called when color changes (on every keystroke / drag). */
  onChange: (value: string) => void
  /** Optional preset colors shown as a small chip row at the top. */
  presets?: ColorPreset[]
  /** Optional label shown above the picker. */
  label?: string
  /** Optional description shown under the label. */
  description?: string
  /** Placeholder when no value */
  placeholder?: string
  /** Show reset button when value differs from default */
  defaultValue?: string
  /** Called when reset is clicked. When present + value is set,
   *  a "Reset" affordance appears below the hex input. */
  onReset?: () => void
  /** Disabled state */
  disabled?: boolean
  /** Additional class on the outer container */
  className?: string
}

/**
 * Flat picker panel — no popover wrapper. Renders the native color
 * input + hex text input directly. Use inside a Popover you control,
 * or inline in a form.
 */
export const ColorPickerPanel = React.forwardRef<HTMLDivElement, ColorPickerPanelProps>(
  ({
    value,
    onChange,
    presets,
    label,
    description,
    placeholder = "#000000",
    defaultValue,
    onReset,
    disabled = false,
    className,
  }, ref) => {
    return (
      <div ref={ref} className={cn("space-y-3", className)}>
        {label && (
          <div>
            <Label className="text-sm font-medium">{label}</Label>
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
        )}

        {/* Optional preset chips. Click to set value. */}
        {presets && presets.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {presets.map((preset) => (
              <button
                key={preset.value}
                type="button"
                disabled={disabled}
                onClick={() => onChange(preset.value)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                  value === preset.value
                    ? "border-foreground/40 bg-muted/40"
                    : "border-border bg-background hover:border-foreground/20",
                  disabled && "opacity-50 cursor-not-allowed",
                )}
                title={preset.value}
              >
                <span
                  className="h-3 w-3 rounded-sm border border-black/10"
                  style={{ backgroundColor: preset.value }}
                />
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Native color input — gives the operator the OS color
            picker (HSL sliders, EyeDropper API on supported
            platforms, etc.). Larger area for a comfortable drag. */}
        <input
          type="color"
          value={value || placeholder}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-32 w-full cursor-pointer rounded-md border-0 outline-none"
        />

        {/* Hex text input — also editable. Stays in sync with the
            native picker; operator can type or drag, both work. */}
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="font-mono text-sm"
        />

        {/* Reset affordance. Visible when both onReset is wired AND
            the current value differs from defaultValue (or when
            defaultValue is unset and we have a value — that covers
            the "override exists, clear it" rung case). */}
        {onReset && value && value !== defaultValue && (
          <button
            type="button"
            onClick={onReset}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1",
              "text-[11px] text-muted-foreground transition-colors",
              "hover:bg-muted hover:text-foreground hover:border-foreground/30",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30",
            )}
            title="Revert to default"
          >
            Reset
          </button>
        )}
      </div>
    )
  }
)
ColorPickerPanel.displayName = "ColorPickerPanel"

/* ──────────────────────────────────────────────────────────────
 * ColorPicker — standalone (swatch trigger + popover + panel)
 * ──────────────────────────────────────────────────────────── */

export interface ColorPickerProps extends Omit<ColorPickerPanelProps, "className"> {
  /** Additional class on the trigger button */
  className?: string
  /** Size variant */
  size?: "sm" | "default" | "lg"
}

const ColorPicker = React.forwardRef<HTMLButtonElement, ColorPickerProps>(
  ({
    value,
    onChange,
    presets,
    label,
    description,
    placeholder = "#000000",
    defaultValue,
    onReset,
    className,
    size = "default",
    disabled = false,
  }, ref) => {
    const sizeClasses = {
      sm: "h-8",
      default: "h-10",
      lg: "h-12",
    }
    const swatchSize = {
      sm: "h-4 w-4",
      default: "h-6 w-6",
      lg: "h-8 w-8",
    }

    return (
      <div className="space-y-2">
        {label && (
          <div>
            <Label className="text-sm font-medium">{label}</Label>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
        )}

        <Popover>
          <PopoverTrigger asChild>
            <button
              ref={ref}
              type="button"
              disabled={disabled}
              className={cn(
                "flex items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm transition-colors hover:bg-primary/10",
                sizeClasses[size],
                disabled && "opacity-50 cursor-not-allowed",
                className,
              )}
            >
              <div
                className={cn("rounded ring-1 ring-inset ring-black/10", swatchSize[size])}
                style={{ backgroundColor: value || placeholder }}
              />
              <span className="font-mono text-xs text-muted-foreground">
                {value || placeholder}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            <ColorPickerPanel
              value={value}
              onChange={onChange}
              presets={presets}
              placeholder={placeholder}
              defaultValue={defaultValue}
              onReset={onReset}
              disabled={disabled}
            />
          </PopoverContent>
        </Popover>
      </div>
    )
  }
)
ColorPicker.displayName = "ColorPicker"

export { ColorPicker }
