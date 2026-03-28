// Hook to access and modify theme

export interface UseThemeReturn {
  primaryColor: string;
  mode: 'light' | 'dark' | 'system';
  setMode: (mode: 'light' | 'dark' | 'system') => void;
}

export function useTheme(): UseThemeReturn {
  // TODO: Implement theme hook
  return {
    primaryColor: '#3B82F6',
    mode: 'system',
    setMode: () => {},
  };
}
