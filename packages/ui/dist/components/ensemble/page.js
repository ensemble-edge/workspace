import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { cn } from "@/lib/utils";
export const ViewportContext = React.createContext({
    outerPaddingApplied: false,
});
/**
 * Provider hosts wrap around their viewport region to signal that
 * --content-padding is already applied. The Shell uses this around
 * its `<Viewport>`.
 */
export function ViewportContextProvider({ outerPaddingApplied, children, }) {
    const value = React.useMemo(() => ({ outerPaddingApplied }), [outerPaddingApplied]);
    return (_jsx(ViewportContext.Provider, { value: value, children: children }));
}
const EnsemblePage = React.forwardRef(({ className, title, description, actions, bleed = false, children, ...props }, ref) => {
    // Context-aware padding: if a host already applied --content-padding
    // around us (shell viewport region), skip our own. Otherwise apply
    // it — operators rendering Page outside the shell (iframe-tier
    // guests, isolated previews) still get the right behavior.
    const { outerPaddingApplied } = React.useContext(ViewportContext);
    const applyInternalPadding = !bleed && !outerPaddingApplied;
    return (_jsxs("div", { ref: ref, className: cn(
        // space-y-6 between header and content.
        // No bg-background here — the body/iframe owns that.
        "space-y-6 text-foreground", applyInternalPadding && "p-[var(--content-padding,1.5rem)]", className), style: { fontFamily: "var(--font-body, inherit)" }, ...props, children: [(title || actions) && (_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { className: "space-y-1 min-w-0", children: [title && (_jsx("h1", { className: "text-3xl font-bold tracking-tight truncate", style: { fontFamily: "var(--font-heading, inherit)" }, children: title })), description && (_jsx("p", { className: "text-muted-foreground", children: description }))] }), actions && (_jsx("div", { className: "flex items-center gap-2 shrink-0", children: actions }))] })), children] }));
});
EnsemblePage.displayName = "EnsemblePage";
const EnsembleSection = React.forwardRef(({ className, title, description, actions, children, ...props }, ref) => {
    return (_jsxs("section", { ref: ref, className: cn("space-y-4", className), ...props, children: [(title || actions) && (_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { className: "space-y-1 min-w-0", children: [title && (_jsx("h2", { className: "text-xl font-semibold tracking-tight truncate", children: title })), description && (_jsx("p", { className: "text-sm text-muted-foreground", children: description }))] }), actions && (_jsx("div", { className: "flex items-center gap-2 shrink-0", children: actions }))] })), children] }));
});
EnsembleSection.displayName = "EnsembleSection";
export { EnsemblePage, EnsembleSection };
//# sourceMappingURL=page.js.map