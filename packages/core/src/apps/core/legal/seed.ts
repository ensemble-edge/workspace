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

import type { LocalizedString } from './types';

interface SeedDoc {
  id: string;
  slugs: Record<string, string>;
  title: LocalizedString;
  description: LocalizedString;
  bodyMd: LocalizedString;
  sortOrder: number;
}

/** The six starter docs. `lastUpdated` is stamped at seed time. */
const SEED_DOCS: SeedDoc[] = [
  {
    id: 'privacy',
    slugs: { es: 'privacidad', en: 'privacy' },
    title: { es: 'Privacidad', en: 'Privacy' },
    description: {
      es: 'Cómo recopilamos, usamos y protegemos su información personal.',
      en: 'How we collect, use, and protect your personal information.',
    },
    bodyMd: {
      es: '## Introducción\n\n[COMPANY NAME] valora su privacidad. Para preguntas, escríbanos a [EMAIL]. Última actualización: [DATE].',
      en: '## Introduction\n\n[COMPANY NAME] values your privacy. For questions, contact us at [EMAIL]. Last updated: [DATE].',
    },
    sortOrder: 10,
  },
  {
    id: 'terms',
    slugs: { es: 'terminos', en: 'terms' },
    title: { es: 'Términos', en: 'Terms & Conditions' },
    description: {
      es: 'Las reglas para usar nuestros servicios.',
      en: 'The rules for using our services.',
    },
    bodyMd: {
      es: '## Términos y Condiciones\n\nAl usar los servicios de [COMPANY NAME], usted acepta estos términos. Contacto: [EMAIL]. Última actualización: [DATE].',
      en: '## Terms & Conditions\n\nBy using [COMPANY NAME] services, you agree to these terms. Contact: [EMAIL]. Last updated: [DATE].',
    },
    sortOrder: 20,
  },
  {
    id: 'telehealth-consent',
    slugs: { es: 'consentimiento-medico', en: 'telehealth-consent' },
    title: { es: 'Consentimiento médico', en: 'Telehealth Medical Consent' },
    description: {
      es: 'Su consentimiento para recibir atención por telesalud.',
      en: 'Your consent to receive telehealth care.',
    },
    bodyMd: {
      es: '## Consentimiento de telesalud\n\nUsted consiente recibir atención médica por telesalud de [COMPANY NAME]. Preguntas: [EMAIL]. Última actualización: [DATE].',
      en: '## Telehealth Consent\n\nYou consent to receive telehealth medical care from [COMPANY NAME]. Questions: [EMAIL]. Last updated: [DATE].',
    },
    sortOrder: 30,
  },
  {
    id: 'cancellation-refunds',
    slugs: { es: 'cancelacion-reembolsos', en: 'cancellation-refunds' },
    title: { es: 'Cancelación y reembolsos', en: 'Cancellation & Refunds' },
    description: {
      es: 'Nuestras políticas de cancelación y reembolso.',
      en: 'Our cancellation and refund policies.',
    },
    bodyMd: {
      es: '## Cancelación y reembolsos\n\nPuede cancelar contactando a [COMPANY NAME] en [EMAIL] o [PHONE]. Última actualización: [DATE].',
      en: '## Cancellation & Refunds\n\nYou may cancel by contacting [COMPANY NAME] at [EMAIL] or [PHONE]. Last updated: [DATE].',
    },
    sortOrder: 40,
  },
  {
    id: 'privacy-practices',
    slugs: { es: 'practicas-de-privacidad', en: 'privacy-practices' },
    title: { es: 'Prácticas de privacidad', en: 'Notice of Privacy Practices' },
    description: {
      es: 'Cómo se pueden usar y divulgar sus datos de salud.',
      en: 'How your health information may be used and disclosed.',
    },
    bodyMd: {
      es: '## Aviso de prácticas de privacidad\n\nEste aviso describe cómo [COMPANY NAME] puede usar su información de salud. Avisos legales: [LEGAL NOTICES EMAIL]. Última actualización: [DATE].',
      en: '## Notice of Privacy Practices\n\nThis notice describes how [COMPANY NAME] may use your health information. Legal notices: [LEGAL NOTICES EMAIL]. Last updated: [DATE].',
    },
    sortOrder: 50,
  },
  {
    id: 'consumer-rights',
    slugs: { es: 'derechos-del-consumidor', en: 'consumer-rights' },
    title: { es: 'Derechos del consumidor', en: 'Consumer Rights' },
    description: {
      es: 'Sus derechos respecto a sus datos personales.',
      en: 'Your rights regarding your personal data.',
    },
    bodyMd: {
      es: '## Derechos del consumidor\n\nUsted tiene derechos sobre sus datos personales. Para ejercerlos, escriba a [LEGAL NOTICES EMAIL]. Dirección: [LEGAL BUSINESS ADDRESS]. Última actualización: [DATE].',
      en: '## Consumer Rights\n\nYou have rights over your personal data. To exercise them, write to [LEGAL NOTICES EMAIL]. Address: [LEGAL BUSINESS ADDRESS]. Last updated: [DATE].',
    },
    sortOrder: 60,
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
export function buildLegalSeedStatements(
  db: D1Database,
  workspaceId: string,
  isoDate: string,
  createdBy: string,
): D1PreparedStatement[] {
  const day = isoDate.slice(0, 10); // YYYY-MM-DD
  const statements: D1PreparedStatement[] = [];

  for (const doc of SEED_DOCS) {
    statements.push(
      db
        .prepare(
          `INSERT INTO legal_docs
             (workspace_id, id, slugs_json, title_json, description_json, body_md_json, last_updated, status, sort_order, created_by, created_at, updated_by, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)
           ON CONFLICT (workspace_id, id) DO NOTHING`,
        )
        .bind(
          workspaceId,
          doc.id,
          JSON.stringify(doc.slugs),
          JSON.stringify(doc.title),
          JSON.stringify(doc.description),
          JSON.stringify(doc.bodyMd),
          day,
          doc.sortOrder,
          createdBy,
          isoDate,
          createdBy,
          isoDate,
        ),
    );

    for (const [locale, slug] of Object.entries(doc.slugs)) {
      if (!slug) continue;
      statements.push(
        db
          .prepare(
            `INSERT INTO legal_doc_slugs (workspace_id, slug, locale, doc_id)
             VALUES (?, ?, ?, ?)
             ON CONFLICT (workspace_id, slug, locale) DO NOTHING`,
          )
          .bind(workspaceId, slug, locale, doc.id),
      );
    }
  }

  return statements;
}
