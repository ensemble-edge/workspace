/**
 * Default policy for a fresh workspace. Permissive on compositions and
 * finishes; auto-banned pairs computed at lookup time from the actual
 * background colors via WCAG contrast.
 */
export function defaultPolicy() {
    return {
        version: 1,
        compositions: {
            'wordmark-only': { allowed: true },
            'icon-only': { allowed: true },
            'stacked': { allowed: true, iconScale: 1.5, spacing: 0.4, hAlign: 'center' },
            'horizontal': { allowed: true, iconScale: 1.2, spacing: 0.4, vAlign: 'middle' },
        },
        finishes: [
            { id: 'full-color', label: 'Full color', allowed: true, fillOverride: null },
            { id: 'mono-black', label: 'Mono black', allowed: true, fillOverride: '#0a0a0a' },
            { id: 'mono-white', label: 'Mono white', allowed: true, fillOverride: '#fafafa' },
            { id: 'mono-brand', label: 'Mono brand', allowed: false, fillOverride: 'var(--brand-primary)' },
        ],
        backgrounds: [
            { id: 'transparent', label: 'Transparent', allowed: true, color: 'transparent' },
            { id: 'light', label: 'Light', allowed: true, color: 'var(--brand-background-light)' },
            { id: 'dark', label: 'Dark', allowed: true, color: 'var(--brand-background-dark)' },
        ],
        bannedPairs: [
        // Operator-curated bans persist here. Contrast-based auto-bans
        // are computed at lookup time from actual background colors —
        // we don't bake them into the stored policy because background
        // colors can change.
        ],
    };
}
/**
 * Load the policy. Returns the default when no policy is set.
 */
export async function loadPolicy(db, workspaceId) {
    try {
        const row = await db
            .prepare(`SELECT value FROM brand_tokens WHERE workspace_id = ? AND category = 'identity' AND key = 'logo_policy' AND locale = ''`)
            .bind(workspaceId)
            .first();
        if (!row?.value)
            return defaultPolicy();
        const parsed = JSON.parse(row.value);
        // Merge with defaults so a policy missing newer fields still works.
        const def = defaultPolicy();
        return {
            version: 1,
            compositions: { ...def.compositions, ...(parsed.compositions ?? {}) },
            finishes: parsed.finishes ?? def.finishes,
            backgrounds: parsed.backgrounds ?? def.backgrounds,
            bannedPairs: parsed.bannedPairs ?? def.bannedPairs,
        };
    }
    catch {
        return defaultPolicy();
    }
}
/**
 * Save the policy.
 */
export async function savePolicy(db, workspaceId, policy) {
    await db.prepare(`INSERT INTO brand_tokens (workspace_id, category, key, value, type, locale, updated_at)
     VALUES (?, 'identity', 'logo_policy', ?, 'text', '', datetime('now'))
     ON CONFLICT (workspace_id, category, key, locale)
     DO UPDATE SET value = excluded.value, updated_at = datetime('now')`).bind(workspaceId, JSON.stringify(policy)).run();
}
/**
 * WCAG relative luminance for a hex color. Mirror of the shell-side
 * helper; duplicated here so the server doesn't need to import
 * shell code.
 */
function relativeLuminance(hex) {
    const m = /^#?([a-f0-9]{6}|[a-f0-9]{3})$/i.exec(hex.trim());
    if (!m)
        return 0.5;
    let h = m[1];
    if (h.length === 3)
        h = h.split('').map((c) => c + c).join('');
    const [r, g, b] = [0, 2, 4].map((i) => {
        const v = parseInt(h.slice(i, i + 2), 16) / 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/**
 * WCAG contrast ratio between two hex colors. Returns 1–21.
 */
export function contrastRatio(fgHex, bgHex) {
    const l1 = relativeLuminance(fgHex);
    const l2 = relativeLuminance(bgHex);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}
/**
 * Compute auto-banned pairs based on WCAG contrast against the actual
 * brand background colors. Called at lookup time so changes to the
 * background pair invalidate stale auto-bans automatically.
 *
 * Threshold: 4.5:1 (WCAG AA for normal text). Logos are typically
 * larger than text but we use the strict threshold so the brand
 * guide's banned-uses gallery is conservative (better to flag a
 * borderline pair than to ship something illegible).
 */
export function computeAutoBannedPairs(policy, brandColors) {
    const bans = [];
    for (const finish of policy.finishes) {
        if (!finish.allowed)
            continue;
        // Resolve the finish color to a concrete hex for contrast math.
        let finishHex = finish.fillOverride;
        if (!finishHex)
            continue; // full-color → skip (no single contrast value)
        if (finishHex === 'var(--brand-primary)')
            finishHex = brandColors.primary;
        if (!/^#/.test(finishHex))
            continue;
        for (const bg of policy.backgrounds) {
            if (!bg.allowed)
                continue;
            if (bg.id === 'transparent')
                continue; // contrast meaningless
            let bgHex = bg.color;
            if (bgHex === 'var(--brand-background-light)')
                bgHex = brandColors.bgLight;
            else if (bgHex === 'var(--brand-background-dark)')
                bgHex = brandColors.bgDark;
            if (!/^#/.test(bgHex))
                continue;
            const ratio = contrastRatio(finishHex, bgHex);
            if (ratio < 4.5) {
                bans.push({
                    finishId: finish.id,
                    backgroundId: bg.id,
                    reason: `Insufficient contrast (${ratio.toFixed(2)}:1 — below WCAG AA 4.5:1)`,
                });
            }
        }
    }
    return bans;
}
/**
 * Combine operator-curated bans with auto-computed contrast bans.
 * Used by the brand guide + variants matrix to know which cells
 * are forbidden.
 */
export function effectiveBannedPairs(policy, brandColors) {
    const auto = computeAutoBannedPairs(policy, brandColors);
    const seen = new Set();
    const merged = [];
    for (const list of [policy.bannedPairs, auto]) {
        for (const ban of list) {
            const key = `${ban.finishId}|${ban.backgroundId}`;
            if (seen.has(key))
                continue;
            seen.add(key);
            merged.push(ban);
        }
    }
    return merged;
}
/**
 * Check whether a specific finish × background pair is allowed.
 * Used by the generator endpoint to refuse banned combinations.
 */
export function isPairAllowed(policy, brandColors, finishId, backgroundId) {
    const finish = policy.finishes.find((f) => f.id === finishId);
    if (!finish || !finish.allowed)
        return false;
    const bg = policy.backgrounds.find((b) => b.id === backgroundId);
    if (!bg || !bg.allowed)
        return false;
    for (const ban of effectiveBannedPairs(policy, brandColors)) {
        if (ban.finishId === finishId && ban.backgroundId === backgroundId)
            return false;
    }
    return true;
}
//# sourceMappingURL=brand-policy.js.map