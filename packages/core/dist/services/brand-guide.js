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
    const ws = await env.DB.prepare(`SELECT name, description FROM workspaces WHERE id = ?`)
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
        workspace_description: ws?.description ?? null,
        tagline: tokens['tagline'] ?? null,
        accent: tokens['accent'] || '#3B82F6',
        tokens,
        wordmark_segments: parseWordmarkSegments(tokens['wordmark_text'] ?? ''),
    };
}
export async function renderBrandGuide(env, workspaceId) {
    const brand = await loadBrandData(env, workspaceId);
    const wordmarkLight = resolveBrandImage(brand.tokens, 'wordmark', { mode: 'light' });
    const iconLight = resolveBrandImage(brand.tokens, 'icon_mark', { mode: 'light' });
    const wordmarkDark = resolveBrandImage(brand.tokens, 'wordmark', { mode: 'dark' });
    const iconDark = resolveBrandImage(brand.tokens, 'icon_mark', { mode: 'dark' });
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