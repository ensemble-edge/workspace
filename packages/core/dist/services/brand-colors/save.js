export async function saveBrandColors(db, workspaceId, doc) {
    // v0.1.100: normalize accentExtras before save. Operators can have
    // up to 3 entries (total accents incl. palettes.accent ≤ 4). Trim
    // empty/invalid rows, then clamp at 3. If the trimmed array is
    // empty we omit the field entirely so the stored doc matches the
    // "no extras configured" shape.
    const normalized = { ...doc };
    if (doc.palettes.accentExtras) {
        const validExtras = doc.palettes.accentExtras
            .filter((p) => p && typeof p.main === 'string' && p.main.trim() !== '' && p.name?.trim() !== '')
            .slice(0, 3)
            .map((p) => ({
            name: p.name.trim(),
            main: p.main.trim(),
            ...(p.overrides ? { overrides: p.overrides } : {}),
        }));
        if (validExtras.length > 0) {
            normalized.palettes = { ...doc.palettes, accentExtras: validExtras };
        }
        else {
            const { accentExtras: _omit, ...rest } = doc.palettes;
            void _omit;
            normalized.palettes = rest;
        }
    }
    await db.prepare(`INSERT INTO brand_tokens (workspace_id, category, key, value, type, locale, updated_at)
     VALUES (?, 'colors', 'brand_colors_v1', ?, 'text', '', datetime('now'))
     ON CONFLICT (workspace_id, category, key, locale)
     DO UPDATE SET value = excluded.value, updated_at = datetime('now')`).bind(workspaceId, JSON.stringify(normalized)).run();
}
export function diffBrandColors(prev, next) {
    const out = {
        palettes: [],
        themeLight: false,
        themeDark: false,
        gradients: [],
        semantic: [],
    };
    const roles = ['primary', 'secondary', 'accent', 'neutral'];
    for (const role of roles) {
        if (JSON.stringify(prev.palettes[role]) !== JSON.stringify(next.palettes[role])) {
            out.palettes.push(role);
        }
    }
    // v0.1.100: surface accentExtras changes under the 'accent' bucket
    // (no need for a separate slot — anyone subscribing to "accent
    // changed" already cares about all accents collectively).
    const prevExtras = JSON.stringify(prev.palettes.accentExtras ?? []);
    const nextExtras = JSON.stringify(next.palettes.accentExtras ?? []);
    if (prevExtras !== nextExtras && !out.palettes.includes('accent')) {
        out.palettes.push('accent');
    }
    if (JSON.stringify(prev.themes.light) !== JSON.stringify(next.themes.light)) {
        out.themeLight = true;
    }
    if (JSON.stringify(prev.themes.dark ?? null) !== JSON.stringify(next.themes.dark ?? null)) {
        out.themeDark = true;
    }
    // Gradient diff: compare by slug.
    const prevSlugs = new Map(prev.gradients.map((g) => [g.slug, g]));
    const nextSlugs = new Map(next.gradients.map((g) => [g.slug, g]));
    const allSlugs = new Set([...prevSlugs.keys(), ...nextSlugs.keys()]);
    for (const slug of allSlugs) {
        const p = prevSlugs.get(slug);
        const n = nextSlugs.get(slug);
        if (!p || !n || JSON.stringify(p) !== JSON.stringify(n)) {
            out.gradients.push(slug);
        }
    }
    const sems = ['success', 'info', 'warning', 'error'];
    for (const s of sems) {
        if (JSON.stringify(prev.semantic[s]) !== JSON.stringify(next.semantic[s])) {
            out.semantic.push(s);
        }
    }
    return out;
}
/**
 * True when the diff would change any rendered output (palettes,
 * themes, semantic). Gradient changes that don't affect output —
 * like a name-only edit — are excluded. Used by the brand-css
 * endpoint to know when to bump its ETag.
 */
export function diffAffectsRender(diff) {
    return (diff.palettes.length > 0 ||
        diff.themeLight ||
        diff.themeDark ||
        diff.gradients.length > 0 ||
        diff.semantic.length > 0);
}
//# sourceMappingURL=save.js.map