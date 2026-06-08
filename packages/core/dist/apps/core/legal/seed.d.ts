/**
 * Legal Center — per-workspace seed content.
 *
 * The six starter legal docs (es + en), seeded at workspace bootstrap
 * against the freshly-minted workspaceId — NOT in the migration, since
 * the workspace id doesn't exist at migration time. Mirrors how
 * bootstrap seeds brand tokens and nav config.
 *
 * The copy is UNREVIEWED-BY-COUNSEL placeholder content — concise
 * starting text an operator rewrites in the CMS. Bodies intentionally
 * carry placeholder tokens ([COMPANY NAME], [EMAIL], [DATE], …) that
 * the render-time resolver substitutes; do NOT pre-substitute here.
 *
 * Returns an array of D1 prepared statements so the caller can fold
 * them into the bootstrap db.batch([...]) transaction.
 */
/**
 * Build the prepared statements that seed the six starter legal docs +
 * their slug-junction rows for a workspace. Caller folds these into the
 * bootstrap db.batch().
 *
 * @param db           The D1 binding.
 * @param workspaceId  The freshly-created workspace id.
 * @param isoDate      Seed timestamp (used for both last_updated and
 *                     created_at, ISO `YYYY-MM-DD` slice for the former).
 * @param createdBy    The bootstrapping user's id (for created_by).
 */
export declare function buildLegalSeedStatements(db: D1Database, workspaceId: string, isoDate: string, createdBy: string): D1PreparedStatement[];
//# sourceMappingURL=seed.d.ts.map