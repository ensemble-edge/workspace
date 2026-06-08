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
 * Minimal markdown → HTML. Supports: #/##/### headings, unordered
 * lists (- or *), blank-line-separated paragraphs, and the inline set
 * above. Deliberately small — covers legal-doc prose without pulling in
 * a markdown dependency into the Worker bundle.
 */
export declare function renderMarkdown(md: string): string;
//# sourceMappingURL=shared.d.ts.map