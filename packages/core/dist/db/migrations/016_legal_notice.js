/**
 * Migration 016: legal_docs.notice_json — a localized notice/callout.
 *
 * A prominent banner rendered at the TOP of a legal doc, above the body —
 * e.g. an arbitration / class-action-waiver warning ("PLEASE READ THESE
 * TERMS CAREFULLY…"). LocalizedString JSON like the other content
 * columns; nullable (most docs have no notice).
 *
 * CRITICAL (the §1.3 FK gotcha): a notice is legally meaningful, so it
 * must be captured in the version audit. The column is mirrored onto
 * legal_docs_versions in THIS migration, and the PUT snapshot writes it —
 * otherwise a version row couldn't reconstruct the notice the patient saw.
 */
export const migration = {
    name: '016_legal_notice',
    sql: `
    ALTER TABLE legal_docs ADD COLUMN notice_json TEXT;
    ALTER TABLE legal_docs_versions ADD COLUMN notice_json TEXT;
  `,
};
//# sourceMappingURL=016_legal_notice.js.map