import * as React from "react";
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
export type SaveStatusState = "clean" | "autosaved" | "dirty" | "saving" | "saved" | "error" | "immediate";
export interface SaveStatusProps extends React.HTMLAttributes<HTMLSpanElement> {
    state: SaveStatusState;
    /** Override the default label text per state. */
    label?: string;
    /** Hide the icon (text-only). */
    hideIcon?: boolean;
    /** Tighter padding for use in tab strips or table cells. */
    compact?: boolean;
}
export declare const SaveStatus: React.ForwardRefExoticComponent<SaveStatusProps & React.RefAttributes<HTMLSpanElement>>;
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
export declare function useSaveStatus({ dirty, inFlight, error, manual, }: {
    dirty: boolean;
    inFlight: boolean;
    error?: unknown;
    /** If true, "clean + not in flight" reads as "autosaved" base state; if false, no autosave. */
    manual?: boolean;
}): SaveStatusState;
//# sourceMappingURL=save-status.d.ts.map