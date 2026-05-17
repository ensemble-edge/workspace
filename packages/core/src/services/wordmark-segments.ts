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

export function parseWordmarkSegments(raw: string): WordmarkSegment[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (s) =>
          typeof s === 'object' && s !== null && typeof (s as { text?: unknown }).text === 'string',
      )
      .map((s) => {
        const seg = s as { text: string; color?: string };
        return { text: seg.text, color: typeof seg.color === 'string' ? seg.color : undefined };
      });
  } catch {
    return [];
  }
}
