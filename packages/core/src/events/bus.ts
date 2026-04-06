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

export function createEventBusService() {
  const handlers = new Map<string, Set<EventHandler>>();

  return {
    on: (type: string, handler: EventHandler) => {
      if (!handlers.has(type)) {
        handlers.set(type, new Set());
      }
      handlers.get(type)!.add(handler);
    },
    off: (type: string, handler: EventHandler) => {
      handlers.get(type)?.delete(handler);
    },
    emit: (event: WorkspaceEvent) => {
      handlers.get(event.type)?.forEach((handler) => handler(event));
      handlers.get('*')?.forEach((handler) => handler(event));
    },
  };
}
