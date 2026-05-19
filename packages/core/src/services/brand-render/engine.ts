/**
 * Brand render engine — Satori + resvg-wasm + in-flight coalescing.
 *
 * v0.1.51 rewrite. Replaces the SVG-string composeLockup heuristic
 * in services/brand-assets.ts with a real layout engine.
 *
 * Why this exists
 * ───────────────
 * The previous engine estimated wordmark dimensions from a heuristic
 * em-width table per font family, then composed lockups against that
 * estimated bounding box. The estimates were systematically wrong —
 * generous-margin viewBoxes meant icons sat against invisible
 * whitespace instead of glyph edges, and `crossAlign`/`spacing`/
 * `iconScale` controls were calibrated to *the wrong bounds*.
 *
 * Satori takes JSX + explicit width/height + actual font binaries and
 * computes layout via real font metrics (the same metrics the browser
 * uses). resvg-wasm rasterizes the resulting SVG to PNG when needed.
 *
 * Architectural lifts from heart-hands / tin-out-of-tin:
 *   - Bundled wasm via Wrangler's `.wasm` import (no R2 fetch, no CDN)
 *   - Module-level `resvgInitialized` memoization for cold-start
 *   - In-flight coalescing via Map<key, Promise> for the variants
 *     matrix burst (16 cells → 1 actual render)
 *   - Extrinsic sizing on the root JSX element (no viewBox, no
 *     preserveAspectRatio — Satori writes exact width/height)
 *
 * Wasm bundling note: Wrangler's static `.wasm` import compiles the
 * binary into the Worker bundle. Total compressed cost ≈ 1.5MB
 * (resvg). Satori itself is JS + yoga-wasm-web (loaded internally by
 * Satori). On the paid Workers plan we have 10MB compressed budget.
 */
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
import satoriImport from 'satori';
import type { SatoriOptions } from 'satori';
import type { FontData } from './fonts';

/* ──────────────────────────────────────────────────────────────
 * Wasm init memoization
 * ──────────────────────────────────────────────────────────── */

let resvgReady: Promise<void> | null = null;

/**
 * Initialize the resvg wasm module once per isolate. Subsequent
 * callers await the same Promise — no double-init, no race.
 *
 * Eager init at first call: Brand Overview tab fires 16 cells in
 * parallel; the first to arrive triggers init, the rest await the
 * same Promise. In-flight coalescing in cache.ts further reduces
 * actual renders to one per (composition, finish, bg).
 */
export function ensureRenderEngineReady(): Promise<void> {
  if (!resvgReady) {
    resvgReady = initWasm(resvgWasm).catch((err) => {
      // Reset on failure so a subsequent call can retry. Without
      // this a transient init error would poison the isolate.
      resvgReady = null;
      throw err;
    });
  }
  return resvgReady;
}

/* ──────────────────────────────────────────────────────────────
 * Satori (SVG layout) + resvg (raster)
 * ──────────────────────────────────────────────────────────── */

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
export async function renderToSvg(
  node: unknown,
  opts: RenderToSvgOptions,
): Promise<string> {
  const satoriOpts: SatoriOptions = {
    width: opts.width,
    height: opts.height,
    fonts: opts.fonts as unknown as SatoriOptions['fonts'],
    // embedFont:true is the default but worth stating — embedded
    // glyph paths mean the resulting SVG is self-contained and
    // renders correctly inside <img> tags (which sandbox external
    // font CSS).
    embedFont: true,
  };
  // Satori's TS bindings expect React.ReactNode but accept any
  // object that satisfies its runtime shape. The cast keeps the
  // call site agnostic about which JSX runtime we used.
  return await satoriImport(node as never, satoriOpts);
}

/**
 * SVG string → PNG buffer via resvg-wasm. Used for `.png` URLs.
 * Width is honored exactly (no DPI scaling). Resvg parses the SVG
 * width attribute and renders at that pixel size 1:1.
 */
export async function renderToPng(
  svg: string,
  width: number,
): Promise<Uint8Array> {
  await ensureRenderEngineReady();
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    background: 'rgba(0,0,0,0)',
  });
  const data = resvg.render();
  const png = data.asPng();
  data.free();
  resvg.free();
  return png;
}
