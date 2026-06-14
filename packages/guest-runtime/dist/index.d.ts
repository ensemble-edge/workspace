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
export type { EnsembleRuntime } from "./runtime";
import type { EnsembleRuntime } from "./runtime";
/**
 * A guest app component.
 *
 * Receives the runtime as props for easy destructuring — same primitives
 * are also available globally via `window.Ensemble`, but destructuring is
 * the recommended pattern (less typing, more discoverable).
 */
export type GuestApp = React.ComponentType<EnsembleRuntime> | React.ComponentType<{}>;
/**
 * Convenience: get the runtime in a non-JSX context.
 *
 *   const { Card, useState } = getEnsemble();
 */
export declare function getEnsemble(): EnsembleRuntime;
//# sourceMappingURL=index.d.ts.map