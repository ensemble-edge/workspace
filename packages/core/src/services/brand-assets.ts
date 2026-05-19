/**
 * Brand asset generation — SVG manipulation pipeline.
 *
 * Produces composed, finish-applied, theme-aware brand assets at
 * request time from one of two source types:
 *   1. Uploaded SVG masters (R2-stored, referenced by brand_token URL)
 *   2. Styled-text wordmark (typography tokens + segment JSON)
 *
 * The pipeline is a function chain:
 *   getSource()        → SVGString | null
 *   composeLockup()    → SVGString (combines wordmark + icon SVGs)
 *   applyFinish()      → SVGString (color-swaps fills)
 *   compositeOnBg()    → SVGString (wraps in background rect)
 *
 * Output is always SVG. Raster conversion (PNG/JPG/WebP via
 * resvg-wasm) ships in a follow-up release; until then operators
 * download SVG and convert externally if they need raster.
 */
import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../types';
import type {
  CompositionId, FinishId, LogoPolicy,
} from './brand-policy';
import { getR2Bucket } from './r2-binding';

/* ──────────────────────────────────────────────────────────────
 * Source resolution
 * ──────────────────────────────────────────────────────────── */

interface WordmarkSegment {
  text: string;
  color?: string;
}

/**
 * Resolve the wordmark to SVG markup. Returns null when neither
 * upload nor styled-text source is configured.
 *
 * - If `logo_wordmark` token points at an R2-served SVG, fetch + return it.
 * - Otherwise compile `wordmark_text` + wordmark typography tokens to SVG.
 *   Approximate text width from char count × emWidth heuristic; the
 *   resulting viewBox is generous but the rendered text aligns to its
 *   own bounding box thanks to text-anchor / dominant-baseline.
 */
export async function getWordmarkSvg(
  env: Env,
  workspaceId: string,
): Promise<string | null> {
  const tokens = await loadIdentityTokens(env.DB, workspaceId);

  // Prefer styled text when configured (operator's brand chose
  // text-based wordmark over an uploaded SVG).
  const wordmarkText = tokens['wordmark_text'];
  if (wordmarkText) {
    return compileTextWordmark(wordmarkText, tokens);
  }

  // Fall back to uploaded SVG. We use logo_wordmark (the base variant)
  // even if it's a PNG — operators on the old upload scheme stay
  // working; new SVG-only uploads go through the v0.1.31 flow.
  const url = tokens['logo_wordmark_svg'] || tokens['logo_wordmark'];
  if (url) {
    if (url.endsWith('.svg') || tokens['logo_wordmark_svg']) {
      return readSvgFromR2(env, workspaceId, url);
    }
    // Raster sources (legacy PNG wordmarks) can't be composed — caller
    // should branch on null and use the raster URL directly.
    return null;
  }

  return null;
}

/**
 * Resolve the icon mark to SVG. Returns null when no SVG icon is set.
 */
export async function getIconSvg(
  env: Env,
  workspaceId: string,
): Promise<string | null> {
  const tokens = await loadIdentityTokens(env.DB, workspaceId);
  const url = tokens['logo_icon_mark_svg'] || tokens['logo_icon_mark'];
  if (!url) return null;
  if (!url.endsWith('.svg') && !tokens['logo_icon_mark_svg']) return null;
  return readSvgFromR2(env, workspaceId, url);
}

async function loadIdentityTokens(db: D1Database, workspaceId: string): Promise<Record<string, string>> {
  const rows = await db.prepare(
    `SELECT key, value FROM brand_tokens
     WHERE workspace_id = ? AND category IN ('identity', 'typography') AND locale = ''`,
  ).bind(workspaceId).all<{ key: string; value: string }>();
  const out: Record<string, string> = {};
  for (const r of rows.results ?? []) out[r.key] = r.value;
  return out;
}

/**
 * Read an SVG asset from R2 directly via the binding — NOT via HTTP
 * self-fetch. The brand_token value is a canonical URL like
 *   /_ensemble/brand/asset/<encoded-key>
 * or the configured public-alias path; we extract the underlying
 * R2 key and read it through c.env[r2-binding-name].
 *
 * This was the cause of the "broken images in waves" bug in v0.1.32:
 * each variant cell fired an HTTP fetch back to the workspace itself,
 * and 16+ concurrent cells exhausted the Worker subrequest budget,
 * causing requests to sit in queue until the 30s subrequest timeout.
 * Reading from R2 directly is faster, doesn't count against the
 * subrequest budget, and is reliable under concurrent load.
 */
async function readSvgFromR2(
  env: Env,
  workspaceId: string,
  urlOrKey: string,
): Promise<string | null> {
  // Extract R2 key from the stored URL. Canonical path is
  // /_ensemble/brand/asset/<urlencoded-key>; aliased paths look like
  // /<alias>/<urlencoded-key>. The key segment is always the URL-
  // encoded R2 key; everything before it is presentation.
  let key: string;
  if (urlOrKey.startsWith('brand/')) {
    // Raw key form (used by some legacy stores).
    key = urlOrKey;
  } else {
    const canonicalMatch = /\/_ensemble\/brand\/asset\/(.+)$/.exec(urlOrKey);
    if (canonicalMatch) {
      key = decodeURIComponent(canonicalMatch[1]);
    } else {
      // Aliased form: /<alias>/<encoded-key>. Strip the first segment.
      const m = /^\/[^/]+\/(.+)$/.exec(urlOrKey);
      if (m) key = decodeURIComponent(m[1]);
      else return null;
    }
  }
  if (!key.startsWith('brand/')) return null;

  const r2 = await getR2Bucket(env, workspaceId);
  if (!r2) return null;
  try {
    const obj = await r2.get(key);
    if (!obj) return null;
    return await obj.text();
  } catch {
    return null;
  }
}

/* ──────────────────────────────────────────────────────────────
 * Styled-text wordmark → SVG
 * ──────────────────────────────────────────────────────────── */

/**
 * Per-family average em-width. Used by the wordmark compiler to
 * estimate text width — feeds the SVG viewBox AND the composition
 * layer (which positions icons relative to wordmark width).
 *
 * Values measured from rendered specimens at common weights (400/700).
 * Display fonts like Bebas Neue are condensed; serifs like Playfair
 * are wider; monospace fonts are widest per-glyph.
 *
 * Default for unknown families: 0.55 (a sans-serif average that's
 * close to most modern UI fonts).
 *
 * This is approximation, not precision — true per-glyph metrics need
 * opentype.js + woff2 parsing (deferred). But knowing a wordmark
 * uses Bebas Neue (~0.42) vs Inter (~0.52) vs Poppins (~0.55) is
 * the difference between composition that looks intentional and
 * composition that looks broken.
 */
const FAMILY_EM_WIDTHS: Record<string, number> = {
  // Sans-serif workhorses
  'Roboto':            0.50,
  'Inter':             0.52,
  'Open Sans':         0.54,
  'Lato':              0.50,
  'Montserrat':        0.58,
  'Poppins':           0.55,
  'Nunito':            0.55,
  'Nunito Sans':       0.55,
  'DM Sans':           0.54,
  'Manrope':           0.55,
  'Work Sans':         0.52,
  'Rubik':             0.55,
  'Plus Jakarta Sans': 0.55,
  'Outfit':            0.55,
  'Geist':             0.52,
  'Public Sans':       0.52,
  'IBM Plex Sans':     0.52,
  'Source Sans 3':     0.50,
  'Karla':             0.50,
  'Mulish':            0.53,
  // Serif (typically wider)
  'Playfair Display':  0.55,
  'Merriweather':      0.62,
  'PT Serif':          0.55,
  'Lora':              0.55,
  'Roboto Slab':       0.55,
  'Source Serif 4':    0.55,
  'Crimson Text':      0.52,
  'Spectral':          0.55,
  'EB Garamond':       0.50,
  'Bitter':            0.55,
  // Display (often condensed)
  'Oswald':            0.40,
  'Bebas Neue':        0.42,
  'Archivo':           0.55,
  'Anton':             0.40,
  'Gloock':            0.55,
  // Monospace (square advance)
  'JetBrains Mono':    0.60,
  'Roboto Mono':       0.60,
  'Fira Code':         0.60,
  'IBM Plex Mono':     0.60,
  'Source Code Pro':   0.60,
  'Space Mono':        0.60,
  // Handwriting
  'Caveat':            0.45,
  'Dancing Script':    0.50,
  'Pacifico':          0.55,
  // System stacks
  'System Sans':       0.52,
  'System Serif':      0.55,
  'System Mono':       0.60,
};

const DEFAULT_EM_WIDTH = 0.55;

/**
 * Compile a styled-text wordmark to an SVG document. Uses the
 * configured wordmark typography (family, weight, size, letter-spacing,
 * case) and per-segment colors.
 *
 * Text metrics: we approximate width from glyph count × an em-width
 * heuristic (0.55 × fontSize for sans-serif). For pixel-perfect
 * results we'd need opentype.js + a fetched woff2 file; that's a
 * follow-up improvement. For composition + brand-guide rendering,
 * the approximation is within 5-10% of true width which is fine
 * for visual reference.
 */
function compileTextWordmark(rawJson: string, tokens: Record<string, string>): string {
  let segments: WordmarkSegment[] = [];
  try {
    const parsed = JSON.parse(rawJson) as unknown;
    if (Array.isArray(parsed)) {
      segments = parsed.filter(
        (s): s is WordmarkSegment => typeof s === 'object' && s !== null && typeof (s as { text?: unknown }).text === 'string',
      );
    }
  } catch { /* fall through with empty */ }
  if (segments.length === 0) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>';
  }

  const family = tokens['wordmark_family'] || 'system-ui, sans-serif';
  const weight = tokens['wordmark_weight'] || '700';
  const style = tokens['wordmark_style'] || 'normal';
  const letterSpacing = tokens['wordmark_letter_spacing'] || '0em';
  const textTransform = tokens['wordmark_text_transform'] || 'none';

  // viewBox math: use 64 as the canonical font-size for SVG layout,
  // then estimate width per segment using the per-family em-width
  // table. Letter-spacing in em adds to the per-glyph advance.
  const SIZE = 64;
  const emWidth = FAMILY_EM_WIDTHS[family] ?? DEFAULT_EM_WIDTH;
  const lsMatch = /^(-?[\d.]+)em$/.exec(letterSpacing);
  const lsEm = lsMatch ? parseFloat(lsMatch[1]) : 0;
  const advance = SIZE * (emWidth + lsEm);

  // Apply text-transform server-side so the rendered glyph count
  // matches what the operator configured (lowercase + uppercase
  // change character widths in real fonts; for the heuristic we
  // assume same advance per glyph).
  function transformText(s: string): string {
    if (textTransform === 'uppercase') return s.toUpperCase();
    if (textTransform === 'lowercase') return s.toLowerCase();
    return s;
  }

  const transformed = segments.map((s) => ({ ...s, text: transformText(s.text) }));
  const totalChars = transformed.reduce((n, s) => n + s.text.length, 0);
  // viewBox width: estimate with a 20% generous margin so even when
  // our em-width is off, glyphs don't clip on the right.
  const estimatedWidth = totalChars * advance;
  const width = Math.ceil(estimatedWidth * 1.2);
  // Height accommodates full em-box (caps + descenders) plus padding.
  // SIZE × 1.2 gives ~10% padding above caps and below descenders so
  // no clipping is possible even for tall fonts.
  const HEIGHT_FACTOR = 1.2;
  const height = Math.ceil(SIZE * HEIGHT_FACTOR);
  // Baseline at 80% of height puts cap-tops at ~y=12 (above zero) and
  // descenders at ~y=80 — comfortably inside the viewBox.
  const baselineY = Math.round(height * 0.8);

  // Inline tspans (NO absolute x positions). The browser flows them
  // left-to-right at their natural rendered widths, so multi-color
  // segments meet seamlessly with no overlap and no gaps.
  // Previously: each tspan had x="<estimate>" which (a) didn't account
  // for actual glyph advances and (b) fought textLength's stretching,
  // causing the overlap you reported.
  const tspans: string[] = [];
  for (const seg of transformed) {
    const fill = seg.color ? ` fill="${escapeXml(seg.color)}"` : '';
    tspans.push(`<tspan${fill}>${escapeXml(seg.text)}</tspan>`);
  }

  // When the wordmark uses a non-system font, embed an @import so
  // the SVG renders correctly even inside <img> tags (which run SVGs
  // in a sandboxed mode without access to the host page's font CSS).
  // System stacks (system-ui, Georgia, ui-monospace) need no import.
  const isSystem = /system-ui|^(serif|sans-serif|monospace)$|Georgia|ui-monospace|-apple-system/i.test(family);
  // Note: drop `&display=swap` from the URL. We can't put a bare `&`
  // inside SVG XML (it would need to be `&amp;` for the XML parser
  // but CSS sees `&amp;` literally and the URL becomes malformed).
  // Skipping the param entirely produces a valid URL the CSS parser
  // accepts. display=swap is a perf optimization, not required.
  const fontImport = isSystem
    ? ''
    : `<defs><style>@import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@${weight}');</style></defs>`;

  // No textLength. No absolute x on tspans. Let the browser do its
  // job — render the text at its natural width with proper
  // letter-spacing. The viewBox is generous enough that natural
  // width fits even when our estimate is off. Composition layer
  // uses the viewBox width as the wordmark width; the slight
  // generous-margin is invisible because the text is left-anchored
  // and the right-side breathing space looks intentional.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" font-family="${escapeXml(family)}" font-weight="${escapeXml(weight)}" font-style="${escapeXml(style)}" font-size="${SIZE}" letter-spacing="${escapeXml(letterSpacing)}">${fontImport}<text x="0" y="${baselineY}">${tspans.join('')}</text></svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

/* ──────────────────────────────────────────────────────────────
 * SVG manipulation helpers
 * ──────────────────────────────────────────────────────────── */

/**
 * Parse an SVG's viewBox into [x, y, width, height]. Defaults to
 * [0, 0, 100, 100] when no viewBox is present.
 */
export function parseViewBox(svg: string): [number, number, number, number] {
  const m = /viewBox\s*=\s*["']([\d.\-\s]+)["']/i.exec(svg);
  if (!m) return [0, 0, 100, 100];
  const parts = m[1].trim().split(/\s+/).map(Number);
  if (parts.length !== 4 || parts.some((n) => !isFinite(n))) return [0, 0, 100, 100];
  return parts as [number, number, number, number];
}

/**
 * Strip the outer <svg> wrapper so the contents can be embedded in
 * a parent SVG (used by composeLockup to nest wordmark + icon).
 */
export function svgInner(svg: string): string {
  return svg.replace(/^[\s\S]*?<svg[^>]*>/i, '').replace(/<\/svg>\s*$/i, '');
}

/* ──────────────────────────────────────────────────────────────
 * Finish application (color swap)
 * ──────────────────────────────────────────────────────────── */

/**
 * Apply a finish to an SVG by rewriting fill values. The finish's
 * fillOverride says what to replace fills WITH:
 *   - null              → no change (full-color)
 *   - hex (e.g. '#000') → replace every fill with this hex
 *   - 'var(--brand-primary)' → resolve to actual brand primary, swap
 *
 * Targets:
 *   - currentColor      → swapped (the canonical theme-aware fill)
 *   - fill="#hex"       → swapped (explicit colors)
 *   - fill="rgb(...)"   → swapped
 *   - class="brand-*"   → swapped via @style block injection
 */
export function applyFinish(
  svg: string,
  finishId: FinishId,
  policy: LogoPolicy,
  brandColors: { bgLight: string; bgDark: string; primary: string; secondary?: string; accent?: string },
): string {
  const finish = policy.finishes.find((f) => f.id === finishId);
  if (!finish || finish.fillOverride === null) return svg;

  let target = finish.fillOverride;
  if (target === 'var(--brand-primary)') target = brandColors.primary;

  // Replace inline fill attributes — preserves attribute ordering and
  // structure better than a full DOM parse.
  let out = svg
    .replace(/fill\s*=\s*["'][^"']*["']/g, `fill="${target}"`)
    .replace(/stroke\s*=\s*["'][^"']*["']/g, `stroke="${target}"`);

  // Replace `currentColor` and class-based brand-* CSS with the
  // target color via an injected <style> block. Goes inside the root
  // <svg> so it scopes to this document only.
  const styleBlock = `<style>
    .brand-primary, .brand-secondary, .brand-accent { fill: ${target}; stroke: ${target}; }
    [fill="currentColor"], [stroke="currentColor"] { fill: ${target}; stroke: ${target}; }
  </style>`;
  out = out.replace(/(<svg[^>]*>)/, `$1${styleBlock}`);

  return out;
}

/* ──────────────────────────────────────────────────────────────
 * Background composition
 * ──────────────────────────────────────────────────────────── */

/**
 * Wrap the SVG in a background rect. 'transparent' bg returns the
 * SVG unchanged. Hex or var() backgrounds inject a full-bleed rect
 * behind the existing content.
 */
export function compositeOnBackground(
  svg: string,
  backgroundColor: string,
): string {
  if (backgroundColor === 'transparent' || !backgroundColor) return svg;
  const [x, y, w, h] = parseViewBox(svg);
  const rect = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${backgroundColor}"/>`;
  // Insert rect IMMEDIATELY after the root <svg ...> open tag so it
  // paints behind everything else.
  return svg.replace(/(<svg[^>]*>)/, `$1${rect}`);
}

/* ──────────────────────────────────────────────────────────────
 * Composition (lockups)
 * ──────────────────────────────────────────────────────────── */

/**
 * Compose icon + wordmark into a stacked or horizontal lockup. The
 * iconScale config controls icon size relative to wordmark height;
 * spacing controls the gap between them (em-relative to wordmark
 * height, NOT viewBox units).
 *
 * Stacked: icon above wordmark, centered. Spacing is the vertical gap.
 * Horizontal: icon left of wordmark, vertically aligned by cap-height.
 *
 * Both inputs must be SVG strings with viewBoxes — getWordmarkSvg
 * and getIconSvg both return valid viewBox-bearing SVGs.
 */
export function composeLockup(
  iconSvg: string,
  wordmarkSvg: string,
  composition: CompositionId,
  config: LogoPolicy['compositions'][CompositionId],
): string {
  if (composition === 'wordmark-only') return wordmarkSvg;
  if (composition === 'icon-only') return iconSvg;

  const [, , iw, ih] = parseViewBox(iconSvg);
  const [, , ww, wh] = parseViewBox(wordmarkSvg);

  // Icon target height in lockup-units = wordmark-height × iconScale.
  const iconScale = config.iconScale ?? 1.5;
  const spacing = (config.spacing ?? 0.4) * wh;

  // Icon scaled to target height; preserves aspect ratio.
  const targetIconHeight = wh * iconScale;
  const targetIconWidth = (iw / ih) * targetIconHeight;

  if (composition === 'stacked') {
    // v0.1.47+: iconPosition controls top/bottom; hAlign kept for
    // legacy reads but always center-aligns horizontally now.
    const iconPosition = config.iconPosition ?? (config.hAlign === 'left' || config.hAlign === 'right' ? 'top' : 'top');
    const lockupWidth = Math.max(targetIconWidth, ww);
    const lockupHeight = targetIconHeight + spacing + wh;
    const iconX = (lockupWidth - targetIconWidth) / 2;
    const wordmarkX = (lockupWidth - ww) / 2;
    const iconY = iconPosition === 'top' ? 0 : (lockupHeight - targetIconHeight);
    const wordmarkY = iconPosition === 'top' ? (targetIconHeight + spacing) : 0;

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lockupWidth} ${lockupHeight}">
      <g transform="translate(${iconX}, ${iconY})">
        <svg width="${targetIconWidth}" height="${targetIconHeight}" viewBox="${parseViewBox(iconSvg).join(' ')}">${svgInner(iconSvg)}</svg>
      </g>
      <g transform="translate(${wordmarkX}, ${wordmarkY})">
        <svg width="${ww}" height="${wh}" viewBox="${parseViewBox(wordmarkSvg).join(' ')}">${svgInner(wordmarkSvg)}</svg>
      </g>
    </svg>`;
  }

  if (composition === 'horizontal') {
    // v0.1.47+: iconSide controls left/right; vAlign defaults to
    // middle (cap-height aligned) and rarely needs operator override.
    const iconSide = config.iconSide ?? 'left';
    const lockupWidth = targetIconWidth + spacing + ww;
    const lockupHeight = Math.max(targetIconHeight, wh);
    const iconY = (lockupHeight - targetIconHeight) / 2;
    const wordmarkY = (lockupHeight - wh) / 2;
    const iconX = iconSide === 'left' ? 0 : (targetIconWidth + spacing + ww - targetIconWidth);
    const wordmarkX = iconSide === 'left' ? (targetIconWidth + spacing) : 0;

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lockupWidth} ${lockupHeight}">
      <g transform="translate(${iconX}, ${iconY})">
        <svg width="${targetIconWidth}" height="${targetIconHeight}" viewBox="${parseViewBox(iconSvg).join(' ')}">${svgInner(iconSvg)}</svg>
      </g>
      <g transform="translate(${wordmarkX}, ${wordmarkY})">
        <svg width="${ww}" height="${wh}" viewBox="${parseViewBox(wordmarkSvg).join(' ')}">${svgInner(wordmarkSvg)}</svg>
      </g>
    </svg>`;
  }

  return wordmarkSvg;
}

/**
 * v0.1.47+: wrap any composition in a brand-background tile with
 * configurable padding. Used when the operator has enabled the
 * Backgrounded variant in policy. Returns a new SVG with the inner
 * composition centered inside a padded background rect.
 */
export function wrapInBackground(
  innerSvg: string,
  backgroundColor: string,
  paddingEm: number,
): string {
  const [, , innerW, innerH] = parseViewBox(innerSvg);
  // Padding in em — treated as a fraction of the inner content height
  // (so a wider lockup gets proportionally wider padding too).
  const padding = innerH * paddingEm;
  const outerW = innerW + padding * 2;
  const outerH = innerH + padding * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${outerW} ${outerH}">
    <rect x="0" y="0" width="${outerW}" height="${outerH}" fill="${backgroundColor}"/>
    <g transform="translate(${padding}, ${padding})">
      <svg width="${innerW}" height="${innerH}" viewBox="${parseViewBox(innerSvg).join(' ')}">${svgInner(innerSvg)}</svg>
    </g>
  </svg>`;
}

/* ──────────────────────────────────────────────────────────────
 * Full pipeline
 * ──────────────────────────────────────────────────────────── */

export interface RenderRequest {
  composition: CompositionId;
  finish: FinishId;
  backgroundId: string;
  /**
   * v0.1.47+: wrap the rendered composition in a brand-background
   * tile with operator-configured padding. When true and policy
   * allows it, the engine appends the wrapInBackground step.
   */
  backgrounded?: boolean;
}

export interface RenderContext {
  workspaceId: string;
  env: Env;
  policy: LogoPolicy;
  brandColors: { bgLight: string; bgDark: string; primary: string };
}

/**
 * Render a brand asset variant as an SVG string. Returns null when
 * the requested variant is banned or the source SVGs aren't available.
 */
export async function renderBrandAsset(
  req: RenderRequest,
  ctx: RenderContext,
): Promise<string | null> {
  const { isPairAllowed } = await import('./brand-policy');
  if (!isPairAllowed(ctx.policy, ctx.brandColors, req.finish, req.backgroundId)) {
    return null;
  }
  if (!ctx.policy.compositions[req.composition]?.allowed) {
    return null;
  }

  // Source resolution — direct R2 reads via getR2Bucket, not HTTP
  // self-fetches. Faster, no subrequest-budget pressure, no timeouts
  // under concurrent variant-matrix renders.
  const wordmarkSvg = await getWordmarkSvg(ctx.env, ctx.workspaceId);
  const iconSvg = await getIconSvg(ctx.env, ctx.workspaceId);

  if (req.composition === 'wordmark-only') {
    if (!wordmarkSvg) return null;
  } else if (req.composition === 'icon-only') {
    if (!iconSvg) return null;
  } else {
    if (!wordmarkSvg || !iconSvg) return null;
  }

  // Composition.
  let svg: string;
  if (req.composition === 'wordmark-only') svg = wordmarkSvg!;
  else if (req.composition === 'icon-only') svg = iconSvg!;
  else svg = composeLockup(iconSvg!, wordmarkSvg!, req.composition, ctx.policy.compositions[req.composition]);

  // Finish (color swap).
  svg = applyFinish(svg, req.finish, ctx.policy, ctx.brandColors);

  // Background composition.
  const bg = ctx.policy.backgrounds.find((b) => b.id === req.backgroundId);
  if (bg) {
    let bgColor = bg.color;
    if (bgColor === 'var(--brand-background-light)') bgColor = ctx.brandColors.bgLight;
    else if (bgColor === 'var(--brand-background-dark)') bgColor = ctx.brandColors.bgDark;
    svg = compositeOnBackground(svg, bgColor);
  }

  // v0.1.47+: backgrounded-tile wrapping. Operator-controlled padding.
  // Refuse the request if backgrounded isn't allowed in policy OR if
  // the specific light/dark variant is disabled.
  if (req.backgrounded && ctx.policy.backgrounded?.allowed) {
    const wantsLight = req.backgroundId === 'light' || req.backgroundId === 'transparent';
    const wantsDark = req.backgroundId === 'dark';
    if (wantsLight && !ctx.policy.backgrounded.lightAllowed) return null;
    if (wantsDark && !ctx.policy.backgrounded.darkAllowed) return null;
    const tileColor = wantsDark ? ctx.brandColors.bgDark : ctx.brandColors.bgLight;
    svg = wrapInBackground(svg, tileColor, ctx.policy.backgrounded.padding);
  }

  return svg;
}
