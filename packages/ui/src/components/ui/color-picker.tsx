/**
 * ColorPicker — A reusable color picker built from shadcn/ui primitives.
 *
 * Uses Popover + native color input + hex text Input.
 * Follows shadcn patterns: forwardRef, cn(), composable.
 *
 * Usage:
 *   <ColorPicker value="#3b82f6" onChange={setValue} />
 *   <ColorPicker value={color} onChange={setColor} presets={[...]} />
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

export interface ColorPickerProps {
  /** Current hex color value */
  value: string
  /** Called when color changes */
  onChange: (value: string) => void
  /** Optional preset colors to show as quick picks */
  presets?: ColorPreset[]
  /** Optional label */
  label?: string
  /** Optional description */
  description?: string
  /** Placeholder when no value */
  placeholder?: string
  /** Show reset button when value differs from default */
  defaultValue?: string
  /** Called when reset is clicked */
  onReset?: () => void
  /** Additional class for the trigger button */
  className?: string
  /** Size variant */
  size?: "sm" | "default" | "lg"
  /** Disabled state */
  disabled?: boolean
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

        {/* Presets */}
        {presets && presets.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {presets.map((preset) => (
              <button
                key={preset.value}
                type="button"
                disabled={disabled}
                onClick={() => onChange(preset.value)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border-2 px-2.5 py-1.5 text-xs font-medium transition-all",
                  value === preset.value
                    ? "border-blue-500 ring-2 ring-blue-500/30"
                    : "border-input hover:border-blue-300",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
                title={preset.value}
              >
                <div
                  className="h-3.5 w-3.5 rounded-full ring-1 ring-inset ring-black/10"
                  style={{ backgroundColor: preset.value }}
                />
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Picker trigger + hex display */}
        <div className="flex items-center gap-2">
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
                  className
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
            <PopoverContent className="w-64" align="start">
              <div className="space-y-3">
                <input
                  type="color"
                  value={value || placeholder}
                  onChange={(e) => onChange(e.target.value)}
                  disabled={disabled}
                  className="h-32 w-full cursor-pointer rounded-md border-0"
                />
                <Input
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder={placeholder}
                  disabled={disabled}
                  className="font-mono text-sm"
                />
              </div>
            </PopoverContent>
          </Popover>

          {/* Reset button */}
          {onReset && value && value !== defaultValue && (
            <button
              type="button"
              onClick={onReset}
              className="text-xs text-muted-foreground hover:text-foreground ml-auto"
            >
              Reset
            </button>
          )}
        </div>
      </div>
    )
  }
)
ColorPicker.displayName = "ColorPicker"

export { ColorPicker }
