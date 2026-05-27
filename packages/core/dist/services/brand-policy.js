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
            'stacked': { allowed: true, iconScale: 1.5, spacing: 0.4, hAlign: 'center', iconPosition: 'top', crossAlign: 0 },
            'horizontal': { allowed: true, iconScale: 1.2, spacing: 0.4, vAlign: 'middle', iconSide: 'left', crossAlign: 0 },
        },
        finishes: [
            { id: 'full-color', label: 'Full color', allowed: true, fillOverride: null },
            { id: 'mono-black', label: 'Mono black', allowed: true, fillOverride: '#0a0a0a' },
            { id: 'mono-white', label: 'Mono white', allowed: true, fillOverride: '#fafafa' },
            { id: 'mono-brand', label: 'Mono brand', allowed: false, fillOverride: 'var(--brand-primary)' },
        ],
        backgrounds: [
            // v0.1.60: five background variants.
            //   transparent → no background
            //   true-white  → universal #FFFFFF (high-contrast, press, faxable)
            //   true-black  → universal #0A0A0A (high-contrast, dark UI)
            //   light       → brand-light (operator's lightTile token)
            //   dark        → brand-dark (operator's darkTile token)
            // true-white/true-black are ALWAYS allowed regardless of
            // operator config — they're universal artifacts every brand
            // ships. light/dark are operator-controlled via
            // policy.backgrounded.lightAllowed/darkAllowed.
            { id: 'transparent', label: 'Transparent', allowed: true, color: 'transparent' },
            { id: 'true-white', label: 'White', allowed: true, color: '#FFFFFF' },
            { id: 'true-black', label: 'Black', allowed: true, color: '#0A0A0A' },
            { id: 'light', label: 'Brand light', allowed: true, color: 'var(--brand-background-light)' },
            { id: 'dark', label: 'Brand dark', allowed: true, color: 'var(--brand-background-dark)' },
        ],
        bannedPairs: [
        // Operator-curated bans persist here. Contrast-based auto-bans
        // are computed at lookup time from actual background colors —
        // we don't bake them into the stored policy because background
        // colors can change.
        ],
        backgrounded: {
            // Default off — operators opt into the backgrounded variant
            // when they actually want it as a brand-approved use. Keeping
            // it off by default avoids polluting the variants matrix and
            // brand guide with a third "container" axis that most brands
            // don't need.
            allowed: false,
            lightAllowed: true,
            darkAllowed: true,
            whiteAllowed: true,
            blackAllowed: true,
            padding: 0.5,
        },
    };
}
/**
 * Forward-migrate a stored backgrounds array. Preserves operator
 * customizations on existing IDs; appends any built-in IDs that are
 * missing (e.g. true-white/true-black on policies stored before v0.1.60).
 */
function mergeBackgrounds(stored, defaults) {
    if (!stored)
        return defaults;
    const storedIds = new Set(stored.map((b) => b.id));
    const missing = defaults.filter((b) => !storedIds.has(b.id));
    return [...stored, ...missing];
}
/**
 * v0.1.63: reconcile the backgrounded allowed flags into the
 * backgrounds[i].allowed source of truth that the variants matrix
 * and isPairAllowed read.
 *
 * Before v0.1.63 the BackgroundedConfig fields (lightAllowed,
 * darkAllowed) were stored but no rendering code read them — the
 * matrix filtered on backgrounds[i].allowed only. That meant the
 * Brand → Logos light/dark toggles were silently dead.
 *
 * This function projects all four allowed flags into the backgrounds
 * array on every load so the two state stores stay synchronized. The
 * BackgroundedConfig flags remain the operator-facing UI state; the
 * backgrounds array is the read source of truth.
 *
 * Transparent stays always-allowed (it's not gated by any toggle).
 */
function reconcileBackgroundsAllowed(backgrounds, cfg) {
    return backgrounds.map((bg) => {
        if (bg.id === 'transparent')
            return bg;
        if (bg.id === 'light')
            return { ...bg, allowed: cfg.lightAllowed };
        if (bg.id === 'dark')
            return { ...bg, allowed: cfg.darkAllowed };
        if (bg.id === 'true-white')
            return { ...bg, allowed: cfg.whiteAllowed !== false };
        if (bg.id === 'true-black')
            return { ...bg, allowed: cfg.blackAllowed !== false };
        return bg;
    });
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
            compositions: {
                // Per-composition merge so older policies missing
                // iconPosition / iconSide auto-receive the defaults.
                'wordmark-only': { ...def.compositions['wordmark-only'], ...parsed.compositions?.['wordmark-only'] },
                'icon-only': { ...def.compositions['icon-only'], ...parsed.compositions?.['icon-only'] },
                'stacked': { ...def.compositions['stacked'], ...parsed.compositions?.['stacked'] },
                'horizontal': { ...def.compositions['horizontal'], ...parsed.compositions?.['horizontal'] },
            },
            finishes: parsed.finishes ?? def.finishes,
            // v0.1.61: forward-migrate stored backgrounds arrays that pre-date
            // the five-variant axis. Workspaces with a saved logo_policy from
            // v0.1.32–v0.1.59 only have ['transparent','light','dark']; append
            // any missing built-in backgrounds (true-white, true-black) so the
            // variants matrix and public /brand guide automatically expand.
            // Operator customizations on existing entries are preserved.
            backgrounds: mergeBackgrounds(parsed.backgrounds, def.backgrounds),
            bannedPairs: parsed.bannedPairs ?? def.bannedPairs,
            backgrounded: { ...def.backgrounded, ...parsed.backgrounded },
        };
    }
    catch {
        return defaultPolicy();
    }
}
/**
 * Load + reconcile. Public entry point: same as loadPolicy() but
 * projects the backgrounded allowed flags into backgrounds[i].allowed
 * so the variants matrix and isPairAllowed see consistent state.
 *
 * All read paths (matrix render, /brand guide, isPairAllowed) go
 * through this. Save paths still use savePolicy() which persists
 * the BackgroundedConfig flags as operator-facing UI state.
 */
export async function loadEffectivePolicy(db, workspaceId) {
    const p = await loadPolicy(db, workspaceId);
    return {
        ...p,
        backgrounds: reconcileBackgroundsAllowed(p.backgrounds, p.backgrounded),
    };
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
        if (!finishHex.startsWith('#'))
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
            if (!bgHex.startsWith('#'))
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