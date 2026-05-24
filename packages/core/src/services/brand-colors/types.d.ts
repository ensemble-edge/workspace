/**
 * Ambient declaration for culori — no @types/culori on npm, so we
 * stub the surface we use. Kept minimal on purpose: declaring the
 * full API surface would be brittle and the JSDoc-style typing in
 * culori's own source is mostly accurate at runtime.
 */
declare module 'culori' {
  // OkLCh / OkLab color object shapes that culori uses.
  export interface OklchColor {
    mode: 'oklch';
    l: number;
    c: number;
    h?: number;
    alpha?: number;
  }

  /** Parse any CSS color string OR a culori color object. Returns a
   *  color object in whatever mode the input implies, or undefined. */
  export function parse(input: string | Record<string, unknown>): Record<string, unknown> | undefined;

  /** Convert any color to OkLCh. Returns undefined if conversion
   *  fails (e.g. unparseable input). */
  export function oklch(input: string | Record<string, unknown>): { l: number; c: number; h?: number } | undefined;

  /** Format any color object as sRGB hex. Returns null when the
   *  color is outside the sRGB gamut. */
  export function formatHex(color: Record<string, unknown>): string | null;

  /** WCAG 2.x contrast ratio (1..21). */
  export function wcagContrast(a: string | Record<string, unknown>, b: string | Record<string, unknown>): number;
}
