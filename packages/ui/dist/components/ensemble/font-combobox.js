import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "../../lib/utils.js";
import { Button } from "../ui/button.js";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, } from "../ui/command.js";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover.js";
// ─── Lazy font-CSS loader ──────────────────────────────────────────
//
// Each Google Fonts family the picker wants to render needs a <link>
// in the document head. We track loaded families in a module-level Set
// so multiple comboboxes share one load per family, and so the load
// persists when the picker closes/reopens.
const LOADED_FAMILIES = new Set();
function ensureFontLoaded(family) {
    if (LOADED_FAMILIES.has(family))
        return;
    if (typeof document === "undefined")
        return;
    LOADED_FAMILIES.add(family);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    // Only load 400 + 700 for the picker preview — enough to render the
    // family name in its natural weight. Operator-final selections trigger
    // a separate full load via the shell entry HTML.
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@400;700&display=swap`;
    document.head.appendChild(link);
}
// ─── Option row ────────────────────────────────────────────────────
function OptionRow({ option, selected, systemStack, }) {
    const ref = React.useRef(null);
    // Lazy-load this family's CSS when the row scrolls into view.
    React.useEffect(() => {
        if (systemStack)
            return; // system fonts don't need loading
        const el = ref.current;
        if (!el)
            return;
        if ("IntersectionObserver" in window) {
            const io = new IntersectionObserver((entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        ensureFontLoaded(option.family);
                        io.disconnect();
                        break;
                    }
                }
            }, { rootMargin: "100px" });
            io.observe(el);
            return () => io.disconnect();
        }
        // No IO support — load immediately.
        ensureFontLoaded(option.family);
    }, [option.family, systemStack]);
    const previewStyle = systemStack
        ? { fontFamily: systemStack }
        : { fontFamily: `"${option.family}", sans-serif` };
    return (_jsxs("div", { ref: ref, className: "flex items-center w-full gap-2", children: [_jsx(Check, { className: cn("h-4 w-4 shrink-0", selected ? "opacity-100" : "opacity-0") }), _jsx("span", { className: "flex-1 text-base truncate", style: previewStyle, children: option.family }), option.hint && (_jsx("span", { className: "text-xs text-muted-foreground shrink-0", children: option.hint }))] }));
}
// ─── Combobox ──────────────────────────────────────────────────────
export const FontCombobox = React.forwardRef(({ value, onChange, systemFonts, googleFonts, recent, onFirstSearch, disabled, placeholder, className }, ref) => {
    const [open, setOpen] = React.useState(false);
    const firstSearchFired = React.useRef(false);
    const handleSearchInput = React.useCallback((next) => {
        if (!firstSearchFired.current && next.trim().length > 0 && onFirstSearch) {
            firstSearchFired.current = true;
            onFirstSearch();
        }
    }, [onFirstSearch]);
    // Group Google Fonts by category for browsability.
    const groupedGoogle = React.useMemo(() => {
        const groups = new Map();
        for (const f of googleFonts) {
            const k = f.category || "Other";
            if (!groups.has(k))
                groups.set(k, []);
            groups.get(k).push(f);
        }
        return groups;
    }, [googleFonts]);
    const recentOptions = React.useMemo(() => {
        if (!recent || recent.length === 0)
            return [];
        // Look up each recent family in the full list.
        return recent
            .map((family) => systemFonts.find((s) => s.family === family) ??
            googleFonts.find((g) => g.family === family))
            .filter((o) => !!o);
    }, [recent, systemFonts, googleFonts]);
    // Find the system stack (if any) for live preview in the trigger.
    const systemStackForTrigger = React.useMemo(() => {
        const sys = systemFonts.find((s) => s.family === value);
        return sys && "stack" in sys
            ? (sys.stack)
            : undefined;
    }, [value, systemFonts]);
    // Eagerly load the selected family if it's a Google Font, so the
    // trigger renders in its proper face.
    React.useEffect(() => {
        if (value && !systemStackForTrigger)
            ensureFontLoaded(value);
    }, [value, systemStackForTrigger]);
    return (_jsxs(Popover, { open: open, onOpenChange: setOpen, children: [_jsx(PopoverTrigger, { asChild: true, children: _jsxs(Button, { ref: ref, type: "button", variant: "outline", role: "combobox", "aria-expanded": open, disabled: disabled, className: cn("w-full justify-between", className), children: [_jsx("span", { className: "truncate text-base", style: systemStackForTrigger
                                ? { fontFamily: systemStackForTrigger }
                                : { fontFamily: `"${value}", sans-serif` }, children: value || placeholder || "Pick a font…" }), _jsx(ChevronsUpDown, { className: "ml-2 h-4 w-4 shrink-0 opacity-50" })] }) }), _jsx(PopoverContent, { className: "w-[var(--radix-popover-trigger-width)] p-0", align: "start", children: _jsxs(Command, { children: [_jsx(CommandInput, { placeholder: "Search fonts\u2026", onValueChange: handleSearchInput }), _jsxs(CommandList, { className: "max-h-80", children: [_jsx(CommandEmpty, { children: "No fonts match." }), _jsx(CommandGroup, { heading: "System", children: systemFonts.map((opt) => (_jsx(CommandItem, { value: opt.family, onSelect: () => { onChange(opt.family); setOpen(false); }, children: _jsx(OptionRow, { option: opt, selected: value === opt.family, systemStack: opt.stack }) }, `sys:${opt.family}`))) }), recentOptions.length > 0 && (_jsxs(_Fragment, { children: [_jsx(CommandSeparator, {}), _jsx(CommandGroup, { heading: "Recently picked", children: recentOptions.map((opt) => (_jsx(CommandItem, { value: opt.family, onSelect: () => { onChange(opt.family); setOpen(false); }, children: _jsx(OptionRow, { option: opt, selected: value === opt.family }) }, `recent:${opt.family}`))) })] })), Array.from(groupedGoogle.entries()).map(([category, options]) => (_jsxs(React.Fragment, { children: [_jsx(CommandSeparator, {}), _jsx(CommandGroup, { heading: prettyCategory(category), children: options.map((opt) => (_jsx(CommandItem, { value: opt.family, onSelect: () => { onChange(opt.family); setOpen(false); }, children: _jsx(OptionRow, { option: opt, selected: value === opt.family }) }, `g:${opt.family}`))) })] }, `cat:${category}`)))] })] }) })] }));
});
FontCombobox.displayName = "FontCombobox";
function prettyCategory(c) {
    switch (c) {
        case "sans-serif": return "Sans Serif";
        case "serif": return "Serif";
        case "display": return "Display";
        case "monospace": return "Monospace";
        case "handwriting": return "Handwriting";
        default: return c.split("-").map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");
    }
}
//# sourceMappingURL=font-combobox.js.map