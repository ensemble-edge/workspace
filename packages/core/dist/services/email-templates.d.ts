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
interface Env {
    DB: D1Database;
    JWT_SECRET: string;
}
export interface RenderedEmail {
    subject: string;
    text: string;
    html: string;
}
/**
 * Magic-link sign-in email.
 */
export declare function renderMagicLinkEmail(env: Env, workspaceId: string, opts: {
    url: string;
    expires_in_minutes: number;
    code?: string;
}): Promise<RenderedEmail>;
/**
 * Invite email — admin invited a new user to the workspace.
 */
export declare function renderInviteEmail(env: Env, workspaceId: string, opts: {
    url: string;
    inviter_name?: string;
    expires_in_days: number;
}): Promise<RenderedEmail>;
/**
 * Password reset email — admin initiated reset, or self-service reset.
 */
export declare function renderPasswordResetEmail(env: Env, workspaceId: string, opts: {
    url: string;
    expires_in_minutes: number;
}): Promise<RenderedEmail>;
export {};
//# sourceMappingURL=email-templates.d.ts.map