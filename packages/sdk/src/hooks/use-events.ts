// Hook to subscribe to workspace events

export interface UseEventsReturn {
  on: (type: string, handler: (payload: unknown) => void) => () => void;
  emit: (type: string, payload: unknown) => void;
}

export function useEvents(): UseEventsReturn {
  // TODO: Implement events hook
  return {
    on: () => () => {},
    emit: () => {},
  };
}
