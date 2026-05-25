/**
 * Workspace Theme Presets
 *
 * Each theme defines a complete color set for BOTH light and dark modes.
 * The CSS endpoint uses these to generate :root and .dark blocks.
 * Users can override individual colors on top of the preset.
 */
export interface ThemePreset {
    id: string;
    label: string;
    description: string;
    light: ThemeColors;
    dark: ThemeColors;
    /** Default primary (button) color */
    primary: string;
    /** Default accent color */
    accent: string;
}
export interface ThemeColors {
    background: string;
    foreground: string;
    card: string;
    'card-foreground': string;
    popover: string;
    'popover-foreground': string;
    primary: string;
    'primary-foreground': string;
    secondary: string;
    'secondary-foreground': string;
    muted: string;
    'muted-foreground': string;
    accent: string;
    'accent-foreground': string;
    destructive: string;
    'destructive-foreground': string;
    border: string;
    input: string;
    ring: string;
    'sidebar-background': string;
    'sidebar-foreground': string;
    'sidebar-primary': string;
    'sidebar-primary-foreground': string;
    'sidebar-accent': string;
    'sidebar-accent-foreground': string;
    'sidebar-border': string;
    'sidebar-ring': string;
}
export declare const THEME_PRESETS: ThemePreset[];
/**
 * Get a theme preset by ID.
 */
export declare function getThemePreset(id: string): ThemePreset | undefined;
/**
 * Get the color scale for a theme preset and mode.
 */
export declare function getPresetScale(presetId: string, mode: 'light' | 'dark'): ThemeColors | undefined;
//# sourceMappingURL=themes.d.ts.map