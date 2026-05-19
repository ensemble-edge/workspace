/**
 * Ambient type declarations for the brand-render pipeline.
 *
 * v0.1.51.1. Wasm imports: `@resvg/resvg-wasm/index_bg.wasm` is
 * Wrangler's static-asset import shape. Declared so the import line
 * in engine.ts doesn't trip TS7016.
 *
 * (Previously declared wawoff2 here too — that dependency was
 * removed in v0.1.51.1 when we switched to fetching TTF directly
 * from Google Fonts via the IE 8 User-Agent trick. The decompress
 * step is no longer needed.)
 */

declare module '*.wasm' {
  const wasm: WebAssembly.Module;
  export default wasm;
}
