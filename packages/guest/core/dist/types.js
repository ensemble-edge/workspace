/**
 * @ensemble-edge/guest — Type Definitions
 *
 * Complete type definitions for building guest apps (connectors, tools, agents)
 * that run inside Ensemble Workspace.
 */
// ============================================================================
// Header Constants
// ============================================================================
/**
 * HTTP headers injected by the gateway.
 */
export const ENSEMBLE_HEADERS = {
    WORKSPACE_ID: 'X-Ensemble-Workspace-Id',
    USER_ID: 'X-Ensemble-User-Id',
    USER_EMAIL: 'X-Ensemble-User-Email',
    USER_ROLE: 'X-Ensemble-User-Role',
    APP_ID: 'X-Ensemble-App-Id',
    CAPABILITY_TOKEN: 'X-Ensemble-Capability-Token',
    REQUEST_ID: 'X-Ensemble-Request-Id',
};
//# sourceMappingURL=types.js.map