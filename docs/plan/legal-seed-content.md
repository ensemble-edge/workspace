# Legal Center — Seed Content (fill-in reference)

> **What this is:** the exact text seeded into the `core:legal` built-in
> app, laid out field-by-field to match the CMS editor at `/legal-app`
> (Content tab). Copy each value into the matching field on each doc card.
>
> **Scope:** the app seeds only **two** starter docs — **Privacy Policy**
> and **Terms of Use** — the documents every workspace is expected to
> have. Anything else (telehealth consent, refunds, privacy practices,
> consumer rights, …) is NOT auto-created; add it in the CMS if your
> business needs it.
>
> **Provenance:** very basic placeholder skeletons authored in-house,
> verbatim from `packages/core/src/apps/core/legal/seed.ts`. **UNREVIEWED
> BY COUNSEL** — a heading + a couple of one-line sections each, meant as
> a starting point, not legal text. Expand and have reviewed before you
> flip the **Publish** toggle (public pages are 404 until you do).
>
> **Where they come from at runtime:** seeded automatically for brand-new
> workspaces at bootstrap. For an existing workspace that upgraded into
> this app, the Content tab starts empty — click **"Add starter
> documents"** there to seed these two (idempotent; never overwrites
> edits).
>
> **Placeholder tokens** (substituted at render time — leave them in):
> `[COMPANY NAME]`, `[EMAIL]`, `[DATE]` (and `[PHONE]`,
> `[LEGAL NOTICES EMAIL]`, `[LEGAL BUSINESS ADDRESS]` if you add docs that
> use them). Empty values erase the token. `[DATE]` fills automatically
> from each doc's "Last updated" date. Set the values in the **Legal
> copy** card (Settings tab).

---

## 1. Privacy Policy

- **id:** `privacy`  ·  **Sort order:** `10`
- **URL slug — ES:** `privacidad`  ·  **EN:** `privacy`

**Title**
- ES: `Política de privacidad`
- EN: `Privacy Policy`

**Description**
- ES: `Cómo recopilamos, usamos y protegemos su información personal.`
- EN: `How we collect, use, and protect your personal information.`

> Each `##` section renders as its own card on the public page (the
> markdown's major sections drive the layout). Intro text before the
> first `##` becomes a leading card.

**Body (markdown) — ES**
```markdown
[COMPANY NAME] valora su privacidad. Esta política describe cómo recopilamos, usamos y protegemos su información personal. Última actualización: [DATE].

## Información que recopilamos

Recopilamos la información que usted nos proporciona directamente (como nombre, correo electrónico y datos de contacto) y la información que se genera automáticamente cuando usa nuestros servicios.

## Cómo usamos su información

Usamos su información para prestar y mejorar nuestros servicios, comunicarnos con usted y cumplir con nuestras obligaciones legales.

## Cómo compartimos su información

No vendemos su información personal. Podemos compartirla con proveedores de servicios que actúan en nuestro nombre y cuando lo exija la ley.

## Sus derechos

Usted puede solicitar acceso, corrección o eliminación de su información personal. Para ejercer estos derechos, escríbanos a [LEGAL NOTICES EMAIL].

## Contacto

Si tiene preguntas sobre esta política, escríbanos a [EMAIL].
```

**Body (markdown) — EN**
```markdown
[COMPANY NAME] values your privacy. This policy describes how we collect, use, and protect your personal information. Last updated: [DATE].

## Information we collect

We collect information you provide to us directly (such as your name, email, and contact details) and information generated automatically when you use our services.

## How we use your information

We use your information to provide and improve our services, communicate with you, and meet our legal obligations.

## How we share your information

We do not sell your personal information. We may share it with service providers acting on our behalf and where required by law.

## Your rights

You may request access to, correction of, or deletion of your personal information. To exercise these rights, contact us at [LEGAL NOTICES EMAIL].

## Contact

If you have questions about this policy, contact us at [EMAIL].
```

---

## 2. Terms of Use

- **id:** `terms`  ·  **Sort order:** `20`
- **URL slug — ES:** `terminos`  ·  **EN:** `terms`

**Title**
- ES: `Términos de uso`
- EN: `Terms of Use`

**Description**
- ES: `Las reglas para usar nuestros servicios.`
- EN: `The rules for using our services.`

**Body (markdown) — ES**
```markdown
Al usar los servicios de [COMPANY NAME], usted acepta estos términos. Léalos con atención. Última actualización: [DATE].

## Uso de los servicios

Usted acepta usar nuestros servicios solo para fines lícitos y de acuerdo con estos términos y la legislación aplicable.

## Cuentas

Usted es responsable de mantener la confidencialidad de su cuenta y de toda la actividad que ocurra en ella.

## Pagos

Los precios y las condiciones de pago aplicables se le comunican antes de cada compra. Usted es responsable de los cargos asociados a su cuenta.

## Limitación de responsabilidad

Nuestros servicios se ofrecen "tal cual". En la medida permitida por la ley, [COMPANY NAME] no será responsable de daños indirectos o incidentales.

## Cambios a estos términos

Podemos actualizar estos términos ocasionalmente. El uso continuado de los servicios constituye su aceptación de los términos revisados.

## Contacto

Para preguntas sobre estos términos, escríbanos a [EMAIL].
```

**Body (markdown) — EN**
```markdown
By using [COMPANY NAME] services, you agree to these terms. Please read them carefully. Last updated: [DATE].

## Use of the services

You agree to use our services only for lawful purposes and in accordance with these terms and applicable law.

## Accounts

You are responsible for keeping your account credentials confidential and for all activity that occurs under your account.

## Payments

Applicable prices and payment terms are disclosed to you before each purchase. You are responsible for charges associated with your account.

## Limitation of liability

Our services are provided "as is." To the extent permitted by law, [COMPANY NAME] is not liable for indirect or incidental damages.

## Changes to these terms

We may update these terms from time to time. Continued use of the services constitutes acceptance of the revised terms.

## Contact

For questions about these terms, contact us at [EMAIL].
```

---

## Legal copy (placeholder values — set once, used everywhere)

Set these in the **Legal copy** card (Settings tab); they fill the
`[TOKENS]` above.

| Field | Token | Default |
|-------|-------|---------|
| Company name | `[COMPANY NAME]` | `Curalisto` |
| Support email | `[EMAIL]` | `hello@curalisto.com` |
| Legal notices email | `[LEGAL NOTICES EMAIL]` | `legal@curalisto.com` |
| Support phone | `[PHONE]` | _(empty)_ |
| Legal business address | `[LEGAL BUSINESS ADDRESS]` | _(empty)_ |

`[DATE]` → auto from each doc's **Last updated** field.

---

## ⚠️ Before publishing

1. These bodies are **basic placeholders, not legal documents.** Expand
   each into real terms.
2. **Have counsel review** every doc before flipping the **Publish**
   toggle (public `/legal/*` + `/api/legal/*` are 404 until you do).
3. The **Spanish** text is a draft translation — have it reviewed too.
4. Add any other documents your business needs (consent, refunds, etc.)
   directly in the CMS.
