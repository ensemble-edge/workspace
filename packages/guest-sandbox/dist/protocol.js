/**
 * The Ensemble guest-sandbox postMessage protocol.
 *
 * This is the v1 wire contract between the workspace shell and sandboxed
 * guest iframes. It's deliberately small: a fixed set of message shapes,
 * each versioned. Sandboxed guests cannot reach the host except through
 * these messages.
 *
 * **Contract stability:** Within v1, message shapes are frozen. New types
 * can be added (additive); existing types' fields cannot change. Unknown
 * types are ignored on receipt — that's how additive evolution works.
 *
 * Direction legend:
 *   guest -> host
 *   host  -> guest
 */
/** Type guard: is this a recognized ensemble: message? */
export function isEnsembleMessage(x) {
    if (!x || typeof x !== 'object')
        return false;
    const m = x;
    return typeof m.type === 'string' && m.type.startsWith('ensemble:') && m.v === 1;
}
//# sourceMappingURL=protocol.js.map