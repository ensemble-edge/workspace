import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './shared';

/**
 * Regression tests for the markdown renderer. The hand-rolled renderer
 * these replace could not do ordered lists or multi-line list items —
 * the latter split a wrapped `- item` line into a stray <p> (the big
 * gaps seen on the rendered legal page). marked fixes both.
 */
describe('renderMarkdown (marked)', () => {
  it('renders ordered lists as <ol>', () => {
    const out = renderMarkdown('1. First\n2. Second\n3. Third');
    expect(out).toContain('<ol>');
    expect(out).toContain('<li>First</li>');
    expect(out).toContain('<li>Third</li>');
  });

  it('renders unordered lists as <ul>', () => {
    const out = renderMarkdown('- A\n- B');
    expect(out).toContain('<ul>');
    expect(out).toContain('<li>A</li>');
  });

  it('keeps a wrapped/continued list-item line inside its <li> (no stray <p>)', () => {
    const out = renderMarkdown('- **Bold lead** — first line,\n  continued second line.');
    expect(out).toContain('<strong>Bold lead</strong>');
    expect(out).toContain('continued second line');
    // The continuation must NOT close the list and start a paragraph.
    expect(out).not.toMatch(/<\/ul>\s*<p>continued/);
  });

  it('supports nested lists', () => {
    const out = renderMarkdown('- Parent\n  - Child\n  - Child 2');
    // A nested <ul> appears inside the parent <li>.
    expect((out.match(/<ul>/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  it('still renders ## headings (so sectionize can split on them)', () => {
    const out = renderMarkdown('## Section One\n\nBody text.');
    expect(out).toContain('<h2>Section One</h2>');
  });

  it('renders inline bold, links, and code', () => {
    const out = renderMarkdown('Text with **bold**, a [link](https://example.com), and `code`.');
    expect(out).toContain('<strong>bold</strong>');
    expect(out).toContain('<a href="https://example.com">link</a>');
    expect(out).toContain('<code>code</code>');
  });

  it('escapes raw HTML-significant characters in text (defensive)', () => {
    // A stray < from a substituted placeholder value must not become markup.
    const out = renderMarkdown('Company < Other & Co.');
    expect(out).toContain('&lt;');
    expect(out).toContain('&amp;');
  });
});
