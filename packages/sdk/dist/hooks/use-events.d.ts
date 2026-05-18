export interface UseEventsReturn {
    on: (type: string, handler: (payload: unknown) => void) => () => void;
    emit: (type: string, payload: unknown) => void;
}
export declare function useEvents(): UseEventsReturn;
//# sourceMappingURL=use-events.d.ts.map