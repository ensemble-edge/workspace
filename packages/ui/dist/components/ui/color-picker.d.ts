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
import * as React from "react";
export interface ColorPreset {
    value: string;
    label: string;
}
export interface ColorPickerPanelProps {
    /** Current hex color value */
    value: string;
    /** Called when color changes (on every keystroke / drag). */
    onChange: (value: string) => void;
    /** Optional preset colors shown as a small chip row at the top. */
    presets?: ColorPreset[];
    /** Optional label shown above the picker. */
    label?: string;
    /** Optional description shown under the label. */
    description?: string;
    /** Placeholder when no value */
    placeholder?: string;
    /** Show reset button when value differs from default */
    defaultValue?: string;
    /** Called when reset is clicked. When present + value is set,
     *  a "Reset" affordance appears below the hex input. */
    onReset?: () => void;
    /** Disabled state */
    disabled?: boolean;
    /** Additional class on the outer container */
    className?: string;
}
/**
 * Flat picker panel — no popover wrapper. Renders the native color
 * input + hex text input directly. Use inside a Popover you control,
 * or inline in a form.
 */
export declare const ColorPickerPanel: React.ForwardRefExoticComponent<ColorPickerPanelProps & React.RefAttributes<HTMLDivElement>>;
export interface ColorPickerProps extends Omit<ColorPickerPanelProps, "className"> {
    /** Additional class on the trigger button */
    className?: string;
    /** Size variant */
    size?: "sm" | "default" | "lg";
}
declare const ColorPicker: React.ForwardRefExoticComponent<ColorPickerProps & React.RefAttributes<HTMLButtonElement>>;
export { ColorPicker };
//# sourceMappingURL=color-picker.d.ts.map