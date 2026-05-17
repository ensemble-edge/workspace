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
import { getCredential } from './credentials.js';
/**
 * Send an email through whichever provider the workspace has configured.
 * Returns a result indicating success or a specific failure mode.
 */
export async function sendEmail(env, workspaceId, msg) {
    const provider = (await getCredential(env, workspaceId, 'email_provider'));
    if (!provider)
        return { ok: false, reason: 'not_configured' };
    const fromAddress = await getCredential(env, workspaceId, 'email_from_address');
    if (!fromAddress)
        return { ok: false, reason: 'not_configured' };
    if (provider === 'cloudflare')
        return sendViaCloudflare(env, workspaceId, msg, fromAddress);
    if (provider === 'resend')
        return sendViaResend(env, workspaceId, msg, fromAddress);
    return { ok: false, reason: 'unknown_provider' };
}
// ─── Cloudflare Email Workers (via SEND_EMAIL binding) ─────────────────
async function sendViaCloudflare(env, _workspaceId, msg, fromAddress) {
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
    }
    catch (err) {
        return { ok: false, reason: 'provider_error', error_detail: String(err) };
    }
}
// ─── Resend ─────────────────────────────────────────────────────────
async function sendViaResend(env, workspaceId, msg, fromAddress) {
    const apiKey = await getCredential(env, workspaceId, 'email_resend_api_key');
    if (!apiKey)
        return { ok: false, reason: 'not_configured', error_detail: 'Resend API key missing' };
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
        const body = await r.json();
        return { ok: true, message_id: body.id };
    }
    const errBody = await r.text();
    if (r.status === 429)
        return { ok: false, reason: 'rate_limited', error_detail: errBody };
    if (r.status === 422)
        return { ok: false, reason: 'unverified_domain', error_detail: errBody };
    return { ok: false, reason: 'provider_error', error_detail: errBody };
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
export async function verifyEmailDomain(env, workspaceId) {
    const provider = (await getCredential(env, workspaceId, 'email_provider'));
    if (!provider)
        return { status: 'failed', message: 'No email provider configured' };
    if (provider === 'cloudflare')
        return verifyViaCloudflare(env, workspaceId);
    if (provider === 'resend')
        return verifyViaResend(env, workspaceId);
    return { status: 'failed', message: 'Unknown provider' };
}
async function verifyViaCloudflare(env, workspaceId) {
    const domain = await getCredential(env, workspaceId, 'email_sending_domain');
    const accountId = await getCredential(env, workspaceId, 'cloudflare_account_id');
    const cfToken = await getCredential(env, workspaceId, 'cloudflare_api_token');
    if (!domain)
        return { status: 'failed', message: 'Sending domain not set' };
    if (!accountId || !cfToken)
        return { status: 'failed', message: 'Connection (Cloudflare) credentials not set' };
    // Check that the zone exists and has DKIM/SPF records.
    // First, find the zone id for the domain.
    const zoneR = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(domain)}`, { headers: { Authorization: `Bearer ${cfToken}` } });
    if (!zoneR.ok)
        return { status: 'failed', message: `Cloudflare API: ${zoneR.status}` };
    const zoneBody = await zoneR.json();
    const zone = zoneBody.result?.[0];
    if (!zone)
        return { status: 'failed', message: `No zone found for ${domain} in this account` };
    // Look for SPF (TXT containing "v=spf1") and DKIM (subdomains like *_domainkey)
    const dnsR = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone.id}/dns_records?type=TXT&per_page=200`, { headers: { Authorization: `Bearer ${cfToken}` } });
    if (!dnsR.ok)
        return { status: 'failed', message: `DNS read failed: ${dnsR.status}` };
    const dnsBody = await dnsR.json();
    const records = dnsBody.result ?? [];
    const hasSpf = records.some((r) => r.content.includes('v=spf1'));
    const hasDkim = records.some((r) => r.name.includes('_domainkey'));
    if (hasSpf && hasDkim)
        return { status: 'verified' };
    if (hasSpf || hasDkim)
        return { status: 'pending', message: `${hasSpf ? '' : 'SPF missing. '}${hasDkim ? '' : 'DKIM missing.'}` };
    return { status: 'pending', message: 'No SPF or DKIM records found. Configure them in Cloudflare DNS.' };
}
async function verifyViaResend(env, workspaceId) {
    const apiKey = await getCredential(env, workspaceId, 'email_resend_api_key');
    const domain = await getCredential(env, workspaceId, 'email_sending_domain');
    if (!apiKey)
        return { status: 'failed', message: 'Resend API key not set' };
    if (!domain)
        return { status: 'failed', message: 'Sending domain not set' };
    const r = await fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!r.ok)
        return { status: 'failed', message: `Resend API: ${r.status}` };
    const body = await r.json();
    const match = body.data?.find((d) => d.name === domain);
    if (!match)
        return { status: 'failed', message: `Domain ${domain} is not registered in Resend` };
    if (match.status === 'verified')
        return { status: 'verified' };
    return { status: 'pending', message: `Resend status: ${match.status}` };
}
// ─── Helpers ────────────────────────────────────────────────────────
function buildMimeMessage(from, msg) {
    const boundary = `==ensemble-${Math.random().toString(36).slice(2)}`;
    const parts = [
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
    }
    else {
        parts.push('Content-Type: text/plain; charset=utf-8');
        parts.push('');
        parts.push(msg.text);
    }
    return parts.join('\r\n');
}
//# sourceMappingURL=email.js.map