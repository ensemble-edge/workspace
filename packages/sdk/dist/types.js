/**
 * @ensemble-edge/sdk — Public types for the workspace context surface.
 *
 * THE CONTRACT — read this before adding a field:
 *
 *   1. Adding a field to WorkspaceContext is purely ADDITIVE. Guest
 *      apps using older SDK versions see new fields as `undefined`
 *      and continue working unchanged.
 *
 *   2. Renaming or removing a field requires bumping `version` from 1
 *      to 2. We've never had to do this. The design intent is that
 *      v1 is forever — extend, don't break.
 *
 *   3. Every domain is a top-level key (workspace, user, locale,
 *      theme, brand, etc.). When the surface grows, group new
 *      capabilities into existing domains or add a new domain.
 *      Avoid sprinkling unrelated fields at the root.
 *
 *   4. The SDK type MUST mirror the server-side WorkspaceContextV1
 *      shape exactly. They're the same contract — one TypeScript
 *      definition lives in @ensemble-edge/core/services/workspace-context.ts
 *      and a verbatim copy lives here so guest apps don't pull
 *      core as a dependency.
 */
export {};
//# sourceMappingURL=types.js.map