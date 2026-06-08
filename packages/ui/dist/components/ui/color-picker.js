import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
import { cn } from "../../lib/utils.js";
import { Popover, PopoverContent, PopoverTrigger } from "./popover.js";
import { Input } from "./input.js";
import { Label } from "./label.js";
/**
 * Flat picker panel — no popover wrapper. Renders the native color
 * input + hex text input directly. Use inside a Popover you control,
 * or inline in a form.
 */
export const ColorPickerPanel = React.forwardRef(({ value, onChange, presets, label, description, placeholder = "#000000", defaultValue, onReset, disabled = false, className, }, ref) => {
    return (_jsxs("div", { ref: ref, className: cn("space-y-3", className), children: [label && (_jsxs("div", { children: [_jsx(Label, { className: "text-sm font-medium", children: label }), description && _jsx("p", { className: "text-xs text-muted-foreground mt-0.5", children: description })] })), presets && presets.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-1.5", children: presets.map((preset) => (_jsxs("button", { type: "button", disabled: disabled, onClick: () => onChange(preset.value), className: cn("flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors", value === preset.value
                        ? "border-foreground/40 bg-muted/40"
                        : "border-border bg-background hover:border-foreground/20", disabled && "opacity-50 cursor-not-allowed"), title: preset.value, children: [_jsx("span", { className: "h-3 w-3 rounded-sm border border-black/10", style: { backgroundColor: preset.value } }), _jsx("span", { children: preset.label })] }, preset.value))) })), _jsx("input", { type: "color", value: value || placeholder, onChange: (e) => onChange(e.target.value), disabled: disabled, className: "h-32 w-full cursor-pointer rounded-md border-0 outline-none" }), _jsx(Input, { value: value, onChange: (e) => onChange(e.target.value), placeholder: placeholder, disabled: disabled, className: "font-mono text-sm" }), onReset && value && value !== defaultValue && (_jsx("button", { type: "button", onClick: onReset, className: cn("inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1", "text-[11px] text-muted-foreground transition-colors", "hover:bg-muted hover:text-foreground hover:border-foreground/30", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"), title: "Revert to default", children: "Reset" }))] }));
});
ColorPickerPanel.displayName = "ColorPickerPanel";
const ColorPicker = React.forwardRef(({ value, onChange, presets, label, description, placeholder = "#000000", defaultValue, onReset, className, size = "default", disabled = false, }, ref) => {
    const sizeClasses = {
        sm: "h-8",
        default: "h-10",
        lg: "h-12",
    };
    const swatchSize = {
        sm: "h-4 w-4",
        default: "h-6 w-6",
        lg: "h-8 w-8",
    };
    return (_jsxs("div", { className: "space-y-2", children: [label && (_jsxs("div", { children: [_jsx(Label, { className: "text-sm font-medium", children: label }), description && _jsx("p", { className: "text-xs text-muted-foreground", children: description })] })), _jsxs(Popover, { children: [_jsx(PopoverTrigger, { asChild: true, children: _jsxs("button", { ref: ref, type: "button", disabled: disabled, className: cn("flex items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm transition-colors hover:bg-primary/10", sizeClasses[size], disabled && "opacity-50 cursor-not-allowed", className), children: [_jsx("div", { className: cn("rounded ring-1 ring-inset ring-black/10", swatchSize[size]), style: { backgroundColor: value || placeholder } }), _jsx("span", { className: "font-mono text-xs text-muted-foreground", children: value || placeholder })] }) }), _jsx(PopoverContent, { className: "w-64 p-3", align: "start", children: _jsx(ColorPickerPanel, { value: value, onChange: onChange, presets: presets, placeholder: placeholder, defaultValue: defaultValue, onReset: onReset, disabled: disabled }) })] })] }));
});
ColorPicker.displayName = "ColorPicker";
export { ColorPicker };
//# sourceMappingURL=color-picker.js.map