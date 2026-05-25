import type { FontData } from './fonts';
/**
 * Initialize the resvg wasm module once per isolate. Subsequent
 * callers await the same Promise — no double-init, no race.
 *
 * Eager init at first call: Brand Overview tab fires 16 cells in
 * parallel; the first to arrive triggers init, the rest await the
 * same Promise. In-flight coalescing in cache.ts further reduces
 * actual renders to one per (composition, finish, bg).
 */
export declare function ensureRenderEngineReady(): Promise<void>;
export interface RenderToSvgOptions {
    width: number;
    height: number;
    fonts: FontData[];
}
/**
 * JSX (ReactNode shape) → SVG string. No viewBox in the resulting
 * SVG — width/height attributes carry the exact pixel dimensions.
 *
 * The `as never` cast on the JSX argument is the standard Satori-
 * with-arbitrary-JSX shape. Satori types are strict about ReactNode
 * shapes that don't quite match React's; in practice the runtime
 * accepts any object literal with the children/type/props shape.
 */
export declare function renderToSvg(node: unknown, opts: RenderToSvgOptions): Promise<string>;
/**
 * SVG string → PNG buffer via resvg-wasm. Used for `.png` URLs.
 * Width is honored exactly (no DPI scaling). Resvg parses the SVG
 * width attribute and renders at that pixel size 1:1.
 */
export declare function renderToPng(svg: string, width: number): Promise<Uint8Array>;
//# sourceMappingURL=engine.d.ts.map