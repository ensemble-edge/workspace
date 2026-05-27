// Event system for guest apps
/**
 * Event bus for communication with workspace and other apps.
 */
export const events = {
    /**
     * Subscribe to an event.
     */
    on: (type, handler) => {
        // TODO: Implement event subscription via postMessage
        return () => { };
    },
    /**
     * Emit an event to the workspace.
     */
    emit: (type, payload) => {
        // TODO: Implement event emission via postMessage
    },
};
//# sourceMappingURL=events.js.map