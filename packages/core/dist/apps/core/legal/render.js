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
// These pages dogfood the workspace brand: they <link> /brand/css and
// reference the same design tokens as the shell, login page, and brand
// guide — hsl(var(--background/foreground/card/muted-foreground/border/
// primary)), var(--font-heading/body), var(--radius). So the public
// /legal/* pages inherit the operator's colors, fonts, and radius and
// track theme changes, instead of carrying a hardcoded palette.
//
// The fallback :root below only kicks in if /brand/css fails to load
// (network blip) — neutral values so the page is never unstyled. When
// /brand/css loads (it does, same-origin) its :root wins.
const STYLE = `
  :root {
    --background: 0 0% 100%; --foreground: 222 47% 11%;
    --card: 0 0% 100%; --card-foreground: 222 47% 11%;
    --muted: 210 40% 96%; --muted-foreground: 215 16% 47%;
    --border: 214 32% 91%; --primary: 222 47% 11%;
    --radius: 0.6rem;
    --font-heading: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    --font-body: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  * { box-sizing: border-box; }
  body { margin:0; font-family: var(--font-body); color: hsl(var(--foreground)); background: hsl(var(--background)); line-height:1.6; }
  .legal-wrap { display:flex; max-width:1080px; margin:0 auto; min-height:100vh; gap: 3rem; padding: 0 1.5rem; }
  .legal-toc { width:240px; flex:0 0 240px; padding:40px 0; }
  .legal-toc h2 { font-size:.7rem; font-weight:700; text-transform:uppercase; letter-spacing:.12em; color: hsl(var(--muted-foreground)); margin:0 0 16px; }
  .legal-toc a { display:block; padding:8px 14px; margin-bottom:6px; color: hsl(var(--muted-foreground)); text-decoration:none; border:1px solid transparent; border-radius: var(--radius); font-size:.9rem; transition: color .15s, background-color .15s; }
  .legal-toc a:hover { color: hsl(var(--foreground)); }
  .legal-toc a.active { color: hsl(var(--primary)); font-weight:700; border-color: hsl(var(--primary) / 0.28); background: hsl(var(--primary) / 0.08); }
  .legal-main { flex:1; padding:40px 0; min-width:0; max-width: 48rem; }
  .legal-head { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:8px; }
  .legal-main h1 { font-family: var(--font-heading); font-size:1.9rem; font-weight:800; letter-spacing:-0.02em; margin:0; }
  .legal-updated { color: hsl(var(--muted-foreground)); font-size:.85rem; margin:0 0 32px; }
  /* Each top-level markdown section (## heading + its prose) becomes a card,
     matching the brand-guide / landing-page legal layout. */
  .legal-body h2 { font-family: var(--font-heading); font-size:1.1rem; font-weight:700; margin:0 0 12px; }
  .legal-body h2 + p, .legal-body h2 ~ p, .legal-body h2 ~ ul { color: hsl(var(--muted-foreground)); }
  .legal-body > h2 { margin-top:0; padding-top:1.5rem; }
  .legal-body { display:flex; flex-direction:column; gap:1.5rem; }
  .legal-body section { background: hsl(var(--card)); border:1px solid hsl(var(--border)); border-radius: calc(var(--radius) + 0.4rem); padding:1.5rem 2rem; }
  .legal-body a { color: hsl(var(--primary)); font-weight:500; }
  .legal-body ul, .legal-body ol { padding-left:1.25rem; margin:.5rem 0; }
  .legal-body ol { list-style: decimal; }
  .legal-body ul { list-style: disc; }
  .legal-body li { margin:.3rem 0; padding-left:.15rem; }
  .legal-body li > ul, .legal-body li > ol { margin:.25rem 0; }
  .legal-body p { margin:.6rem 0; }
  .legal-lang select { padding:6px 10px; border:1px solid hsl(var(--border)); border-radius: var(--radius); font-size:.85rem; background: hsl(var(--card)); color: hsl(var(--foreground)); }
  @media (max-width:720px) { .legal-wrap { flex-direction:column; gap:1rem; } .legal-toc { width:auto; flex:none; padding:24px 0 0; } .legal-main { padding:16px 0 40px; } .legal-body section { padding:1.25rem 1.25rem; } }
`;
/**
 * Group rendered markdown HTML into <section> cards, one per top-level
 * `## heading`. This is a PAGE-presentation concern, not part of the
 * content: renderMarkdown() stays semantic (flat h2/p/ul) so the JSON
 * API consumers get clean embeddable HTML; the page wraps those into
 * cards here — the same shape the brand guide and landing-page legal
 * sections use.
 *
 * Splits on `<h2`. Anything before the first `<h2>` (an intro paragraph)
 * becomes its own leading section.
 */
function sectionize(html) {
    if (!html.includes('<h2')) {
        // No section headings — wrap the whole body in one card.
        return `<section>${html}</section>`;
    }
    const parts = html.split(/(?=<h2)/g).filter((p) => p.trim());
    return parts.map((p) => `<section>${p}</section>`).join('\n');
}
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
<!-- Dogfood the workspace brand: load the same tokens the shell + brand
     guide use. Loaded AFTER the fallback <style> so /brand/css :root wins. -->
<link rel="stylesheet" href="/brand/css">
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
    <div class="legal-body">${sectionize(data.contentHtml)}</div>
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
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(t.notFound)}</title><style>${STYLE}</style><link rel="stylesheet" href="/brand/css"></head>
<body><main class="legal-main" style="max-width:48rem;margin:0 auto;"><h1>${esc(t.notFound)}</h1></main></body>
</html>`;
}
//# sourceMappingURL=render.js.map