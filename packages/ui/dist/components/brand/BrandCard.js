import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * BrandCard — unified display unit for a workspace's brand color system.
 *
 * v0.1.55. Single component, two consumers, two modes:
 *
 *   Consumers:
 *     - Brand Overview tab (display mode)
 *     - /brand public guide (display mode)
 *     - Brand Colors editor tab (edit mode — hosts inline editors)
 *
 *   Modes:
 *     - display: click-to-copy swatches, no inputs, no pickers
 *     - edit: name/gradient-name become inline-editable inputs;
 *             Main faces and rung swatches open ColorPicker popovers
 *
 * The component receives a "resolved" data structure (every rung +
 * theme binding pre-resolved to hex) via the `data` prop. Resolution
 * lives in @ensemble-edge/core (services/brand-colors/resolver.ts);
 * this component is render-only.
 *
 * Sections (in order):
 *   1. Brand palettes — 3-up grid of Primary, Secondary, Accent
 *   2. Neutral — single horizontal strip with five rungs
 *   3. Gradients — stacked named banners (hidden when empty)
 *   4. Semantic — 4-up grid of state-color pairs
 *
 * Every swatch is click-to-copy with toast confirmation. Hover
 * affordances follow the card spec (brightness 0.97 on filled
 * faces, translateY -1px on chips).
 */
import * as React from 'react';
import { toast } from '../ui/sonner.js';
import { Input } from '../ui/input.js';
import { ColorPicker } from '../ui/color-picker.js';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover.js';
import { cn } from '../../lib/utils.js';
/* ──────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────── */
async function copyToClipboard(value, label) {
    try {
        await navigator.clipboard.writeText(value);
        toast.success(`Copied ${label}`);
    }
    catch {
        toast.error('Copy failed');
    }
}
function gradientCssString(g) {
    const stops = g.resolvedStops.map((s) => s.hex).join(', ');
    if (g.mode === 'radial')
        return `radial-gradient(circle, ${stops})`;
    return `linear-gradient(${g.angle}deg, ${stops})`;
}
/** Compact "color label" — token reference if available, else hex. */
function colorLabel(token, hex) {
    if (token === 'white' || token === 'black')
        return { primary: token, isToken: true };
    if (/^(primary|secondary|accent|neutral)-/.test(token))
        return { primary: token, isToken: true };
    return { primary: hex.toUpperCase(), isToken: false };
}
function Swatch({ color, label, className, style, ariaLabel, onClick, children }) {
    const handleClick = () => {
        if (onClick) {
            onClick();
            return;
        }
        if (label)
            copyToClipboard(label, label);
    };
    return (_jsx("div", { role: "button", tabIndex: 0, "aria-label": ariaLabel ?? (label ? `Copy hex ${label}` : 'Color swatch'), onClick: handleClick, onKeyDown: (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick();
            }
        }, className: cn('cursor-pointer transition-transform border-[0.5px] border-black/10 outline-none', 'hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-foreground/30', className), style: { backgroundColor: color, ...style }, children: children }));
}
function PaletteCard({ role, palette, resolved, onColor, mode, onNameChange, onMainChange, onRungOverride, }) {
    const isEdit = mode === 'edit';
    const main = resolved.main;
    const fg = onColor.hex;
    const rungs = [
        { name: 'dark', hex: resolved.dark, label: 'Dark' },
        { name: 'bright', hex: resolved.bright, label: 'Bright' },
        { name: 'pastel', hex: resolved.pastel, label: 'Pastel' },
        { name: 'faded', hex: resolved.faded, label: 'Faded' },
    ];
    return (_jsxs("div", { className: "rounded-2xl overflow-hidden bg-background border-[0.5px] border-black/[0.07]", children: [isEdit ? (_jsxs(Popover, { children: [_jsx(PopoverTrigger, { asChild: true, children: _jsxs("div", { role: "button", tabIndex: 0, "aria-label": `Open color picker for ${role} main`, className: "aspect-[16/11] p-[18px] flex flex-col justify-between cursor-pointer transition-[filter] hover:brightness-[0.97] outline-none focus-visible:ring-2 focus-visible:ring-foreground/30", style: { backgroundColor: main, color: fg }, children: [_jsx(PaletteFaceContent, { role: role, palette: palette, mode: mode, onNameChange: onNameChange, fg: fg }), _jsx(PaletteFaceFooter, { role: role, hex: main, fg: fg })] }) }), _jsx(PopoverContent, { className: "p-3 w-[280px]", align: "start", children: _jsx(ColorPicker, { label: `${palette.name} main`, value: palette.main, onChange: (hex) => onMainChange?.(hex) }) })] })) : (_jsxs("div", { role: "button", tabIndex: 0, "aria-label": `Copy hex ${main}`, onClick: () => copyToClipboard(main, main), onKeyDown: (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        copyToClipboard(main, main);
                    }
                }, className: "aspect-[16/11] p-[18px] flex flex-col justify-between cursor-pointer transition-[filter] hover:brightness-[0.97] outline-none focus-visible:ring-2 focus-visible:ring-foreground/30", style: { backgroundColor: main, color: fg }, children: [_jsx(PaletteFaceContent, { role: role, palette: palette, mode: mode, fg: fg }), _jsx(PaletteFaceFooter, { role: role, hex: main, fg: fg })] })), _jsx("div", { className: "grid grid-cols-4 gap-2 p-3 bg-background", children: rungs.map((r) => (_jsx(RungChip, { role: role, rung: r.name, hex: r.hex, label: r.label, mode: mode, onOverride: onRungOverride }, r.name))) })] }));
}
function PaletteFaceContent({ role, palette, mode, onNameChange, fg, }) {
    return (_jsxs("div", { className: "flex flex-col gap-1", children: [mode === 'edit' && onNameChange ? (_jsx(Input, { value: palette.name, onChange: (e) => onNameChange(e.currentTarget.value), onClick: (e) => e.stopPropagation(), className: "bg-transparent border-0 px-0 h-auto text-[26px] font-normal leading-[1.05] tracking-tight focus-visible:ring-0 hover:bg-black/5", style: {
                    color: fg,
                    fontFamily: 'var(--brand-font-display, var(--brand-font-heading, inherit))',
                } })) : (_jsx("p", { className: "text-[26px] font-normal leading-[1.05] tracking-tight", style: {
                    color: fg,
                    fontFamily: 'var(--brand-font-display, var(--brand-font-heading, inherit))',
                }, children: palette.name })), _jsx("p", { className: "text-[10px] font-medium tracking-[0.12em] opacity-70", style: {
                    color: fg,
                    // Mockup spec: role label is lowercase, not uppercase.
                    // Matches the editorial feel — the palette name is the
                    // shouted thing, the role is the quiet identifier.
                    textTransform: 'lowercase',
                    fontFamily: 'var(--brand-font-eyebrow, var(--brand-font-body, inherit))',
                }, children: role })] }));
}
function PaletteFaceFooter({ role, hex, fg }) {
    return (_jsxs("div", { className: "flex items-end justify-between text-[11px]", style: {
            color: fg,
            fontFamily: 'var(--brand-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
        }, children: [_jsxs("span", { className: "opacity-90", children: [role, "-main"] }), _jsx("span", { className: "opacity-90", children: hex.toUpperCase() })] }));
}
function RungChip({ role, rung, hex, label, mode, onOverride, showMeta = true, chipHeight = 24 }) {
    const chipStyle = { backgroundColor: hex, height: chipHeight };
    if (mode === 'edit' && onOverride) {
        return (_jsxs(Popover, { children: [_jsx(PopoverTrigger, { asChild: true, children: _jsxs("button", { type: "button", "aria-label": `Edit ${role}-${rung}`, className: "flex flex-col gap-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 rounded", children: [_jsx("span", { className: "rounded-md border-[0.5px] border-black/10 cursor-pointer hover:-translate-y-px transition-transform", style: chipStyle }), showMeta && (_jsxs("span", { className: "flex flex-col gap-0", children: [_jsx("span", { className: "text-[10px] font-medium text-foreground tracking-[0.04em]", style: { fontFamily: 'var(--brand-font-label, var(--brand-font-body, inherit))' }, children: label }), _jsx("span", { className: "text-[9.5px] text-muted-foreground", style: { fontFamily: 'var(--brand-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)' }, children: hex.toUpperCase() })] }))] }) }), _jsx(PopoverContent, { className: "p-3 w-[280px]", align: "start", children: _jsx(ColorPicker, { label: `${role}-${rung} override`, description: "Reset returns to the OkLCh-derived value.", value: hex, onChange: (next) => onOverride(rung, next), onReset: () => onOverride(rung, null) }) })] }));
    }
    return (_jsxs("div", { className: "flex flex-col gap-1", children: [_jsx(Swatch, { color: hex, label: hex.toUpperCase(), className: "rounded-md", style: { height: chipHeight } }), showMeta && (_jsxs(_Fragment, { children: [_jsx("span", { className: "text-[10px] font-medium text-foreground tracking-[0.04em]", style: { fontFamily: 'var(--brand-font-label, var(--brand-font-body, inherit))' }, children: label }), _jsx("span", { className: "text-[9.5px] text-muted-foreground", style: { fontFamily: 'var(--brand-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)' }, children: hex.toUpperCase() })] }))] }));
}
function NeutralStrip({ palette, resolved, mode, onNameChange, onRungOverride }) {
    const isEdit = mode === 'edit';
    return (_jsx("div", { className: "rounded-2xl border-[0.5px] border-black/[0.07] bg-background p-5", children: _jsxs("div", { className: "grid grid-cols-[180px_1fr] gap-6 items-center", children: [_jsxs("div", { className: "flex flex-col gap-1", children: [isEdit && onNameChange ? (_jsx(Input, { value: palette.name, onChange: (e) => onNameChange(e.currentTarget.value), className: "bg-transparent border-0 px-0 h-auto text-[22px] font-normal tracking-tight focus-visible:ring-0 hover:bg-black/5", style: { fontFamily: 'var(--brand-font-display, var(--brand-font-heading, inherit))' } })) : (_jsx("p", { className: "text-[22px] font-normal tracking-tight leading-none", style: { fontFamily: 'var(--brand-font-display, var(--brand-font-heading, inherit))' }, children: palette.name })), _jsx("p", { className: "text-[11px] font-medium tracking-[0.12em] text-muted-foreground mt-1.5", style: {
                                textTransform: 'lowercase',
                                fontFamily: 'var(--brand-font-eyebrow, var(--brand-font-body, inherit))',
                            }, children: "neutral" }), _jsx("p", { className: "text-xs text-muted-foreground", children: "Surfaces \u00B7 borders \u00B7 muted text. Derived from primary by default." })] }), _jsx("div", { className: "grid grid-cols-5 gap-2", children: ['dark', 'main', 'bright', 'pastel', 'faded'].map((rung) => (_jsxs("div", { className: "flex flex-col gap-1", children: [rung === 'main' ? (_jsx(Swatch, { color: resolved.main, label: resolved.main.toUpperCase(), className: "h-[36px] rounded-md", style: { boxShadow: '0 0 0 1.5px var(--foreground, #18181B)' } })) : (_jsx(RungChip, { role: "neutral", rung: rung, hex: resolved[rung], label: rung.charAt(0).toUpperCase() + rung.slice(1), mode: mode, onOverride: onRungOverride, showMeta: false, chipHeight: 36 })), _jsx("span", { className: "text-[11px] font-medium text-foreground capitalize", children: rung }), _jsx("span", { className: "font-mono text-[9.5px] text-muted-foreground", children: resolved[rung].toUpperCase() })] }, rung))) })] }) }));
}
function GradientBanner({ gradient, onColor, mode, onNameChange }) {
    const css = gradientCssString(gradient);
    const isEdit = mode === 'edit';
    return (_jsxs("div", { className: "rounded-2xl overflow-hidden border-[0.5px] border-black/[0.07] bg-background", children: [_jsx("div", { role: "button", tabIndex: 0, "aria-label": `Copy gradient ${gradient.slug}`, onClick: () => copyToClipboard(css, `gradient-${gradient.slug}`), onKeyDown: (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        copyToClipboard(css, `gradient-${gradient.slug}`);
                    }
                }, className: "h-[90px] flex items-center px-5 cursor-pointer transition-[filter] hover:brightness-[0.97] outline-none focus-visible:ring-2 focus-visible:ring-foreground/30", style: { background: css, color: onColor.hex }, children: isEdit && onNameChange ? (_jsx(Input, { value: gradient.name, onChange: (e) => onNameChange(e.currentTarget.value), onClick: (e) => e.stopPropagation(), className: "bg-transparent border-0 px-0 h-auto text-[32px] font-normal tracking-tight focus-visible:ring-0 hover:bg-black/5", style: {
                        color: onColor.hex,
                        fontFamily: 'var(--brand-font-display, var(--brand-font-heading, inherit))',
                    } })) : (_jsx("p", { className: "text-[32px] font-normal tracking-tight leading-none", style: {
                        color: onColor.hex,
                        fontFamily: 'var(--brand-font-display, var(--brand-font-heading, inherit))',
                    }, children: gradient.name })) }), _jsxs("div", { className: "flex items-center justify-between px-4 py-2.5 text-[11px] border-t border-black/[0.07]", style: { fontFamily: 'var(--brand-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)' }, children: [_jsxs("span", { className: "text-muted-foreground", children: ["gradient-", gradient.slug] }), _jsx("div", { className: "flex items-center gap-2 flex-wrap", children: gradient.resolvedStops.map((s, i) => (_jsxs(React.Fragment, { children: [i > 0 && _jsx("span", { className: "text-muted-foreground", children: "\u2192" }), _jsxs("span", { className: "inline-flex items-center gap-1.5", children: [_jsx("span", { className: "w-[10px] h-[10px] rounded-sm border-[0.5px] border-black/10", style: { backgroundColor: s.hex } }), _jsx("span", { className: "text-muted-foreground", children: colorLabel(s.token, s.hex).primary })] })] }, i))) }), _jsx("span", { className: "text-muted-foreground bg-black/5 px-2 py-0.5 rounded", children: gradient.mode === 'radial' ? 'radial' : `linear · ${gradient.angle}°` })] })] }));
}
const SEM_LABEL = {
    success: 'Success',
    info: 'Info',
    warning: 'Warning',
    error: 'Error',
};
function SemanticCell({ role, pair, mode, onChange }) {
    const isEdit = mode === 'edit';
    return (_jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx("div", { className: "grid grid-cols-[2fr_1fr] gap-1 h-[40px]", children: isEdit && onChange ? (_jsxs(_Fragment, { children: [_jsxs(Popover, { children: [_jsx(PopoverTrigger, { asChild: true, children: _jsx("button", { type: "button", "aria-label": `Edit ${role} main`, className: "rounded-md border-[0.5px] border-black/10 outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 cursor-pointer hover:-translate-y-px transition-transform", style: { backgroundColor: pair.main } }) }), _jsx(PopoverContent, { className: "p-3 w-[280px]", align: "start", children: _jsx(ColorPicker, { label: `${SEM_LABEL[role]} main`, value: pair.main, onChange: (hex) => onChange('main', hex) }) })] }), _jsxs(Popover, { children: [_jsx(PopoverTrigger, { asChild: true, children: _jsx("button", { type: "button", "aria-label": `Edit ${role} light`, className: "rounded-md border-[0.5px] border-black/10 outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 cursor-pointer hover:-translate-y-px transition-transform", style: { backgroundColor: pair.light } }) }), _jsx(PopoverContent, { className: "p-3 w-[280px]", align: "start", children: _jsx(ColorPicker, { label: `${SEM_LABEL[role]} light`, value: pair.light, onChange: (hex) => onChange('light', hex) }) })] })] })) : (_jsxs(_Fragment, { children: [_jsx(Swatch, { color: pair.main, label: pair.main.toUpperCase(), className: "rounded-md" }), _jsx(Swatch, { color: pair.light, label: pair.light.toUpperCase(), className: "rounded-md" })] })) }), _jsx("p", { className: "text-[13px] font-medium", children: SEM_LABEL[role] }), _jsxs("p", { className: "text-[11px] text-muted-foreground", style: { fontFamily: 'var(--brand-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)' }, children: [pair.main.toUpperCase(), " \u00B7 ", pair.light.toUpperCase()] })] }));
}
/* ──────────────────────────────────────────────────────────────
 * BrandCard — top-level
 * ──────────────────────────────────────────────────────────── */
export function BrandCard({ data, mode = 'display', size = 'default', onPaletteNameChange, onPaletteMainChange, onRungOverride, onGradientNameChange, onSemanticChange, className, }) {
    const hasGradients = data.gradients.length > 0;
    // Compact size variant: smaller paddings, no rung strip in palette
    // cards, single-line gradient previews, semantic without surrounding
    // cards. We toggle classNames inline rather than maintaining a
    // separate component tree.
    const isCompact = size === 'compact';
    return (_jsxs("div", { className: cn('space-y-10', isCompact && 'space-y-6', className), children: [_jsxs("section", { children: [_jsxs("header", { className: "flex items-baseline justify-between mb-3.5", children: [_jsx("h2", { className: "text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground", style: { fontFamily: 'var(--brand-font-eyebrow, var(--brand-font-body, inherit))' }, children: "Brand palettes" }), _jsx("span", { className: "text-[11px] text-muted-foreground", style: { fontFamily: 'var(--brand-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)' }, children: "primary \u00B7 secondary \u00B7 accent" })] }), _jsx("div", { className: cn('grid gap-3.5', isCompact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-3'), children: ['primary', 'secondary', 'accent'].map((role) => (_jsx(PaletteCard, { role: role, palette: data.palettes[role], resolved: data.resolvedPalettes[role], onColor: data.onColor[role], mode: mode, onNameChange: onPaletteNameChange ? (name) => onPaletteNameChange(role, name) : undefined, onMainChange: onPaletteMainChange ? (hex) => onPaletteMainChange(role, hex) : undefined, onRungOverride: onRungOverride ? (rung, hex) => onRungOverride(role, rung, hex) : undefined }, role))) })] }), _jsxs("section", { children: [_jsxs("header", { className: "flex items-baseline justify-between mb-3.5", children: [_jsx("h2", { className: "text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground", style: { fontFamily: 'var(--brand-font-eyebrow, var(--brand-font-body, inherit))' }, children: "Neutral" }), _jsx("span", { className: "text-[11px] text-muted-foreground", style: { fontFamily: 'var(--brand-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)' }, children: data.palettes.neutral.hueMode ? `hue · ${data.palettes.neutral.hueMode}` : '' })] }), _jsx(NeutralStrip, { palette: data.palettes.neutral, resolved: data.resolvedPalettes.neutral, mode: mode, onNameChange: onPaletteNameChange ? (name) => onPaletteNameChange('neutral', name) : undefined, onRungOverride: onRungOverride ? (rung, hex) => onRungOverride('neutral', rung, hex) : undefined })] }), hasGradients && (_jsxs("section", { children: [_jsxs("header", { className: "flex items-baseline justify-between mb-3.5", children: [_jsx("h2", { className: "text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground", style: { fontFamily: 'var(--brand-font-eyebrow, var(--brand-font-body, inherit))' }, children: "Gradients" }), _jsxs("span", { className: "text-[11px] text-muted-foreground", style: { fontFamily: 'var(--brand-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)' }, children: [data.gradients.length, " of 5"] })] }), _jsx("div", { className: "space-y-3", children: data.gradients.map((g) => {
                            // On-color for the gradient banner. Prefer the first
                            // stop's parent palette's Faded rung when the stop is a
                            // palette ref (keeps the on-color in-family with the
                            // banner), else fall back to WCAG luminance check vs
                            // white/black. Matches the spec's "in-family color"
                            // rule on §4.
                            const firstStop = g.resolvedStops[0];
                            const firstHex = firstStop?.hex ?? '#000000';
                            const firstToken = firstStop?.token ?? '';
                            const paletteMatch = /^(primary|secondary|accent|neutral)-/.exec(firstToken);
                            let onColorHex;
                            if (paletteMatch) {
                                const role = paletteMatch[1];
                                onColorHex = data.resolvedPalettes[role].faded;
                                // Validate contrast — if Faded is too close to the
                                // banner's midpoint hex, fall back to white/black.
                                const mid = data.resolvedPalettes[role].main;
                                if (wcagRatio(onColorHex, mid) < 3.0) {
                                    onColorHex = isHexDark(firstHex) ? '#FAFAFA' : '#0A0A0A';
                                }
                            }
                            else {
                                onColorHex = isHexDark(firstHex) ? '#FAFAFA' : '#0A0A0A';
                            }
                            const onColor = { hex: onColorHex, usedFallback: !paletteMatch };
                            return (_jsx(GradientBanner, { gradient: g, onColor: onColor, mode: mode, onNameChange: onGradientNameChange ? (name) => onGradientNameChange(g.slug, name) : undefined }, g.slug));
                        }) })] })), _jsxs("section", { children: [_jsxs("header", { className: "flex items-baseline justify-between mb-3.5", children: [_jsx("h2", { className: "text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground", style: { fontFamily: 'var(--brand-font-eyebrow, var(--brand-font-body, inherit))' }, children: "Semantic" }), _jsx("span", { className: "text-[11px] text-muted-foreground", style: { fontFamily: 'var(--brand-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)' }, children: "state \u00B7 main + light" })] }), _jsx("div", { className: cn('grid gap-3', isCompact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'), children: ['success', 'info', 'warning', 'error'].map((role) => (_jsx(SemanticCell, { role: role, pair: data.semantic[role], mode: mode, onChange: onSemanticChange ? (which, hex) => onSemanticChange(role, which, hex) : undefined }, role))) })] })] }));
}
export default BrandCard;
/* ──────────────────────────────────────────────────────────────
 * Small WCAG helpers used by the gradient on-color check.
 * Kept local to avoid pulling culori into the UI bundle.
 * ──────────────────────────────────────────────────────────── */
function hexToLinear(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m)
        return [0, 0, 0];
    const r = parseInt(m[1].slice(0, 2), 16) / 255;
    const g = parseInt(m[1].slice(2, 4), 16) / 255;
    const b = parseInt(m[1].slice(4, 6), 16) / 255;
    const lin = (v) => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    return [lin(r), lin(g), lin(b)];
}
function relLuminance(hex) {
    const [r, g, b] = hexToLinear(hex);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function wcagRatio(a, b) {
    const la = relLuminance(a);
    const lb = relLuminance(b);
    const lighter = Math.max(la, lb);
    const darker = Math.min(la, lb);
    return (lighter + 0.05) / (darker + 0.05);
}
function isHexDark(hex) {
    return relLuminance(hex) < 0.5;
}
//# sourceMappingURL=BrandCard.js.map