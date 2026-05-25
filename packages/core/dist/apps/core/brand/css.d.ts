/**
 * Brand CSS Generation
 *
 * Now delegates to the brand spec system:
 * 1. Assembles the full EnsembleBrandSpec from D1
 * 2. Generates CSS from the spec (brand tokens as --brand-* variables)
 * 3. Also generates workspace shell CSS (--background, --font-body, etc.)
 *
 * The CSS endpoint serves BOTH:
 * - Brand CSS (--brand-*) for external projects
 * - Shell CSS (shadcn/ui variables) for the workspace UI
 */
/** Font family map — shared with shell Appearance tab */
export declare const FONT_FAMILIES: Record<string, string>;
/** Base color scales — HSL values for shadcn/ui dark mode */
export declare const BASE_COLOR_SCALES: Record<string, {
    bg: string;
    fg: string;
    border: string;
}>;
/**
 * Generate the full CSS output for /_ensemble/brand/css.
 *
 * This includes:
 * 1. Brand CSS (--brand-* variables from the spec)
 * 2. Shell CSS (shadcn/ui variables for workspace appearance)
 */
export declare function generateBrandCss(db: D1Database, workspaceId: string, defaultAccent: string): Promise<string>;
/**
 * Get the saved theme mode for the HTML class attribute.
 * 'system' means respect prefers-color-scheme — we default to dark for server render.
 */
export declare function getSavedThemeMode(db: D1Database, workspaceId: string): Promise<'light' | 'dark' | 'system'>;
//# sourceMappingURL=css.d.ts.map