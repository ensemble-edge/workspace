// Event system for guest apps

type EventHandler = (payload: unknown) => void;

/**
 * Event bus for communication with workspace and other apps.
 */
export const events = {
  /**
   * Subscribe to an event.
   */
  on: (type: string, handler: EventHandler): (() => void) => {
    // TODO: Implement event subscription via postMessage
    return () => {};
  },

  /**
   * Emit an event to the workspace.
   */
  emit: (type: string, payload: unknown): void => {
    // TODO: Implement event emission via postMessage
  },
};
