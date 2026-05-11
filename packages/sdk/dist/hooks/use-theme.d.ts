export interface UseThemeReturn {
    primaryColor: string;
    mode: 'light' | 'dark' | 'system';
    setMode: (mode: 'light' | 'dark' | 'system') => void;
}
export declare function useTheme(): UseThemeReturn;
//# sourceMappingURL=use-theme.d.ts.map