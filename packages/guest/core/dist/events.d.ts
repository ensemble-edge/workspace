type EventHandler = (payload: unknown) => void;
/**
 * Event bus for communication with workspace and other apps.
 */
export declare const events: {
    /**
     * Subscribe to an event.
     */
    on: (type: string, handler: EventHandler) => (() => void);
    /**
     * Emit an event to the workspace.
     */
    emit: (type: string, payload: unknown) => void;
};
export {};
//# sourceMappingURL=events.d.ts.map