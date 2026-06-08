/**
 * core:legal — public HTML page rendering.
 *
 * Self-contained HTML + inline CSS (no Tailwind, no client JS beyond a
 * tiny inline language-switcher). The "Centro Legal" layout from spec
 * §6.1: brand-agnostic ToC sidebar on the left, rendered doc on the
 * right, a language dropdown driven by the doc's own slugs_json.
 *
 * Crawlable: emits <link rel="alternate" hreflang> per locale and does
 * NOT set noindex. The route layer omits the noindex header to match.
 */
/** Inline UI dictionary — the only chrome strings the page needs. */
const DICT = {
    es: { center: 'Centro Legal', updated: 'Última actualización', notFound: 'No existe ese documento' },
    en: { center: 'Legal Center', updated: 'Last updated', notFound: 'No such document' },
};
function dict(lang) {
    return DICT[lang] ?? DICT[lang.split('-')[0]] ?? DICT.es;
}
function esc(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
/** Intl-format an ISO date for the page header; falls back to raw. */
function formatDate(iso, lang) {
    try {
        return new Intl.DateTimeFormat(lang, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'UTC',
        }).format(new Date(`${iso}T12:00:00Z`));
    }
    catch {
        return iso;
    }
}
const STYLE = `
  :root { --ink:#1a1a2e; --muted:#6b7280; --line:#e5e7eb; --accent:#2563eb; --bg:#ffffff; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color:var(--ink); background:var(--bg); line-height:1.6; }
  .legal-wrap { display:flex; max-width:1080px; margin:0 auto; min-height:100vh; }
  .legal-toc { width:260px; flex:0 0 260px; border-right:1px solid var(--line); padding:32px 20px; }
  .legal-toc h2 { font-size:.75rem; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); margin:0 0 16px; }
  .legal-toc a { display:block; padding:8px 12px; color:var(--ink); text-decoration:none; border-radius:6px; border-left:3px solid transparent; font-size:.95rem; }
  .legal-toc a:hover { background:#f9fafb; }
  .legal-toc a.active { border-left-color:var(--accent); font-weight:600; background:#f3f6ff; }
  .legal-main { flex:1; padding:40px 48px; min-width:0; }
  .legal-head { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:8px; }
  .legal-main h1 { font-size:1.9rem; margin:0; }
  .legal-updated { color:var(--muted); font-size:.9rem; margin:0 0 28px; }
  .legal-body h1,.legal-body h2,.legal-body h3 { margin-top:1.6em; }
  .legal-body a { color:var(--accent); }
  .legal-lang select { padding:6px 10px; border:1px solid var(--line); border-radius:6px; font-size:.9rem; background:#fff; }
  @media (max-width:720px) { .legal-wrap { flex-direction:column; } .legal-toc { width:auto; flex:none; border-right:none; border-bottom:1px solid var(--line); } .legal-main { padding:24px; } }
`;
export function renderLegalPage(data) {
    const t = dict(data.lang);
    // Language switcher + hreflang: every locale this doc has a slug for.
    const localeSlugs = Object.entries(data.slugs).filter(([, s]) => s);
    const langOptions = localeSlugs
        .map(([locale, slug]) => `<option value="/legal/${esc(slug)}"${locale === data.lang ? ' selected' : ''}>${esc(locale.toUpperCase())}</option>`)
        .join('');
    const hreflangs = localeSlugs
        .map(([locale, slug]) => `<link rel="alternate" hreflang="${esc(locale)}" href="/legal/${esc(slug)}">`)
        .join('');
    const toc = data.toc
        .filter((e) => e.slug)
        .map((e) => `<a href="/legal/${esc(e.slug)}" class="${e.id === data.activeId ? 'active' : ''}">${esc(e.title || e.id)}</a>`)
        .join('');
    const langSwitcher = localeSlugs.length > 1
        ? `<div class="legal-lang"><select onchange="if(this.value)location.href=this.value">${langOptions}</select></div>`
        : '';
    return `<!DOCTYPE html>
<html lang="${esc(data.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(data.title)}</title>
${hreflangs}
<style>${STYLE}</style>
</head>
<body>
<div class="legal-wrap">
  <nav class="legal-toc">
    <h2>${esc(t.center)}</h2>
    ${toc}
  </nav>
  <main class="legal-main">
    <div class="legal-head">
      <h1>${esc(data.title)}</h1>
      ${langSwitcher}
    </div>
    <p class="legal-updated">${esc(t.updated)}: ${esc(formatDate(data.lastUpdated, data.lang))}</p>
    <div class="legal-body">${data.contentHtml}</div>
  </main>
</div>
</body>
</html>`;
}
/** Small 404 page (spec §6.1) — site-default-locale, no sidebar. */
export function renderLegalNotFound(lang) {
    const t = dict(lang);
    return `<!DOCTYPE html>
<html lang="${esc(lang)}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(t.notFound)}</title><style>${STYLE}</style></head>
<body><main class="legal-main"><h1>${esc(t.notFound)}</h1></main></body>
</html>`;
}
//# sourceMappingURL=render.js.map