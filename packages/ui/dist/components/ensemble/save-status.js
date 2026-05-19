import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { Check, CircleDot, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "../../lib/utils";
const DEFAULTS = {
    clean: { label: "No changes", tone: "text-muted-foreground" },
    autosaved: { label: "Autosaved", tone: "text-muted-foreground" },
    dirty: { label: "Unsaved changes", tone: "text-amber-600 dark:text-amber-500" },
    saving: { label: "Saving…", tone: "text-muted-foreground" },
    saved: { label: "Saved", tone: "text-green-600 dark:text-green-500" },
    error: { label: "Save failed", tone: "text-destructive" },
    immediate: { label: "Saves immediately", tone: "text-muted-foreground" },
};
function StateIcon({ state }) {
    switch (state) {
        case "saving":
            return _jsx(Loader2, { className: "h-3 w-3 animate-spin", "aria-hidden": true });
        case "saved":
            return _jsx(Check, { className: "h-3 w-3", "aria-hidden": true });
        case "error":
            return _jsx(AlertTriangle, { className: "h-3 w-3", "aria-hidden": true });
        case "dirty":
            return _jsx(CircleDot, { className: "h-3 w-3 fill-current", "aria-hidden": true });
        case "autosaved":
        case "immediate":
        default:
            return _jsx("span", { className: "h-1.5 w-1.5 rounded-full bg-current inline-block", "aria-hidden": true });
    }
}
export const SaveStatus = React.forwardRef(({ state, label, hideIcon, compact, className, ...rest }, ref) => {
    const cfg = DEFAULTS[state];
    return (_jsxs("span", { ref: ref, role: "status", "aria-live": "polite", className: cn("inline-flex items-center gap-1.5 text-xs font-medium", compact ? "px-1.5 py-0.5" : "px-2 py-1", cfg.tone, className), ...rest, children: [!hideIcon && _jsx(StateIcon, { state: state }), _jsx("span", { children: label ?? cfg.label })] }));
});
SaveStatus.displayName = "SaveStatus";
/**
 * useSaveStatus — small hook that manages the autosaved/saved fade
 * lifecycle. Pass the dirty flag (true while pending) and the inFlight
 * flag; the hook returns the right state to render. After a successful
 * save (inFlight → false while dirty was true), it shows "saved" for
 * ~1.5s, then returns to "autosaved".
 *
 * For manual-save cards, prefer setting state directly — this hook is
 * tuned for the autosave-on-blur pattern.
 */
export function useSaveStatus({ dirty, inFlight, error, manual, }) {
    const [recentlySaved, setRecentlySaved] = React.useState(false);
    const lastInFlight = React.useRef(inFlight);
    React.useEffect(() => {
        if (lastInFlight.current && !inFlight && !error) {
            setRecentlySaved(true);
            const t = setTimeout(() => setRecentlySaved(false), 1500);
            return () => clearTimeout(t);
        }
        lastInFlight.current = inFlight;
    }, [inFlight, error]);
    if (error)
        return "error";
    if (inFlight)
        return "saving";
    if (recentlySaved)
        return "saved";
    if (dirty)
        return "dirty";
    return manual ? "dirty" : "autosaved";
}
//# sourceMappingURL=save-status.js.map