import * as React from "react";
import { Check, CircleDot, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "../../lib/utils";

/**
 * SaveStatus — visible save-state indicator for any form/card.
 *
 * Solves a recurring confusion across the workspace: operators can't
 * tell whether a card autosaves or needs a manual Save click. Every
 * card that holds editable state gets one of these in its header so
 * the contract is explicit.
 *
 * States:
 *   - autosaved: card writes on blur/change; nothing to do
 *   - dirty:     user has edited; click the Save button (manual-save cards)
 *   - saving:    write in flight
 *   - saved:     just wrote successfully (auto-fade back to autosaved/clean)
 *   - error:     last save failed; details elsewhere (toast)
 *   - immediate: discrete actions take effect on click (toggles, deletes)
 *
 * Designed to be small — fits in a card header or footer without
 * disrupting layout. Use `compact` for tight spaces (tab triggers).
 */
export type SaveStatusState =
  | "clean"      // no changes; manual-save cards typically hide this
  | "autosaved"  // autosave on, no pending change
  | "dirty"
  | "saving"
  | "saved"
  | "error"
  | "immediate";

export interface SaveStatusProps extends React.HTMLAttributes<HTMLSpanElement> {
  state: SaveStatusState;
  /** Override the default label text per state. */
  label?: string;
  /** Hide the icon (text-only). */
  hideIcon?: boolean;
  /** Tighter padding for use in tab strips or table cells. */
  compact?: boolean;
}

const DEFAULTS: Record<SaveStatusState, { label: string; tone: string }> = {
  clean:     { label: "No changes", tone: "text-muted-foreground" },
  autosaved: { label: "Autosaved", tone: "text-muted-foreground" },
  dirty:     { label: "Unsaved changes", tone: "text-amber-600 dark:text-amber-500" },
  saving:    { label: "Saving…", tone: "text-muted-foreground" },
  saved:     { label: "Saved", tone: "text-green-600 dark:text-green-500" },
  error:     { label: "Save failed", tone: "text-destructive" },
  immediate: { label: "Saves immediately", tone: "text-muted-foreground" },
};

function StateIcon({ state }: { state: SaveStatusState }) {
  switch (state) {
    case "saving":
      return <Loader2 className="h-3 w-3 animate-spin" aria-hidden />;
    case "saved":
      return <Check className="h-3 w-3" aria-hidden />;
    case "error":
      return <AlertTriangle className="h-3 w-3" aria-hidden />;
    case "dirty":
      return <CircleDot className="h-3 w-3 fill-current" aria-hidden />;
    case "autosaved":
    case "immediate":
    default:
      return <span className="h-1.5 w-1.5 rounded-full bg-current inline-block" aria-hidden />;
  }
}

export const SaveStatus = React.forwardRef<HTMLSpanElement, SaveStatusProps>(
  ({ state, label, hideIcon, compact, className, ...rest }, ref) => {
    const cfg = DEFAULTS[state];
    return (
      <span
        ref={ref}
        role="status"
        aria-live="polite"
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-medium",
          compact ? "px-1.5 py-0.5" : "px-2 py-1",
          cfg.tone,
          className,
        )}
        {...rest}
      >
        {!hideIcon && <StateIcon state={state} />}
        <span>{label ?? cfg.label}</span>
      </span>
    );
  },
);
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
export function useSaveStatus({
  dirty,
  inFlight,
  error,
  manual,
}: {
  dirty: boolean;
  inFlight: boolean;
  error?: unknown;
  /** If true, "clean + not in flight" reads as "autosaved" base state; if false, no autosave. */
  manual?: boolean;
}): SaveStatusState {
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

  if (error) return "error";
  if (inFlight) return "saving";
  if (recentlySaved) return "saved";
  if (dirty) return "dirty";
  return manual ? "dirty" : "autosaved";
}
