import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover.js';
import { ColorPickerPanel } from '../ui/color-picker.js';
import { cn } from '../../lib/utils.js';
const ALL_RUNGS = ['dark', 'main', 'bright', 'pastel', 'faded'];
const ALL_ROLES = ['primary', 'secondary', 'accent', 'neutral'];
function isRungRef(v) {
    return /^(primary|secondary|accent|neutral)-(dark|main|bright|pastel|faded)$/.test(v);
}
function isHex(v) {
    return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);
}
function resolveDisplay(value, palettes) {
    if (value === 'auto')
        return { label: 'auto', swatch: 'transparent', isToken: false };
    if (value === 'white')
        return { label: 'white', swatch: '#ffffff', isToken: true };
    if (value === 'black')
        return { label: 'black', swatch: '#000000', isToken: true };
    if (isRungRef(value)) {
        const [role, rung] = value.split('-');
        return { label: value, swatch: palettes[role][rung], isToken: true };
    }
    if (isHex(value))
        return { label: value.toUpperCase(), swatch: value, isToken: false };
    return { label: value, swatch: '#000000', isToken: false };
}
export function BrandTokenPicker({ value, onChange, palettes, allowHex = false, allowAuto = false, allowSystem = false, allowedRoles = ALL_ROLES, label, className, }) {
    const display = resolveDisplay(value, palettes);
    return (_jsxs(Popover, { children: [_jsx(PopoverTrigger, { asChild: true, children: _jsxs("button", { type: "button", "aria-label": label ?? `Pick color token (current: ${display.label})`, className: cn('inline-flex items-center gap-2 px-2 py-1.5 rounded-md border border-border bg-background', 'hover:bg-muted/50 outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 transition-colors', 'text-left min-w-0', className), children: [_jsx("span", { className: "w-4 h-4 rounded border border-black/10 shrink-0", style: { backgroundColor: display.swatch } }), _jsx("span", { className: cn('font-mono text-xs truncate', display.isToken ? 'text-foreground' : 'text-muted-foreground'), children: display.label })] }) }), _jsxs(PopoverContent, { align: "start", className: "w-[320px] p-3 max-h-[420px] overflow-y-auto", children: [(allowAuto || allowSystem) && (_jsxs("div", { className: "flex flex-wrap gap-1.5 mb-3 pb-3 border-b", children: [allowAuto && (_jsx(TokenChip, { active: value === 'auto', label: "auto", swatch: "transparent", onClick: () => onChange('auto'), title: "APCA-picked at render time" })), allowSystem && (_jsxs(_Fragment, { children: [_jsx(TokenChip, { active: value === 'white', label: "white", swatch: "#ffffff", onClick: () => onChange('white') }), _jsx(TokenChip, { active: value === 'black', label: "black", swatch: "#000000", onClick: () => onChange('black') })] }))] })), _jsx("div", { className: "space-y-2", children: allowedRoles.map((role) => (_jsxs("div", { className: "space-y-1", children: [_jsx("p", { className: "text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-medium", children: role }), _jsx("div", { className: "grid grid-cols-5 gap-1", children: ALL_RUNGS.map((rung) => {
                                        const ref = `${role}-${rung}`;
                                        const isSelected = value === ref;
                                        return (_jsxs("button", { type: "button", "aria-label": ref, onClick: () => onChange(ref), className: cn('flex flex-col items-center gap-0.5 p-1 rounded outline-none', 'hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-foreground/30 transition-colors', isSelected && 'ring-2 ring-foreground/40 bg-muted/30'), children: [_jsx("span", { className: "w-full h-5 rounded border border-black/10", style: { backgroundColor: palettes[role][rung] } }), _jsx("span", { className: "text-[9px] text-muted-foreground capitalize", children: rung })] }, rung));
                                    }) })] }, role))) }), allowHex && (_jsxs("div", { className: "mt-3 pt-3 border-t", children: [_jsx("p", { className: "text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-medium mb-2", children: "Custom hex" }), _jsx(ColorPickerPanel, { value: isHex(value) ? value : '#000000', onChange: (hex) => onChange(hex) })] }))] })] }));
}
function TokenChip({ active, label, swatch, onClick, title, }) {
    return (_jsxs("button", { type: "button", title: title, onClick: onClick, className: cn('inline-flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-mono', 'hover:bg-muted/50 outline-none focus-visible:ring-2 focus-visible:ring-foreground/30', active ? 'border-foreground/40 bg-muted/30' : 'border-border bg-background'), children: [_jsx("span", { className: "w-3 h-3 rounded border border-black/10", style: { backgroundColor: swatch } }), label] }));
}
export default BrandTokenPicker;
//# sourceMappingURL=BrandTokenPicker.js.map