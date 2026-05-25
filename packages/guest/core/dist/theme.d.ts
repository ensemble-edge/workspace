import type { ThemeContext } from './types.js';
/**
 * Get the current theme context.
 */
export declare function getTheme(): ThemeContext;
/**
 * Subscribe to theme changes.
 */
export declare function onThemeChange(callback: (theme: ThemeContext) => void): () => void;
//# sourceMappingURL=theme.d.ts.map