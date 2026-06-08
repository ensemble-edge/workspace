/**
 * Legal Center — shared helpers used by both the CMS routes and the
 * public read/render routes.
 *
 *   • loc()              locale fallback for LocalizedString values
 *   • parseDocRow()      DB row → typed LegalDoc
 *   • renderMarkdown()   markdown → HTML via marked (CommonMark + GFM)
 *   • SLUG_RE / ID_RE    validation regexes (spec §3)
 */
import type { LegalDoc, LocalizedString } from './types';
/** id + slug validation: lowercase alphanumerics + hyphens, 1–80 chars. */
export declare const ID_RE: RegExp;
export declare const SLUG_RE: RegExp;
/**
 * Resolve a LocalizedString to a concrete string. Order: requested
 * locale → fallback locale (e.g. the slug's native locale) → first
 * non-empty value → ''. Never throws, never returns null.
 */
export declare function loc(value: LocalizedString | null | undefined, requested: string, fallback?: string): string;
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
export declare function parseDocRow(row: LegalDocRow): LegalDoc;
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
export declare function renderMarkdown(md: string): string;
//# sourceMappingURL=shared.d.ts.map