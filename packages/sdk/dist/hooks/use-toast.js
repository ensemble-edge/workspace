/**
 * useToast() / toast — show a workspace-styled toast notification from
 * a guest app (v0.1.86).
 *
 * Where toasts come from depends on where the guest is running:
 *
 *   • Component-tier — the guest is part of the shell's React tree.
 *     `window.Ensemble.toast` is the shell's real toast() and gets used
 *     directly (no postMessage hop, supports the full ToastOptions API
 *     including action buttons).
 *
 *   • Iframe-tier — the guest is in an iframe under the workspace shell.
 *     `window.Ensemble.toast` is the guest-runtime bridge that
 *     postMessages the parent shell; the shell renders the toast in its
 *     own toaster. Functions can't cross frames, so this surface is
 *     limited to kind/message/description/duration.
 *
 *   • Standalone — guest app served on a different origin, no workspace
 *     shell around it. `window.Ensemble` is undefined. We log to the
 *     console as a visible-during-dev signal. If you want toasts in a
 *     standalone deployment, render your own toaster (sonner, etc).
 *
 * The SDK doesn't know at build time which environment it ends up in,
 * so this hook abstracts the dispatch.
 */
import * as React from 'react';
function getEnsembleToast() {
    if (typeof window === 'undefined')
        return undefined;
    const ens = window.Ensemble;
    return ens?.toast;
}
function dispatch(kind, message, options) {
    const ens = getEnsembleToast();
    if (ens) {
        const method = ens[kind];
        if (typeof method === 'function') {
            method(message, options);
            return;
        }
        // Generic form if the kind-specific helper isn't available.
        ens(kind, message, options);
        return;
    }
    // Standalone fallback — no workspace shell around us. Log so the
    // signal isn't silently lost during local dev.
    // eslint-disable-next-line no-console
    console.log(`[ensemble:toast:${kind}]`, message, options?.description ?? '');
}
/**
 * Framework-agnostic toast client. Same API as the React hook; use this
 * in event handlers, async flows, or non-React code paths.
 */
export const toast = Object.assign((kind, message, options) => dispatch(kind, message, options), {
    success: (message, options) => dispatch('success', message, options),
    error: (message, options) => dispatch('error', message, options),
    warning: (message, options) => dispatch('warning', message, options),
    info: (message, options) => dispatch('info', message, options),
});
/**
 * React hook returning the same `toast` API. The hook form gives you a
 * stable reference for use inside effects without needing to lift the
 * import out of component scope.
 */
export function useToast() {
    return React.useMemo(() => toast, []);
}
//# sourceMappingURL=use-toast.js.map