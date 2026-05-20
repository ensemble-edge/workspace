import { loadPolicy, isPairAllowed, } from '../brand-policy.js';
import { composeLockup, wrapInBackground, applyFinishToWordmark, applyFinishToIconSvg, canvasSize, } from './lockup.js';
import { renderToSvg, renderToPng } from './engine.js';
import { loadFonts, FontNotInR2Error } from './fonts.js';
import { installFontIfMissing } from './install-font.js';
import { getOrGenerate, hashSnapshot } from './cache.js';
import { getIconSvg } from './sources.js';
export async function renderBrandAssetV2(req) {
    // ── 1. Policy + tokens + colors ──
    let policy = await loadPolicy(req.env.DB, req.workspaceId);
    const tokens = await loadIdentityTokens(req.env, req.workspaceId);
    const brandColors = readBrandColors(tokens);
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
    const wordmarkInputs = buildWordmarkInputs(tokens);
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
    const cacheKeySnapshot = {
        policy,
        tokens: pickRenderRelevantTokens(tokens),
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
        const fresh = await produceAsset({ req, policy, tokens, wordmarkInputs, iconSvg, brandColors });
        return { ...fresh, editorial: true };
    }
    const cached = await getOrGenerate({
        env: req.env,
        workspaceId: req.workspaceId,
        key: cacheKey,
        produce: () => produceAsset({ req, policy, tokens, wordmarkInputs, iconSvg, brandColors }),
    });
    return { ...cached, editorial: false };
}
async function produceAsset(inputs) {
    const { req, policy, wordmarkInputs, iconSvg, brandColors } = inputs;
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
    const bg = policy.backgrounds.find((b) => b.id === req.backgroundId);
    if (bg && bg.id !== 'transparent') {
        let bgColor = bg.color;
        if (bgColor === 'var(--brand-background-light)')
            bgColor = brandColors.bgLight;
        else if (bgColor === 'var(--brand-background-dark)')
            bgColor = brandColors.bgDark;
        // Padding pulls from policy.backgrounded.padding when present;
        // defaults to 0.5em when the policy doesn't have the field
        // (older workspaces). 0 padding = full-bleed (the old "no
        // padding" behavior is now just "set padding to 0").
        const paddingEm = policy.backgrounded?.padding ?? 0.5;
        tree = wrapInBackground({
            inner: tree,
            tileColor: bgColor,
            paddingEm,
        });
    }
    // Canvas dimensions for Satori.
    // v0.1.53: favicon suite passes faviconSize to force a square
    // canvas at the exact pixel size needed (32/180/192/512). When
    // unset, the default canvasSize() picks a generous canvas based
    // on composition.
    const { width, height } = req.faviconSize
        ? { width: req.faviconSize, height: req.faviconSize }
        : canvasSize(req.composition);
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
function readBrandColors(tokens) {
    return {
        bgLight: tokens['brand-background-light'] || '#ffffff',
        bgDark: tokens['brand-background-dark'] || '#0a0a0a',
        primary: tokens['brand-primary'] || '#3b82f6',
    };
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
function buildWordmarkInputs(tokens) {
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