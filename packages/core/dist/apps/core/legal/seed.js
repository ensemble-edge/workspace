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
 * The starter docs. Intentionally just TWO — Privacy Policy and Terms of
 * Use — the documents every workspace is expected to have. They ship as
 * very basic placeholder skeletons (a heading + a couple of one-line
 * sections) for the operator to expand and have reviewed by counsel.
 * Other docs (telehealth consent, refunds, privacy practices, consumer
 * rights, etc.) are NOT auto-created — an operator adds them in the CMS
 * if their business needs them.
 *
 * `lastUpdated` is stamped at seed time.
 */
const SEED_DOCS = [
    {
        id: 'privacy',
        slugs: { es: 'privacidad', en: 'privacy' },
        title: { es: 'Política de privacidad', en: 'Privacy Policy' },
        description: {
            es: 'Cómo recopilamos, usamos y protegemos su información personal.',
            en: 'How we collect, use, and protect your personal information.',
        },
        bodyMd: {
            es: '## Política de privacidad\n\n[COMPANY NAME] valora su privacidad. Esta política describe cómo recopilamos, usamos y protegemos su información personal.\n\n## Contacto\n\nSi tiene preguntas, escríbanos a [EMAIL].\n\nÚltima actualización: [DATE].',
            en: '## Privacy Policy\n\n[COMPANY NAME] values your privacy. This policy describes how we collect, use, and protect your personal information.\n\n## Contact\n\nIf you have questions, contact us at [EMAIL].\n\nLast updated: [DATE].',
        },
        sortOrder: 10,
    },
    {
        id: 'terms',
        slugs: { es: 'terminos', en: 'terms' },
        title: { es: 'Términos de uso', en: 'Terms of Use' },
        description: {
            es: 'Las reglas para usar nuestros servicios.',
            en: 'The rules for using our services.',
        },
        bodyMd: {
            es: '## Términos de uso\n\nAl usar los servicios de [COMPANY NAME], usted acepta estos términos.\n\n## Contacto\n\nPara preguntas sobre estos términos, escríbanos a [EMAIL].\n\nÚltima actualización: [DATE].',
            en: '## Terms of Use\n\nBy using [COMPANY NAME] services, you agree to these terms.\n\n## Contact\n\nFor questions about these terms, contact us at [EMAIL].\n\nLast updated: [DATE].',
        },
        sortOrder: 20,
    },
];
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
export function buildLegalSeedStatements(db, workspaceId, isoDate, createdBy) {
    const day = isoDate.slice(0, 10); // YYYY-MM-DD
    const statements = [];
    for (const doc of SEED_DOCS) {
        statements.push(db
            .prepare(`INSERT INTO legal_docs
             (workspace_id, id, slugs_json, title_json, description_json, body_md_json, last_updated, status, sort_order, created_by, created_at, updated_by, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)
           ON CONFLICT (workspace_id, id) DO NOTHING`)
            .bind(workspaceId, doc.id, JSON.stringify(doc.slugs), JSON.stringify(doc.title), JSON.stringify(doc.description), JSON.stringify(doc.bodyMd), day, doc.sortOrder, createdBy, isoDate, createdBy, isoDate));
        for (const [locale, slug] of Object.entries(doc.slugs)) {
            if (!slug)
                continue;
            statements.push(db
                .prepare(`INSERT INTO legal_doc_slugs (workspace_id, slug, locale, doc_id)
             VALUES (?, ?, ?, ?)
             ON CONFLICT (workspace_id, slug, locale) DO NOTHING`)
                .bind(workspaceId, slug, locale, doc.id));
        }
    }
    return statements;
}
//# sourceMappingURL=seed.js.map