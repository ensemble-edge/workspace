/**
 * Public brand guide renderer.
 *
 * Server-rendered HTML at /brand that surfaces the workspace's brand
 * identity for external sharing: wordmark, color palette with copyable
 * hex codes, typography stack, logo variants, and contact info.
 *
 * Headers + meta tags enforce noindex/nofollow so the page doesn't
 * appear in search. The page works without shell JS so it loads
 * instantly and renders even for visitors with JS disabled.
 */
import { resolveBrandImage } from './brand-images.js';
import { parseWordmarkSegments } from './wordmark-segments.js';
async function loadBrandData(env, workspaceId) {
    const ws = await env.DB.prepare(`SELECT name, slug FROM workspaces WHERE id = ?`)
        .bind(workspaceId)
        .first();
    const rows = await env.DB.prepare(`SELECT key, value, category FROM brand_tokens
       WHERE workspace_id = ? AND category IN ('identity', 'colors', 'typography', 'messaging')
         AND locale = ''`)
        .bind(workspaceId)
        .all();
    const tokens = {};
    for (const r of rows.results ?? [])
        tokens[r.key] = r.value;
    return {
        workspace_name: ws?.name ?? 'Workspace',
        workspace_slug: (ws?.slug ?? workspaceId).toLowerCase(),
        // Source description from elevator_pitch — it's the closest
        // operator-curated "what does this workspace do" string we have.
        // Falls back to null so the brand-guide renderer can hide the
        // description block entirely.
        workspace_description: tokens['elevator_pitch'] ?? null,
        tagline: tokens['tagline'] ?? null,
        accent: tokens['accent'] || '#3B82F6',
        tokens,
        wordmark_segments: parseWordmarkSegments(tokens['wordmark_text'] ?? ''),
    };
}
export async function renderBrandGuide(env, workspaceId) {
    const brand = await loadBrandData(env, workspaceId);
    // Apply the operator's pretty asset alias on every URL we render.
    // Stored brand_token values stay canonical — transforming on read
    // means changing the alias path never breaks the stored data.
    const { applyAssetAlias, getSetting } = await import('./workspace-settings.js');
    const aliasPath = (await getSetting(env, workspaceId, 'asset_public_alias_path')).trim();
    const wordmarkLight = applyAssetAlias(resolveBrandImage(brand.tokens, 'wordmark', { mode: 'light' }), aliasPath);
    const iconLight = applyAssetAlias(resolveBrandImage(brand.tokens, 'icon_mark', { mode: 'light' }), aliasPath);
    const wordmarkDark = applyAssetAlias(resolveBrandImage(brand.tokens, 'wordmark', { mode: 'dark' }), aliasPath);
    const iconDark = applyAssetAlias(resolveBrandImage(brand.tokens, 'icon_mark', { mode: 'dark' }), aliasPath);
    // v0.1.32+: policy-driven approved + banned variants. The variants
    // gallery pulls live from the generator endpoint; the banned-uses
    // gallery renders the same logo with red Xs and a reason caption.
    const { loadPolicy, effectiveBannedPairs } = await import('./brand-policy.js');
    const policy = await loadPolicy(env.DB, workspaceId);
    const brandColors = {
        bgLight: brand.tokens['brand-background-light'] || '#ffffff',
        bgDark: brand.tokens['brand-background-dark'] || '#0a0a0a',
        primary: brand.tokens['brand-primary'] || brand.accent,
    };
    const bannedPairs = effectiveBannedPairs(policy, brandColors);
    const allComps = Object.entries(policy.compositions);
    const approvedComps = allComps.filter(([, c]) => c.allowed).map(([id]) => id);
    // v0.1.47+: compositions explicitly disabled in policy show up in
    // the banned-uses gallery so external consumers learn the brand's
    // approved-vs-banned compositions visually.
    const bannedComps = allComps.filter(([, c]) => !c.allowed).map(([id]) => id);
    const approvedFinishes = policy.finishes.filter((f) => f.allowed);
    const approvedBgs = policy.backgrounds.filter((b) => b.allowed);
    const banSet = new Set(bannedPairs.map((b) => `${b.finishId}|${b.backgroundId}`));
    const font = tokens('font_sans', brand.tokens) ||
        `-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif`;
    const colorEntries = Object.entries(brand.tokens)
        .filter(([k, v]) => isHex(v) && !k.startsWith('logo_'))
        .map(([k, v]) => ({ name: prettifyTokenKey(k), value: v }));
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex,nofollow">
    <meta name="color-scheme" content="light">
    <title>${escapeHtml(brand.workspace_name)} — Brand</title>
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: ${font}; color: #111827; background: #ffffff; }
      .container { max-width: 980px; margin: 0 auto; padding: 48px 24px; }
      header { padding-bottom: 32px; border-bottom: 1px solid #e5e7eb; margin-bottom: 32px; }
      h1 { font-size: 18px; font-weight: 500; color: #6b7280; margin: 0 0 8px; }
      h2 { font-size: 13px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin: 32px 0 12px; }
      .wordmark { font-size: 42px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; margin: 8px 0; }
      .tagline { font-size: 18px; color: #6b7280; margin: 8px 0 0; line-height: 1.5; }
      .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); }
      .swatch { border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; cursor: pointer; transition: transform 0.1s; }
      .swatch:hover { transform: translateY(-1px); }
      .swatch .color { height: 80px; }
      .swatch .meta { padding: 10px 12px; font-size: 13px; }
      .swatch .meta strong { display: block; color: #111827; }
      .swatch .meta code { color: #6b7280; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
      .logo-grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
      .logo-tile { border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; display: flex; align-items: center; justify-content: center; min-height: 120px; }
      .logo-tile.dark { background: #0a0a0a; border-color: #262626; }
      .logo-tile img { max-width: 100%; max-height: 80px; }
      .typography-sample { padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px; }
      .typography-sample p { margin: 0 0 12px; }
      .typography-sample p:last-child { margin: 0; }
      footer { margin-top: 64px; padding-top: 24px; border-top: 1px solid #e5e7eb; font-size: 13px; color: #6b7280; }
    </style>
  </head>
  <body>
    <div class="container">
      <header>
        <h1>Brand guide</h1>
        ${renderWordmark(brand)}
        ${brand.tagline ? `<p class="tagline">${escapeHtml(brand.tagline)}</p>` : ''}
      </header>

      ${wordmarkLight || iconLight || wordmarkDark || iconDark
        ? `<section>
              <h2>Logo marks</h2>
              <div class="logo-grid">
                ${wordmarkLight ? logoTile('Wordmark', wordmarkLight, false) : ''}
                ${wordmarkDark ? logoTile('Wordmark · dark', wordmarkDark, true) : ''}
                ${iconLight ? logoTile('Icon', iconLight, false) : ''}
                ${iconDark ? logoTile('Icon · dark', iconDark, true) : ''}
              </div>
            </section>`
        : ''}

      <section>
        <h2>Approved uses</h2>
        <p style="font-size:13px;color:#6b7280;margin:0 0 12px;">
          Every composition × finish × background combination approved by this brand.
          Use these freely.
        </p>
        ${approvedComps.map((composition) => `
          <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;margin:16px 0 8px;">
            ${escapeHtml(composition.replace('-', ' '))}
          </p>
          <div class="logo-grid">
            ${approvedFinishes.flatMap((finish) => approvedBgs.map((bg) => {
        if (banSet.has(`${finish.id}|${bg.id}`))
            return '';
        const compShort = composition === 'wordmark-only' ? 'wordmark'
            : composition === 'icon-only' ? 'icon'
                : composition;
        const renderUrl = applyAssetAlias(`/_ensemble/brand/render/${brand.workspace_slug}-${compShort}-${finish.id}-${bg.id}.svg`, aliasPath) ?? '';
        const isDark = bg.id === 'dark';
        return `<div>
                  <div class="logo-tile${isDark ? ' dark' : ''}">
                    <img src="${escapeAttr(renderUrl)}" alt="${escapeHtml(`${finish.label} on ${bg.label}`)}">
                  </div>
                  <p style="font-size:12px;color:#6b7280;margin:8px 0 0;">${escapeHtml(`${finish.label} · ${bg.label}`)}</p>
                </div>`;
    })).join('')}
          </div>
        `).join('')}

        <!-- v0.1.54: separate Backgrounded section removed.
             Light/dark background variants in the matrix above
             already use the policy.backgrounded.padding setting
             configured in Brand → Logos → Background settings. -->
      </section>

      ${(bannedPairs.length > 0 || bannedComps.length > 0) ? `
      <section>
        <h2>Banned uses</h2>
        <p style="font-size:13px;color:#6b7280;margin:0 0 12px;">
          Don't use the logo in these combinations — they're either illegible
          (insufficient contrast) or off-brand by policy.
        </p>
        <div class="logo-grid">
          ${bannedComps.map((composition) => {
        // v0.1.47+: render a sample of this banned composition with the
        // red X overlay so consumers learn the brand's allowed lockups.
        // Uses full-color × transparent as the sample finish/bg since
        // we just need to show *what the composition looks like*.
        const compShort = composition === 'wordmark-only' ? 'wordmark'
            : composition === 'icon-only' ? 'icon'
                : composition;
        const renderUrl = applyAssetAlias(`/_ensemble/brand/render/${brand.workspace_slug}-${compShort}-full-color-transparent.svg`, aliasPath) ?? '';
        const label = composition.replace('-', ' ');
        return `<div>
              <div class="logo-tile" style="position:relative;">
                <img src="${escapeAttr(renderUrl)}" alt="banned composition: ${escapeAttr(label)}">
                <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;">
                  <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <line x1="5" y1="5" x2="95" y2="95" stroke="#c62828" stroke-width="3"/>
                    <line x1="95" y1="5" x2="5" y2="95" stroke="#c62828" stroke-width="3"/>
                  </svg>
                </div>
              </div>
              <p style="font-size:12px;color:#c62828;margin:8px 0 0;font-weight:600;text-transform:capitalize;">${escapeHtml(label)} lockup</p>
              <p style="font-size:11px;color:#6b7280;margin:2px 0 0;">Not an approved composition for this brand.</p>
            </div>`;
    }).join('')}
          ${bannedPairs.map((ban) => {
        const finish = policy.finishes.find((f) => f.id === ban.finishId);
        const bg = policy.backgrounds.find((b) => b.id === ban.backgroundId);
        if (!finish || !bg)
            return '';
        const renderUrl = applyAssetAlias(`/_ensemble/brand/render/${brand.workspace_slug}-wordmark-${ban.finishId}-${ban.backgroundId}.svg`, aliasPath) ?? '';
        const isDark = ban.backgroundId === 'dark';
        return `<div>
              <div class="logo-tile${isDark ? ' dark' : ''}" style="position:relative;">
                <img src="${escapeAttr(renderUrl)}" alt="banned use">
                <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;">
                  <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <line x1="5" y1="5" x2="95" y2="95" stroke="#c62828" stroke-width="3"/>
                    <line x1="95" y1="5" x2="5" y2="95" stroke="#c62828" stroke-width="3"/>
                  </svg>
                </div>
              </div>
              <p style="font-size:12px;color:#c62828;margin:8px 0 0;font-weight:600;">${escapeHtml(`${finish.label} · ${bg.label}`)}</p>
              ${ban.reason ? `<p style="font-size:11px;color:#6b7280;margin:2px 0 0;">${escapeHtml(ban.reason)}</p>` : ''}
            </div>`;
    }).join('')}
        </div>
      </section>
      ` : ''}

      ${colorEntries.length > 0
        ? `<section>
              <h2>Colors</h2>
              <div class="grid">
                ${colorEntries.map((c) => swatch(c.name, c.value)).join('')}
              </div>
            </section>`
        : ''}

      <section>
        <h2>Typography</h2>
        <div class="typography-sample">
          <p style="font-size:28px;font-weight:700;line-height:1.2;">The quick brown fox jumps over the lazy dog.</p>
          <p style="font-size:18px;font-weight:500;line-height:1.4;">The quick brown fox jumps over the lazy dog.</p>
          <p style="font-size:15px;line-height:1.5;color:#6b7280;">Stack: ${escapeHtml(font)}</p>
        </div>
      </section>

      <footer>
        ${escapeHtml(brand.workspace_name)}${brand.workspace_description ? ' · ' + escapeHtml(brand.workspace_description) : ''}
      </footer>
    </div>
    <script>
      // Click a swatch to copy its hex.
      for (const el of document.querySelectorAll('.swatch')) {
        el.addEventListener('click', () => {
          const hex = el.getAttribute('data-hex');
          if (!hex) return;
          navigator.clipboard?.writeText(hex);
          const meta = el.querySelector('.meta code');
          if (meta) {
            const orig = meta.textContent;
            meta.textContent = 'Copied!';
            setTimeout(() => { meta.textContent = orig; }, 1200);
          }
        });
      }
    </script>
  </body>
</html>`;
}
function renderWordmark(brand) {
    if (brand.wordmark_segments.length > 0) {
        return `<div class="wordmark">${brand.wordmark_segments
            .map((s) => `<span${s.color ? ` style="color:${escapeAttr(s.color)}"` : ''}>${escapeHtml(s.text)}</span>`)
            .join('')}</div>`;
    }
    return `<div class="wordmark" style="color:${escapeAttr(brand.accent)}">${escapeHtml(brand.workspace_name)}</div>`;
}
function logoTile(label, src, dark) {
    return `<div>
    <div class="logo-tile${dark ? ' dark' : ''}">
      <img src="${escapeAttr(src)}" alt="${escapeHtml(label)}">
    </div>
    <p style="font-size:12px;color:#6b7280;margin:8px 0 0;">${escapeHtml(label)}</p>
  </div>`;
}
function swatch(name, hex) {
    return `<div class="swatch" data-hex="${escapeAttr(hex)}" title="Click to copy">
    <div class="color" style="background:${escapeAttr(hex)}"></div>
    <div class="meta">
      <strong>${escapeHtml(name)}</strong>
      <code>${escapeHtml(hex)}</code>
    </div>
  </div>`;
}
function tokens(key, t) {
    return t[key];
}
function isHex(v) {
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v.trim());
}
function prettifyTokenKey(k) {
    return k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
function escapeHtml(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function escapeAttr(s) {
    return escapeHtml(s);
}
//# sourceMappingURL=brand-guide.js.map