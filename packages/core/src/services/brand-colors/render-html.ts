/**
 * Server-side HTML emitter for the BrandCard's display mode.
 *
 * v0.1.55. The /brand public guide is server-rendered HTML, so we
 * can't mount the Preact <BrandCard> there directly. This module
 * emits HTML that visually mirrors the BrandCard's display layout
 * — palettes (3-up grid), neutral (horizontal strip), gradients
 * (banners, hidden when empty), semantic (4-up grid).
 *
 * Output is plain HTML + inline styles, designed to slot into the
 * existing /brand template's `<section>` for colors. No JS, no
 * click-to-copy (the guide is read-only consumed by external folks),
 * but the visual model is identical.
 */
import { resolvePalettes, resolveStopValue, onColorForeground } from './resolver';
import type { BrandColorsDoc } from './schema';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Render the colors section as a self-contained HTML fragment. The
 * caller wraps it in their own <section> tag (or skips it entirely
 * when the colors doc is missing).
 */
export function renderBrandColorsHtml(doc: BrandColorsDoc): string {
  const palettes = resolvePalettes(doc);
  const hasGradients = doc.gradients.length > 0;

  // Sub-renderers. v0.1.59: every clickable swatch carries a
  // data-hex attribute. The /brand page's existing swatch click
  // handler picks these up and copies the hex to clipboard with a
  // brief "Copied!" confirmation.
  const palette = (role: 'primary' | 'secondary' | 'accent') => {
    const p = doc.palettes[role];
    const r = palettes[role];
    const fg = onColorForeground(role, palettes).hex;
    return `
      <div style="border-radius:14px;overflow:hidden;background:#fff;border:0.5px solid rgba(0,0,0,0.07);">
        <div data-hex="${r.main}" title="Click to copy ${r.main.toUpperCase()}" style="aspect-ratio:16/11;padding:18px;background:${r.main};color:${fg};display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <div style="font-size:26px;font-weight:400;letter-spacing:-0.005em;line-height:1.05;">${escapeHtml(p.name)}</div>
            <div style="font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:0.08em;opacity:0.8;margin-top:2px;">${role}</div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:flex-end;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;opacity:0.9;">
            <span>${role}-main</span>
            <span>${r.main.toUpperCase()}</span>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(64px,1fr));gap:8px;padding:12px;background:#fff;">
          ${(['dark', 'bright', 'pastel', 'faded'] as const).map((rung) => `
            <div style="display:flex;flex-direction:column;gap:4px;min-width:0;">
              <div data-hex="${r[rung]}" title="Click to copy ${r[rung].toUpperCase()}" style="height:24px;border-radius:6px;background:${r[rung]};border:0.5px solid rgba(0,0,0,0.08);"></div>
              <div style="font-size:11px;font-weight:500;color:#18181b;text-transform:capitalize;">${rung}</div>
              <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9.5px;color:#71717a;overflow-wrap:anywhere;">${r[rung].toUpperCase()}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  };

  const neutralStrip = () => {
    const p = doc.palettes.neutral;
    const r = palettes.neutral;
    return `
      <div style="border-radius:14px;border:0.5px solid rgba(0,0,0,0.07);background:#fff;padding:20px;display:flex;flex-direction:column;gap:18px;">
        <div style="min-width:0;">
          <div style="font-size:20px;font-weight:400;letter-spacing:-0.005em;">${escapeHtml(p.name)}</div>
          <div style="font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.08em;color:#71717a;margin-top:2px;">neutral</div>
          <div style="font-size:12px;color:#71717a;margin-top:6px;">Surfaces · borders · muted text.</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(64px,1fr));gap:8px;">
          ${(['dark', 'main', 'bright', 'pastel', 'faded'] as const).map((rung) => {
            const isMain = rung === 'main';
            return `
              <div style="display:flex;flex-direction:column;gap:4px;min-width:0;">
                <div data-hex="${r[rung]}" title="Click to copy ${r[rung].toUpperCase()}" style="height:32px;border-radius:6px;background:${r[rung]};border:0.5px solid rgba(0,0,0,0.08);${isMain ? 'box-shadow:0 0 0 1.5px #18181b;' : ''}"></div>
                <div style="font-size:11px;font-weight:500;color:#18181b;text-transform:capitalize;">${rung}</div>
                <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9.5px;color:#71717a;overflow-wrap:anywhere;">${r[rung].toUpperCase()}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  };

  const gradientBanner = (g: BrandColorsDoc['gradients'][number]) => {
    const stops = g.stops.map((s) => ({ token: s, hex: resolveStopValue(s, palettes) }));
    const css = g.mode === 'radial'
      ? `radial-gradient(circle, ${stops.map((s) => s.hex).join(', ')})`
      : `linear-gradient(${g.angle}deg, ${stops.map((s) => s.hex).join(', ')})`;
    // Approximate on-color for banner: pick black vs white by midpoint
    // luminance — server-side, no APCA needed here for read-only display.
    const firstHex = stops[0]?.hex ?? '#000';
    const lum = ['#fff', '#FFF', '#ffffff', '#FFFFFF'].includes(firstHex) ? 1
      : (parseInt(firstHex.slice(1, 3), 16) + parseInt(firstHex.slice(3, 5), 16) + parseInt(firstHex.slice(5, 7), 16)) / (255 * 3);
    const fg = lum < 0.5 ? '#fff' : '#0a0a0a';
    return `
      <div style="border-radius:14px;overflow:hidden;border:0.5px solid rgba(0,0,0,0.07);background:#fff;">
        <div style="height:90px;display:flex;align-items:center;padding:0 20px;background:${css};color:${fg};">
          <div style="font-size:28px;font-weight:400;letter-spacing:-0.005em;">${escapeHtml(g.name)}</div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px;font-size:11px;flex-wrap:wrap;gap:8px;min-width:0;">
          <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#71717a;overflow-wrap:anywhere;min-width:0;">gradient-${escapeHtml(g.slug)}</span>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0;">
            ${stops.map((s, i) => `
              ${i > 0 ? '<span style="color:#a1a1aa;">→</span>' : ''}
              <span style="display:inline-flex;align-items:center;gap:6px;min-width:0;">
                <span style="width:14px;height:14px;border-radius:4px;border:0.5px solid rgba(0,0,0,0.08);background:${s.hex};flex-shrink:0;"></span>
                <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#71717a;overflow-wrap:anywhere;">${escapeHtml(s.token)}</span>
              </span>
            `).join('')}
          </div>
          <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#71717a;background:rgba(0,0,0,0.05);padding:2px 8px;border-radius:4px;flex-shrink:0;">${g.mode === 'radial' ? 'radial' : `linear · ${g.angle}°`}</span>
        </div>
      </div>
    `;
  };

  const semanticCell = (role: 'success' | 'info' | 'warning' | 'error') => {
    const pair = doc.semantic[role];
    const label = role.charAt(0).toUpperCase() + role.slice(1);
    return `
      <div style="display:flex;flex-direction:column;gap:6px;min-width:0;">
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:4px;height:40px;">
          <div data-hex="${pair.main}" title="Click to copy ${pair.main.toUpperCase()}" style="border-radius:6px;background:${pair.main};border:0.5px solid rgba(0,0,0,0.08);"></div>
          <div data-hex="${pair.light}" title="Click to copy ${pair.light.toUpperCase()}" style="border-radius:6px;background:${pair.light};border:0.5px solid rgba(0,0,0,0.08);"></div>
        </div>
        <div style="font-size:13px;font-weight:500;">${label}</div>
        <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:#71717a;overflow-wrap:anywhere;">${pair.main.toUpperCase()} · ${pair.light.toUpperCase()}</div>
      </div>
    `;
  };

  const sectionHead = (title: string, meta?: string) => `
    <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px;">
      <h3 style="font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.08em;color:#71717a;margin:0;">${title}</h3>
      ${meta ? `<span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:#a1a1aa;">${meta}</span>` : ''}
    </div>
  `;

  return `
    <div style="display:flex;flex-direction:column;gap:40px;">
      <section>
        ${sectionHead('Brand palettes', 'primary · secondary · accent')}
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;">
          ${palette('primary')}
          ${palette('secondary')}
          ${palette('accent')}
        </div>
      </section>

      <section>
        ${sectionHead('Neutral', `hue · ${doc.palettes.neutral.hueMode}`)}
        ${neutralStrip()}
      </section>

      ${hasGradients ? `
        <section>
          ${sectionHead('Gradients', `${doc.gradients.length} of 5`)}
          <div style="display:flex;flex-direction:column;gap:12px;">
            ${doc.gradients.map(gradientBanner).join('')}
          </div>
        </section>
      ` : ''}

      <section>
        ${sectionHead('Semantic', 'state · main + light')}
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;">
          ${semanticCell('success')}
          ${semanticCell('info')}
          ${semanticCell('warning')}
          ${semanticCell('error')}
        </div>
      </section>
    </div>
  `;
}
