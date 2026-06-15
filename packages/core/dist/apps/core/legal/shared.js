/**
 * Legal Center — shared helpers used by both the CMS routes and the
 * public read/render routes.
 *
 *   • loc()              locale fallback for LocalizedString values
 *   • parseDocRow()      DB row → typed LegalDoc
 *   • renderMarkdown()   markdown → HTML via marked (CommonMark + GFM)
 *   • SLUG_RE / ID_RE    validation regexes (spec §3)
 */
import { marked } from 'marked';
/** id + slug validation: lowercase alphanumerics + hyphens, 1–80 chars. */
export const ID_RE = /^[a-z0-9-]{1,80}$/;
export const SLUG_RE = /^[a-z0-9-]{1,80}$/;
/**
 * Resolve a LocalizedString to a concrete string. Order: requested
 * locale → fallback locale (e.g. the slug's native locale) → first
 * non-empty value → ''. Never throws, never returns null.
 */
export function loc(value, requested, fallback) {
    if (!value)
        return '';
    const tryKey = (k) => {
        if (!k)
            return undefined;
        const v = value[k];
        return v != null && v !== '' ? v : undefined;
    };
    const direct = tryKey(requested);
    if (direct !== undefined)
        return direct;
    const fb = tryKey(fallback);
    if (fb !== undefined)
        return fb;
    for (const v of Object.values(value)) {
        if (v != null && v !== '')
            return v;
    }
    return '';
}
/** Parse a JSON column, tolerating null/garbage → {}. */
function parseJson(raw) {
    if (!raw)
        return {};
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    }
    catch {
        return {};
    }
}
/** DB row → typed LegalDoc (JSON columns parsed). */
export function parseDocRow(row) {
    return {
        id: row.id,
        slugs: parseJson(row.slugs_json),
        title: parseJson(row.title_json),
        description: row.description_json ? parseJson(row.description_json) : null,
        notice: row.notice_json ? parseJson(row.notice_json) : null,
        bodyMd: parseJson(row.body_md_json),
        lastUpdated: row.last_updated,
        status: row.status === 'archived' ? 'archived' : 'active',
        sortOrder: row.sort_order,
    };
}
/**
 * Markdown → HTML for legal docs, via `marked` (CommonMark + GFM).
 *
 * Replaces the earlier hand-rolled renderer, which couldn't do ordered
 * lists or multi-line list items (a wrapped `- item` line split into a
 * stray paragraph). marked handles ordered/nested lists, tables,
 * blockquotes, and inline formatting correctly.
 *
 * Config:
 *   • gfm:    GitHub-flavored extensions (tables, strikethrough).
 *   • async:  false — we need a synchronous string return.
 *   • breaks: false — a single newline is NOT a <br>; paragraphs are
 *             separated by blank lines, the markdown norm. (The legal
 *             bodies are authored with blank-line-separated sections.)
 *
 * Sanitization: the spec treats doc bodies as authored-by-us (trusted),
 * and the resolved placeholder VALUES (company name, address, emails)
 * are substituted BEFORE this runs. marked HTML-escapes text content by
 * default, so a stray `<` in an operator-set value renders as text, not
 * markup — the defensive posture we want without extra work.
 */
export function renderMarkdown(md) {
    return marked.parse(md, { gfm: true, async: false, breaks: false });
}
//# sourceMappingURL=shared.js.map