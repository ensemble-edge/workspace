/**
 * Ensemble Brand Spec — The canonical brand format.
 *
 * One spec, multiple renderings:
 *   /_ensemble/brand/spec     → JSON (machine consumption, import/export)
 *   /_ensemble/brand/css      → CSS custom properties (websites)
 *   /_ensemble/brand/context  → Markdown (AI system prompts)
 *   /_ensemble/brand/page     → HTML (human-readable brand page)
 *
 * The spec is the single source of truth. Everything else is derived from it.
 */
/**
 * Assemble a complete EnsembleBrandSpec from D1 database tokens.
 */
export async function assembleBrandSpec(db, workspaceId, baseUrl, 
/**
 * Operator-configured pretty alias path (e.g. 'assets'). When set,
 * canonical /_ensemble/brand/asset/<key> URLs are rewritten to
 * /<aliasPath>/<key>. Stored brand_tokens remain canonical —
 * transforming on read keeps the data layer stable.
 */
assetAliasPath) {
    // Fetch all tokens and groups in parallel
    const [tokensResult, groupsResult] = await Promise.all([
        db.prepare(`SELECT category, key, value, type, label, description, group_slug
       FROM brand_tokens WHERE workspace_id = ? AND locale = ''
       ORDER BY category, sort_order, key`).bind(workspaceId).all(),
        db.prepare(`SELECT slug, label, category FROM brand_token_groups
       WHERE workspace_id = ? ORDER BY sort_order, label`).bind(workspaceId).all(),
    ]);
    const tokens = tokensResult.results || [];
    const groups = groupsResult.results || [];
    // Index tokens by category
    const byCategory = new Map();
    for (const t of tokens) {
        if (!byCategory.has(t.category))
            byCategory.set(t.category, []);
        byCategory.get(t.category).push(t);
    }
    const get = (category, key) => byCategory.get(category)?.find((t) => t.key === key)?.value;
    // ── Colors ──
    const colorGroups = [];
    const colorTokens = byCategory.get('colors') || [];
    const colorGroupSlugs = new Set(groups.filter((g) => g.category === 'colors').map((g) => g.slug));
    // Build color groups from tokens with group_slug
    const groupShades = new Map();
    const semanticColors = {};
    for (const t of colorTokens) {
        if (t.group_slug && colorGroupSlugs.has(t.group_slug)) {
            const shade = t.key.split('.').slice(1).join('.');
            if (shade) {
                if (!groupShades.has(t.group_slug))
                    groupShades.set(t.group_slug, {});
                groupShades.get(t.group_slug)[shade] = t.value;
            }
        }
        else if (t.key.startsWith('semantic.')) {
            semanticColors[t.key.replace('semantic.', '')] = t.value;
        }
    }
    for (const g of groups.filter((g) => g.category === 'colors')) {
        colorGroups.push({
            slug: g.slug,
            label: g.label,
            shades: groupShades.get(g.slug) || {},
        });
    }
    // v0.1.55: synthesize palette groups + gradients + semantic from
    // the new BrandColorsDoc. This produces --primary-main, --gradient-
    // sunrise, and the like as CSS variables alongside any legacy
    // color-group output. The doc is the canonical source going forward.
    try {
        const { loadBrandColors } = await import('../../../services/brand-colors/load.js');
        const { resolvePalettes, resolveStopValue } = await import('../../../services/brand-colors/resolver.js');
        const doc = await loadBrandColors(db, workspaceId);
        const palettes = resolvePalettes(doc);
        // Emit each palette as a group whose "shades" are the rung
        // names. The CSS gen reads {slug}-{shade} so this lands as
        // --brand-primary-main, --brand-primary-bright, etc. We also
        // emit the un-prefixed form (--primary-main) by adding an
        // additional group at slug '' below.
        const roles = ['primary', 'secondary', 'accent', 'neutral'];
        for (const role of roles) {
            const p = palettes[role];
            colorGroups.push({
                slug: role,
                label: doc.palettes[role].name,
                shades: { dark: p.dark, main: p.main, bright: p.bright, pastel: p.pastel, faded: p.faded },
            });
        }
        // Semantic — override any legacy semantic tokens.
        semanticColors.success = doc.semantic.success.main;
        semanticColors['success-light'] = doc.semantic.success.light;
        semanticColors.info = doc.semantic.info.main;
        semanticColors['info-light'] = doc.semantic.info.light;
        semanticColors.warning = doc.semantic.warning.main;
        semanticColors['warning-light'] = doc.semantic.warning.light;
        semanticColors.error = doc.semantic.error.main;
        semanticColors['error-light'] = doc.semantic.error.light;
        // Gradients — emit as named entries in spec.gradients (which
        // the CSS gen writes as --brand-gradient-<name>: <value>).
        if (doc.gradients.length > 0) {
            for (const g of doc.gradients) {
                const stops = g.stops.map((s) => resolveStopValue(s, palettes)).join(', ');
                const direction = g.mode === 'radial' ? 'radial-gradient(circle' : `linear-gradient(${g.angle}deg`;
                semanticColors[`__gradient_${g.slug}`] = `${direction}, ${stops})`;
            }
        }
    }
    catch {
        // If the new doc loader fails we degrade to legacy-only output.
    }
    // ── Typography ──
    const typoTokens = byCategory.get('typography') || [];
    const typoMap = Object.fromEntries(typoTokens.map((t) => [t.key, t.value]));
    const FONT_CATEGORIES = {
        gloock: 'serif', spectral: 'serif', playfair: 'serif',
        'dm-sans': 'sans-serif', inter: 'sans-serif', manrope: 'sans-serif',
        geist: 'sans-serif', roboto: 'sans-serif', system: 'sans-serif',
        'jetbrains-mono': 'monospace', 'fira-code': 'monospace',
    };
    const makeFontSpec = (key) => {
        const val = typoMap[key];
        if (!val)
            return undefined;
        return { family: val, category: FONT_CATEGORIES[val] || 'sans-serif' };
    };
    // ── Identity ──
    const identityTokens = byCategory.get('identity') || [];
    const idMap = Object.fromEntries(identityTokens.map((t) => [t.key, t]));
    const identityCustom = {};
    const knownIdentityKeys = new Set(['display_name', 'legal_name', 'founding_year', 'headquarters', 'website', 'industry']);
    for (const t of identityTokens) {
        if (!knownIdentityKeys.has(t.key) && !t.key.startsWith('logo_')) {
            identityCustom[t.key] = {
                value: t.value,
                type: t.type,
                label: t.label || t.key,
                description: t.description || undefined,
            };
        }
    }
    // ── Logos ──
    // Apply the operator's pretty asset alias on emit. Stored token
    // values stay canonical; this transforms on read so external
    // consumers see the chosen path style.
    const { applyAssetAlias } = await import('../../../services/workspace-settings.js');
    const logos = {};
    // Track the original (unaliased) values so the v1.1 masters block
    // can carry typed metadata while the v1.0 flat URLs stay aliased.
    const logoSlotUrls = {};
    // v0.1.93: logo_policy is a JSON blob storing the brand-policy config,
    // NOT a logo asset URL. It happens to share the `logo_` prefix so the
    // naive startsWith filter picked it up and emitted the JSON string as
    // a fake logo (visible as `masters.policy` in v0.1.92 spec responses).
    // Hard-code the skip here; if more meta keys join the logo_ namespace,
    // we move to an allowlist of known logo slots instead.
    const NON_LOGO_KEYS = new Set(['logo_policy']);
    for (const t of identityTokens) {
        if (t.key.startsWith('logo_') && !NON_LOGO_KEYS.has(t.key)) {
            const logoKey = t.key.replace('logo_', '');
            const aliased = applyAssetAlias(t.value, assetAliasPath ?? '');
            if (aliased) {
                logos[logoKey] = aliased;
                logoSlotUrls[logoKey] = aliased;
            }
        }
    }
    // ── Messaging ──
    const msgTokens = byCategory.get('messaging') || [];
    const msgMap = Object.fromEntries(msgTokens.map((t) => [t.key, t]));
    const msgCustom = {};
    const knownMsgKeys = new Set([
        'tagline', 'elevator_pitch', 'mission', 'boilerplate', 'legal_footer',
        'value_props', 'tone_descriptors', 'tone_avoid', 'voice_guidelines',
    ]);
    for (const t of msgTokens) {
        if (!knownMsgKeys.has(t.key)) {
            msgCustom[t.key] = {
                value: t.value,
                type: t.type,
                label: t.label || t.key,
                description: t.description || undefined,
            };
        }
    }
    let valueProps;
    try {
        if (msgMap.value_props)
            valueProps = JSON.parse(msgMap.value_props.value);
    }
    catch { /* ignore */ }
    const toneDescriptors = msgMap.tone_descriptors?.value.split(',').map((s) => s.trim()).filter(Boolean);
    const toneAvoid = msgMap.tone_avoid?.value.split(',').map((s) => s.trim()).filter(Boolean);
    // ── v1.1: Workspace meta ──
    // v0.1.91 hotfix: workspaces.display_name does NOT exist — the column
    // is `name`. The bad SELECT in v0.1.89 threw on every call, which
    // crashed /brand/css (every assembleBrandSpec consumer) and left the
    // entire shell unstyled. Curl-first next time.
    const workspaceRow = await db.prepare(`SELECT id, slug, name FROM workspaces WHERE id = ?`).bind(workspaceId).first();
    // ── v1.1: Typography roles + font sources ──
    const v11Typography = await assembleTypographyV11(db, workspaceId, baseUrl);
    // ── v1.1: Logo masters + variants + clearspace ──
    const v11Logos = await assembleLogosV11(db, workspaceId, logoSlotUrls, baseUrl, workspaceRow?.slug, assetAliasPath ?? '');
    // ── v1.1: Color palettes + modes ──
    const v11ColorsExtra = await assembleColorsV11(db, workspaceId);
    // ── v1.1: Spatial v2 ──
    const v11Spatial = await assembleSpatialV11(db, workspaceId);
    // ── v1.1: Messaging extras (operator-populated via JSON import) ──
    let voiceExamples;
    try {
        if (msgMap.voice_examples)
            voiceExamples = JSON.parse(msgMap.voice_examples.value);
    }
    catch { /* ignore */ }
    let audiences;
    try {
        if (msgMap.audiences)
            audiences = JSON.parse(msgMap.audiences.value);
    }
    catch { /* ignore */ }
    // ── v1.1: License ──
    const licenseType = idMap.brand_license_type?.value ?? null;
    const licenseRestrictions = idMap.brand_license_restrictions?.value ?? undefined;
    // ── v0.1.93: Instructions block for AI/tool consumers ──
    const { BRAND_SPEC_INSTRUCTIONS } = await import('../../../services/brand-spec-extras.js');
    // ── Assemble ──
    const generatedAt = new Date().toISOString();
    const spec = {
        ensemble_brand: '1.1',
        schema_version: '1.1.0',
        spec_url: baseUrl ? `${baseUrl}/brand/spec` : undefined,
        // Instructions sit at the TOP so an LLM reading the first ~500
        // tokens of the response immediately encounters the contract
        // before parsing any data.
        instructions: BRAND_SPEC_INSTRUCTIONS,
        workspace: workspaceRow ? {
            id: workspaceRow.id,
            slug: workspaceRow.slug,
            display_name: workspaceRow.name,
            public_url: baseUrl ?? '',
        } : undefined,
        updated_at: generatedAt,
        generated_at: generatedAt,
        license: licenseType || licenseRestrictions ? {
            type: licenseType,
            usage_restrictions: licenseRestrictions,
        } : undefined,
        identity: {
            display_name: idMap.display_name?.value || '',
            legal_name: idMap.legal_name?.value || undefined,
            founding_year: idMap.founding_year?.value || undefined,
            headquarters: idMap.headquarters?.value || undefined,
            website: idMap.website?.value || undefined,
            industry: idMap.industry?.value || undefined,
            ...(Object.keys(identityCustom).length > 0 ? { custom: identityCustom } : {}),
        },
        colors: {
            groups: colorGroups,
            semantic: {
                success: semanticColors['success'] || '#5B8A72',
                'success-light': semanticColors['success-light'],
                info: semanticColors['info'] || '#6B8FAD',
                'info-light': semanticColors['info-light'],
                warning: semanticColors['warning'] || '#CB9661',
                'warning-light': semanticColors['warning-light'],
                error: semanticColors['error'] || '#C62828',
                'error-light': semanticColors['error-light'],
            },
            // v1.1 additions
            ...v11ColorsExtra,
        },
        typography: {
            // v1.0 — keep for back-compat
            display: makeFontSpec('display_font'),
            heading: makeFontSpec('heading_font'),
            body: makeFontSpec('body_font'),
            mono: makeFontSpec('mono_font'),
            // v1.1 — full 9 roles + sources + stylesheet URL
            ...v11Typography,
        },
        logos,
        // v1.1 — sibling to logos so the v1.0 shape stays string-only.
        assets: v11Logos,
        messaging: {
            tagline: msgMap.tagline?.value || undefined,
            elevator_pitch: msgMap.elevator_pitch?.value || undefined,
            mission: msgMap.mission?.value || undefined,
            boilerplate: msgMap.boilerplate?.value || undefined,
            legal_footer: msgMap.legal_footer?.value || undefined,
            value_props: valueProps,
            tone: (toneDescriptors || toneAvoid || msgMap.voice_guidelines) ? {
                descriptors: toneDescriptors,
                avoid: toneAvoid,
                voice_guidelines: msgMap.voice_guidelines?.value || undefined,
            } : undefined,
            // v1.1: schema slots — operator may populate via JSON spec import
            ...(voiceExamples && voiceExamples.length > 0 ? { voice_examples: voiceExamples } : {}),
            ...(audiences && audiences.length > 0 ? { audiences } : {}),
            ...(Object.keys(msgCustom).length > 0 ? { custom: msgCustom } : {}),
        },
        spatial: v11Spatial,
        ...(baseUrl ? {
            endpoints: (() => {
                // v0.1.96: alias the asset-distribution endpoints (css, font_stylesheet,
                // preview_card) so the operator's configured /<alias>/brand/* path
                // applies uniformly. The /brand/* spec-family endpoints stay
                // unaliased — those are canonical short URLs for spec navigation,
                // not asset distribution surfaces.
                const aliasPath = assetAliasPath ?? '';
                const aliasIfSet = (path) => {
                    if (!aliasPath)
                        return `${baseUrl}${path}`;
                    const m = /^\/(?:brand|_ensemble\/brand)\/(.+)$/.exec(path);
                    if (!m)
                        return `${baseUrl}${path}`;
                    return `${baseUrl}/${aliasPath}/brand/${m[1]}`;
                };
                // logoSlotUrls.og_image already went through the alias transform
                // when it was loaded from brand_tokens, so we use it as-is here.
                // v0.1.97: preview_card is OMITTED when there's no real source.
                // Pre-v0.1.97 it fell back to /_ensemble/brand/og.png — a URL
                // with NO handler that returned the SPA HTML shell. Spec
                // consumers following the URL got HTML instead of an image,
                // worse than the field being absent. New rule: if the operator
                // hasn't uploaded an og_image asset, we omit the field. The
                // instructions block already tells consumers to treat absent
                // fields as "not set" rather than to invent a fallback.
                const previewCard = logoSlotUrls.og_image
                    ? (logoSlotUrls.og_image.startsWith('http')
                        ? logoSlotUrls.og_image
                        : `${baseUrl}${logoSlotUrls.og_image}`)
                    : undefined;
                // v0.1.98: every endpoint path emits the canonical /brand/* form.
                // The aliasIfSet helper still rewrites to /<alias>/brand/* if the
                // operator has set asset_public_alias_path. The endpoints object
                // is the consumer-facing surface; we never want a /_ensemble/
                // path here — that prefix is internal-API plumbing.
                return {
                    spec: `${baseUrl}/brand/spec`,
                    css: aliasIfSet('/brand/css'),
                    context: `${baseUrl}/brand/context`,
                    brand_guide: `${baseUrl}/brand`,
                    variant_index: `${baseUrl}/brand/variants`,
                    font_stylesheet: aliasIfSet('/brand/css'),
                    schema: `${baseUrl}/brand/spec/schema.json`,
                    changelog: `${baseUrl}/brand/changelog`,
                    ...(previewCard ? { preview_card: previewCard } : {}),
                };
            })(),
        } : {}),
    };
    // v1.1: compute etag last so it reflects the final payload.
    if (spec.workspace) {
        spec.etag = await computeEtag(spec);
    }
    return spec;
}
// ─────────────────────────────────────────────────────────────
// v1.1 sub-assemblers — kept inline in this file rather than split
// out so the full spec-shape is readable in one place.
// ─────────────────────────────────────────────────────────────
async function assembleTypographyV11(db, workspaceId, baseUrl) {
    try {
        const { loadAndResolveRoles, familyStack, buildGoogleFontsHref, isSystem: isSystemFamily } = await import('../../../services/font-roles.js');
        const { ROLE_USAGE } = await import('../../../services/font-roles.js');
        const { ROLE_EXAMPLES } = await import('../../../services/brand-spec-extras.js');
        const roles = await loadAndResolveRoles(db, workspaceId);
        const rolesOut = {};
        for (const [roleName, r] of Object.entries(roles)) {
            const meta = ROLE_USAGE[roleName];
            rolesOut[roleName] = {
                family: r.family,
                weight: r.weight,
                style: r.style,
                letter_spacing: r.letterSpacing,
                text_transform: r.textTransform,
                font_size: r.fontSize,
                stack: familyStack(r.family),
                css_var: `--font-${roleName}`,
                label: meta?.label ?? roleName,
                usage: meta?.usage ?? '',
                examples: ROLE_EXAMPLES[roleName] ?? [],
                is_system: r.isSystem,
            };
        }
        // Build font_sources — one entry per unique family.
        const sourcesByFamily = new Map();
        for (const r of Object.values(roles)) {
            let entry = sourcesByFamily.get(r.family);
            if (!entry) {
                entry = {
                    family: r.family,
                    source: isSystemFamily(r.family) ? 'system' : 'google',
                    weights: new Set(),
                    hasItalic: false,
                };
                sourcesByFamily.set(r.family, entry);
            }
            entry.weights.add(r.weight);
            if (r.style === 'italic')
                entry.hasItalic = true;
        }
        const googleHref = buildGoogleFontsHref(roles);
        const fontSources = Array.from(sourcesByFamily.values()).map((e) => ({
            family: e.family,
            source: e.source,
            url: e.source === 'google' && googleHref ? googleHref : undefined,
            weights: Array.from(e.weights).map((w) => Number(w)).filter((n) => !Number.isNaN(n)).sort((a, b) => a - b),
            has_italic: e.hasItalic,
        }));
        return {
            font_sources: fontSources,
            stylesheet_url: baseUrl ? `${baseUrl}/_ensemble/brand/css` : undefined,
            roles: rolesOut,
        };
    }
    catch {
        return {};
    }
}
async function assembleLogosV11(db, workspaceId, logoSlotUrls, baseUrl, workspaceSlug, 
// v0.1.96: pass the operator's asset alias path so variant + favicon
// URLs can be rewritten uniformly. Without this every variant URL
// emits as `/_ensemble/brand/render/...` even when the operator has
// configured `/<alias>/brand/...` for distribution — inconsistent
// with how `logos.*` URLs already get aliased.
assetAliasPath) {
    const out = {};
    // Helper: rewrite an absolute brand URL to honor the configured alias.
    // applyAssetAlias works on paths only, so strip baseUrl, apply, prepend.
    const aliasUrl = (absUrl) => {
        if (!baseUrl || !assetAliasPath)
            return absUrl;
        if (!absUrl.startsWith(baseUrl))
            return absUrl;
        const path = absUrl.slice(baseUrl.length);
        // applyAssetAlias is imported lazily at the call site in
        // assembleBrandSpec; reuse the inline regex here to keep this
        // helper synchronous (avoids threading an async transform through
        // every variant emit).
        const m = /^\/(?:brand|_ensemble\/brand)\/(.+)$/.exec(path);
        if (!m)
            return absUrl;
        return `${baseUrl}/${assetAliasPath}/brand/${m[1]}`;
    };
    // Masters — typed metadata around each slot URL.
    const masters = {};
    const slotRoles = {
        wordmark: 'wordmark', wordmark_dark: 'wordmark',
        icon_mark: 'icon', icon_mark_dark: 'icon',
        favicon: 'favicon', social_avatar: 'avatar', og_image: 'og',
    };
    for (const [slot, url] of Object.entries(logoSlotUrls)) {
        const role = slotRoles[slot] ?? 'wordmark';
        const ext = url.split('.').pop()?.toLowerCase();
        const format = (ext === 'svg' || ext === 'png' || ext === 'ico')
            ? ext
            : 'svg';
        masters[slot] = {
            url,
            role,
            format,
            minimum_size_px: role === 'wordmark' ? 120 : role === 'icon' ? 24 : undefined,
        };
    }
    if (Object.keys(masters).length > 0)
        out.masters = masters;
    // Variants — enumerate from the brand policy.
    if (workspaceSlug && baseUrl) {
        try {
            const { loadEffectivePolicy, effectiveBannedPairs } = await import('../../../services/brand-policy.js');
            const policy = await loadEffectivePolicy(db, workspaceId);
            // effectiveBannedPairs takes policy + chrome colors so it can
            // compute contrast-based auto-bans. Pull the chrome colors from
            // brand_tokens with sensible defaults.
            const chromeRes = await db.prepare(`SELECT key, value FROM brand_tokens
          WHERE workspace_id = ? AND category = 'colors' AND locale = ''
            AND key IN ('brand-background-light','brand-background-dark','brand-primary-main')`).bind(workspaceId).all();
            const chromeMap = Object.fromEntries((chromeRes.results ?? []).map((r) => [r.key, r.value]));
            // Contrast check still runs internally to EXCLUDE unreadable
            // combos from the variant matrix. v0.1.93: we no longer surface
            // a `banned` array publicly — banned uses were removed from the
            // operator-facing brand model. The contrast filter is a quality
            // gate on what we expose, not a thing for agents to read.
            const banned = effectiveBannedPairs(policy, {
                bgLight: chromeMap['brand-background-light'] ?? '#ffffff',
                bgDark: chromeMap['brand-background-dark'] ?? '#0a0a0a',
                primary: chromeMap['brand-primary-main'] ?? '#3b82f6',
            });
            const variants = [];
            const compEntries = Object.entries(policy.compositions);
            const allowedComps = compEntries.filter(([, c]) => c.allowed).map(([id]) => id);
            const allowedFinishes = policy.finishes.filter((f) => f.allowed);
            const allowedBgs = policy.backgrounds.filter((b) => b.allowed);
            const banSet = new Set(banned.map((b) => `${b.finishId}|${b.backgroundId}`));
            const compShortMap = {
                'wordmark-only': 'wordmark',
                'icon-only': 'icon',
                'stacked': 'stacked',
                'horizontal': 'horizontal',
            };
            // v0.1.93: enrich each variant with usage prose. Composes guidance
            // from the composition (where the lockup goes), the finish (what
            // visual treatment), and the background (what surface it sits on)
            // into a per-variant usage paragraph + concrete recommended_for hints.
            const { COMPOSITION_USAGE, FINISH_USAGE, BACKGROUND_USAGE, FORMAT_USAGE, USE_HINT_GUIDANCE, } = await import('../../../services/brand-spec-extras.js');
            function enrichVariant(v) {
                const comp = COMPOSITION_USAGE[v.composition];
                const fin = FINISH_USAGE[v.finish];
                const bg = BACKGROUND_USAGE[v.background];
                const fmt = FORMAT_USAGE[v.format];
                const useHint = v.use ? USE_HINT_GUIDANCE[v.use] : undefined;
                // Combine the three guidance sentences into a single usage block.
                const parts = [comp?.usage, fin?.usage, bg?.usage].filter(Boolean);
                const usage = parts.length > 0
                    ? parts.join(' ')
                    : 'Use as appropriate for your brand context.';
                // recommended_for blends composition + background + format hints.
                const recommended_for = [
                    ...(comp?.examples ?? []),
                    ...(bg?.examples ?? []),
                    ...(useHint ? [useHint] : []),
                    ...(fmt ? [fmt] : []),
                ];
                // examples is the tighter list — composition examples primarily.
                const examples = comp?.examples ?? [];
                return { ...v, usage, examples, recommended_for };
            }
            // v0.1.95: PNG size matrix per composition. Wordmark/stacked/
            // horizontal cover hero → thumbnail at three sizes; icon-only
            // covers the full range from social to favicon-sized at six.
            // Each PNG appends ?size=N to the render URL — the render
            // endpoint reads ?size= and renders at that pixel dimension.
            const PNG_SIZES = {
                'wordmark-only': [1024, 512, 256],
                'stacked': [1024, 512, 256],
                'horizontal': [1024, 512, 256],
                'icon-only': [1024, 512, 256, 128, 64, 32],
            };
            for (const comp of allowedComps) {
                const compShort = compShortMap[comp] ?? comp;
                const roleForComp = comp === 'icon-only' ? 'icon' : 'wordmark';
                const pngSizes = PNG_SIZES[comp] ?? [1024];
                for (const finish of allowedFinishes) {
                    for (const bg of allowedBgs) {
                        const approved = !banSet.has(`${finish.id}|${bg.id}`);
                        if (!approved)
                            continue;
                        const baseName = `${workspaceSlug}-${compShort}-${finish.id}-${bg.id}`;
                        // SVG — single entry, scales infinitely.
                        variants.push(enrichVariant({
                            role: roleForComp,
                            composition: comp,
                            finish: finish.id,
                            background: bg.id,
                            format: 'svg',
                            size_px: null,
                            url: aliasUrl(`${baseUrl}/brand/render/${baseName}.svg`),
                            approved: true,
                        }));
                        // PNG — one entry per size in the matrix.
                        for (const size of pngSizes) {
                            variants.push(enrichVariant({
                                role: roleForComp,
                                composition: comp,
                                finish: finish.id,
                                background: bg.id,
                                format: 'png',
                                size_px: size,
                                url: aliasUrl(`${baseUrl}/brand/render/${baseName}.png?size=${size}`),
                                approved: true,
                            }));
                        }
                    }
                }
            }
            // Favicon variants — emit unconditionally when an icon master is
            // available (NOT gated on a separate `favicon` token slot — favicons
            // are sized renders of the icon master, no separate upload needed).
            // The /_ensemble/brand/favicon-N.png routes already exist and
            // return the icon master rasterized at exactly N pixels with
            // square aspect + full-color finish + transparent background —
            // the right defaults for every favicon use case.
            const hasIcon = !!logoSlotUrls.icon_mark || !!logoSlotUrls.icon_mark_dark;
            if (hasIcon) {
                const FAVICONS = [
                    { size: 16, use: 'favicon' },
                    { size: 32, use: 'favicon' },
                    { size: 180, use: 'apple-touch' },
                    { size: 192, use: 'android-chrome' },
                    { size: 512, use: 'android-chrome-maskable' },
                ];
                for (const { size, use } of FAVICONS) {
                    variants.push(enrichVariant({
                        role: 'favicon',
                        composition: 'icon-only',
                        finish: 'full-color',
                        background: 'transparent',
                        format: 'png',
                        size_px: size,
                        url: aliasUrl(`${baseUrl}/brand/favicon-${size}.png`),
                        approved: true,
                        use,
                    }));
                }
            }
            if (variants.length > 0)
                out.variants = variants;
            // v0.1.93: banned uses dropped from spec output (removed from
            // operator-facing brand model). The contrast check above still
            // filters bad combos out of `variants`, which is the actual
            // guarantee consumers need.
        }
        catch {
            // Policy loader failed — skip variants gracefully.
        }
    }
    // Clearspace — sensible defaults; future operator override.
    const { DEFAULT_CLEARSPACE } = await import('../../../services/brand-spec-extras.js');
    out.clearspace = DEFAULT_CLEARSPACE;
    return out;
}
async function assembleColorsV11(db, workspaceId) {
    try {
        const { loadBrandColors } = await import('../../../services/brand-colors/load.js');
        const { resolvePalettes } = await import('../../../services/brand-colors/resolver.js');
        const { PALETTE_USAGE, SEMANTIC_USAGE, DEFAULT_MODES } = await import('../../../services/brand-spec-extras.js');
        const doc = await loadBrandColors(db, workspaceId);
        const palettes = resolvePalettes(doc);
        const palettesOut = {};
        const roles = ['primary', 'secondary', 'accent', 'neutral'];
        for (const role of roles) {
            const p = palettes[role];
            const meta = PALETTE_USAGE[role];
            palettesOut[role] = {
                name: doc.palettes[role].name,
                dark: p.dark, main: p.main, bright: p.bright, pastel: p.pastel, faded: p.faded,
                on: '#ffffff', // Sensible default — a future v0.1.90 can derive from contrast.
                css_vars: {
                    dark: `--brand-${role}-dark`,
                    main: `--brand-${role}-main`,
                    bright: `--brand-${role}-bright`,
                    pastel: `--brand-${role}-pastel`,
                    faded: `--brand-${role}-faded`,
                },
                usage: meta.usage,
                examples: meta.examples,
            };
        }
        const semanticV2 = {};
        const semRoles = ['success', 'info', 'warning', 'error'];
        for (const sr of semRoles) {
            const s = doc.semantic[sr];
            semanticV2[sr] = {
                main: s.main,
                light: s.light,
                on: '#ffffff',
                css_var: `--brand-semantic-${sr}`,
                usage: SEMANTIC_USAGE[sr],
            };
        }
        // Modes — pull from brand_tokens chrome colors if set, else defaults.
        const tokensRes = await db.prepare(`SELECT key, value FROM brand_tokens WHERE workspace_id = ? AND category = 'colors' AND key LIKE 'brand-%' AND locale = ''`).bind(workspaceId).all();
        const tokenMap = Object.fromEntries((tokensRes.results ?? []).map((r) => [r.key, r.value]));
        const modes = {
            light: {
                background: tokenMap['brand-background-light'] ?? DEFAULT_MODES.light.background,
                foreground: tokenMap['brand-foreground-light'] ?? DEFAULT_MODES.light.foreground,
                surface: tokenMap['brand-surface-light'] ?? DEFAULT_MODES.light.surface,
                border: tokenMap['brand-border-light'] ?? DEFAULT_MODES.light.border,
            },
            dark: {
                background: tokenMap['brand-background-dark'] ?? DEFAULT_MODES.dark.background,
                foreground: tokenMap['brand-foreground-dark'] ?? DEFAULT_MODES.dark.foreground,
                surface: tokenMap['brand-surface-dark'] ?? DEFAULT_MODES.dark.surface,
                border: tokenMap['brand-border-dark'] ?? DEFAULT_MODES.dark.border,
            },
        };
        return { palettes: palettesOut, semantic_v2: semanticV2, modes };
    }
    catch {
        return {};
    }
}
async function assembleSpatialV11(db, workspaceId) {
    // Split into two halves with different rules:
    //
    //   v1.0 fields (radius, radius_lg, spacing_unit) feed into
    //   generateCssFromSpec → /brand/css. If we fill them from defaults,
    //   the CSS endpoint emits --brand-radius overrides that shift the
    //   live shell visuals. So: ONLY emit these when the operator has
    //   explicitly set the corresponding brand_token. Matches v0.1.88
    //   behavior byte-for-byte.
    //
    //   v1.1 fields (radius_scale, spacing, shadow, components) are
    //   agent-facing METADATA. generateCssFromSpec ignores them, so they
    //   have zero CSS side-effect. Emit them ALWAYS, populated from
    //   defaults, so an external builder always knows the spacing
    //   system — even on workspaces that haven't customised it.
    const spatialTokens = await db.prepare(`SELECT key, value FROM brand_tokens WHERE workspace_id = ? AND category = 'spatial' AND locale = ''`).bind(workspaceId).all();
    const tokens = Object.fromEntries((spatialTokens.results ?? []).map((r) => [r.key, r.value]));
    const { DEFAULT_RADIUS, DEFAULT_SHADOW, COMPONENT_DEFAULTS } = await import('../../../services/brand-spec-extras.js');
    const radiusScale = {
        sm: tokens['radius_sm'] ?? DEFAULT_RADIUS.sm,
        md: tokens['radius_md'] ?? DEFAULT_RADIUS.md,
        lg: tokens['radius_lg'] ?? DEFAULT_RADIUS.lg,
        xl: tokens['radius_xl'] ?? DEFAULT_RADIUS.xl,
        full: tokens['radius_full'] ?? DEFAULT_RADIUS.full,
    };
    return {
        // v1.0 — emit ONLY when the operator explicitly set the token.
        // Falling back to defaults here would override the shell's bundled
        // CSS via /brand/css and visibly shift the workspace look.
        radius: tokens['radius'] ?? undefined,
        radius_lg: tokens['radius_lg'] ?? undefined,
        spacing_unit: tokens['spacing_unit'] ?? undefined,
        // v1.1 — ALWAYS emit. generateCssFromSpec doesn't read these, so
        // CSS output is identical regardless. External agents get a full
        // spacing system to reference.
        radius_scale: radiusScale,
        spacing: {
            unit: tokens['spacing_unit'] ?? '0.25rem',
            scale: [0, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64],
        },
        shadow: {
            sm: tokens['shadow_sm'] ?? DEFAULT_SHADOW.sm,
            md: tokens['shadow_md'] ?? DEFAULT_SHADOW.md,
            lg: tokens['shadow_lg'] ?? DEFAULT_SHADOW.lg,
            xl: tokens['shadow_xl'] ?? DEFAULT_SHADOW.xl,
        },
        components: COMPONENT_DEFAULTS,
    };
}
async function computeEtag(spec) {
    // Cheap content hash — SHA-256 over a stable serialization, first 16 hex chars.
    // We exclude generated_at from the hash so identical content yields the
    // same etag across re-renders.
    const stable = { ...spec, generated_at: undefined, etag: undefined };
    const enc = new TextEncoder().encode(JSON.stringify(stable));
    const buf = await crypto.subtle.digest('SHA-256', enc);
    const arr = Array.from(new Uint8Array(buf));
    const hex = arr.slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
    return `W/"${hex}"`;
}
// ============================================================================
// Generate CSS from Spec
// ============================================================================
const FONT_FAMILIES = {
    system: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    inter: '"Inter", system-ui, sans-serif',
    manrope: '"Manrope", system-ui, sans-serif',
    geist: '"Geist", system-ui, sans-serif',
    spectral: '"Spectral", serif',
    gloock: '"Gloock", serif',
    playfair: '"Playfair Display", serif',
    roboto: '"Roboto", system-ui, sans-serif',
    'dm-sans': '"DM Sans", system-ui, sans-serif',
    'cal-sans': '"Cal Sans", system-ui, sans-serif',
    'jetbrains-mono': '"JetBrains Mono", monospace',
    'fira-code': '"Fira Code", monospace',
};
/**
 * Generate CSS custom properties from a brand spec.
 */
export function generateCssFromSpec(spec) {
    const lines = [];
    lines.push(`/* Ensemble Brand Spec v${spec.ensemble_brand} — ${spec.identity.display_name || 'Workspace'} */`);
    lines.push('');
    // Google Fonts import
    const fontFamilies = [
        spec.typography.display?.family,
        spec.typography.heading?.family,
        spec.typography.body?.family,
        spec.typography.mono?.family,
    ].filter((f) => !!f && f !== 'system');
    if (fontFamilies.length > 0) {
        const uniqueFonts = [...new Set(fontFamilies)];
        const params = uniqueFonts.map((f) => `family=${f.replace(/ /g, '+')}:wght@300;400;500;600;700`).join('&');
        lines.push(`@import url('https://fonts.googleapis.com/css2?${params}&display=swap');`);
        lines.push('');
    }
    lines.push(':root {');
    // Color groups
    for (const group of spec.colors.groups) {
        lines.push(`  /* ${group.label} */`);
        const sortedShades = Object.entries(group.shades).sort(([a], [b]) => Number(a) - Number(b));
        for (const [shade, hex] of sortedShades) {
            lines.push(`  --brand-${group.slug}-${shade}: ${hex};`);
        }
        lines.push('');
    }
    // Semantic colors
    lines.push('  /* Semantic */');
    for (const [key, value] of Object.entries(spec.colors.semantic)) {
        if (value)
            lines.push(`  --brand-${key}: ${value};`);
    }
    lines.push('');
    // Typography
    lines.push('  /* Typography */');
    if (spec.typography.display) {
        lines.push(`  --brand-font-display: ${FONT_FAMILIES[spec.typography.display.family] || `"${spec.typography.display.family}", sans-serif`};`);
    }
    if (spec.typography.heading) {
        lines.push(`  --brand-font-heading: ${FONT_FAMILIES[spec.typography.heading.family] || `"${spec.typography.heading.family}", sans-serif`};`);
    }
    if (spec.typography.body) {
        lines.push(`  --brand-font-body: ${FONT_FAMILIES[spec.typography.body.family] || `"${spec.typography.body.family}", sans-serif`};`);
    }
    if (spec.typography.mono) {
        lines.push(`  --brand-font-mono: ${FONT_FAMILIES[spec.typography.mono.family] || `"${spec.typography.mono.family}", monospace`};`);
    }
    lines.push('');
    // Spatial
    if (spec.spatial) {
        lines.push('  /* Spatial */');
        if (spec.spatial.radius)
            lines.push(`  --brand-radius: ${spec.spatial.radius};`);
        if (spec.spatial.radius_lg)
            lines.push(`  --brand-radius-lg: ${spec.spatial.radius_lg};`);
        if (spec.spatial.spacing_unit)
            lines.push(`  --brand-spacing: ${spec.spatial.spacing_unit};`);
        lines.push('');
    }
    // Gradients
    if (spec.gradients) {
        lines.push('  /* Gradients */');
        for (const [name, value] of Object.entries(spec.gradients)) {
            lines.push(`  --brand-gradient-${name}: ${value};`);
        }
        lines.push('');
    }
    lines.push('}');
    return lines.join('\n');
}
// ============================================================================
// Generate AI Context (Markdown) from Spec
// ============================================================================
/**
 * Generate a human/AI-readable markdown brand context from a spec.
 */
export function generateContextFromSpec(spec) {
    const lines = [];
    const name = spec.identity.display_name || 'Workspace';
    lines.push(`# ${name} Brand Guide`);
    lines.push('');
    // Identity
    if (spec.identity.legal_name || spec.identity.industry || spec.identity.headquarters) {
        lines.push('## Company');
        if (spec.identity.legal_name)
            lines.push(`- **Legal name:** ${spec.identity.legal_name}`);
        if (spec.identity.industry)
            lines.push(`- **Industry:** ${spec.identity.industry}`);
        if (spec.identity.headquarters)
            lines.push(`- **Headquarters:** ${spec.identity.headquarters}`);
        if (spec.identity.founding_year)
            lines.push(`- **Founded:** ${spec.identity.founding_year}`);
        if (spec.identity.website)
            lines.push(`- **Website:** ${spec.identity.website}`);
        if (spec.identity.custom) {
            for (const [key, field] of Object.entries(spec.identity.custom)) {
                lines.push(`- **${field.label}:** ${field.value}`);
            }
        }
        lines.push('');
    }
    // Messaging
    if (spec.messaging.tagline || spec.messaging.mission) {
        lines.push('## Messaging');
        if (spec.messaging.tagline)
            lines.push(`**Tagline:** "${spec.messaging.tagline}"`);
        if (spec.messaging.elevator_pitch) {
            lines.push('');
            lines.push(`**Elevator pitch:** ${spec.messaging.elevator_pitch}`);
        }
        if (spec.messaging.mission) {
            lines.push('');
            lines.push(`**Mission:** ${spec.messaging.mission}`);
        }
        if (spec.messaging.value_props?.length) {
            lines.push('');
            lines.push('**Value propositions:**');
            for (const vp of spec.messaging.value_props) {
                lines.push(`- **${vp.headline}** — ${vp.description}`);
            }
        }
        if (spec.messaging.custom) {
            for (const [key, field] of Object.entries(spec.messaging.custom)) {
                lines.push(`- **${field.label}:** ${field.value}`);
            }
        }
        lines.push('');
    }
    // Tone
    if (spec.messaging.tone) {
        lines.push('## Voice & Tone');
        if (spec.messaging.tone.descriptors?.length) {
            lines.push(`**Tone:** ${spec.messaging.tone.descriptors.join(', ')}`);
        }
        if (spec.messaging.tone.avoid?.length) {
            lines.push(`**Avoid:** ${spec.messaging.tone.avoid.join(', ')}`);
        }
        if (spec.messaging.tone.voice_guidelines) {
            lines.push('');
            lines.push(spec.messaging.tone.voice_guidelines);
        }
        lines.push('');
    }
    // Colors
    if (spec.colors.groups.length > 0) {
        lines.push('## Colors');
        for (const group of spec.colors.groups) {
            const shadeList = Object.entries(group.shades)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([shade, hex]) => `${shade}: ${hex}`)
                .join(', ');
            lines.push(`- **${group.label}:** ${shadeList}`);
        }
        lines.push(`- **Success:** ${spec.colors.semantic.success} | **Error:** ${spec.colors.semantic.error} | **Warning:** ${spec.colors.semantic.warning} | **Info:** ${spec.colors.semantic.info}`);
        lines.push('');
    }
    // Typography
    if (spec.typography.heading || spec.typography.body) {
        lines.push('## Typography');
        if (spec.typography.display)
            lines.push(`- **Display:** ${spec.typography.display.family} (${spec.typography.display.category})`);
        if (spec.typography.heading)
            lines.push(`- **Headings:** ${spec.typography.heading.family} (${spec.typography.heading.category})`);
        if (spec.typography.body)
            lines.push(`- **Body:** ${spec.typography.body.family} (${spec.typography.body.category})`);
        if (spec.typography.mono)
            lines.push(`- **Code:** ${spec.typography.mono.family} (${spec.typography.mono.category})`);
        lines.push('');
    }
    // Boilerplate
    if (spec.messaging.boilerplate) {
        lines.push('## Boilerplate');
        lines.push(spec.messaging.boilerplate);
        lines.push('');
    }
    if (spec.messaging.legal_footer) {
        const year = new Date().getFullYear().toString();
        lines.push(`*${spec.messaging.legal_footer.replace('{year}', year)}*`);
    }
    return lines.join('\n');
}
// ============================================================================
// Import Spec into DB (graceful merge)
// ============================================================================
/**
 * Import a brand spec into a workspace, merging with existing data.
 * Custom fields in identity and messaging are created automatically.
 */
export async function importBrandSpec(db, workspaceId, spec, overwrite = false) {
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const upsertToken = async (category, key, value, type = 'text', label, groupSlug, sortOrder = 0) => {
        if (!overwrite) {
            const existing = await db.prepare(`SELECT value FROM brand_tokens WHERE workspace_id = ? AND category = ? AND key = ? AND locale = ''`).bind(workspaceId, category, key).first();
            if (existing) {
                skipped++;
                return;
            }
        }
        const result = await db.prepare(`INSERT INTO brand_tokens (workspace_id, category, key, value, type, label, group_slug, sort_order, locale, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', datetime('now'))
       ON CONFLICT (workspace_id, category, key, locale)
       DO UPDATE SET value = excluded.value, type = excluded.type, label = excluded.label,
                     group_slug = excluded.group_slug, sort_order = excluded.sort_order, updated_at = datetime('now')`).bind(workspaceId, category, key, value, type, label || null, groupSlug || null, sortOrder).run();
        if (result.meta.changes > 0) {
            // Can't distinguish insert vs update easily, count as created for new imports
            if (overwrite)
                updated++;
            else
                created++;
        }
    };
    // Identity
    if (spec.identity.display_name)
        await upsertToken('identity', 'display_name', spec.identity.display_name);
    if (spec.identity.legal_name)
        await upsertToken('identity', 'legal_name', spec.identity.legal_name);
    if (spec.identity.founding_year)
        await upsertToken('identity', 'founding_year', spec.identity.founding_year);
    if (spec.identity.headquarters)
        await upsertToken('identity', 'headquarters', spec.identity.headquarters);
    if (spec.identity.website)
        await upsertToken('identity', 'website', spec.identity.website, 'url');
    if (spec.identity.industry)
        await upsertToken('identity', 'industry', spec.identity.industry);
    if (spec.identity.custom) {
        for (const [key, field] of Object.entries(spec.identity.custom)) {
            await upsertToken('identity', key, field.value, field.type, field.label);
        }
    }
    // Colors
    for (const group of spec.colors.groups) {
        // Create group
        await db.prepare(`INSERT INTO brand_token_groups (workspace_id, slug, label, category)
       VALUES (?, ?, ?, 'colors')
       ON CONFLICT (workspace_id, slug) DO UPDATE SET label = excluded.label`).bind(workspaceId, group.slug, group.label).run();
        let sortOrder = 0;
        for (const [shade, hex] of Object.entries(group.shades)) {
            await upsertToken('colors', `${group.slug}.${shade}`, hex, 'color', `${group.label} ${shade}`, group.slug, sortOrder++);
        }
    }
    // Semantic colors
    for (const [key, value] of Object.entries(spec.colors.semantic)) {
        if (value)
            await upsertToken('colors', `semantic.${key}`, value, 'color');
    }
    // Typography
    if (spec.typography.display)
        await upsertToken('typography', 'display_font', spec.typography.display.family, 'font');
    if (spec.typography.heading)
        await upsertToken('typography', 'heading_font', spec.typography.heading.family, 'font');
    if (spec.typography.body)
        await upsertToken('typography', 'body_font', spec.typography.body.family, 'font');
    if (spec.typography.mono)
        await upsertToken('typography', 'mono_font', spec.typography.mono.family, 'font');
    // Logos — v1.0 string URLs. v1.1 typed asset data lives in
    // spec.assets (sibling), is derived on emit, and is not imported back.
    for (const [key, url] of Object.entries(spec.logos)) {
        if (url)
            await upsertToken('identity', `logo_${key}`, url, 'url');
    }
    // Messaging
    if (spec.messaging.tagline)
        await upsertToken('messaging', 'tagline', spec.messaging.tagline);
    if (spec.messaging.elevator_pitch)
        await upsertToken('messaging', 'elevator_pitch', spec.messaging.elevator_pitch);
    if (spec.messaging.mission)
        await upsertToken('messaging', 'mission', spec.messaging.mission);
    if (spec.messaging.boilerplate)
        await upsertToken('messaging', 'boilerplate', spec.messaging.boilerplate);
    if (spec.messaging.legal_footer)
        await upsertToken('messaging', 'legal_footer', spec.messaging.legal_footer);
    if (spec.messaging.value_props) {
        await upsertToken('messaging', 'value_props', JSON.stringify(spec.messaging.value_props));
    }
    if (spec.messaging.tone?.descriptors) {
        await upsertToken('messaging', 'tone_descriptors', spec.messaging.tone.descriptors.join(', '));
    }
    if (spec.messaging.tone?.avoid) {
        await upsertToken('messaging', 'tone_avoid', spec.messaging.tone.avoid.join(', '));
    }
    if (spec.messaging.tone?.voice_guidelines) {
        await upsertToken('messaging', 'voice_guidelines', spec.messaging.tone.voice_guidelines);
    }
    if (spec.messaging.custom) {
        for (const [key, field] of Object.entries(spec.messaging.custom)) {
            await upsertToken('messaging', key, field.value, field.type, field.label);
        }
    }
    return { created, updated, skipped };
}
//# sourceMappingURL=spec.js.map