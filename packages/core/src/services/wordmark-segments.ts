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
export function renderWordmarkHtml(
  segments: WordmarkSegment[],
  opts: {
    fontSize?: number;
    fontWeight?: number;
    /** Resolved font-family stack (e.g. `"Inter", sans-serif`). */
    fontFamily?: string;
    /** Overrides fontWeight if set. */
    weight?: number | string;
    style?: 'normal' | 'italic';
  } = {},
): string | null {
  if (segments.length === 0) return null;
  const fontSize = opts.fontSize ?? 24;
  const fontWeight = opts.weight ?? opts.fontWeight ?? 700;
  const fontStyle = opts.style ?? 'normal';
  const fontFamily = opts.fontFamily ?? '';
  const inner = segments
    .map(
      (s) =>
        `<span${
          s.color ? ` style="color:${escapeAttr(s.color)}"` : ''
        }>${escapeText(s.text)}</span>`,
    )
    .join('');
  const styles = [
    `font-size:${fontSize}px`,
    `font-weight:${fontWeight}`,
    `font-style:${fontStyle}`,
    'letter-spacing:-0.02em',
    'line-height:1.1',
  ];
  if (fontFamily) styles.unshift(`font-family:${fontFamily}`);
  return `<span style="${styles.join(';')}">${inner}</span>`;
}

function escapeText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;').replace(/</g, '&lt;');
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
