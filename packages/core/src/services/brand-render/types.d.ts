/**
 * Ambient type declarations for untyped dependencies used by the
 * brand-render pipeline.
 *
 * v0.1.51. `wawoff2` ships no types of its own — and there's no
 * @types/wawoff2 on npm — so we declare the surface we use here.
 * If wawoff2 ever adds types, delete this declaration and the
 * import will pick them up automatically.
 *
 * Wasm imports: `@resvg/resvg-wasm/index_bg.wasm` is Wrangler's
 * static-asset import shape. Declared so the import line in
 * engine.ts doesn't trip TS7016.
 */
declare module 'wawoff2' {
  /**
   * Decode a woff2 binary into TTF bytes. Async because the
   * underlying wasm needs a one-time init on first call.
   */
  export function decompress(woff2: Uint8Array): Promise<Uint8Array>;

  /** Round-trip the other direction. We don't use this yet but
   *  the library exports it. */
  export function compress(ttf: Uint8Array): Promise<Uint8Array>;
}

declare module '*.wasm' {
  const wasm: WebAssembly.Module;
  export default wasm;
}
