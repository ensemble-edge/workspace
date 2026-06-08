import { describe, it, expect } from 'vitest';
import { renderLegalPage, renderLegalNotFound } from './render';

describe('legal page favicon', () => {
  const favicon = '<link rel="icon" type="image/svg+xml" href="/_ensemble/brand/favicon.svg">';
  it('emits the passed favicon snippet in the page head', () => {
    const html = renderLegalPage({
      lang: 'en', activeId: 'privacy', title: 'Privacy', lastUpdated: '2026-06-08',
      noticeHtml: '', faviconHtml: favicon, contentHtml: '<p>x</p>', slugs: { en: 'privacy' },
      toc: [{ id: 'privacy', title: 'Privacy', slug: 'privacy' }],
    });
    expect(html).toContain(favicon);
    expect(html).toContain('/brand/css'); // still dogfoods CSS too
  });
  it('emits favicon in the 404 page', () => {
    expect(renderLegalNotFound('es', favicon)).toContain(favicon);
  });
  it('404 without favicon arg still renders (optional)', () => {
    expect(renderLegalNotFound('es')).toContain('<html');
  });
});
