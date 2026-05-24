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
    // v0.1.62: only the light-mode resolved URLs are rendered at the top
    // of /brand now — the full light/dark/white/black variant matrix is
    // the "Approved uses" section below.
    const wordmarkLight = applyAssetAlias(resolveBrandImage(brand.tokens, 'wordmark', { mode: 'light' }), aliasPath);
    const iconLight = applyAssetAlias(resolveBrandImage(brand.tokens, 'icon_mark', { mode: 'light' }), aliasPath);
    // v0.1.32+: policy-driven approved + banned variants. The variants
    // gallery pulls live from the generator endpoint; the banned-uses
    // gallery renders the same logo with red Xs and a reason caption.
    const { loadEffectivePolicy, effectiveBannedPairs } = await import('./brand-policy.js');
    const policy = await loadEffectivePolicy(env.DB, workspaceId);
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
    // v0.1.57: load all configured typography roles for the expanded
    // typography section. Each role carries family + weight + style +
    // letter-spacing + text-transform + font-size. We render one
    // specimen per role using the workspace's actual settings.
    const { loadAndResolveRoles } = await import('./font-roles.js');
    let typographyRoles = null;
    try {
        typographyRoles = await loadAndResolveRoles(env.DB, workspaceId);
    }
    catch {
        /* fall back to single-pangram section */
    }
    const colorEntries = Object.entries(brand.tokens)
        .filter(([k, v]) => isHex(v) && !k.startsWith('logo_'))
        .map(([k, v]) => ({ name: prettifyTokenKey(k), value: v }));
    // v0.1.55: brand-colors HTML emitter — same visual model as the
    // BrandCard display mode used on the Brand Overview tab. Falls
    // back to the legacy swatch grid when the new doc isn't present
    // (which on a single-workspace install should never happen, but
    // the legacy path stays as a safety net for graceful degradation).
    let brandColorsHtml = '';
    try {
        const { loadBrandColors } = await import('./brand-colors/load.js');
        const { renderBrandColorsHtml } = await import('./brand-colors/render-html.js');
        const doc = await loadBrandColors(env.DB, workspaceId);
        brandColorsHtml = renderBrandColorsHtml(doc);
    }
    catch {
        /* fall through to legacy */
    }
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
      /* v0.1.57: logo tiles use the same #808080 mid-grey chrome
         the Brand Overview matrix uses (50%-luminance preview surface
         — shows true light/dark logo relationships without bias). */
      .logo-tile {
        background: #808080;
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 8px;
        padding: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 120px;
        cursor: pointer;
        transition: transform 0.1s, box-shadow 0.1s;
      }
      .logo-tile:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
      .logo-tile img { max-width: 100%; max-height: 80px; }
      .logo-meta { display: flex; flex-direction: column; }
      .logo-downloads { display: flex; gap: 6px; }
      .dl-link {
        display: inline-flex;
        align-items: center;
        font-size: 10px;
        font-weight: 500;
        color: #6b7280;
        background: rgba(0, 0, 0, 0.04);
        padding: 2px 8px;
        border-radius: 4px;
        text-decoration: none;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        transition: background 0.12s, color 0.12s;
      }
      .dl-link:hover { background: rgba(0, 0, 0, 0.08); color: #18181b; }
      /* v0.1.59: favicon + resources sections */
      .favicon-row {
        display: flex;
        gap: 24px;
        align-items: flex-end;
        flex-wrap: wrap;
        padding: 20px 24px;
        background: #808080;
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 8px;
      }
      .fav-tile { display: flex; flex-direction: column; align-items: center; }
      .fav-tile-inner {
        background: rgba(255, 255, 255, 0.6);
        border-radius: 8px;
        padding: 8px;
        display: flex; align-items: center; justify-content: center;
      }
      .fav-tile p { color: #fafafa !important; }
      .resource-grid {
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      }
      .resource-card {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 16px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        text-decoration: none;
        color: inherit;
        transition: border-color 0.12s, background 0.12s, transform 0.12s;
      }
      .resource-card:hover {
        border-color: #18181b;
        background: rgba(0, 0, 0, 0.02);
        transform: translateY(-1px);
      }
      .resource-label {
        font-size: 14px;
        font-weight: 500;
        color: #18181b;
      }
      .resource-path {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 11px;
        color: #6b7280;
        word-break: break-all;
      }
      .resource-note {
        font-size: 12px;
        color: #71717a;
        margin-top: 4px;
        line-height: 1.4;
      }
      /* v0.1.59: click-to-copy hex on any element with data-hex.
         Cursor + hover hint stays subtle so the page reads as a
         reference document, not an app. */
      [data-hex] { cursor: pointer; }
      [data-hex]:hover { filter: brightness(0.97); }
      /* Typography specimens — one row per configured role. */
      .typography-card {
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 0;
        overflow: hidden;
      }
      .typo-row {
        display: grid;
        grid-template-columns: 200px 1fr;
        gap: 28px;
        align-items: flex-start;
        padding: 24px 28px;
        border-top: 1px solid #f3f4f6;
      }
      .typo-row:first-child { border-top: 0; }
      .typo-meta { font-size: 11px; color: #71717a; }
      .typo-meta .role {
        font-weight: 500;
        color: #18181b;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        display: block;
        margin-bottom: 4px;
      }
      .typo-meta .stack {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 10px;
        color: #a1a1aa;
        word-break: break-word;
      }
      .typo-meta .vitals {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 10px;
        color: #a1a1aa;
        margin-top: 2px;
      }
      .typo-specimen { line-height: 1.25; color: #18181b; }
      /* v0.1.59: expanded typography rows — multi-line specimen
         block per role, vital pills for at-a-glance settings. */
      .typo-specimen-block { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
      .typo-primary { line-height: 1.15; color: #18181b; word-break: break-word; }
      .typo-pangram { line-height: 1.4; color: #18181b; word-break: break-word; }
      .typo-glyphs, .typo-numerals { line-height: 1.4; word-break: break-all; }
      .typo-meta .vitals { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; align-items: center; }
      .vital-pill {
        display: inline-flex;
        align-items: center;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 10px;
        color: #52525b;
        background: rgba(0, 0, 0, 0.05);
        padding: 2px 6px;
        border-radius: 4px;
      }
      footer { margin-top: 64px; padding-top: 24px; border-top: 1px solid #e5e7eb; font-size: 13px; color: #6b7280; }
      /* v0.1.61: mobile breakpoints. Phones (<=640px) collapse the
         typography metadata sidebar above the specimen, and tighten
         the section padding. The brand-colors HTML emitter handles
         its own responsive collapse via auto-fit + minmax inline. */
      @media (max-width: 640px) {
        .container { padding: 32px 16px; }
        .typo-row {
          grid-template-columns: 1fr;
          gap: 12px;
          padding: 20px 16px;
        }
        .typo-meta .stack, .typo-meta .vitals { font-size: 11px; }
        /* v0.1.62: hide numerals + glyph rows on phones. They take up
           significant vertical space, break to multiple lines on
           narrow viewports, and don't add value on mobile where the
           operator is glancing — full glyph coverage belongs on the
           desktop view used for actual design handoffs. */
        .typo-numerals, .typo-glyphs { display: none; }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <header>
        <h1>Brand guide</h1>
        ${renderWordmark(brand)}
        ${brand.tagline ? `<p class="tagline">${escapeHtml(brand.tagline)}</p>` : ''}
      </header>

      ${wordmarkLight || iconLight
        ? `<section>
              <h2>Logo marks</h2>
              <div class="logo-grid">
                ${wordmarkLight ? logoTile('Wordmark', wordmarkLight, false) : ''}
                ${iconLight ? logoTile('Icon', iconLight, false) : ''}
              </div>
            </section>`
        : ''}
      <!-- v0.1.62: dropped "Wordmark · dark" and "Icon · dark" tiles.
           Every preview tile uses the same #808080 mid-grey chrome
           (v0.1.57+), so light and dark variants of the same SVG
           rendered identically — pure visual noise at the top of the
           guide. The full light/dark/white/black variant matrix lives
           in the "Approved uses" section below. -->

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
        const svgUrl = applyAssetAlias(`/_ensemble/brand/render/${brand.workspace_slug}-${compShort}-${finish.id}-${bg.id}.svg`, aliasPath) ?? '';
        const pngUrl = applyAssetAlias(`/_ensemble/brand/render/${brand.workspace_slug}-${compShort}-${finish.id}-${bg.id}.png`, aliasPath) ?? '';
        // v0.1.57: every logo tile uses the same #808080
        // mid-grey chrome. v0.1.59: add download links for
        // SVG + PNG so external consumers can grab assets
        // without round-tripping through an admin tool.
        // v0.1.62: click the tile to copy the SVG asset URL.
        // Download links stay for explicit Save-As; click is
        // the fast path for pasting into design tools.
        return `<div>
                  <div class="logo-tile" data-copy="${escapeAttr(svgUrl)}" title="Click to copy SVG URL">
                    <img src="${escapeAttr(svgUrl)}" alt="${escapeHtml(`${finish.label} on ${bg.label}`)}">
                  </div>
                  <div class="logo-meta">
                    <p style="font-size:12px;color:#6b7280;margin:8px 0 4px;">${escapeHtml(`${finish.label} · ${bg.label}`)}</p>
                    <div class="logo-downloads">
                      <a href="${escapeAttr(svgUrl)}" download class="dl-link">SVG</a>
                      <a href="${escapeAttr(pngUrl)}" download class="dl-link">PNG</a>
                    </div>
                  </div>
                </div>`;
    })).join('')}
          </div>
        `).join('')}

        <!-- v0.1.54: separate Backgrounded section removed.
             Light/dark background variants in the matrix above
             already use the policy.backgrounded.padding setting
             configured in Brand → Logos → Background settings. -->
      </section>

      <!-- v0.1.59: banned-uses section removed. External brand
           consumers (the audience for /brand) primarily need to know
           what IS approved. Banned use enforcement lives at the
           variants matrix in the admin app — the public guide just
           shows the approved uses cleanly. -->

      ${brandColorsHtml
        ? `<section>
              <h2>Brand colors</h2>
              ${brandColorsHtml}
            </section>`
        : colorEntries.length > 0
            ? `<section>
                <h2>Colors</h2>
                <div class="grid">
                  ${colorEntries.map((c) => swatch(c.name, c.value)).join('')}
                </div>
              </section>`
            : ''}

      <section>
        <h2>Typography</h2>
        ${renderTypographySection(typographyRoles, font)}
      </section>

      <!-- v0.1.59: favicon section. Shows the favicon at common
           browser sizes so external consumers can see what the
           bookmark/tab/home-screen artifact looks like. -->
      <section>
        <h2>Favicon</h2>
        <p style="font-size:13px;color:#6b7280;margin:0 0 12px;">
          What this brand looks like in browser tabs, bookmarks, and home-screen icons.
        </p>
        <div class="favicon-row">
          ${[
        { size: 32, label: '32 · tab', suffix: '-32.png' },
        { size: 180, label: '180 · iOS', suffix: '-180.png' },
        { size: 192, label: '192 · Android', suffix: '-192.png' },
        { size: 512, label: '512 · PWA', suffix: '-512.png' },
    ].map((f) => {
        const url = applyAssetAlias(`/_ensemble/brand/favicon${f.suffix}`, aliasPath) ?? '';
        const displayPx = Math.min(f.size, 64);
        return `<div class="fav-tile">
              <div class="fav-tile-inner" style="width:${displayPx}px;height:${displayPx}px;">
                <img src="${escapeAttr(url)}" alt="favicon ${f.size}" style="width:100%;height:100%;object-fit:contain;">
              </div>
              <p style="font-size:11px;color:#6b7280;margin:8px 0 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escapeHtml(f.label)}</p>
            </div>`;
    }).join('')}
        </div>
      </section>

      <!-- v0.1.59: Resources section — links to public CSS, JSON
           spec, manifest, and the favicon SVG so external
           collaborators can integrate this brand into their own
           projects. -->
      <section>
        <h2>Resources</h2>
        <p style="font-size:13px;color:#6b7280;margin:0 0 12px;">
          Use this brand in any external project. Reference the CSS directly or download the spec.
        </p>
        <div class="resource-grid">
          ${[
        {
            label: 'Brand CSS',
            path: '/_ensemble/brand/css',
            note: 'CSS custom properties (--primary-main, --gradient-*, --brand-*) for any project',
        },
        {
            label: 'Brand spec (JSON)',
            path: '/_ensemble/brand/spec',
            note: 'Full machine-readable brand definition — palettes, themes, gradients, semantic, typography',
        },
        {
            label: 'Web manifest',
            path: '/_ensemble/brand/manifest.webmanifest',
            note: 'PWA manifest with theme colors + favicon icons',
        },
        {
            label: 'Favicon SVG',
            path: '/_ensemble/brand/favicon.svg',
            note: 'Vector favicon for modern browsers',
        },
    ].map((r) => {
        const url = applyAssetAlias(r.path, aliasPath) ?? r.path;
        return `<a class="resource-card" href="${escapeAttr(url)}" target="_blank" rel="noreferrer noopener">
              <span class="resource-label">${escapeHtml(r.label)}</span>
              <span class="resource-path">${escapeHtml(url)}</span>
              <span class="resource-note">${escapeHtml(r.note)}</span>
            </a>`;
    }).join('')}
        </div>
      </section>

      <footer>
        ${escapeHtml(brand.workspace_name)}${brand.workspace_description ? ' · ' + escapeHtml(brand.workspace_description) : ''}
      </footer>
    </div>
    <script>
      // v0.1.62: unified copy-on-click for the whole guide.
      //   • [data-hex]   → copy hex value
      //   • [data-copy]  → copy arbitrary string (logo asset URLs)
      //
      // The legacy .swatch handler is gone — every clickable swatch
      // (including BrandCard-style swatches from render-html.ts that
      // emit data-hex but not .swatch) goes through one handler.
      function flashToast(msg) {
        let t = document.getElementById('__copy_toast__');
        if (!t) {
          t = document.createElement('div');
          t.id = '__copy_toast__';
          t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);background:#0a0a0a;color:#fafafa;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:500;opacity:0;transition:opacity 0.18s,transform 0.18s;z-index:9999;pointer-events:none;box-shadow:0 8px 24px rgba(0,0,0,0.2);';
          document.body.appendChild(t);
        }
        t.textContent = msg;
        requestAnimationFrame(() => {
          t.style.opacity = '1';
          t.style.transform = 'translateX(-50%) translateY(0)';
        });
        clearTimeout(t.__hideTimer);
        t.__hideTimer = setTimeout(() => {
          t.style.opacity = '0';
          t.style.transform = 'translateX(-50%) translateY(20px)';
        }, 1100);
      }
      document.addEventListener('click', (ev) => {
        const target = ev.target instanceof Element ? ev.target.closest('[data-hex],[data-copy]') : null;
        if (!target) return;
        const hex = target.getAttribute('data-hex');
        const copy = target.getAttribute('data-copy');
        const value = hex || copy;
        if (!value) return;
        navigator.clipboard?.writeText(value);
        // Legacy .swatch tiles flip their hex label inline for
        // continuity with the v0.1.59 UX.
        const meta = target.classList.contains('swatch') ? target.querySelector('.meta code') : null;
        if (meta) {
          const orig = meta.textContent;
          meta.textContent = 'Copied!';
          setTimeout(() => { meta.textContent = orig; }, 1200);
        } else {
          flashToast(hex ? 'Copied ' + hex.toUpperCase() : 'Copied URL');
        }
      });
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
function logoTile(label, src, _dark) {
    // v0.1.57: dark parameter retained for signature compat but
    // ignored — every logo tile uses the same #808080 chrome now.
    // v0.1.62: click the tile to copy the asset URL.
    return `<div>
    <div class="logo-tile" data-copy="${escapeAttr(src)}" title="Click to copy URL">
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
const ROLE_DISPLAY_ORDER = [
    { key: 'display', label: 'Display', preview: 'Make something beautiful' },
    { key: 'heading', label: 'Heading', preview: 'The quick brown fox' },
    { key: 'subheading', label: 'Subheading', preview: 'Card title or modal heading' },
    { key: 'body', label: 'Body', preview: 'The quick brown fox jumps over the lazy dog. Used for paragraphs, descriptions, and most reading.' },
    { key: 'eyebrow', label: 'Eyebrow', preview: 'Product update' },
    { key: 'label', label: 'Label', preview: 'Save changes' },
    { key: 'caption', label: 'Caption', preview: 'Updated 5 minutes ago. Source: Ensemble v0.1.57 release notes.' },
    { key: 'mono', label: 'Mono', preview: 'const x = 42;' },
];
function renderTypographySection(roles, fallbackFontStack) {
    if (!roles) {
        // Legacy fallback when the role loader failed (e.g. fresh DB).
        return `<div class="typography-card" style="padding:24px;">
      <p style="font-size:28px;font-weight:700;line-height:1.2;margin:0 0 12px;">The quick brown fox jumps over the lazy dog.</p>
      <p style="font-size:18px;font-weight:500;line-height:1.4;margin:0 0 12px;">The quick brown fox jumps over the lazy dog.</p>
      <p style="font-size:15px;line-height:1.5;color:#6b7280;margin:0;">Stack: ${escapeHtml(fallbackFontStack)}</p>
    </div>`;
    }
    // v0.1.59: expanded specimen — pangram + 36/54-char glyph string +
    // size info per role. Mirrors the Brand Overview typography card
    // density so external collaborators see the same depth admins do.
    const PANGRAM = 'The quick brown fox jumps over the lazy dog.';
    const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const NUMERALS = '0123456789 .,;:!?‘’“”—–';
    // Build one row per role using the operator's actual settings.
    const rows = ROLE_DISPLAY_ORDER.map((spec) => {
        const r = roles[spec.key];
        if (!r)
            return '';
        // Family stack — synthesize from family + sensible fallback chain.
        const stack = familyStack(r.family, spec.key);
        const styleAttr = r.style === 'italic' ? 'italic' : 'normal';
        const transformAttr = (r.textTransform || 'none');
        // Display size for the primary specimen line. Clamp huge values
        // down so the /brand guide doesn't overflow on narrow screens.
        const sizeRem = parseFloat(r.fontSize) || 1;
        const displaySize = Math.min(sizeRem, 3) + 'rem';
        const isMono = spec.key === 'mono';
        // For mono, swap the glyph string to something code-like.
        const glyphLine = isMono ? 'const fn = () => { return 42; };' : GLYPHS;
        const numeralLine = isMono ? 'array[0] === true && i < 10' : NUMERALS;
        const styleString = `font-family:${escapeAttr(stack)};font-weight:${escapeAttr(r.weight)};font-style:${styleAttr};letter-spacing:${escapeAttr(r.letterSpacing || '0')};text-transform:${transformAttr};`;
        return `
      <div class="typo-row">
        <div class="typo-meta">
          <span class="role">${escapeHtml(spec.label)}</span>
          <div class="stack">${escapeHtml(r.family)}${r.inheritedFrom ? ` <span style="color:#a1a1aa;">· inherits from ${escapeHtml(r.inheritedFrom)}</span>` : ''}</div>
          <div class="vitals">
            <span class="vital-pill">${escapeHtml(r.weight)}</span>
            <span class="vital-pill">${escapeHtml(r.fontSize)}</span>
            ${r.style === 'italic' ? `<span class="vital-pill">italic</span>` : ''}
            ${r.letterSpacing && r.letterSpacing !== '0em' ? `<span class="vital-pill">tracking ${escapeHtml(r.letterSpacing)}</span>` : ''}
            ${transformAttr !== 'none' ? `<span class="vital-pill">${escapeHtml(transformAttr)}</span>` : ''}
          </div>
        </div>
        <div class="typo-specimen-block">
          <div class="typo-primary" style="${styleString}font-size:${displaySize};">
            ${escapeHtml(spec.preview)}
          </div>
          <div class="typo-pangram" style="${styleString}font-size:1.0rem;">
            ${escapeHtml(PANGRAM)}
          </div>
          <div class="typo-glyphs" style="${styleString}font-size:0.9rem;color:#71717a;">
            ${escapeHtml(glyphLine)}
          </div>
          <div class="typo-numerals" style="${styleString}font-size:0.85rem;color:#a1a1aa;">
            ${escapeHtml(numeralLine)}
          </div>
        </div>
      </div>
    `;
    }).join('');
    return `<div class="typography-card">${rows}</div>`;
}
/**
 * Build a CSS font-family stack from a role's family + sensible
 * generic fallback. Wraps multi-word families in quotes.
 */
function familyStack(family, role) {
    const generic = role === 'mono' ? 'ui-monospace, monospace' : 'system-ui, sans-serif';
    // System families don't need quotes.
    if (/^(system-ui|sans-serif|serif|monospace|ui-monospace|-apple-system)$/i.test(family.trim())) {
        return `${family}, ${generic}`;
    }
    return `"${family}", ${generic}`;
}
//# sourceMappingURL=brand-guide.js.map