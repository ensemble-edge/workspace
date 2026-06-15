/**
 * Workspace Domain — Theme
 *
 * Theme configuration for workspace branding.
 */
export interface ThemeConfig {
    primaryColor: string;
    mode: 'light' | 'dark' | 'system';
    logo?: string;
    favicon?: string;
}
export declare function createThemeService(config?: Partial<ThemeConfig>): {
    config: {
        primaryColor: string;
        mode: "system" | "dark" | "light";
        logo: string | undefined;
        favicon: string | undefined;
    };
};
//# sourceMappingURL=theme.d.ts.map