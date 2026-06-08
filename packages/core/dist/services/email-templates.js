/**
 * Branded email templates.
 *
 * Reads brand_tokens for logo + accent + workspace name and produces
 * `{subject, text, html}` ready to hand to sendEmail(). Three templates
 * in v0.1.15: magic-link, invite, password-reset.
 *
 * Design decisions:
 *   - Inline styles only — external CSS doesn't work in email clients.
 *   - System font stack — web fonts don't render reliably in email.
 *   - Light mode only — dark-mode email is a multi-week rabbit hole.
 *   - Plain-text fallback always present (a11y + non-HTML clients).
 *   - Logo via the `workspace_public_url` credential + the resolver, so
 *     emails reference absolute URLs (relative paths don't work).
 *   - Renders fail open: if brand_tokens are missing, emails still go
 *     out with workspace name + text styling.
 */
import { getCredential } from './credentials.js';
import { resolveBrandImage } from './brand-images.js';
import { parseWordmarkSegments, renderWordmarkHtml } from './wordmark-segments.js';
import { loadAndResolveRoles, familyStack } from './font-roles.js';
/**
 * Pull the brand pieces needed for any template. One DB roundtrip,
 * cached implicitly by Cloudflare's request scope.
 */
async function loadBrandContext(env, workspaceId) {
    // workspace_name from workspaces table; brand tokens from brand_tokens.
    const [wsRow, baseUrl] = await Promise.all([
        env.DB.prepare(`SELECT name FROM workspaces WHERE id = ?`).bind(workspaceId).first(),
        getCredential(env, workspaceId, 'workspace_public_url'),
    ]);
    // Identity-category tokens (logos, accent, etc.).
    const tokenRows = await env.DB.prepare(`SELECT key, value FROM brand_tokens
      WHERE workspace_id = ? AND category IN ('identity', 'colors') AND locale = ''`)
        .bind(workspaceId)
        .all();
    const tokens = {};
    for (const r of tokenRows.results ?? [])
        tokens[r.key] = r.value;
    // v0.1.60: resolve the brand accent color via the BrandColorsDoc.
    // Pre-v0.1.55, the workspace stored a flat 'accent' token in
    // brand_tokens; v0.1.55 stopped writing that key (replaced by the
    // doc-based palette model). Email templates can't read CSS
    // variables (most email clients strip them), so we need an inline
    // hex value. Resolve via the new doc → light theme's `brand`
    // binding → through palettes. Falls back to legacy token + default
    // for fresh workspaces.
    let accent = tokens['accent'] || '';
    try {
        const { loadBrandColors } = await import('./brand-colors/load.js');
        const { resolvePalettes, resolveBindingValue } = await import('./brand-colors/resolver.js');
        const doc = await loadBrandColors(env.DB, workspaceId);
        const palettes = resolvePalettes(doc);
        const resolved = resolveBindingValue(doc.themes.light.bindings.brand, palettes);
        if (resolved)
            accent = resolved;
    }
    catch {
        /* fall through to legacy / default */
    }
    if (!accent)
        accent = '#3B82F6';
    // Resolve logo paths. They may be relative ('/_ensemble/brand/asset/...')
    // — for email use, we must absolutize them with workspace_public_url.
    const wordmarkRel = resolveBrandImage(tokens, 'wordmark', { mode: 'light' });
    const iconRel = resolveBrandImage(tokens, 'icon_mark', { mode: 'light' });
    const absolutize = (rel) => {
        if (!rel)
            return null;
        if (/^https?:\/\//i.test(rel))
            return rel;
        if (!baseUrl)
            return null; // can't absolutize → skip logo in email
        return `${baseUrl.replace(/\/$/, '')}${rel.startsWith('/') ? '' : '/'}${rel}`;
    };
    return {
        workspace_name: wsRow?.name ?? 'Workspace',
        wordmark_segments: parseWordmarkSegments(tokens['wordmark_text'] ?? ''),
        wordmark_role: (await loadAndResolveRoles(env.DB, workspaceId)).wordmark,
        logo_wordmark: absolutize(wordmarkRel),
        logo_icon_mark: absolutize(iconRel),
        accent,
        base_url: baseUrl ?? '',
    };
}
/**
 * Shared HTML envelope. `bodyHtml` is the per-template content between
 * header (logo) and footer.
 */
function renderEnvelope(brand, opts) {
    // Precedence: styled-text wordmark > raster wordmark > icon mark >
    // plain workspace name. Styled text wins because it scales cleanly
    // in every email client (no image-loading off by default, no Outlook
    // sizing surprises).
    const styledWordmark = renderWordmarkHtml(brand.wordmark_segments, {
        fontSize: 18,
        weight: brand.wordmark_role.weight,
        style: brand.wordmark_role.style,
        fontFamily: familyStack(brand.wordmark_role.family),
    });
    const logoImg = styledWordmark
        ? styledWordmark
        : brand.logo_wordmark
            ? `<img src="${brand.logo_wordmark}" alt="${escapeHtml(brand.workspace_name)}" style="max-height:32px;max-width:200px;display:block;" />`
            : brand.logo_icon_mark
                ? `<img src="${brand.logo_icon_mark}" alt="${escapeHtml(brand.workspace_name)}" style="max-height:32px;max-width:32px;display:block;" />`
                : `<span style="font-size:18px;font-weight:600;color:#111827;">${escapeHtml(brand.workspace_name)}</span>`;
    const font = `-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif`;
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${escapeHtml(opts.heading)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:${font};color:#111827;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f4f4f5;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:24px 32px;border-bottom:1px solid #e5e7eb;">
                ${logoImg}
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#111827;line-height:1.3;">
                  ${escapeHtml(opts.heading)}
                </h1>
                ${opts.bodyHtml}
                <div style="margin:32px 0 16px;">
                  <a href="${opts.cta.url}"
                     style="display:inline-block;padding:12px 24px;background:${brand.accent};color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:500;">
                    ${escapeHtml(opts.cta.label)}
                  </a>
                </div>
                <p style="margin:24px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">
                  ${opts.footnote}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;background:#f9fafb;font-size:12px;color:#6b7280;border-top:1px solid #e5e7eb;">
                ${escapeHtml(brand.workspace_name)} · Sent from a workspace you've used.
                If you didn't expect this email, you can ignore it.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
/**
 * Plain-text fallback. Mirrors the HTML body structure but flattens
 * everything to text. Always sent alongside HTML for a11y and for
 * email clients that don't render HTML.
 */
function plainText(opts) {
    return [
        opts.heading,
        '',
        opts.body,
        '',
        `${opts.cta_label}: ${opts.cta_url}`,
        '',
        opts.footnote,
        '',
        '— ' + opts.workspace_name,
    ].join('\n');
}
function escapeHtml(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
/**
 * Magic-link sign-in email.
 */
export async function renderMagicLinkEmail(env, workspaceId, opts) {
    const brand = await loadBrandContext(env, workspaceId);
    const subject = `Sign in to ${brand.workspace_name}`;
    const body = `Click the button below to sign in to ${brand.workspace_name}, ` +
        (opts.code ? `or enter the 6-digit code on the sign-in page. ` : '') +
        `This expires in ${opts.expires_in_minutes} minutes and can be used once.`;
    const footnote = `If you didn't request this sign-in, you can safely ignore this email — ` +
        `no one can use the link or code without your inbox.`;
    // v0.1.79: render a copy-friendly code block in the HTML email,
    // alongside the existing CTA button. Plain-text body includes the
    // code on a line operators can copy from any text email client.
    const codeHtml = opts.code
        ? `<div style="margin:24px 0;text-align:center;">
         <div style="display:inline-block;padding:14px 22px;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:32px;font-weight:600;letter-spacing:0.18em;color:#111827;">${escapeHtml(opts.code)}</div>
         <p style="margin:8px 0 0;font-size:12px;color:#6b7280;">Or enter this code on the sign-in page</p>
       </div>`
        : '';
    return {
        subject,
        text: plainText({
            workspace_name: brand.workspace_name,
            heading: subject,
            body: body + (opts.code ? `\n\nSign-in code: ${opts.code}` : ''),
            cta_label: 'Open workspace',
            cta_url: opts.url,
            footnote,
        }),
        html: renderEnvelope(brand, {
            heading: subject,
            bodyHtml: `<p style="margin:0;font-size:15px;line-height:1.5;color:#374151;">${escapeHtml(body)}</p>` +
                codeHtml,
            cta: { url: opts.url, label: 'Open workspace' },
            footnote: escapeHtml(footnote),
        }),
    };
}
/**
 * Invite email — admin invited a new user to the workspace.
 */
export async function renderInviteEmail(env, workspaceId, opts) {
    const brand = await loadBrandContext(env, workspaceId);
    const inviterClause = opts.inviter_name ? `${opts.inviter_name} invited you to ` : 'You\'ve been invited to ';
    const subject = `${inviterClause}${brand.workspace_name}`;
    const body = `Click the button below to accept the invitation and set up your account. ` +
        `This invite expires in ${opts.expires_in_days} days.`;
    const footnote = `If you didn't expect this invitation, you can ignore this email. ` +
        `The invite link can't be used without your email address.`;
    return {
        subject,
        text: plainText({
            workspace_name: brand.workspace_name,
            heading: subject,
            body,
            cta_label: 'Accept invite',
            cta_url: opts.url,
            footnote,
        }),
        html: renderEnvelope(brand, {
            heading: subject,
            bodyHtml: `<p style="margin:0;font-size:15px;line-height:1.5;color:#374151;">${escapeHtml(body)}</p>`,
            cta: { url: opts.url, label: 'Accept invite' },
            footnote: escapeHtml(footnote),
        }),
    };
}
/**
 * Password reset email — admin initiated reset, or self-service reset.
 */
export async function renderPasswordResetEmail(env, workspaceId, opts) {
    const brand = await loadBrandContext(env, workspaceId);
    const subject = `Reset your ${brand.workspace_name} password`;
    const body = `Click the button below to choose a new password. ` +
        `This link expires in ${opts.expires_in_minutes} minutes and can be used once.`;
    const footnote = `If you didn't request a password reset, you can safely ignore this email — ` +
        `your current password is unchanged.`;
    return {
        subject,
        text: plainText({
            workspace_name: brand.workspace_name,
            heading: subject,
            body,
            cta_label: 'Choose a new password',
            cta_url: opts.url,
            footnote,
        }),
        html: renderEnvelope(brand, {
            heading: subject,
            bodyHtml: `<p style="margin:0;font-size:15px;line-height:1.5;color:#374151;">${escapeHtml(body)}</p>`,
            cta: { url: opts.url, label: 'Choose a new password' },
            footnote: escapeHtml(footnote),
        }),
    };
}
//# sourceMappingURL=email-templates.js.map