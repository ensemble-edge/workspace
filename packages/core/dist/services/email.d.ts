/**
 * Workspace email service.
 *
 * One provider active at a time, chosen by the operator. No automatic
 * failover; if the active provider returns a hard error, the caller
 * surfaces it. The operator switches providers manually if needed.
 *
 * Provider-specific knowledge lives in this file; the rest of workspace
 * imports `sendEmail` and `verifyEmailDomain` and doesn't care which
 * provider is configured.
 */
export interface EmailMessage {
    to: string;
    subject: string;
    text: string;
    html?: string;
}
export type EmailProvider = 'cloudflare' | 'resend';
export interface EmailResult {
    ok: boolean;
    /** If not ok, a stable code: 'not_configured', 'unverified_domain', 'rate_limited', 'provider_error', 'unknown_provider' */
    reason?: string;
    /** Provider-side message id, if successfully sent. */
    message_id?: string;
    /** Provider-side error body for debugging. */
    error_detail?: unknown;
}
interface Env {
    DB: D1Database;
    JWT_SECRET: string;
    SEND_EMAIL?: {
        send(message: {
            from: string;
            to: string;
            raw: ReadableStream | string;
        }): Promise<void>;
    };
}
/**
 * Send an email through whichever provider the workspace has configured.
 * Returns a result indicating success or a specific failure mode.
 */
export declare function sendEmail(env: Env, workspaceId: string, msg: EmailMessage): Promise<EmailResult>;
export interface VerifyResult {
    status: 'verified' | 'pending' | 'failed';
    message?: string;
}
/**
 * Verify the configured sending domain. Implementation differs by
 * provider: Cloudflare reads DKIM/SPF records via the CF DNS API;
 * Resend polls its own domain-status endpoint.
 *
 * Result is stored back into workspace_credentials.email_provider_verified
 * so the login screen can quickly check magic-link availability without
 * re-running verification on every request.
 */
export declare function verifyEmailDomain(env: Env, workspaceId: string): Promise<VerifyResult>;
export {};
//# sourceMappingURL=email.d.ts.map