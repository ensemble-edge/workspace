/**
 * Brand CSS Generation
 *
 * Now delegates to the brand spec system:
 * 1. Assembles the full EnsembleBrandSpec from D1
 * 2. Generates CSS from the spec (brand tokens as --brand-* variables)
 * 3. Also generates workspace shell CSS (--background, --font-body, etc.)
 *
 * The CSS endpoint serves BOTH:
 * - Brand CSS (--brand-*) for external projects
 * - Shell CSS (shadcn/ui variables) for the workspace UI
 */
import { assembleBrandSpec, generateCssFromSpec } from './spec.js';
import { getThemePreset } from './themes.js';
import { loadAndResolveRoles, buildGoogleFontsHref, buildFontCssVars, } from '../../../services/font-roles.js';
/** Font family map — shared with shell Appearance tab */
export const FONT_FAMILIES = {
    system: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    inter: '"Inter", system-ui, sans-serif',
    manrope: '"Manrope", system-ui, sans-serif',
    geist: '"Geist", system-ui, sans-serif',
    'cal-sans': '"Cal Sans", system-ui, sans-serif',
    roboto: '"Roboto", system-ui, sans-serif',
    'dm-sans': '"DM Sans", system-ui, sans-serif',
    spectral: '"Spectral", serif',
    gloock: '"Gloock", serif',
    playfair: '"Playfair Display", serif',
};
/** Base color scales — HSL values for shadcn/ui dark mode */
export const BASE_COLOR_SCALES = {
    zinc: { bg: '240 10% 3.9%', fg: '0 0% 98%', border: '240 3.7% 15.9%' },
    slate: { bg: '222.2 84% 4.9%', fg: '210 40% 98%', border: '217.2 32.6% 17.5%' },
    stone: { bg: '20 14.3% 4.1%', fg: '60 9.1% 97.8%', border: '12 6.5% 15.1%' },
    gray: { bg: '224 71.4% 4.1%', fg: '210 20% 98%', border: '215 27.9% 16.9%' },
    neutral: { bg: '0 0% 3.9%', fg: '0 0% 98%', border: '0 0% 14.9%' },
};
/**
 * Generate the full CSS output for /_ensemble/brand/css.
 *
 * This includes:
 * 1. Brand CSS (--brand-* variables from the spec)
 * 2. Shell CSS (shadcn/ui variables for workspace appearance)
 */
export async function generateBrandCss(db, workspaceId, defaultAccent) {
    // Assemble full spec
    const spec = await assembleBrandSpec(db, workspaceId);
    // Generate brand CSS from spec
    const brandCss = generateCssFromSpec(spec);
    // Also generate shell CSS (workspace appearance settings from 'custom' category)
    const shellCss = await generateShellCss(db, workspaceId, defaultAccent);
    // v0.1.17: resolve all five typographic roles and emit:
    //   1. An @import for the combined Google Fonts CSS (only families/weights in use)
    //   2. :root CSS variables consumers reference (--font-display, --font-display-weight, etc.)
    //   3. A wordmark fallback to display when wordmark family is unset.
    let fontCss = '';
    try {
        const roles = await loadAndResolveRoles(db, workspaceId);
        const href = buildGoogleFontsHref(roles);
        const importLine = href ? `@import url('${href}');\n\n` : '';
        fontCss = importLine + buildFontCssVars(roles);
    }
    catch (err) {
        console.warn('[brand-css] font role resolution failed:', err);
    }
    // v0.1.56: operator-typed custom CSS overrides. Stored in
    // brand_tokens at category='custom', key='operator_css_overrides'.
    // Appended LAST so operator declarations win cascade order — the
    // entire point of the CSS tab is "let me override anything above."
    let customCss = '';
    try {
        const row = await db.prepare(`SELECT value FROM brand_tokens
       WHERE workspace_id = ? AND category = 'custom' AND key = 'operator_css_overrides' AND locale = ''`).bind(workspaceId).first();
        if (row?.value) {
            // Wrap in a clearly-labelled comment block so operators
            // inspecting /brand.css see exactly what was operator-added.
            customCss = `\n\n/* ── Operator-defined overrides ─────────────────────────\n   Edit at /brand → CSS\n   ─────────────────────────────────────────────────────── */\n${row.value}\n`;
        }
    }
    catch {
        /* leave customCss empty on read failure */
    }
    // Font CSS must come FIRST so the @import lands at the top of the
    // stylesheet (CSS @import rules are only valid before any other
    // declarations). Custom operator CSS comes LAST so it can override
    // anything emitted above.
    return `${fontCss}\n\n${brandCss}\n\n${shellCss}${customCss}`;
}
/**
 * Generate shell-specific CSS with FULL shadcn/ui color scale.
 *
 * Also exports the saved themeMode so the HTML can set `class="dark"`.
 */
async function generateShellCss(db, workspaceId, defaultAccent) {
    let accent = defaultAccent;
    const customTokens = {};
    const brandTokens = {};
    try {
        const result = await db.prepare(`SELECT category, key, value FROM brand_tokens
       WHERE workspace_id = ? AND locale = '' AND category IN ('colors', 'custom')`).bind(workspaceId).all();
        for (const row of result.results || []) {
            if (row.category === 'colors' && row.key === 'accent')
                accent = row.value;
            if (row.category === 'colors')
                brandTokens[row.key] = row.value;
            if (row.category === 'custom')
                customTokens[row.key] = row.value;
        }
        // Workspace accent color overrides brand accent
        if (customTokens.accentColor)
            accent = customTokens.accentColor;
    }
    catch {
        // Use defaults
    }
    // v0.1.55: bridge from the new BrandColorsDoc to the legacy
    // brand-primary/brand-secondary/brand-accent + semantic.* token
    // names this CSS generator uses. The doc is the source of truth;
    // we synthesize the old token names from its resolved palettes +
    // semantic colors so the shadcn-preset shell-CSS machinery
    // doesn't need to know about palette rungs.
    try {
        const { loadBrandColors } = await import('../../../services/brand-colors/load.js');
        const { resolvePalettes, resolveBindingValue } = await import('../../../services/brand-colors/resolver.js');
        const doc = await loadBrandColors(db, workspaceId);
        const palettes = resolvePalettes(doc);
        // "brand-primary" → the light theme's `brand` binding resolved
        // through palettes. "brand-secondary"/"brand-accent" → the
        // Main rung of the secondary/accent palettes (operator picks
        // them directly there).
        brandTokens['brand-primary'] = resolveBindingValue(doc.themes.light.bindings.brand, palettes);
        brandTokens['brand-secondary'] = palettes.secondary.main;
        brandTokens['brand-accent'] = palettes.accent.main;
        brandTokens['brand-background-light'] = resolveBindingValue(doc.themes.light.bindings.canvas, palettes);
        brandTokens['brand-background-dark'] = doc.themes.dark
            ? resolveBindingValue(doc.themes.dark.bindings.canvas, palettes)
            : '#0a0a0a';
        // Per-rung CSS variables — operators consume these directly in
        // app code as e.g. `var(--primary-bright)`.
        const roles = ['primary', 'secondary', 'accent', 'neutral'];
        for (const role of roles) {
            const p = palettes[role];
            brandTokens[`${role}-dark`] = p.dark;
            brandTokens[`${role}-main`] = p.main;
            brandTokens[`${role}-bright`] = p.bright;
            brandTokens[`${role}-pastel`] = p.pastel;
            brandTokens[`${role}-faded`] = p.faded;
        }
        // v0.1.100: accent #1 also addressable as accent-1-<rung> for
        // symmetry with accents 2-4. The bare `accent-<rung>` form
        // (above) is the back-compat path.
        {
            const p = palettes.accent;
            brandTokens['accent-1-dark'] = p.dark;
            brandTokens['accent-1-main'] = p.main;
            brandTokens['accent-1-bright'] = p.bright;
            brandTokens['accent-1-pastel'] = p.pastel;
            brandTokens['accent-1-faded'] = p.faded;
        }
        // v0.1.100: accents 2-4 from palettes.accentExtras. Each emits
        // a full 5-rung scale with accent-<N>- prefix.
        if (palettes.accentExtras) {
            palettes.accentExtras.forEach((p, i) => {
                const idx = i + 2; // accentExtras[0] → accent-2
                brandTokens[`accent-${idx}-dark`] = p.dark;
                brandTokens[`accent-${idx}-main`] = p.main;
                brandTokens[`accent-${idx}-bright`] = p.bright;
                brandTokens[`accent-${idx}-pastel`] = p.pastel;
                brandTokens[`accent-${idx}-faded`] = p.faded;
            });
        }
        // Semantic — emit as semantic.<role> keys for the existing
        // shadcn-preset machinery below; emit pairs in a separate
        // namespace for the brand-css consumers (--semantic-success-main, etc).
        brandTokens['semantic.success'] = doc.semantic.success.main;
        brandTokens['semantic.info'] = doc.semantic.info.main;
        brandTokens['semantic.warning'] = doc.semantic.warning.main;
        brandTokens['semantic.error'] = doc.semantic.error.main;
        brandTokens['semantic.success-light'] = doc.semantic.success.light;
        brandTokens['semantic.info-light'] = doc.semantic.info.light;
        brandTokens['semantic.warning-light'] = doc.semantic.warning.light;
        brandTokens['semantic.error-light'] = doc.semantic.error.light;
        // Gradients — emit as --gradient-<slug> CSS variables.
        const { resolveStopValue } = await import('../../../services/brand-colors/resolver.js');
        for (const g of doc.gradients) {
            const stops = g.stops
                .map((s) => resolveStopValue(s, palettes))
                .join(', ');
            const direction = g.mode === 'radial' ? 'radial-gradient(circle' : `linear-gradient(${g.angle}deg`;
            brandTokens[`gradient-${g.slug}`] = `${direction}, ${stops})`;
        }
    }
    catch {
        // If the new doc loader fails, leave the legacy brandTokens map
        // untouched so the rest of this function still produces output.
    }
    const radius = customTokens.radius || '0.5';
    const headingFont = customTokens.headingFont || 'dm-sans';
    const bodyFont = customTokens.bodyFont || 'dm-sans';
    const themeMode = customTokens.themeMode || 'dark';
    const contentPadding = customTokens.contentPadding || '1.5';
    const cardPadding = customTokens.cardPadding || '1.5';
    const themePresetId = customTokens.themePreset || 'default';
    const resolvedHeadingFont = FONT_FAMILIES[headingFont] || FONT_FAMILIES['dm-sans'];
    const resolvedBodyFont = FONT_FAMILIES[bodyFont] || FONT_FAMILIES['dm-sans'];
    // Start from the theme preset (provides coordinated light + dark scales)
    // "brand" preset uses "default" as base — brand colors are applied via individual overrides
    const preset = getThemePreset(themePresetId === 'brand' ? 'default' : themePresetId) || getThemePreset('default');
    const lightScale = { ...preset.light };
    const darkScale = { ...preset.dark };
    // For "brand" preset, read colors directly from brand_tokens (live)
    // This means changing brand colors auto-updates the workspace appearance
    if (themePresetId === 'brand') {
        const bp = brandTokens['brand-primary'];
        const bs = brandTokens['brand-secondary'];
        const ba = brandTokens['brand-accent'];
        if (bp && !customTokens.buttonColor)
            customTokens.buttonColor = bp;
        if (ba && !customTokens.accentColor)
            customTokens.accentColor = ba;
        if (bs && !customTokens.sidebarColor)
            customTokens.sidebarColor = bs;
        // Pull brand semantic colors into workspace if not overridden
        for (const key of ['semantic.success', 'semantic.warning', 'semantic.error', 'semantic.info']) {
            const val = brandTokens[key];
            const wsKey = key.replace('semantic.', '') + 'Color';
            if (val && !customTokens[wsKey])
                customTokens[wsKey] = val;
        }
    }
    // Apply user overrides on top of the preset
    // Primary color (buttons, badges, checkbox, switch, slider, links, focus ring)
    const buttonColorHex = customTokens.buttonColor || '';
    if (buttonColorHex) {
        const hsl = hexToHslString(buttonColorHex);
        if (hsl) {
            const fg = isLightHex(buttonColorHex) ? '0 0% 9%' : '0 0% 98%';
            lightScale.primary = hsl;
            lightScale['primary-foreground'] = fg;
            lightScale.ring = hsl;
            lightScale['sidebar-primary'] = hsl;
            lightScale['sidebar-primary-foreground'] = fg;
            darkScale.primary = hsl;
            darkScale['primary-foreground'] = fg;
            darkScale.ring = hsl;
            darkScale['sidebar-primary'] = hsl;
            darkScale['sidebar-primary-foreground'] = fg;
        }
    }
    // Accent color (sidebar hover/active)
    const accentColorHex = customTokens.accentColor || '';
    if (accentColorHex) {
        const hsl = hexToHslString(accentColorHex);
        if (hsl) {
            const fg = isLightHex(accentColorHex) ? '0 0% 9%' : '0 0% 98%';
            lightScale['sidebar-accent'] = hsl;
            lightScale['sidebar-accent-foreground'] = fg;
            darkScale['sidebar-accent'] = hsl;
            darkScale['sidebar-accent-foreground'] = fg;
        }
    }
    // Canvas color (page background)
    const canvasColorHex = customTokens.canvasColor || '';
    if (canvasColorHex) {
        const hsl = hexToHslString(canvasColorHex);
        if (hsl) {
            const isLight = isLightHex(canvasColorHex);
            lightScale.background = hsl;
            lightScale.foreground = isLight ? '0 0% 9%' : '0 0% 98%';
            // Auto-generate dark variant from same hue
            const darkBg = autoDarkVariant(canvasColorHex);
            if (darkBg) {
                darkScale.background = darkBg;
                darkScale.foreground = '0 0% 98%';
            }
        }
    }
    // Sidebar color
    // v0.1.58: when the sidebar background is overridden, set BOTH
    // primary foreground AND muted foreground based on the actual bg
    // luminance. Previously we only set sidebar-foreground; the
    // muted-foreground stayed at the preset default which often
    // failed APCA contrast against the new sidebar color (e.g. the
    // Curalisto teal sidebar made the user-row email/secondary text
    // read as a dim grey-on-teal that was hard to scan).
    //
    // Also set sidebar-accent (hover state) to a subtle tint of the
    // bg so hover affordances stay visible.
    const sidebarColorHex = customTokens.sidebarColor || '';
    if (sidebarColorHex) {
        const hsl = hexToHslString(sidebarColorHex);
        if (hsl) {
            const isLight = isLightHex(sidebarColorHex);
            // Primary foreground: high contrast.
            //   light bg → near-black; dark bg → near-white
            const fg = isLight ? '0 0% 9%' : '0 0% 98%';
            // Muted foreground: mid-contrast, biased toward the bg.
            //   light bg → 35% lightness; dark bg → 75% lightness
            // These hit APCA Lc ~50-60 against typical brand sidebars,
            // which is the on-color foreground threshold for secondary
            // text per the v0.1.55 brand-card spec.
            const mutedFg = isLight ? '0 0% 35%' : '0 0% 75%';
            // Sidebar-accent: subtle hover tint. We use the same hsl
            // hue but shift L by ±8% for hover visibility.
            const hoverTint = isLight ? '0 0% 92%' : '0 0% 18%';
            lightScale['sidebar-background'] = hsl;
            lightScale['sidebar-foreground'] = fg;
            lightScale['sidebar-accent'] = hoverTint;
            lightScale['sidebar-accent-foreground'] = fg;
            darkScale['sidebar-background'] = hsl;
            darkScale['sidebar-foreground'] = fg;
            darkScale['sidebar-accent'] = hoverTint;
            darkScale['sidebar-accent-foreground'] = fg;
            // muted-foreground is read by the workspace/email subtitle row
            // in the sidebar user nav. Push the high-contrast muted there
            // too so secondary text (e.g. "ho@curalisto.com") reads cleanly
            // against the sidebar bg.
            lightScale['sidebar-muted-foreground'] = mutedFg;
            darkScale['sidebar-muted-foreground'] = mutedFg;
        }
    }
    // Card color (card/popover surfaces)
    const cardColorHex = customTokens.cardColor || '';
    if (cardColorHex) {
        const hsl = hexToHslString(cardColorHex);
        if (hsl) {
            const isLight = isLightHex(cardColorHex);
            const fg = isLight ? '0 0% 9%' : '0 0% 98%';
            const mutedFg = isLight ? '0 0% 40%' : '0 0% 65%';
            lightScale.card = hsl;
            lightScale['card-foreground'] = fg;
            lightScale.popover = hsl;
            lightScale['popover-foreground'] = fg;
            lightScale['muted-foreground'] = mutedFg;
            darkScale.card = hsl;
            darkScale['card-foreground'] = fg;
            darkScale.popover = hsl;
            darkScale['popover-foreground'] = fg;
            darkScale['muted-foreground'] = mutedFg;
        }
    }
    // Semantic color overrides (error uses --destructive which is standard shadcn)
    const errorHex = customTokens.errorColor || '';
    if (errorHex) {
        const hsl = hexToHslString(errorHex);
        if (hsl) {
            const fg = isLightHex(errorHex) ? '0 0% 9%' : '0 0% 98%';
            lightScale.destructive = hsl;
            lightScale['destructive-foreground'] = fg;
            darkScale.destructive = hsl;
            darkScale['destructive-foreground'] = fg;
        }
    }
    // Emit HSL triplets. Tailwind v4's @theme block wraps them:
    // --color-primary: hsl(var(--primary)). Since brand/css loads AFTER
    // shell.css, our :root values for --primary etc. take effect, and
    // the @theme hsl() wrapper reads them at computed value time.
    const emitVars = (scale) => Object.entries(scale).map(([k, v]) => `  --${k}: ${v};`).join('\n');
    const lightVars = emitVars(lightScale);
    const darkVars = emitVars(darkScale);
    return `
/* Workspace Shell Theme (${themePresetId} theme, ${themeMode} mode) */

/* Shared tokens */
:root {
  --color-accent: ${accent};
  --color-accent-hover: color-mix(in srgb, ${accent} 85%, white);
  --color-accent-dim: color-mix(in srgb, ${accent} 20%, transparent);
  --font-heading: ${resolvedHeadingFont};
  --font-body: ${resolvedBodyFont};
  --font-mono: 'JetBrains Mono', monospace;
  --radius: ${radius}rem;
  --content-padding: ${contentPadding}rem;
  --card-padding: ${cardPadding}rem;
  --chart-1: 220 70% 50%;
  --color-success: ${customTokens.successColor || '#16a34a'};
  --color-warning: ${customTokens.warningColor || '#ca8a04'};
  --color-error: ${customTokens.errorColor || '#dc2626'};
  --color-info: ${customTokens.infoColor || '#2563eb'};
}

/* Light mode (default) */
:root {
${lightVars}
}

/* Dark mode */
.dark {
${darkVars}
}`.trim();
}
/**
 * Get the saved theme mode for the HTML class attribute.
 * 'system' means respect prefers-color-scheme — we default to dark for server render.
 */
export async function getSavedThemeMode(db, workspaceId) {
    try {
        const result = await db.prepare(`SELECT value FROM brand_tokens WHERE workspace_id = ? AND category = 'custom' AND key = 'themeMode' AND locale = ''`).bind(workspaceId).first();
        return result?.value || 'dark';
    }
    catch {
        return 'dark';
    }
}
/** Convert hex color to HSL string for CSS variables (e.g., "240 10% 3.9%") */
function hexToHslString(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result)
        return null;
    const r = parseInt(result[1], 16) / 255;
    const g = parseInt(result[2], 16) / 255;
    const b = parseInt(result[3], 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
                break;
            case g:
                h = ((b - r) / d + 2) / 6;
                break;
            case b:
                h = ((r - g) / d + 4) / 6;
                break;
        }
    }
    return `${(h * 360).toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%`;
}
/** Check if hex color is light (luminance > 0.5) */
function isLightHex(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result)
        return false;
    // v0.1.58: gamma-corrected relative luminance (WCAG 2.x). The
    // previous implementation skipped gamma decoding and operated on
    // raw sRGB 0..1 values, which over-classified mid-tones as
    // "dark" — Curalisto's teal #3F7A78 has raw-RGB luminance ~0.43
    // but actual sRGB-linearized luminance ~0.18, so the "light vs
    // dark" decision flipped correctly only some of the time.
    const channelToLinear = (c) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    const r = channelToLinear(parseInt(result[1], 16) / 255);
    const g = channelToLinear(parseInt(result[2], 16) / 255);
    const b = channelToLinear(parseInt(result[3], 16) / 255);
    // 0.18 ≈ middle gray in linear space. Anything above is "light"
    // for our foreground-picking purposes.
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.18;
}
/**
 * Auto-generate a dark mode variant from a hex color.
 * Preserves the hue, reduces saturation slightly, sets lightness to ~5%.
 */
function autoDarkVariant(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result)
        return null;
    const r = parseInt(result[1], 16) / 255;
    const g = parseInt(result[2], 16) / 255;
    const b = parseInt(result[3], 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    if (max !== min) {
        const d = max - min;
        s = d / (2 - max - min); // Use the formula for l > 0.5 doesn't matter for hue
        if (max === r)
            h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        else if (max === g)
            h = ((b - r) / d + 2) / 6;
        else
            h = ((r - g) / d + 4) / 6;
    }
    // Keep hue, reduce saturation to 70% of original, set lightness to 5%
    return `${(h * 360).toFixed(1)} ${Math.max(5, s * 70).toFixed(1)}% 5%`;
}
//# sourceMappingURL=css.js.map