export async function saveBrandColors(db, workspaceId, doc) {
    await db.prepare(`INSERT INTO brand_tokens (workspace_id, category, key, value, type, locale, updated_at)
     VALUES (?, 'colors', 'brand_colors_v1', ?, 'text', '', datetime('now'))
     ON CONFLICT (workspace_id, category, key, locale)
     DO UPDATE SET value = excluded.value, updated_at = datetime('now')`).bind(workspaceId, JSON.stringify(doc)).run();
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