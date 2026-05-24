import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
import { cn } from "../../lib/utils.js";
import { Popover, PopoverContent, PopoverTrigger } from "./popover.js";
import { Input } from "./input.js";
import { Label } from "./label.js";
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
    return (_jsxs("div", { className: "space-y-2", children: [label && (_jsxs("div", { children: [_jsx(Label, { className: "text-sm font-medium", children: label }), description && _jsx("p", { className: "text-xs text-muted-foreground", children: description })] })), presets && presets.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-1.5", children: presets.map((preset) => (_jsxs("button", { type: "button", disabled: disabled, onClick: () => onChange(preset.value), className: cn("flex items-center gap-1.5 rounded-lg border-2 px-2.5 py-1.5 text-xs font-medium transition-all", value === preset.value
                        ? "border-blue-500 ring-2 ring-blue-500/30"
                        : "border-input hover:border-blue-300", disabled && "opacity-50 cursor-not-allowed"), title: preset.value, children: [_jsx("div", { className: "h-3.5 w-3.5 rounded-full ring-1 ring-inset ring-black/10", style: { backgroundColor: preset.value } }), _jsx("span", { children: preset.label })] }, preset.value))) })), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs(Popover, { children: [_jsx(PopoverTrigger, { asChild: true, children: _jsxs("button", { ref: ref, type: "button", disabled: disabled, className: cn("flex items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm transition-colors hover:bg-primary/10", sizeClasses[size], disabled && "opacity-50 cursor-not-allowed", className), children: [_jsx("div", { className: cn("rounded ring-1 ring-inset ring-black/10", swatchSize[size]), style: { backgroundColor: value || placeholder } }), _jsx("span", { className: "font-mono text-xs text-muted-foreground", children: value || placeholder })] }) }), _jsx(PopoverContent, { className: "w-64", align: "start", children: _jsxs("div", { className: "space-y-3", children: [_jsx("input", { type: "color", value: value || placeholder, onChange: (e) => onChange(e.target.value), disabled: disabled, className: "h-32 w-full cursor-pointer rounded-md border-0" }), _jsx(Input, { value: value, onChange: (e) => onChange(e.target.value), placeholder: placeholder, disabled: disabled, className: "font-mono text-sm" })] }) })] }), onReset && value && value !== defaultValue && (_jsx("button", { type: "button", onClick: onReset, className: cn("inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1", "text-[11px] text-muted-foreground transition-colors", "hover:bg-muted hover:text-foreground hover:border-foreground/30", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30", "ml-auto"), title: "Revert to default", children: "Reset" }))] })] }));
});
ColorPicker.displayName = "ColorPicker";
export { ColorPicker };
//# sourceMappingURL=color-picker.js.map