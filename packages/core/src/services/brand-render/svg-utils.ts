/**
 * SVG manipulation helpers used by the brand-render pipeline.
 *
 * v0.1.51. Extracted from the old brand-assets.ts so we can delete
 * the old file without losing these primitives. Lockup composition
 * needs viewBox parsing to know icon aspect ratios when scaling.
 */

/**
 * Parse an SVG's viewBox into [x, y, width, height]. Defaults to
 * [0, 0, 100, 100] when no viewBox is present so callers can divide
 * safely without checking for null.
 */
export function parseViewBox(svg: string): [number, number, number, number] {
  const m = /viewBox\s*=\s*["']([\d.\-\s]+)["']/i.exec(svg);
  if (!m) return [0, 0, 100, 100];
  const parts = m[1].trim().split(/\s+/).map(Number);
  if (parts.length !== 4 || parts.some((n) => !isFinite(n))) return [0, 0, 100, 100];
  return parts as [number, number, number, number];
}

/**
 * Strip the outer <svg> wrapper, returning the inner element tree.
 * Useful when embedding an uploaded SVG inside a parent SVG/JSX
 * without doubled root tags.
 */
export function svgInner(svg: string): string {
  return svg.replace(/^[\s\S]*?<svg[^>]*>/i, '').replace(/<\/svg>\s*$/i, '');
}
