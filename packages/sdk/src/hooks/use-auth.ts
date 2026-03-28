// Hook to access authentication state

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface UseAuthReturn {
  user: User | null;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  // TODO: Implement auth hook
  return {
    user: null,
    isAuthenticated: false,
    logout: async () => {},
  };
}
