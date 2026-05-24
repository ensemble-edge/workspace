import { defaultBrandColors } from './schema.js';
export async function loadBrandColors(db, workspaceId) {
    try {
        const row = await db
            .prepare(`SELECT value FROM brand_tokens WHERE workspace_id = ? AND category = 'colors' AND key = 'brand_colors_v1' AND locale = ''`)
            .bind(workspaceId)
            .first();
        if (!row?.value)
            return defaultBrandColors();
        const parsed = JSON.parse(row.value);
        // Merge with defaults so a doc missing newer fields still works
        // — defensive against future schema additions. version: 1
        // forced because that's what loaders below assume.
        const def = defaultBrandColors();
        return {
            version: 1,
            palettes: {
                primary: { ...def.palettes.primary, ...(parsed.palettes?.primary ?? {}) },
                secondary: { ...def.palettes.secondary, ...(parsed.palettes?.secondary ?? {}) },
                accent: { ...def.palettes.accent, ...(parsed.palettes?.accent ?? {}) },
                neutral: { ...def.palettes.neutral, ...(parsed.palettes?.neutral ?? {}) },
            },
            gradients: parsed.gradients ?? def.gradients,
            themes: {
                light: parsed.themes?.light ?? def.themes.light,
                dark: parsed.themes?.dark, // undefined is the correct "no dark theme" state
            },
            semantic: { ...def.semantic, ...(parsed.semantic ?? {}) },
        };
    }
    catch {
        return defaultBrandColors();
    }
}
//# sourceMappingURL=load.js.map