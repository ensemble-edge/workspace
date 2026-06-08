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

**Body (markdown) — ES**
```markdown
## Política de privacidad

[COMPANY NAME] valora su privacidad. Esta política describe cómo recopilamos, usamos y protegemos su información personal.

## Contacto

Si tiene preguntas, escríbanos a [EMAIL].

Última actualización: [DATE].
```

**Body (markdown) — EN**
```markdown
## Privacy Policy

[COMPANY NAME] values your privacy. This policy describes how we collect, use, and protect your personal information.

## Contact

If you have questions, contact us at [EMAIL].

Last updated: [DATE].
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
## Términos de uso

Al usar los servicios de [COMPANY NAME], usted acepta estos términos.

## Contacto

Para preguntas sobre estos términos, escríbanos a [EMAIL].

Última actualización: [DATE].
```

**Body (markdown) — EN**
```markdown
## Terms of Use

By using [COMPANY NAME] services, you agree to these terms.

## Contact

For questions about these terms, contact us at [EMAIL].

Last updated: [DATE].
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
