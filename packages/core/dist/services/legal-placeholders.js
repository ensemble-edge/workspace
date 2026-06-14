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
/**
 * Format an ISO `YYYY-MM-DD` date for the given locale. Anchored at
 * noon UTC so the calendar day is stable across time zones. Falls back
 * to en-US, then to the raw ISO string — never throws.
 */
export function formatLegalDate(iso, locale) {
    const tryFormat = (loc) => new Intl.DateTimeFormat(loc, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
    }).format(new Date(`${iso}T12:00:00Z`));
    try {
        return tryFormat(locale);
    }
    catch {
        try {
            return tryFormat('en-US');
        }
        catch {
            return iso;
        }
    }
}
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
export function substituteLegalPlaceholders(bodyMd, values, isoDate, locale) {
    const { companyName, businessAddress, supportEmail, supportPhone, noticesEmail } = values;
    // Composite token. Best-effort: "Company (email)" when both present,
    // otherwise whichever is present, otherwise empty (erased).
    const companyContact = companyName && supportEmail
        ? `${companyName} (${supportEmail})`
        : companyName || supportEmail || '';
    // `[DATE]` passes through (formatted) — only substituted when the doc
    // actually has an ISO date.
    const formattedDate = isoDate ? formatLegalDate(isoDate, locale) : '';
    // Order matters: the COMPOSITE/longer token is replaced first so that
    // `[COMPANY NAME CONTACT]` can't be clobbered by `[COMPANY NAME]`.
    let out = bodyMd;
    out = out.replaceAll('[COMPANY NAME CONTACT]', companyContact);
    out = out.replaceAll('[COMPANY NAME]', companyName);
    out = out.replaceAll('[LEGAL BUSINESS ADDRESS]', businessAddress);
    out = out.replaceAll('[LEGAL NOTICES EMAIL]', noticesEmail);
    out = out.replaceAll('[EMAIL]', supportEmail);
    out = out.replaceAll('[PHONE]', supportPhone);
    out = out.replaceAll('[DATE]', formattedDate);
    return out;
}
/**
 * Fetch the five `legal.*` settings for a workspace and substitute every
 * placeholder in `bodyMd`. The render-path entry point.
 */
export async function resolveLegalPlaceholders(env, workspaceId, bodyMd, isoDate, locale) {
    const { getSetting } = await import('./workspace-settings.js');
    const [companyName, businessAddress, supportEmail, supportPhone, noticesEmail] = await Promise.all([
        getSetting(env, workspaceId, 'legal.company_name'),
        getSetting(env, workspaceId, 'legal.business_address'),
        getSetting(env, workspaceId, 'legal.support_email'),
        getSetting(env, workspaceId, 'legal.support_phone'),
        getSetting(env, workspaceId, 'legal.notices_email'),
    ]);
    return substituteLegalPlaceholders(bodyMd, { companyName, businessAddress, supportEmail, supportPhone, noticesEmail }, isoDate, locale);
}
//# sourceMappingURL=legal-placeholders.js.map