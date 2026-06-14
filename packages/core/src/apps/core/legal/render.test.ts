import { describe, it, expect } from 'vitest';
import { renderLegalPage, renderLegalNotFound } from './render';

describe('legal page favicon + seo head', () => {
  const favicon = '<link rel="icon" type="image/svg+xml" href="/_ensemble/brand/favicon.svg">';
  const base = {
    lang: 'en', activeId: 'privacy', title: 'Privacy', lastUpdated: '2026-06-08',
    noticeHtml: '', faviconHtml: favicon, contentHtml: '<p>x</p>',
    slugs: { en: 'privacy' }, toc: [{ id: 'privacy', title: 'Privacy', slug: 'privacy' }],
  };

  it('emits the passed favicon snippet in the page head', () => {
    const html = renderLegalPage({ ...base, seoHead: '' });
    expect(html).toContain(favicon);
    expect(html).toContain('/brand/css'); // still dogfoods CSS too
  });

  it('emits the indexable seo head (canonical) when passed', () => {
    const seo = '<link rel="canonical" href="https://curalisto.com/legal/privacy">';
    const html = renderLegalPage({ ...base, seoHead: seo });
    expect(html).toContain(seo);
    expect(html).not.toContain('noindex');
  });

  it('emits the noindex seo head when passed', () => {
    const html = renderLegalPage({ ...base, seoHead: '<meta name="robots" content="noindex, nofollow">' });
    expect(html).toContain('noindex, nofollow');
    expect(html).not.toContain('rel="canonical"');
  });

  it('emits favicon in the 404 page and the 404 is always noindex', () => {
    const html = renderLegalNotFound('es', favicon);
    expect(html).toContain(favicon);
    expect(html).toContain('noindex, nofollow');
  });
  it('404 without favicon arg still renders (optional)', () => {
    expect(renderLegalNotFound('es')).toContain('<html');
  });
});
