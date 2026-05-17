/**
 * useFormStatus — convenience hook for manual-save cards.
 *
 * Tracks dirty state by comparing a serialized snapshot of the form's
 * current value against the snapshot taken at load time (or the last
 * successful save). Returns the right SaveStatusState for the card's
 * indicator + helpers to drive save lifecycle.
 *
 * Pair with @ensemble-edge/ui's <SaveStatus /> in the card header.
 *
 * Usage:
 *   const status = useFormStatus({ value: { tagline, mission } });
 *   ...
 *   <CardHeader><SaveStatus state={status.state} /></CardHeader>
 *   <Button onClick={async () => {
 *     status.beginSave();
 *     try { await saveToServer(); status.commitSave(); }
 *     catch (e) { status.failSave(e); }
 *   }}>Save</Button>
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SaveStatusState } from '@ensemble-edge/ui';

// Module-scoped sentinel so `resetBaseline()` (no arg) can be reliably
// distinguished from `resetBaseline(undefined)` — Symbol identity is
// stable across renders.
const USE_CLOSURE_VALUE = Symbol('useFormStatus.useClosureValue');

interface FormStatusReturn {
  state: SaveStatusState;
  dirty: boolean;
  /** Call when a save begins; flips status to 'saving'. */
  beginSave: () => void;
  /** Call on save success; resets baseline so further edits become dirty again. */
  commitSave: () => void;
  /** Call on save failure; status becomes 'error' until a new edit clears it. */
  failSave: (err?: unknown) => void;
  /**
   * Programmatically reset the baseline. Pass the value to snapshot
   * explicitly if calling after an async load (the closure-captured
   * value may still be the pre-load default).
   */
  resetBaseline: (nextValue?: unknown) => void;
}

export function useFormStatus({
  value,
  mode = 'manual',
}: {
  value: unknown;
  /** 'manual' = clean state hides the indicator (no lie); 'autosave' = clean shows "Autosaved". */
  mode?: 'manual' | 'autosave';
}): FormStatusReturn {
  // Serialize for comparison. JSON.stringify is fine for the shapes
  // we use (no Maps/Sets/Dates) and avoids accidental reference-equality
  // false-positives.
  const serialized = JSON.stringify(value);
  const baseline = useRef<string>(serialized);
  const [inFlight, setInFlight] = useState(false);
  const [recentlySaved, setRecentlySaved] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // Reset baseline once on mount (snapshot the loaded value).
  // The caller can also call resetBaseline() after an async load.
  useEffect(() => {
    baseline.current = serialized;
    // Intentionally only on mount; resetBaseline handles later resets.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dirty = serialized !== baseline.current;

  // Any new edit clears the error state — operator's intent is "try
  // again," and lingering errors after a fresh edit are confusing.
  useEffect(() => {
    if (dirty && error) setError(null);
  }, [dirty, error]);

  const beginSave = useCallback(() => {
    setInFlight(true);
    setError(null);
  }, []);

  const commitSave = useCallback(() => {
    setInFlight(false);
    baseline.current = JSON.stringify(value);
    setRecentlySaved(true);
    setError(null);
    setTimeout(() => setRecentlySaved(false), 1500);
  }, [value]);

  const failSave = useCallback((e?: unknown) => {
    setInFlight(false);
    setError(e ?? new Error('Save failed'));
  }, []);

  const resetBaseline = useCallback(
    (nextValue: unknown = USE_CLOSURE_VALUE) => {
      const v = nextValue === USE_CLOSURE_VALUE ? value : nextValue;
      baseline.current = JSON.stringify(v);
    },
    [value],
  );

  let state: SaveStatusState;
  if (error) state = 'error';
  else if (inFlight) state = 'saving';
  else if (recentlySaved) state = 'saved';
  else if (dirty) state = 'dirty';
  else state = mode === 'autosave' ? 'autosaved' : 'clean';

  return { state, dirty, beginSave, commitSave, failSave, resetBaseline };
}
