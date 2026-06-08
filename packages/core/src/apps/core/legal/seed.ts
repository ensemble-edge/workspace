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
const SEED_DOCS: SeedDoc[] = [
  {
    id: 'privacy',
    slugs: { es: 'privacidad', en: 'privacy' },
    title: { es: 'Política de privacidad', en: 'Privacy Policy' },
    description: {
      es: 'Cómo recopilamos, usamos y protegemos su información personal.',
      en: 'How we collect, use, and protect your personal information.',
    },
    bodyMd: {
      es:
        '[COMPANY NAME] valora su privacidad. Esta política describe cómo recopilamos, usamos y protegemos su información personal. Última actualización: [DATE].\n\n' +
        '## Información que recopilamos\n\nRecopilamos la información que usted nos proporciona directamente (como nombre, correo electrónico y datos de contacto) y la información que se genera automáticamente cuando usa nuestros servicios.\n\n' +
        '## Cómo usamos su información\n\nUsamos su información para prestar y mejorar nuestros servicios, comunicarnos con usted y cumplir con nuestras obligaciones legales.\n\n' +
        '## Cómo compartimos su información\n\nNo vendemos su información personal. Podemos compartirla con proveedores de servicios que actúan en nuestro nombre y cuando lo exija la ley.\n\n' +
        '## Sus derechos\n\nUsted puede solicitar acceso, corrección o eliminación de su información personal. Para ejercer estos derechos, escríbanos a [LEGAL NOTICES EMAIL].\n\n' +
        '## Contacto\n\nSi tiene preguntas sobre esta política, escríbanos a [EMAIL].',
      en:
        '[COMPANY NAME] values your privacy. This policy describes how we collect, use, and protect your personal information. Last updated: [DATE].\n\n' +
        '## Information we collect\n\nWe collect information you provide to us directly (such as your name, email, and contact details) and information generated automatically when you use our services.\n\n' +
        '## How we use your information\n\nWe use your information to provide and improve our services, communicate with you, and meet our legal obligations.\n\n' +
        '## How we share your information\n\nWe do not sell your personal information. We may share it with service providers acting on our behalf and where required by law.\n\n' +
        '## Your rights\n\nYou may request access to, correction of, or deletion of your personal information. To exercise these rights, contact us at [LEGAL NOTICES EMAIL].\n\n' +
        '## Contact\n\nIf you have questions about this policy, contact us at [EMAIL].',
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
      es:
        'Al usar los servicios de [COMPANY NAME], usted acepta estos términos. Léalos con atención. Última actualización: [DATE].\n\n' +
        '## Uso de los servicios\n\nUsted acepta usar nuestros servicios solo para fines lícitos y de acuerdo con estos términos y la legislación aplicable.\n\n' +
        '## Cuentas\n\nUsted es responsable de mantener la confidencialidad de su cuenta y de toda la actividad que ocurra en ella.\n\n' +
        '## Pagos\n\nLos precios y las condiciones de pago aplicables se le comunican antes de cada compra. Usted es responsable de los cargos asociados a su cuenta.\n\n' +
        '## Limitación de responsabilidad\n\nNuestros servicios se ofrecen "tal cual". En la medida permitida por la ley, [COMPANY NAME] no será responsable de daños indirectos o incidentales.\n\n' +
        '## Cambios a estos términos\n\nPodemos actualizar estos términos ocasionalmente. El uso continuado de los servicios constituye su aceptación de los términos revisados.\n\n' +
        '## Contacto\n\nPara preguntas sobre estos términos, escríbanos a [EMAIL].',
      en:
        'By using [COMPANY NAME] services, you agree to these terms. Please read them carefully. Last updated: [DATE].\n\n' +
        '## Use of the services\n\nYou agree to use our services only for lawful purposes and in accordance with these terms and applicable law.\n\n' +
        '## Accounts\n\nYou are responsible for keeping your account credentials confidential and for all activity that occurs under your account.\n\n' +
        '## Payments\n\nApplicable prices and payment terms are disclosed to you before each purchase. You are responsible for charges associated with your account.\n\n' +
        '## Limitation of liability\n\nOur services are provided "as is." To the extent permitted by law, [COMPANY NAME] is not liable for indirect or incidental damages.\n\n' +
        '## Changes to these terms\n\nWe may update these terms from time to time. Continued use of the services constitutes acceptance of the revised terms.\n\n' +
        '## Contact\n\nFor questions about these terms, contact us at [EMAIL].',
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
