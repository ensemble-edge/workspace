/**
 * Brand lockup JSX components — extrinsic-sized flex layouts.
 *
 * v0.1.51. The components return Satori-compatible JSX (flexbox only,
 * no viewBox, no Tailwind). Satori reads the explicit width/height
 * on the root container and uses real font metrics from the loaded
 * TTFs to compute glyph positions exactly — replacing the heuristic
 * em-width table in the old composeLockup.
 *
 * Why no className / no shadcn / no Tailwind
 * ──────────────────────────────────────────
 * Satori implements a subset of CSS (no cascade, no class selectors,
 * no media queries — only inline style objects with flexbox + a
 * curated property set). Every style is inline. Components produce
 * "elements" via a hand-written `el()` helper that mirrors React's
 * createElement signature without pulling in React. This keeps the
 * render path zero-runtime-dependency on React DOM.
 *
 * What each function returns
 * ──────────────────────────
 *   composeLockup({...}) → a Satori-renderable element tree
 *   (renderToSvg() in engine.ts turns that tree into SVG bytes.)
 */
import type { CompositionConfig, LogoPolicy } from '../brand-policy';
import { svgInner, parseViewBox } from './svg-utils';

/* ──────────────────────────────────────────────────────────────
 * Minimal JSX element helper — no React dep
 * ──────────────────────────────────────────────────────────── */

interface SatoriElement {
  type: string;
  props: Record<string, unknown> & { children?: unknown };
}

function el(type: string, props: Record<string, unknown> = {}, children?: unknown): SatoriElement {
  return { type, props: { ...props, children } };
}

/* ──────────────────────────────────────────────────────────────
 * Shared sizing constants
 * ──────────────────────────────────────────────────────────── */

/**
 * Canonical wordmark font-size used by every lockup. The icon size
 * is derived as `iconScale * WORDMARK_SIZE_PX` (so iconScale=1.0
 * means "icon visually equal to one em of the wordmark"). Spacing
 * is also in em units — `spacingEm * WORDMARK_SIZE_PX`.
 *
 * Picking a "base" size for the lockup canvas is necessary because
 * Satori requires explicit width/height. Consumers scale the
 * resulting SVG via the <img> width/CSS — Satori's job is to
 * compute the correct *proportions*, not the final display size.
 *
 * 128px is large enough that anti-aliased glyph edges look crisp
 * when scaled DOWN to favicon sizes, and not so large that the
 * intermediate SVG is huge.
 */
const WORDMARK_SIZE_PX = 128;

/* ──────────────────────────────────────────────────────────────
 * Wordmark element — text-mode (segments) or image-mode
 * ──────────────────────────────────────────────────────────── */

export interface WordmarkSegment {
  text: string;
  color?: string;
}

/** Resolved palettes for palette-rung-ref segments. */
export type ResolvedPalettesForRender = Record<
  'primary' | 'secondary' | 'accent' | 'neutral',
  Record<'dark' | 'main' | 'bright' | 'pastel' | 'faded', string>
>;

/** Gradient defs for gradient-ref segments. */
export interface GradientForRender {
  slug: string;
  /** Resolved CSS gradient string for clip-text rendering. */
  css: string;
}

export interface WordmarkInputs {
  /** When provided, render as styled text (segment array). */
  segments?: WordmarkSegment[];
  /** When provided, render as embedded SVG (uploaded master). */
  svgString?: string;
  /** Resolved CSS font-family for text mode. Picked weight + style
   *  are applied via inline style; Satori uses the font's real
   *  metrics from the loaded FontData. */
  fontFamily?: string;
  fontWeight?: number;
  fontStyle?: 'normal' | 'italic';
  /** em-relative letter-spacing as a number (e.g. -0.02 = -0.02em). */
  letterSpacingEm?: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase';
  /** Applied to every segment that doesn't specify its own color. */
  defaultFill?: string;
  /** v0.1.60: palette + gradient resolution for token-ref segments. */
  palettes?: ResolvedPalettesForRender;
  gradients?: GradientForRender[];
}

function applyTransform(s: string, t?: WordmarkInputs['textTransform']): string {
  if (t === 'uppercase') return s.toUpperCase();
  if (t === 'lowercase') return s.toLowerCase();
  return s;
}

/**
 * Wordmark element. Returns either:
 *   - a <div> with multi-color <span> segments (text mode), or
 *   - an <img> wrapping the uploaded SVG (raster-mode wordmark
 *     would also work but uploaded brands are SVG)
 *
 * Text mode is the preferred path — fonts in R2, real metrics from
 * Satori, exact glyph positioning. Image mode is the fallback for
 * brands with a hand-tuned wordmark SVG.
 */
function buildWordmark(inputs: WordmarkInputs): SatoriElement {
  if (inputs.svgString) {
    // Inline the uploaded SVG. Satori accepts <img src="data:..."/>
    // for raster, but for SVG masters we want the vector tree
    // included — encode as a data: URI.
    const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(inputs.svgString)}`;
    const [, , w, h] = parseViewBox(inputs.svgString);
    const aspect = w > 0 && h > 0 ? w / h : 4;
    return el('img', {
      src: dataUri,
      style: {
        display: 'block',
        height: WORDMARK_SIZE_PX,
        width: WORDMARK_SIZE_PX * aspect,
      },
    });
  }

  // Text mode. Render each segment as a <span> with its own color;
  // the parent <div> sets font + spacing once.
  const segments = inputs.segments ?? [{ text: '' }];
  const family = inputs.fontFamily ?? 'system-ui';
  const weight = inputs.fontWeight ?? 700;
  const style = inputs.fontStyle ?? 'normal';
  const ls = inputs.letterSpacingEm ?? 0;

  // v0.1.60: resolve segment color through palettes + gradients.
  // Gradient refs render via background-clip:text (Satori supports
  // the CSS subset including backgroundClip + WebkitBackgroundClip).
  const resolveSegmentStyle = (raw: string | undefined): Record<string, string> => {
    if (!raw) return { color: inputs.defaultFill ?? '#0a0a0a' };
    const t = raw.trim();
    // Gradient ref
    if (/^gradient-[a-z0-9-]+$/.test(t)) {
      const slug = t.replace(/^gradient-/, '');
      const g = inputs.gradients?.find((x) => x.slug === slug);
      if (g) {
        return {
          background: g.css,
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          color: 'transparent',
          WebkitTextFillColor: 'transparent',
        };
      }
      return { color: inputs.defaultFill ?? '#0a0a0a' };
    }
    // Palette rung ref
    const m = /^(primary|secondary|accent|neutral)-(dark|main|bright|pastel|faded)$/.exec(t);
    if (m && inputs.palettes) {
      const role = m[1] as keyof ResolvedPalettesForRender;
      const rung = m[2] as keyof ResolvedPalettesForRender[typeof role];
      return { color: inputs.palettes[role][rung] };
    }
    // Literal hex
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(t)) return { color: t };
    return { color: inputs.defaultFill ?? '#0a0a0a' };
  };

  const spans = segments.map((seg) => el('span', {
    style: resolveSegmentStyle(seg.color),
  }, applyTransform(seg.text, inputs.textTransform)));

  return el('div', {
    style: {
      display: 'flex',
      // line-height tight to glyph metrics. Satori uses the font's
      // own metrics for the baseline; this just removes extra
      // leading that would push other lockup elements away.
      lineHeight: 1,
      fontFamily: family,
      fontWeight: weight,
      fontStyle: style,
      fontSize: WORDMARK_SIZE_PX,
      letterSpacing: `${ls}em`,
      whiteSpace: 'nowrap',
      // Color is applied per-segment; this sets a default so a
      // missing per-segment color falls through to brand foreground.
      color: inputs.defaultFill ?? '#0a0a0a',
    },
  }, spans);
}

/* ──────────────────────────────────────────────────────────────
 * Icon element
 * ──────────────────────────────────────────────────────────── */

export interface IconInputs {
  svgString: string;
  /** Width in lockup units. Height derives from the icon's intrinsic
   *  aspect ratio so the icon never distorts. */
  width: number;
}

function buildIcon(inputs: IconInputs): SatoriElement {
  const [, , vw, vh] = parseViewBox(inputs.svgString);
  const aspect = vw > 0 && vh > 0 ? vw / vh : 1;
  const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(inputs.svgString)}`;
  return el('img', {
    src: dataUri,
    style: {
      display: 'block',
      width: inputs.width,
      height: inputs.width / aspect,
    },
  });
}

/* ──────────────────────────────────────────────────────────────
 * Lockup compositions
 * ──────────────────────────────────────────────────────────── */

export type CompositionId = 'wordmark-only' | 'icon-only' | 'stacked' | 'horizontal';

export interface ComposeInputs {
  composition: CompositionId;
  wordmark: WordmarkInputs;
  icon?: IconInputs;
  /** Composition config from policy (iconScale, spacing, etc.). */
  config?: CompositionConfig;
}

/**
 * Build the lockup element tree. Returns a single root <div> with
 * children laid out by flexbox according to the composition.
 *
 * Math
 * ────
 * Icon target width = WORDMARK_SIZE_PX × iconScale (icon "size" is
 * relative to one em of the wordmark, same convention as before).
 *
 * Spacing converts em → px: spacingEm * WORDMARK_SIZE_PX.
 *
 * crossAlign in [-1, 1]: passed through to flexbox align-self via a
 * margin trick — the alignment becomes "where in the cross-axis
 * does the SHORTER element sit." For horizontal: shorter element's
 * vertical position. For stacked: narrower element's horizontal
 * position.
 *
 * For the cross-axis math we use `alignItems: flex-start` on the
 * container and apply `marginTop` (horizontal) / `marginLeft`
 * (stacked) as a fraction of the container slack. This produces
 * the same offset as the legacy slack-fraction math but driven by
 * real Satori-computed dimensions instead of estimated.
 *
 * Actually simpler: we don't know exact element heights/widths at
 * JSX construction time (Satori computes them at render time). So
 * we lean on flexbox: alignItems controls cross-axis. We translate
 * crossAlign into either flex-start / center / flex-end (snap to
 * discrete edges when |crossAlign| ≥ 0.5) OR center + a percentage
 * marginTop on the smaller element.
 *
 * For v0.1.51 we use the discrete snap version — produces 3 clean
 * positions per axis. Smooth offset is a v0.1.52 refinement once
 * we measure that operators want the in-between values.
 */
export function composeLockup(inputs: ComposeInputs): SatoriElement {
  const { composition, wordmark, icon, config } = inputs;

  if (composition === 'wordmark-only') {
    return buildWordmark(wordmark);
  }
  if (composition === 'icon-only') {
    if (!icon) throw new Error('icon-only composition requires icon');
    return buildIcon(icon);
  }
  if (!icon) throw new Error(`${composition} composition requires icon`);

  const iconScale = config?.iconScale ?? (composition === 'horizontal' ? 1.2 : 1.5);
  const spacingEm = config?.spacing ?? 0.4;
  const crossAlign = Math.max(-1, Math.min(1, config?.crossAlign ?? 0));

  // Cross-axis alignment snap. |crossAlign| < 0.34 → center,
  // else snap to the nearer edge. Three discrete positions per axis.
  // (Smooth offset deferred — see header comment.)
  const align: 'flex-start' | 'center' | 'flex-end' =
    crossAlign < -0.34 ? 'flex-start'
    : crossAlign > 0.34 ? 'flex-end'
    : 'center';

  const iconWidthPx = WORDMARK_SIZE_PX * iconScale;
  const spacingPx = WORDMARK_SIZE_PX * spacingEm;

  const wordmarkEl = buildWordmark(wordmark);
  const iconEl = buildIcon({ ...icon, width: iconWidthPx });

  if (composition === 'horizontal') {
    const iconSide = config?.iconSide ?? 'left';
    const children = iconSide === 'left' ? [iconEl, wordmarkEl] : [wordmarkEl, iconEl];
    return el('div', {
      style: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: align,
        gap: spacingPx,
      },
    }, children);
  }

  // composition === 'stacked'
  const iconPosition = config?.iconPosition ?? 'top';
  const children = iconPosition === 'top' ? [iconEl, wordmarkEl] : [wordmarkEl, iconEl];
  return el('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: align,
      gap: spacingPx,
    },
  }, children);
}

/* ──────────────────────────────────────────────────────────────
 * Backgrounded tile wrapper
 * ──────────────────────────────────────────────────────────── */

export interface BackgroundedInputs {
  /** Inner lockup element to wrap. */
  inner: SatoriElement;
  /** Tile background. v0.1.60: accepts a hex color OR a CSS gradient
   *  string. When the string starts with "linear-gradient(" or
   *  "radial-gradient(", we set the `background` shorthand;
   *  otherwise treat as a flat hex and set `backgroundColor`. */
  tileColor: string;
  /** Outer padding as a fraction of wordmark size (em). */
  paddingEm: number;
  /** v0.1.63: explicit canvas dimensions in pixels — used to stretch
   *  the tile to fill the full canvas with guaranteed-uniform layout
   *  across variants. */
  canvasWidth: number;
  canvasHeight: number;
}

/**
 * Wrap a composition in a brand-color tile. Flex-centered inside the
 * tile so the lockup is naturally centered both axes regardless of
 * inner dimensions.
 *
 * v0.1.60: tileColor can be a CSS gradient string; we detect the
 * "linear-gradient("/"radial-gradient(" prefix and use background
 * shorthand for those. Hex values continue to use backgroundColor.
 */
export function wrapInBackground(inputs: BackgroundedInputs): SatoriElement {
  const paddingPx = WORDMARK_SIZE_PX * inputs.paddingEm;
  const isGradient = /^(linear|radial)-gradient\(/.test(inputs.tileColor);
  // v0.1.63: explicit pixel dimensions from caller. v0.1.62 used
  // width:'100%' / height:'100%' to stretch the tile to fill the
  // canvas, but Satori's percentage resolution was inconsistent
  // across flex contexts — yielding tile sizes that varied across
  // variants of the same composition and made the padding slider
  // appear inert in the live preview. Explicit pixel dims (passed by
  // produceAsset, sourced from canvasSize()) remove ambiguity and
  // guarantee identical layout across every background variant.
  const style: Record<string, unknown> = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: inputs.canvasWidth,
    height: inputs.canvasHeight,
    padding: paddingPx,
  };
  if (isGradient) style.background = inputs.tileColor;
  else style.backgroundColor = inputs.tileColor;
  return el('div', { style }, [inputs.inner]);
}

/* ──────────────────────────────────────────────────────────────
 * Finish application (color swap)
 * ──────────────────────────────────────────────────────────── */

/**
 * Apply a finish color override to the wordmark inputs. Returns a
 * new WordmarkInputs with `defaultFill` set to the override color
 * and per-segment colors removed (mono finishes flatten all
 * segments to one color).
 *
 * For full-color (no override), the inputs pass through unchanged
 * so multi-color wordmarks render with their segment colors intact.
 */
export function applyFinishToWordmark(
  inputs: WordmarkInputs,
  finishColor: string | null,
): WordmarkInputs {
  if (finishColor === null) return inputs;
  return {
    ...inputs,
    defaultFill: finishColor,
    segments: inputs.segments?.map((s) => ({ text: s.text /* drop color */ })),
  };
}

/**
 * Apply finish to icon SVG by rewriting fills/strokes. Lifted from
 * brand-assets.ts applyFinish but trimmed to the icon-only case:
 *   - currentColor → swap
 *   - fill="..." → swap
 *   - class="brand-*" → swap via injected <style>
 */
export function applyFinishToIconSvg(svg: string, finishColor: string | null): string {
  if (finishColor === null) return svg;
  const out = svg
    .replace(/fill\s*=\s*["'][^"']*["']/g, `fill="${finishColor}"`)
    .replace(/stroke\s*=\s*["'][^"']*["']/g, `stroke="${finishColor}"`);
  const styleBlock = `<style>
    .brand-primary, .brand-secondary, .brand-accent { fill: ${finishColor}; stroke: ${finishColor}; }
    [fill="currentColor"], [stroke="currentColor"] { fill: ${finishColor}; stroke: ${finishColor}; }
  </style>`;
  return out.replace(/(<svg[^>]*>)/, `$1${styleBlock}`);
}

/* ──────────────────────────────────────────────────────────────
 * Sizing the Satori canvas
 * ──────────────────────────────────────────────────────────── */

/**
 * Estimate the canvas dimensions for a composition. Satori needs
 * explicit width/height; if we pass too small a value, content
 * clips. Too large is wasteful but renders correctly.
 *
 * Heuristic: 8 × WORDMARK_SIZE_PX wide is enough for ~14 wordmark
 * characters at proportional widths. Tall depends on composition.
 *
 * For v0.1.51 we err generous (12× wide, 4× tall) — wasted pixels
 * are cheap. A future refinement could measure the wordmark string
 * length and dial this down.
 */
export function canvasSize(composition: CompositionId): { width: number; height: number } {
  if (composition === 'icon-only') return { width: WORDMARK_SIZE_PX * 3, height: WORDMARK_SIZE_PX * 3 };
  if (composition === 'wordmark-only') return { width: WORDMARK_SIZE_PX * 12, height: WORDMARK_SIZE_PX * 2 };
  if (composition === 'stacked') return { width: WORDMARK_SIZE_PX * 12, height: WORDMARK_SIZE_PX * 6 };
  // horizontal
  return { width: WORDMARK_SIZE_PX * 16, height: WORDMARK_SIZE_PX * 4 };
}

export { WORDMARK_SIZE_PX };

// svg-utils is split out so the old brand-assets.ts can stay until
// the wireup is complete. After deletion we'll move parseViewBox /
// svgInner inline.
export type { SatoriElement };
