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
import * as React from "react";
export interface ColorPreset {
    value: string;
    label: string;
}
export interface ColorPickerProps {
    /** Current hex color value */
    value: string;
    /** Called when color changes */
    onChange: (value: string) => void;
    /** Optional preset colors to show as quick picks */
    presets?: ColorPreset[];
    /** Optional label */
    label?: string;
    /** Optional description */
    description?: string;
    /** Placeholder when no value */
    placeholder?: string;
    /** Show reset button when value differs from default */
    defaultValue?: string;
    /** Called when reset is clicked */
    onReset?: () => void;
    /** Additional class for the trigger button */
    className?: string;
    /** Size variant */
    size?: "sm" | "default" | "lg";
    /** Disabled state */
    disabled?: boolean;
}
declare const ColorPicker: React.ForwardRefExoticComponent<ColorPickerProps & React.RefAttributes<HTMLButtonElement>>;
export { ColorPicker };
//# sourceMappingURL=color-picker.d.ts.map