/**
 * Legal placeholder resolver.
 *
 * Legal-doc markdown carries bracketed placeholder tokens that are
 * substituted at render time — every render path (the `:slug` JSON API
 * and the `:slug` HTML page) calls the same resolver so the two never
 * drift. Ported from the Curalisto quiz prototype's
 * `legalPlaceholders.ts`, re-cut for the workspace settings store.
 *
 * Design rules (from docs/plan/legal-builtin-app.md §7):
 *
 *   • Empty substitution ERASES the token. An empty support phone must
 *     never render `[PHONE]` or `[]` — the visitor sees a clean line.
 *   • `[COMPANY NAME CONTACT]` is replaced BEFORE `[COMPANY NAME]` so
 *     the longer token wins. We use plain `replaceAll`, not regex, so
 *     bracket characters in values can't matter.
 *   • `[DATE]` is Intl-formatted in the render locale from the doc's
 *     `last_updated` ISO date. Parsed as `${iso}T12:00:00Z` so it never
 *     shifts a day in negative-UTC locales. Never throws — falls back
 *     to en-US, then to the raw ISO string.
 */
/** The five operator-tunable placeholder values, all strings. */
export interface LegalPlaceholderValues {
    companyName: string;
    businessAddress: string;
    supportEmail: string;
    supportPhone: string;
    noticesEmail: string;
}
/**
 * Format an ISO `YYYY-MM-DD` date for the given locale. Anchored at
 * noon UTC so the calendar day is stable across time zones. Falls back
 * to en-US, then to the raw ISO string — never throws.
 */
export declare function formatLegalDate(iso: string, locale: string): string;
/**
 * Substitute every placeholder token in `bodyMd`.
 *
 * Pure and dependency-free — takes already-resolved values so it can be
 * unit-tested without a DB. The async `resolveLegalPlaceholders`
 * wrapper below fetches the values from the settings store.
 *
 * @param bodyMd   The doc's markdown body (already locale-selected).
 * @param values   The five placeholder values.
 * @param isoDate  The doc's `last_updated` ISO date for `[DATE]`.
 * @param locale   The render locale for date formatting.
 */
export declare function substituteLegalPlaceholders(bodyMd: string, values: LegalPlaceholderValues, isoDate: string, locale: string): string;
interface SettingsEnv {
    DB: D1Database;
}
/**
 * Fetch the five `legal.*` settings for a workspace and substitute every
 * placeholder in `bodyMd`. The render-path entry point.
 */
export declare function resolveLegalPlaceholders(env: SettingsEnv, workspaceId: string, bodyMd: string, isoDate: string, locale: string): Promise<string>;
export {};
//# sourceMappingURL=legal-placeholders.d.ts.map