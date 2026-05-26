/**
 * Wordmark segment parsing — shared between shell editor and server renderers.
 *
 * Storage shape (JSON-stringified in brand_token `wordmark_text`):
 *   [{ text: 'Cura', color: '#137774' }, { text: 'listo', color: '#F2795D' }]
 */
export interface WordmarkSegment {
    text: string;
    color?: string;
}
/**
 * Server-side renderer — emits inline-styled HTML for the wordmark.
 * Used by login page HTML, email template headers, and the public
 * brand guide. Returns null when there are no segments — callers
 * should fall back to plain text or an image.
 *
 * Caller is responsible for HTML-escaping the surrounding context; the
 * function itself escapes segment text. The `fontSize` is rendered as
 * a CSS px value on the wrapper span.
 *
 * v0.1.17: accepts optional family/weight/style so server-rendered
 * consumers (login HTML, email) render the wordmark in the operator's
 * chosen typeface. For emails, only the family-as-CSS-stack is
 * meaningful — email clients won't load Google Fonts CSS, so the
 * family falls back to the system stack in the recipient's client.
 */
export declare function renderWordmarkHtml(segments: WordmarkSegment[], opts?: {
    fontSize?: number;
    fontWeight?: number;
    /** Resolved font-family stack (e.g. `"Inter", sans-serif`). */
    fontFamily?: string;
    /** Overrides fontWeight if set. */
    weight?: number | string;
    style?: 'normal' | 'italic';
}): string | null;
export declare function parseWordmarkSegments(raw: string): WordmarkSegment[];
//# sourceMappingURL=wordmark-segments.d.ts.map