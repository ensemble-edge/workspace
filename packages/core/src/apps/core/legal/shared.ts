/**
 * Legal Center — shared helpers used by both the CMS routes and the
 * public read/render routes.
 *
 *   • loc()              locale fallback for LocalizedString values
 *   • parseDocRow()      DB row → typed LegalDoc
 *   • renderMarkdown()   tiny dependency-free markdown → HTML
 *   • SLUG_RE / ID_RE    validation regexes (spec §3)
 */

import type { LegalDoc, LocalizedString } from './types';

/** id + slug validation: lowercase alphanumerics + hyphens, 1–80 chars. */
export const ID_RE = /^[a-z0-9-]{1,80}$/;
export const SLUG_RE = /^[a-z0-9-]{1,80}$/;

/**
 * Resolve a LocalizedString to a concrete string. Order: requested
 * locale → fallback locale (e.g. the slug's native locale) → first
 * non-empty value → ''. Never throws, never returns null.
 */
export function loc(
  value: LocalizedString | null | undefined,
  requested: string,
  fallback?: string,
): string {
  if (!value) return '';
  const tryKey = (k?: string): string | undefined => {
    if (!k) return undefined;
    const v = value[k];
    return v != null && v !== '' ? v : undefined;
  };
  const direct = tryKey(requested);
  if (direct !== undefined) return direct;
  const fb = tryKey(fallback);
  if (fb !== undefined) return fb;
  for (const v of Object.values(value)) {
    if (v != null && v !== '') return v;
  }
  return '';
}

/** Parse a JSON column, tolerating null/garbage → {}. */
function parseJson(raw: string | null | undefined): LocalizedString {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as LocalizedString) : {};
  } catch {
    return {};
  }
}

/** Shape of a raw legal_docs row from D1. */
export interface LegalDocRow {
  id: string;
  slugs_json: string;
  title_json: string;
  description_json: string | null;
  body_md_json: string;
  last_updated: string;
  status: string;
  sort_order: number;
}

/** DB row → typed LegalDoc (JSON columns parsed). */
export function parseDocRow(row: LegalDocRow): LegalDoc {
  return {
    id: row.id,
    slugs: parseJson(row.slugs_json),
    title: parseJson(row.title_json),
    description: row.description_json ? parseJson(row.description_json) : null,
    bodyMd: parseJson(row.body_md_json),
    lastUpdated: row.last_updated,
    status: row.status === 'archived' ? 'archived' : 'active',
    sortOrder: row.sort_order,
  };
}

/** Escape the five HTML-significant characters in a text node. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Inline markdown: bold, italic, links, code. Escapes text first. */
function renderInline(text: string): string {
  let out = escapeHtml(text);
  // links: [label](url) — url is escaped by the earlier escapeHtml pass.
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, url) => {
    return `<a href="${url}">${label}</a>`;
  });
  // bold then italic (bold first so ** isn't eaten by *).
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // inline code
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  return out;
}

/**
 * Minimal markdown → HTML. Supports: #/##/### headings, unordered
 * lists (- or *), blank-line-separated paragraphs, and the inline set
 * above. Deliberately small — covers legal-doc prose without pulling in
 * a markdown dependency into the Worker bundle.
 */
export function renderMarkdown(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let para: string[] = [];
  let listItems: string[] = [];

  const flushPara = () => {
    if (para.length) {
      html.push(`<p>${renderInline(para.join(' '))}</p>`);
      para = [];
    }
  };
  const flushList = () => {
    if (listItems.length) {
      html.push(`<ul>${listItems.map((li) => `<li>${renderInline(li)}</li>`).join('')}</ul>`);
      listItems = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const listItem = /^[-*]\s+(.*)$/.exec(line);

    if (heading) {
      flushPara();
      flushList();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
    } else if (listItem) {
      flushPara();
      listItems.push(listItem[1]);
    } else if (line.trim() === '') {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();

  return html.join('\n');
}
