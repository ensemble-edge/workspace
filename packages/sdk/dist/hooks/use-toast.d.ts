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
export type ToastKind = 'success' | 'error' | 'warning' | 'info';
export interface ToastOptions {
    /** Subtext shown under the main message. */
    description?: string;
    /** ms, default 5000. 0 = persistent until dismissed by the user. */
    duration?: number;
}
export interface ToastApi {
    /** Generic form. `kind` chooses the icon/colour. */
    (kind: ToastKind, message: string, options?: ToastOptions): void;
    success: (message: string, options?: ToastOptions) => void;
    error: (message: string, options?: ToastOptions) => void;
    warning: (message: string, options?: ToastOptions) => void;
    info: (message: string, options?: ToastOptions) => void;
}
/**
 * Framework-agnostic toast client. Same API as the React hook; use this
 * in event handlers, async flows, or non-React code paths.
 */
export declare const toast: ToastApi;
/**
 * React hook returning the same `toast` API. The hook form gives you a
 * stable reference for use inside effects without needing to lift the
 * import out of component scope.
 */
export declare function useToast(): ToastApi;
//# sourceMappingURL=use-toast.d.ts.map