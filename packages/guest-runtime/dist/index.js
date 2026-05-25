/**
 * @ensemble-edge/guest-runtime — public types for guest app developers.
 *
 * Guest apps import TYPES from here. At runtime, the actual implementation
 * comes from window.Ensemble (loaded via /_ensemble/runtime/v1/runtime.js).
 *
 * The guest's JSX is compiled against the jsx-runtime shim, which forwards
 * to window.Ensemble.createElement. The guest's bundle therefore contains
 * none of React or workspace UI — those live in the workspace-served runtime.
 *
 * Usage in a guest worker:
 *
 *   import type { EnsembleRuntime, GuestApp } from '@ensemble-edge/workspace/guest-runtime';
 *
 *   const QuizCms: GuestApp = ({ Page, Section, Card, Button }) => (
 *     <Page title="Quiz CMS" description="Manage form schemas">
 *       <Card>...</Card>
 *     </Page>
 *   );
 *
 *   export default QuizCms;
 */
/**
 * Convenience: get the runtime in a non-JSX context.
 *
 *   const { Card, useState } = getEnsemble();
 */
export function getEnsemble() {
    if (typeof window === "undefined" || !window.Ensemble) {
        throw new Error("Ensemble runtime not loaded. Did you include " +
            "<script src=\"/_ensemble/runtime/v1/runtime.js\"></script> in your iframe HTML?");
    }
    return window.Ensemble;
}
//# sourceMappingURL=index.js.map