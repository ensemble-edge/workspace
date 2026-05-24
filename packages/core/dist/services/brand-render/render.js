import { loadEffectivePolicy, isPairAllowed, } from '../brand-policy.js';
import { composeLockup, wrapInBackground, applyFinishToWordmark, applyFinishToIconSvg, canvasSize, } from './lockup.js';
import { renderToSvg, renderToPng } from './engine.js';
import { loadFonts, FontNotInR2Error } from './fonts.js';
import { installFontIfMissing } from './install-font.js';
import { getOrGenerate, hashSnapshot } from './cache.js';
import { getIconSvg } from './sources.js';
export async function renderBrandAssetV2(req) {
    // ── 1. Policy + tokens + colors ──
    let policy = await loadEffectivePolicy(req.env.DB, req.workspaceId);
    const tokens = await loadIdentityTokens(req.env, req.workspaceId);
    const brandColors = await readBrandColors(req.env, req.workspaceId);
    // Apply editorial overrides on top of the stored policy.
    if (req.overrides) {
        policy = applyOverridesToPolicy(policy, req.composition, req.overrides);
    }
    // Banned-pair check. Skipped when overrides are present — the
    // preview is editorial and may show banned combos for evaluation.
    if (!req.overrides) {
        if (!isPairAllowed(policy, brandColors, req.finish, req.backgroundId)) {
            return null;
        }
        if (!policy.compositions[req.composition]?.allowed) {
            return null;
        }
    }
    // ── 2. Source resolution ──
    // v0.1.60: load the brand colors doc for palette + gradient
    // resolution. Wordmark segments can reference palette rungs or
    // gradients; the renderer needs the doc to turn refs into CSS.
    const { loadBrandColors } = await import('../brand-colors/load.js');
    const { resolvePalettes, resolveStopValue } = await import('../brand-colors/resolver.js');
    const brandDoc = await loadBrandColors(req.env.DB, req.workspaceId);
    const resolvedPalettes = resolvePalettes(brandDoc);
    // Convert gradients to {slug, css} for the wordmark renderer.
    const renderGradients = brandDoc.gradients.map((g) => {
        const stops = g.stops.map((s) => resolveStopValue(s, resolvedPalettes)).join(', ');
        const css = g.mode === 'radial'
            ? `radial-gradient(circle, ${stops})`
            : `linear-gradient(${g.angle}deg, ${stops})`;
        return { slug: g.slug, css };
    });
    const wordmarkInputs = buildWordmarkInputs(tokens, resolvedPalettes, renderGradients);
    const iconSvg = await loadIconSvg(req.env, req.workspaceId, tokens);
    if (req.composition === 'wordmark-only' && !wordmarkInputs.segments?.length && !wordmarkInputs.svgString) {
        return null;
    }
    if (req.composition === 'icon-only' && !iconSvg) {
        return null;
    }
    if ((req.composition === 'stacked' || req.composition === 'horizontal') &&
        ((!wordmarkInputs.segments?.length && !wordmarkInputs.svgString) || !iconSvg)) {
        return null;
    }
    // ── 3. Cache key ──
    // Everything that influences the output goes into the hash.
    // v0.1.55: the resolved brand colors (primary, bgLight, bgDark)
    // replace the old per-token snapshot for colors. The doc itself
    // is structurally part of every render — any palette/theme edit
    // changes the resolved hexes and therefore the cache key.
    const cacheKeySnapshot = {
        policy,
        tokens: pickRenderRelevantTokens(tokens),
        brandColors,
        req: {
            composition: req.composition,
            finish: req.finish,
            backgroundId: req.backgroundId,
            backgrounded: !!req.backgrounded,
            format: req.format ?? 'svg',
            // v0.1.53: include faviconSize in the snapshot so different
            // favicon sizes don't collide in cache. Square canvas → one
            // dimension is enough.
            faviconSize: req.faviconSize,
        },
    };
    const snapshotHash = hashSnapshot(cacheKeySnapshot);
    const sizeTail = req.faviconSize ? `-${req.faviconSize}` : '';
    const cacheKey = `${req.workspaceSlug}/${snapshotHash}/${req.composition}-${req.finish}-${req.backgroundId}${req.backgrounded ? '-bg' : ''}${sizeTail}.${req.format ?? 'svg'}`;
    // Editorial renders bypass persistent caching (operator is
    // actively dragging sliders; the output is throwaway).
    if (req.overrides) {
        const fresh = await produceAsset({ req, policy, tokens, wordmarkInputs, iconSvg, brandColors, resolvedPalettes, renderGradients });
        return { ...fresh, editorial: true };
    }
    const cached = await getOrGenerate({
        env: req.env,
        workspaceId: req.workspaceId,
        key: cacheKey,
        produce: () => produceAsset({ req, policy, tokens, wordmarkInputs, iconSvg, brandColors, resolvedPalettes, renderGradients }),
    });
    return { ...cached, editorial: false };
}
async function produceAsset(inputs) {
    const { req, policy, wordmarkInputs, iconSvg, brandColors, resolvedPalettes, renderGradients } = inputs;
    // Resolve finish color.
    const finishConfig = policy.finishes.find((f) => f.id === req.finish);
    let finishColor = finishConfig?.fillOverride ?? null;
    if (finishColor === 'var(--brand-primary)')
        finishColor = brandColors.primary;
    // Apply finish to wordmark + icon.
    const finishedWordmark = applyFinishToWordmark(wordmarkInputs, finishColor);
    const finishedIconSvg = iconSvg ? applyFinishToIconSvg(iconSvg, finishColor) : null;
    // Resolve composition config (already includes overrides via policy).
    const config = policy.compositions[req.composition];
    // Build the JSX tree.
    const composeInputs = {
        composition: req.composition,
        wordmark: finishedWordmark,
        icon: finishedIconSvg ? { svgString: finishedIconSvg, width: 0 } : undefined,
        config,
    };
    let tree = composeLockup(composeInputs);
    // v0.1.54 unified background pass. Previously we had two paths:
    // (a) backgrounds axis = solid color, no padding; (b) a separate
    // `backgrounded` flag = same color, with padding. Operators saw
    // both as "logo on a light background" and the distinction was
    // confusing. We collapsed them: when the background is light or
    // dark (anything other than transparent), the policy's
    // backgrounded.padding setting applies. Single source of truth.
    //
    // req.backgrounded is kept as a back-compat input but no longer
    // gates anything — the background axis itself decides.
    // v0.1.63: compute canvas dimensions BEFORE wrapping the tile so
    // wrapInBackground can stretch to fill them with explicit pixels
    // (avoids percentage-resolution drift in Satori — see
    // wrapInBackground for the failure mode this avoids).
    const { width, height } = req.faviconSize
        ? { width: req.faviconSize, height: req.faviconSize }
        : canvasSize(req.composition);
    const bg = policy.backgrounds.find((b) => b.id === req.backgroundId);
    if (bg && bg.id !== 'transparent') {
        // v0.1.60: five background variants.
        //   true-white / true-black → universal flat fills, NO token
        //     resolution. Always #FFFFFF / #0A0A0A. Always allowed.
        //     Tile padding still applies so the logo sits inside a
        //     proper boundary, but the color is fixed.
        //   light / dark → brand-tile variants resolved through
        //     policy.backgrounded.lightTile / .darkTile (token refs
        //     with palette + gradient support). Operator-controlled.
        let tileColor;
        if (bg.id === 'true-white') {
            tileColor = '#FFFFFF';
        }
        else if (bg.id === 'true-black') {
            tileColor = '#0A0A0A';
        }
        else {
            const isLight = bg.id === 'light';
            const tileTokenRef = isLight
                ? (policy.backgrounded?.lightTile ?? 'neutral-faded')
                : (policy.backgrounded?.darkTile ?? 'neutral-dark');
            const gradMatch = /^gradient-([a-z0-9-]+)$/.exec(tileTokenRef);
            if (gradMatch) {
                const g = renderGradients.find((x) => x.slug === gradMatch[1]);
                tileColor = g?.css ?? brandColors.bgLight;
            }
            else {
                const { resolveBindingValue } = await import('../brand-colors/resolver.js');
                tileColor = resolveBindingValue(tileTokenRef, resolvedPalettes);
                if (!tileColor || (tileColor === '#0a0a0a' && tileTokenRef !== 'neutral-dark')) {
                    tileColor = isLight ? brandColors.bgLight : brandColors.bgDark;
                }
            }
        }
        const paddingEm = policy.backgrounded?.padding ?? 0.5;
        tree = wrapInBackground({
            inner: tree,
            tileColor,
            paddingEm,
            canvasWidth: width,
            canvasHeight: height,
        });
    }
    // Load fonts (text-mode wordmark only — image-mode doesn't need fonts).
    const fontRequests = collectFontRequests(wordmarkInputs);
    let fonts;
    try {
        fonts = await loadFonts(req.env, req.workspaceId, fontRequests);
    }
    catch (err) {
        // Backstop migration: workspace had typography saved pre-v0.1.51
        // and the TTF isn't in R2 yet. Install inline and retry.
        if (err instanceof FontNotInR2Error) {
            await installFontIfMissing(req.env, req.workspaceId, err.family, err.weight);
            fonts = await loadFonts(req.env, req.workspaceId, fontRequests);
        }
        else {
            throw err;
        }
    }
    // Wrap the tree in a sized root so Satori has explicit dimensions.
    const rootTree = {
        type: 'div',
        props: {
            style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width,
                height,
            },
            children: [tree],
        },
    };
    const svg = await renderToSvg(rootTree, { width, height, fonts });
    if (req.format === 'png') {
        const png = await renderToPng(svg, width);
        return {
            body: png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength),
            contentType: 'image/png',
        };
    }
    return {
        body: new TextEncoder().encode(svg).buffer,
        contentType: 'image/svg+xml; charset=utf-8',
    };
}
/* ──────────────────────────────────────────────────────────────
 * Helpers — token reads, override merge, font request collection
 * ──────────────────────────────────────────────────────────── */
async function loadIdentityTokens(env, workspaceId) {
    const rows = await env.DB.prepare(`SELECT key, value FROM brand_tokens WHERE workspace_id = ? AND category IN ('identity','typography','colors') AND locale = ''`).bind(workspaceId).all();
    const out = {};
    for (const r of rows.results ?? [])
        out[r.key] = r.value;
    return out;
}
/**
 * Resolve the three brand colors the render pipeline cares about
 * (primary, light canvas, dark canvas) from the v0.1.55 brand colors
 * doc.
 *
 *   primary  → light theme `brand` binding, resolved through palettes
 *   bgLight  → light theme `canvas` binding
 *   bgDark   → dark theme `canvas` binding (when configured)
 *
 * Per Q3: if dark theme is unconfigured, fall back to black so
 * existing dark-bg variants still render with reasonable defaults.
 */
async function readBrandColors(env, workspaceId) {
    const { loadBrandColors } = await import('../brand-colors/load.js');
    const { resolvePalettes, resolveBindingValue } = await import('../brand-colors/resolver.js');
    const doc = await loadBrandColors(env.DB, workspaceId);
    const palettes = resolvePalettes(doc);
    const bgLight = resolveBindingValue(doc.themes.light.bindings.canvas, palettes);
    const bgDark = doc.themes.dark
        ? resolveBindingValue(doc.themes.dark.bindings.canvas, palettes)
        : '#0a0a0a';
    const primary = resolveBindingValue(doc.themes.light.bindings.brand, palettes);
    return { bgLight, bgDark, primary };
}
function pickRenderRelevantTokens(tokens) {
    // Only fields that actually affect render output go into the
    // cache key. Avoids unnecessary cache misses on unrelated token
    // edits (taglines, contact info, etc. don't change logo rendering).
    const out = {};
    for (const k of Object.keys(tokens)) {
        if (k === 'wordmark_text' || k === 'wordmark_family' || k === 'wordmark_weight' ||
            k === 'wordmark_style' || k === 'wordmark_letter_spacing' || k === 'wordmark_text_transform' ||
            k === 'logo_wordmark_svg' || k === 'logo_wordmark' ||
            k === 'logo_icon_mark_svg' || k === 'logo_icon_mark' ||
            k === 'brand-primary' || k === 'brand-background-light' || k === 'brand-background-dark') {
            out[k] = tokens[k];
        }
    }
    return out;
}
function buildWordmarkInputs(tokens, palettes, gradients) {
    // SVG upload wins (operator hand-tuned wordmark).
    const svgUrl = tokens['logo_wordmark_svg'] || tokens['logo_wordmark'];
    if (svgUrl && svgUrl.endsWith('.svg')) {
        // Source SVG is fetched separately in the icon path; for the
        // wordmark we currently inline as text via the picker. The
        // uploaded-SVG-wordmark case is rare enough to handle in a
        // follow-up. For v0.1.51, text mode covers the primary path.
    }
    const wordmarkText = tokens['wordmark_text'];
    let segments = [];
    if (wordmarkText) {
        try {
            const parsed = JSON.parse(wordmarkText);
            if (Array.isArray(parsed)) {
                segments = parsed.filter((s) => typeof s === 'object' && s !== null && typeof s.text === 'string');
            }
        }
        catch { /* fall through */ }
    }
    const weightStr = tokens['wordmark_weight'] || '700';
    const weight = parseInt(weightStr, 10) || 700;
    const lsStr = tokens['wordmark_letter_spacing'] || '0em';
    const lsMatch = /^(-?[\d.]+)em$/.exec(lsStr);
    const letterSpacingEm = lsMatch ? parseFloat(lsMatch[1]) : 0;
    return {
        segments,
        fontFamily: tokens['wordmark_family'] || 'system-ui',
        fontWeight: weight,
        fontStyle: tokens['wordmark_style'] || 'normal',
        letterSpacingEm,
        textTransform: tokens['wordmark_text_transform'] || 'none',
        palettes,
        gradients,
    };
}
// Icon SVG loading is shared with the favicon endpoint via sources.ts.
// Wrapper exists so the call site below stays symmetric with the
// other inline helpers; the actual implementation lives in
// services/brand-render/sources.ts (extracted v0.1.51 when the old
// brand-assets.ts was deleted).
async function loadIconSvg(env, workspaceId, _tokens) {
    return getIconSvg(env, workspaceId);
}
function applyOverridesToPolicy(policy, composition, overrides) {
    const next = {
        ...policy,
        compositions: { ...policy.compositions },
        backgrounded: policy.backgrounded ? { ...policy.backgrounded } : undefined,
    };
    if (composition === 'stacked' || composition === 'horizontal') {
        next.compositions[composition] = {
            ...next.compositions[composition],
            allowed: true,
            ...(overrides.iconScale != null ? { iconScale: overrides.iconScale } : {}),
            ...(overrides.spacing != null ? { spacing: overrides.spacing } : {}),
            ...(overrides.iconSide != null ? { iconSide: overrides.iconSide } : {}),
            ...(overrides.iconPosition != null ? { iconPosition: overrides.iconPosition } : {}),
            ...(overrides.crossAlign != null ? { crossAlign: overrides.crossAlign } : {}),
        };
    }
    if (overrides.backgroundedPadding != null && next.backgrounded) {
        next.backgrounded = {
            ...next.backgrounded,
            allowed: true,
            padding: overrides.backgroundedPadding,
        };
    }
    // v0.1.63: live tile-color overrides for the editor preview.
    if (overrides.lightTile != null && next.backgrounded) {
        next.backgrounded = { ...next.backgrounded, lightTile: overrides.lightTile };
    }
    if (overrides.darkTile != null && next.backgrounded) {
        next.backgrounded = { ...next.backgrounded, darkTile: overrides.darkTile };
    }
    return next;
}
function collectFontRequests(inputs) {
    // Text-mode wordmark: one font request. Image-mode: none.
    if (!inputs.segments || inputs.segments.length === 0)
        return [];
    const family = inputs.fontFamily ?? 'system-ui';
    // Skip system fonts — they're not in R2 and Satori handles them
    // via its built-in fallback chain. Operator picked one of the
    // "System" entries in the picker.
    if (/system-ui|^(serif|sans-serif|monospace)$|Georgia|ui-monospace|-apple-system/i.test(family)) {
        return [];
    }
    return [{
            family,
            weight: inputs.fontWeight ?? 700,
            style: inputs.fontStyle ?? 'normal',
        }];
}
//# sourceMappingURL=render.js.map