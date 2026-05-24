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

import { getCredential } from './credentials';

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
  // Optional CF Email Routing send binding — only present if operator
  // has wired the worker up to send via Cloudflare Email Workers.
  SEND_EMAIL?: { send(message: { from: string; to: string; raw: ReadableStream | string }): Promise<void> };
}

/**
 * Send an email through whichever provider the workspace has configured.
 * Returns a result indicating success or a specific failure mode.
 */
export async function sendEmail(
  env: Env,
  workspaceId: string,
  msg: EmailMessage,
): Promise<EmailResult> {
  const provider = (await getCredential(env, workspaceId, 'email_provider')) as EmailProvider | null;
  if (!provider) return { ok: false, reason: 'not_configured' };

  const fromAddress = await getCredential(env, workspaceId, 'email_from_address');
  if (!fromAddress) return { ok: false, reason: 'not_configured' };

  if (provider === 'cloudflare') return sendViaCloudflare(env, workspaceId, msg, fromAddress);
  if (provider === 'resend') return sendViaResend(env, workspaceId, msg, fromAddress);
  return { ok: false, reason: 'unknown_provider' };
}

// ─── Cloudflare Email Workers (via SEND_EMAIL binding) ─────────────────

async function sendViaCloudflare(
  env: Env,
  _workspaceId: string,
  msg: EmailMessage,
  fromAddress: string,
): Promise<EmailResult> {
  if (!env.SEND_EMAIL) {
    return {
      ok: false,
      reason: 'not_configured',
      error_detail: 'Cloudflare Email Workers requires a [send_email] binding in wrangler.toml',
    };
  }
  try {
    const raw = buildMimeMessage(fromAddress, msg);
    await env.SEND_EMAIL.send({ from: fromAddress, to: msg.to, raw });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: 'provider_error', error_detail: String(err) };
  }
}

// ─── Resend ─────────────────────────────────────────────────────────

async function sendViaResend(
  env: Env,
  workspaceId: string,
  msg: EmailMessage,
  fromAddress: string,
): Promise<EmailResult> {
  const apiKey = await getCredential(env, workspaceId, 'email_resend_api_key');
  if (!apiKey) return { ok: false, reason: 'not_configured', error_detail: 'Resend API key missing' };

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
    }),
  });

  if (r.ok) {
    const body = await r.json<{ id?: string }>();
    return { ok: true, message_id: body.id };
  }

  const errBody = await r.text();
  if (r.status === 429) return { ok: false, reason: 'rate_limited', error_detail: errBody };
  if (r.status === 422) return { ok: false, reason: 'unverified_domain', error_detail: errBody };
  return { ok: false, reason: 'provider_error', error_detail: errBody };
}

// ─── Domain verification ────────────────────────────────────────────

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
export async function verifyEmailDomain(
  env: Env,
  workspaceId: string,
): Promise<VerifyResult> {
  const provider = (await getCredential(env, workspaceId, 'email_provider')) as EmailProvider | null;
  if (!provider) return { status: 'failed', message: 'No email provider configured' };

  if (provider === 'cloudflare') return verifyViaCloudflare(env, workspaceId);
  if (provider === 'resend') return verifyViaResend(env, workspaceId);
  return { status: 'failed', message: 'Unknown provider' };
}

async function verifyViaCloudflare(env: Env, workspaceId: string): Promise<VerifyResult> {
  const domain = await getCredential(env, workspaceId, 'email_sending_domain');
  const accountId = await getCredential(env, workspaceId, 'cloudflare_account_id');
  const cfToken = await getCredential(env, workspaceId, 'cloudflare_api_token');
  if (!domain) return { status: 'failed', message: 'Sending domain not set' };
  if (!accountId || !cfToken) return { status: 'failed', message: 'Connection (Cloudflare) credentials not set' };

  // Find the zone that owns this domain. Cloudflare zones are
  // registered at the registrable-domain level (curalisto.com), not
  // per-subdomain. A sending domain like `io.curalisto.com` lives
  // as DNS records under the parent zone, so we walk up labels until
  // we find a zone that exists in the account.
  //
  // v0.1.67: prior versions only queried the exact domain, which
  // 404'd for every subdomain sender — operators saw
  // "No zone found for io.curalisto.com in this account" with no
  // hint that they should retry against the root.
  async function findZone(name: string): Promise<{ id: string; name: string } | null> {
    let candidate = name;
    while (candidate.includes('.')) {
      const r = await fetch(
        `https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(candidate)}`,
        { headers: { Authorization: `Bearer ${cfToken}` } },
      );
      if (!r.ok) return null;
      const body = await r.json<{ result?: Array<{ id: string; name: string }> }>();
      const z = body.result?.[0];
      if (z) return z;
      candidate = candidate.slice(candidate.indexOf('.') + 1);
    }
    return null;
  }
  const zone = await findZone(domain);
  if (!zone) {
    return {
      status: 'failed',
      message: `No Cloudflare zone matches ${domain} (or any parent) in this account. Add the zone in Cloudflare DNS first.`,
    };
  }

  // Look for SPF (TXT containing "v=spf1") and DKIM (subdomains like
  // *_domainkey). DNS records are scoped to the parent zone but their
  // `name` field reflects the full subdomain, so subdomain senders
  // get correctly evaluated against records like
  // `io.curalisto.com` TXT v=spf1 / `default._domainkey.io.curalisto.com`.
  const dnsR = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zone.id}/dns_records?type=TXT&per_page=200`,
    { headers: { Authorization: `Bearer ${cfToken}` } },
  );
  if (!dnsR.ok) return { status: 'failed', message: `DNS read failed: ${dnsR.status}` };
  const dnsBody = await dnsR.json<{ result?: Array<{ name: string; content: string }> }>();
  const records = dnsBody.result ?? [];

  // v0.1.67: scope the SPF/DKIM checks to the sending domain
  // specifically. The zone may be the parent (curalisto.com) but the
  // sender is the subdomain (io.curalisto.com) — we only want
  // records that match the sending domain, not unrelated SPF records
  // on the root.
  const domainLower = domain.toLowerCase();
  const matchesDomain = (r: { name: string }) => r.name.toLowerCase() === domainLower;
  const matchesDkim = (r: { name: string }) =>
    r.name.toLowerCase().includes('_domainkey') &&
    r.name.toLowerCase().endsWith('.' + domainLower);
  const hasSpf = records.some((r) => matchesDomain(r) && r.content.includes('v=spf1'));
  const hasDkim = records.some(matchesDkim);
  if (hasSpf && hasDkim) return { status: 'verified' };
  if (hasSpf || hasDkim) return { status: 'pending', message: `${hasSpf ? '' : 'SPF missing. '}${hasDkim ? '' : 'DKIM missing.'}` };
  return { status: 'pending', message: `No SPF or DKIM records found for ${domain}. Configure them in Cloudflare DNS under zone ${zone.name}.` };
}

async function verifyViaResend(env: Env, workspaceId: string): Promise<VerifyResult> {
  const apiKey = await getCredential(env, workspaceId, 'email_resend_api_key');
  const domain = await getCredential(env, workspaceId, 'email_sending_domain');
  if (!apiKey) return { status: 'failed', message: 'Resend API key not set' };
  if (!domain) return { status: 'failed', message: 'Sending domain not set' };

  const r = await fetch('https://api.resend.com/domains', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!r.ok) return { status: 'failed', message: `Resend API: ${r.status}` };
  const body = await r.json<{ data?: Array<{ name: string; status: string }> }>();
  const match = body.data?.find((d) => d.name === domain);
  if (!match) return { status: 'failed', message: `Domain ${domain} is not registered in Resend` };
  if (match.status === 'verified') return { status: 'verified' };
  return { status: 'pending', message: `Resend status: ${match.status}` };
}

// ─── Helpers ────────────────────────────────────────────────────────

function buildMimeMessage(from: string, msg: EmailMessage): string {
  const boundary = `==ensemble-${Math.random().toString(36).slice(2)}`;
  const parts: string[] = [
    `From: ${from}`,
    `To: ${msg.to}`,
    `Subject: ${msg.subject}`,
    'MIME-Version: 1.0',
  ];
  if (msg.html) {
    parts.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    parts.push('');
    parts.push(`--${boundary}`);
    parts.push('Content-Type: text/plain; charset=utf-8');
    parts.push('');
    parts.push(msg.text);
    parts.push(`--${boundary}`);
    parts.push('Content-Type: text/html; charset=utf-8');
    parts.push('');
    parts.push(msg.html);
    parts.push(`--${boundary}--`);
  } else {
    parts.push('Content-Type: text/plain; charset=utf-8');
    parts.push('');
    parts.push(msg.text);
  }
  return parts.join('\r\n');
}
