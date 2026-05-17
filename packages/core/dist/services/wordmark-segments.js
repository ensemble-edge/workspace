/**
 * Wordmark segment parsing — shared between shell editor and server renderers.
 *
 * Storage shape (JSON-stringified in brand_token `wordmark_text`):
 *   [{ text: 'Cura', color: '#137774' }, { text: 'listo', color: '#F2795D' }]
 */
export function parseWordmarkSegments(raw) {
    if (!raw)
        return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed))
            return [];
        return parsed
            .filter((s) => typeof s === 'object' && s !== null && typeof s.text === 'string')
            .map((s) => {
            const seg = s;
            return { text: seg.text, color: typeof seg.color === 'string' ? seg.color : undefined };
        });
    }
    catch {
        return [];
    }
}
//# sourceMappingURL=wordmark-segments.js.map