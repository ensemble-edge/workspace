/**
 * Font role resolution — server-side companion to shell/font-utils.ts.
 *
 * Reads brand_tokens for the five typographic roles (display, heading,
 * body, mono, wordmark) and produces:
 *   - A single Google Fonts <link> URL combining all needed weights/styles
 *   - CSS variables (`--font-<role>` / `--font-<role>-weight` / `--font-<role>-style`)
 *
 * Used by:
 *   - Shell entry HTML — to load the right fonts up front
 *   - /_ensemble/brand/css — to publish the CSS variables consumers reference
 *   - Email + login server-rendered HTML — to render the wordmark in the right face
 *
 * Wordmark falls back to display when its family is unset, so operators
 * don't have to configure wordmark typography unless they want it
 * different.
 */
/**
 * Per-role human-readable label + usage description. Mirrors the
 * ROLE_META map in the shell so the brand-guide readout and the
 * admin UI see identical text. Edit the shell's font-utils to change
 * what operators see — this server copy MUST stay in sync.
 */
export const ROLE_USAGE = {
    wordmark: { label: 'Wordmark', usage: 'Reserved exclusively for the brand lockup — appears nowhere else in the UI so the mark stays ownable.' },
    display: { label: 'Display', usage: 'Hero sections, full-screen landing moments, and any headline where maximum visual impact is the primary goal.' },
    heading: { label: 'Heading (H1–H3)', usage: 'Primary page and section titles that structure the main content hierarchy and guide the reader through the experience.' },
    subheading: { label: 'Subheading (H4–H6)', usage: 'Secondary and tertiary groupings such as card titles, sidebar headers, modal titles, and nested section labels.' },
    body: { label: 'Body', usage: 'All paragraph text, article content, product descriptions, and any prose that requires sustained reading comfort.' },
    eyebrow: { label: 'Eyebrow', usage: 'Small all-caps label placed above a heading to signal category, content type, or platform context before the main title.' },
    label: { label: 'Label', usage: 'Buttons, navigation items, form field labels, tags, and all interactive UI elements where clarity at small sizes matters.' },
    caption: { label: 'Caption', usage: 'Image credits, footnotes, legal disclaimers, timestamps, and supporting detail that sits beneath primary content.' },
    mono: { label: 'Monospace', usage: 'Clinical data, patient IDs, dosage figures, API responses, and any content requiring precise fixed-width character alignment.' },
};
/** Pinned system stacks — must mirror SYSTEM_FONTS in shell/font-utils.ts. */
const SYSTEM_STACKS = {
    'System Sans': 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    'System Serif': 'Georgia, "Times New Roman", Times, serif',
    'System Mono': 'ui-monospace, SFMono-Regular, Menlo, Monaco, "Cascadia Mono", "Roboto Mono", monospace',
};
const LEGACY_SLUG_TO_FAMILY = {
    system: 'System Sans',
    'dm-sans': 'DM Sans',
    inter: 'Inter',
    manrope: 'Manrope',
    spectral: 'Spectral',
    gloock: 'Gloock',
    playfair: 'Playfair Display',
    geist: 'Geist',
    roboto: 'Roboto',
    'jetbrains-mono': 'JetBrains Mono',
    'fira-code': 'Fira Code',
};
const DEFAULT_WEIGHT = {
    wordmark: '700',
    display: '700',
    heading: '600',
    subheading: '500',
    body: '400',
    eyebrow: '600',
    label: '500',
    caption: '400',
    mono: '400',
};
const DEFAULT_FAMILY = {
    wordmark: '', // Inherits from display
    display: 'System Sans',
    heading: 'System Sans',
    subheading: '', // Inherits from heading
    body: 'System Sans',
    eyebrow: 'System Sans',
    label: 'System Sans',
    caption: 'System Sans',
    mono: 'System Mono',
};
const DEFAULT_LETTER_SPACING = {
    wordmark: '0em',
    display: '0em',
    heading: '0em',
    subheading: '0em',
    body: '0em',
    eyebrow: '0.1em',
    label: '0.01em',
    caption: '0em',
    mono: '0em',
};
const DEFAULT_TEXT_TRANSFORM = {
    wordmark: 'none',
    display: 'none',
    heading: 'none',
    subheading: 'none',
    body: 'none',
    eyebrow: 'uppercase',
    label: 'none',
    caption: 'none',
    mono: 'none',
};
/**
 * Resolve all five role triples from a flat token map. Wordmark falls
 * back to display when its family is unset.
 */
export function resolveAllRoles(tokens) {
    const display = resolveRole('display', tokens);
    const heading = resolveRole('heading', tokens);
    const body = resolveRole('body', tokens);
    const eyebrow = resolveRole('eyebrow', tokens);
    const label = resolveRole('label', tokens);
    const caption = resolveRole('caption', tokens);
    const mono = resolveRole('mono', tokens);
    // Subheading inherits Heading when its family is unset.
    const subheadingFamily = tokens['typography_subheading_family'];
    const subheading = subheadingFamily
        ? resolveRole('subheading', tokens)
        : { ...heading, inheritedFrom: 'heading' };
    // Wordmark inherits Display when its family is unset.
    const wordmarkFamily = tokens['wordmark_family'];
    const wordmark = wordmarkFamily
        ? {
            family: wordmarkFamily,
            weight: tokens['wordmark_weight'] || DEFAULT_WEIGHT.wordmark,
            style: tokens['wordmark_style'] || 'normal',
            letterSpacing: tokens['wordmark_letter_spacing'] || DEFAULT_LETTER_SPACING.wordmark,
            textTransform: tokens['wordmark_text_transform'] || DEFAULT_TEXT_TRANSFORM.wordmark,
            isSystem: isSystem(wordmarkFamily),
        }
        : { ...display, inheritedFrom: 'display' };
    return { wordmark, display, heading, subheading, body, eyebrow, label, caption, mono };
}
function resolveRole(role, tokens) {
    const newFamily = tokens[`typography_${role}_family`];
    if (newFamily) {
        return {
            family: newFamily,
            weight: tokens[`typography_${role}_weight`] || DEFAULT_WEIGHT[role],
            style: tokens[`typography_${role}_style`] || 'normal',
            letterSpacing: tokens[`typography_${role}_letter_spacing`] || DEFAULT_LETTER_SPACING[role],
            textTransform: tokens[`typography_${role}_text_transform`] || DEFAULT_TEXT_TRANSFORM[role],
            isSystem: isSystem(newFamily),
        };
    }
    // Legacy `<role>_font='inter'`.
    const legacy = tokens[`${role}_font`];
    if (legacy) {
        const fam = LEGACY_SLUG_TO_FAMILY[legacy] ?? legacy;
        return {
            family: fam,
            weight: DEFAULT_WEIGHT[role],
            style: 'normal',
            letterSpacing: DEFAULT_LETTER_SPACING[role],
            textTransform: DEFAULT_TEXT_TRANSFORM[role],
            isSystem: isSystem(fam),
        };
    }
    const fam = DEFAULT_FAMILY[role];
    return {
        family: fam,
        weight: DEFAULT_WEIGHT[role],
        style: 'normal',
        letterSpacing: DEFAULT_LETTER_SPACING[role],
        textTransform: DEFAULT_TEXT_TRANSFORM[role],
        isSystem: isSystem(fam),
    };
}
export function isSystem(family) {
    return family in SYSTEM_STACKS;
}
/** Resolve a family to its CSS font-family stack (server-side mirror). */
export function familyStack(family) {
    if (family in SYSTEM_STACKS)
        return SYSTEM_STACKS[family];
    return `"${family}", sans-serif`;
}
/**
 * Build the Google Fonts <link> URL combining every non-system family
 * across all five roles. Only loads the weights+styles actually in use.
 * Returns null when all five roles are system-stacked (no link needed).
 */
export function buildGoogleFontsHref(roles) {
    const byFamily = new Map();
    for (const role of Object.values(roles)) {
        if (role.isSystem)
            continue;
        let spec = byFamily.get(role.family);
        if (!spec) {
            spec = { weights: new Set(), italics: new Set() };
            byFamily.set(role.family, spec);
        }
        if (role.style === 'italic')
            spec.italics.add(role.weight);
        else
            spec.weights.add(role.weight);
    }
    if (byFamily.size === 0)
        return null;
    const families = [];
    for (const [family, spec] of byFamily.entries()) {
        const encoded = encodeURIComponent(family).replace(/%20/g, '+');
        // Google Fonts axis-tuple syntax. If any italics exist, encode them
        // alongside normals as wght@... + ital,wght@...
        const normals = Array.from(spec.weights).sort((a, b) => Number(a) - Number(b));
        const italics = Array.from(spec.italics).sort((a, b) => Number(a) - Number(b));
        let spec_str;
        if (italics.length > 0) {
            // Format: family=Inter:ital,wght@0,400;0,700;1,400
            const tuples = [];
            for (const w of normals)
                tuples.push(`0,${w}`);
            for (const w of italics)
                tuples.push(`1,${w}`);
            spec_str = `ital,wght@${tuples.join(';')}`;
        }
        else {
            spec_str = `wght@${normals.join(';')}`;
        }
        families.push(`family=${encoded}:${spec_str}`);
    }
    return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`;
}
/**
 * Build the CSS variable block for the five roles. Returns a string
 * suitable for inclusion in /_ensemble/brand/css.
 */
export function buildFontCssVars(roles) {
    const lines = [':root {'];
    for (const [role, r] of Object.entries(roles)) {
        lines.push(`  --font-${role}: ${familyStack(r.family)};`);
        lines.push(`  --font-${role}-weight: ${r.weight};`);
        lines.push(`  --font-${role}-style: ${r.style};`);
        lines.push(`  --font-${role}-letter-spacing: ${r.letterSpacing};`);
        lines.push(`  --font-${role}-text-transform: ${r.textTransform};`);
    }
    lines.push('}');
    return lines.join('\n');
}
/**
 * Load typography + wordmark brand tokens directly from the DB and
 * resolve. One-stop helper for server-rendered consumers (login HTML,
 * email templates, brand CSS endpoint).
 */
export async function loadAndResolveRoles(db, workspaceId) {
    const result = await db.prepare(`SELECT key, value FROM brand_tokens
       WHERE workspace_id = ?
         AND category IN ('typography', 'identity')
         AND locale = ''`).bind(workspaceId).all();
    const tokens = {};
    for (const r of result.results ?? [])
        tokens[r.key] = r.value;
    return resolveAllRoles(tokens);
}
//# sourceMappingURL=font-roles.js.map