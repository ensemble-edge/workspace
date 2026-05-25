/**
 * Events Domain — Bus
 *
 * Event bus for cross-app communication.
 */
export function createEventBusService() {
    const handlers = new Map();
    return {
        on: (type, handler) => {
            if (!handlers.has(type)) {
                handlers.set(type, new Set());
            }
            handlers.get(type).add(handler);
        },
        off: (type, handler) => {
            handlers.get(type)?.delete(handler);
        },
        emit: (event) => {
            handlers.get(event.type)?.forEach((handler) => handler(event));
            handlers.get('*')?.forEach((handler) => handler(event));
        },
    };
}
//# sourceMappingURL=bus.js.map