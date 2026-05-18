/**
 * Events Domain — Bus
 *
 * Event bus for cross-app communication.
 */
export interface WorkspaceEvent {
    type: string;
    payload: unknown;
    timestamp: number;
}
type EventHandler = (event: WorkspaceEvent) => void;
export declare function createEventBusService(): {
    on: (type: string, handler: EventHandler) => void;
    off: (type: string, handler: EventHandler) => void;
    emit: (event: WorkspaceEvent) => void;
};
export {};
//# sourceMappingURL=bus.d.ts.map