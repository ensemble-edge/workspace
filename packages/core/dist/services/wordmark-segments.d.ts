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
export declare function parseWordmarkSegments(raw: string): WordmarkSegment[];
//# sourceMappingURL=wordmark-segments.d.ts.map