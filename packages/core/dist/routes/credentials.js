/**
 * Credentials, AI tiers, setup-status, auth-methods, and user-invite
 * routes (v0.1.12).
 *
 * All endpoints under `/_ensemble/`. Admin-only routes verify
 * membership.role === 'admin' or 'owner' before reading/writing
 * secrets. The list endpoint never returns secret values; only an
 * "is set" flag.
 */
import { Hono } from 'hono';
import { listCredentials, getCredential, setCredential, deleteCredential, getWorkspacePublicUrl, } from '../services/credentials';
import { verifyEmailDomain, sendEmail } from '../services/email';
import { renderMagicLinkEmail, renderInviteEmail, renderPasswordResetEmail, } from '../services/email-templates';
import { listTiers, getTier, createTier, patchTier, deleteTier, provisionTierRoute, seedDefaultTiers, canaryForProvider, gatewayDashboardUrl, } from '../services/ai-tiers';
import { listLocales, addLocale, patchLocale, setDefaultLocale, removeLocale, countLocalizedBrandTokens, } from '../services/locales';
import { getSetting, setSetting, parseSessionTtl, SESSION_TTL_OPTIONS, validateAliasPath, } from '../services/workspace-settings';
function requireAdmin(c) {
    const membership = c.get('membership');
    if (!membership || (membership.role !== 'admin' && membership.role !== 'owner')) {
        return c.json({ error: 'admin role required' }, 403);
    }
    return { ok: true };
}
export function createCredentialsRoutes() {
    const app = new Hono();
    // ─── Brand asset upload (R2) ──────────────────────────────────────
    //
    // Operators upload logos/favicons via Brand → Logos. Files land in
    // env.R2 under `brand/<workspace>/<kind>/<random>.<ext>` and a public
    // URL is returned for the brand_tokens table to reference.
    //
    // Auth: admin-only. Size limit: 5 MB. Allowed content-types are an
    // explicit allowlist — we don't want this to become a generic upload.
    const ALLOWED_UPLOAD_TYPES = new Set([
        'image/png',
        'image/jpeg',
        'image/svg+xml',
        'image/webp',
        'image/x-icon',
        'image/vnd.microsoft.icon',
    ]);
    const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
    app.post('/_ensemble/brand/upload', async (c) => {
        const adminCheck = requireAdmin(c);
        if (adminCheck instanceof Response)
            return adminCheck;
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'workspace not resolved' }, 400);
        if (!c.env.R2) {
            return c.json({ error: 'R2 bucket not bound. Add the binding in wrangler.toml.' }, 412);
        }
        const form = await c.req.formData();
        const file = form.get('file');
        const kind = form.get('kind') || 'logo';
        if (!(file instanceof File)) {
            return c.json({ error: 'No file provided (form field "file")' }, 400);
        }
        if (!ALLOWED_UPLOAD_TYPES.has(file.type)) {
            return c.json({ error: `Unsupported content-type: ${file.type}` }, 415);
        }
        if (file.size > MAX_UPLOAD_BYTES) {
            return c.json({ error: `File too large (max ${MAX_UPLOAD_BYTES / 1024 / 1024}MB)` }, 413);
        }
        // Generate a non-guessable key; the kind is descriptive only.
        const ext = extensionFor(file.type);
        const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
        const key = `brand/${workspace.id}/${kind}/${id}${ext}`;
        await c.env.R2.put(key, file.stream(), {
            httpMetadata: { contentType: file.type },
        });
        // Canonical URL is always returned for storage. When the operator
        // has configured a public alias path (e.g. 'media'), we also
        // include the pretty form (/media/<key>) as `display_url` so the
        // UI's "Copy URL" can show the operator's chosen path. Stored
        // brand_token values stay canonical — changing the alias path
        // never breaks stored data.
        const canonical = `/_ensemble/brand/asset/${encodeURIComponent(key)}`;
        const aliasPath = (await getSetting(c.env, workspace.id, 'asset_public_alias_path')).trim();
        const display = aliasPath
            ? `/${aliasPath}/${encodeURIComponent(key)}`
            : canonical;
        return c.json({
            ok: true,
            key,
            // Canonical (workspace-served, permanent) URL — always present.
            url: canonical,
            // Pretty URL when alias is enabled; same as `url` otherwise.
            display_url: display,
        });
    });
    /**
     * Shared R2 brand-asset reader. Used by both the canonical path and
     * the optional /assets/<key> alias. Scoped to keys under `brand/` so
     * the alias cannot exfiltrate other R2 prefixes.
     */
    async function serveBrandAsset(c, key) {
        if (!c.env.R2)
            return c.json({ error: 'R2 not configured' }, 404);
        if (!key.startsWith('brand/'))
            return c.json({ error: 'Not found' }, 404);
        const obj = await c.env.R2.get(key);
        if (!obj)
            return c.json({ error: 'Not found' }, 404);
        const headers = new Headers();
        obj.writeHttpMetadata(headers);
        headers.set('etag', obj.httpEtag);
        headers.set('Cache-Control', 'public, max-age=3600');
        return new Response(obj.body, { headers });
    }
    app.get('/_ensemble/brand/asset/:key{.+}', async (c) => {
        return serveBrandAsset(c, decodeURIComponent(c.req.param('key')));
    });
    // NOTE: The configurable asset alias used to be registered here as
    // `app.get('/:alias/:key{.+}')`. That route shape matched ANY two-
    // or-more-segment URL — including `/_ensemble/*`. When the handler
    // returned `c.notFound()` (because no alias was configured), Hono
    // committed to the match and stopped routing, so every workspace
    // API call 404'd. The fix moves alias handling into the SPA
    // catchall in create-workspace.ts where it can check the path
    // inline and fall through cleanly to the SPA when no match.
    // ─── Credentials CRUD ─────────────────────────────────────────────
    app.get('/_ensemble/credentials', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'workspace not resolved' }, 400);
        const category = c.req.query('category');
        const items = await listCredentials(c.env, workspace.id, category);
        return c.json({ items });
    });
    app.get('/_ensemble/credentials/:key', async (c) => {
        const check = requireAdmin(c);
        if (check instanceof Response)
            return check;
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'workspace not resolved' }, 400);
        const value = await getCredential(c.env, workspace.id, c.req.param('key'));
        if (value === null)
            return c.json({ error: 'not set' }, 404);
        return c.json({ key: c.req.param('key'), value });
    });
    app.put('/_ensemble/credentials/:key', async (c) => {
        const check = requireAdmin(c);
        if (check instanceof Response)
            return check;
        const workspace = c.get('workspace');
        const user = c.get('user');
        if (!workspace?.id)
            return c.json({ error: 'workspace not resolved' }, 400);
        const body = await c.req.json();
        if (typeof body.value !== 'string' || !body.category || typeof body.is_secret !== 'boolean') {
            return c.json({ error: 'body must include {value, category, is_secret}' }, 400);
        }
        await setCredential(c.env, workspace.id, c.req.param('key'), body.category, body.value, {
            isSecret: body.is_secret,
            updatedBy: user?.id,
        });
        // Side-effect: saving the AI Gateway namespace seeds default tiers.
        // (Pre-v0.1.14 also triggered on ai_gateway_token; that key was
        // dropped — the CF API token serves both Connection + AI Access.)
        const key = c.req.param('key');
        if (key === 'ai_gateway_name') {
            await seedDefaultTiers(c.env, workspace.id);
        }
        return c.json({ ok: true });
    });
    app.delete('/_ensemble/credentials/:key', async (c) => {
        const check = requireAdmin(c);
        if (check instanceof Response)
            return check;
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'workspace not resolved' }, 400);
        await deleteCredential(c.env, workspace.id, c.req.param('key'));
        return c.json({ ok: true });
    });
    // ─── Connection-test endpoints ─────────────────────────────────────
    /**
     * Test the configured Cloudflare API token against each scope the
     * workspace needs. Returns a list the UI renders as status lights.
     * Persists the result under `cf_token_scope_status` so the UI can show
     * the last-known state without re-running tests on every page load.
     *
     * Each scope test is a minimally-invasive read against the relevant
     * API. We don't write anything during a test. A 401/403 means the
     * scope is missing; any other error is reported with detail so the
     * operator can debug.
     */
    app.post('/_ensemble/credentials/test/connection', async (c) => {
        const check = requireAdmin(c);
        if (check instanceof Response)
            return check;
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'workspace not resolved' }, 400);
        const token = await getCredential(c.env, workspace.id, 'cloudflare_api_token');
        const accountId = await getCredential(c.env, workspace.id, 'cloudflare_account_id');
        if (!token)
            return c.json({ error: 'No Cloudflare API token set' }, 400);
        const scopes = [];
        const auth = { Authorization: `Bearer ${token}` };
        // 1. Token validity itself — also tells us the token is alive.
        const verifyR = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
            headers: auth,
        });
        if (!verifyR.ok) {
            // Token is invalid/expired — every scope check would fail. Report
            // a single result and short-circuit.
            scopes.push({
                name: 'Token validity',
                ok: false,
                detail: `Token rejected by Cloudflare (HTTP ${verifyR.status}).`,
            });
            await setCredential(c.env, workspace.id, 'cf_token_scope_status', 'connection', JSON.stringify(scopes), { isSecret: false });
            return c.json({ scopes });
        }
        // 2. Zone DNS:Edit — list zones (read implies the token can target zones).
        const zonesR = await fetch('https://api.cloudflare.com/client/v4/zones?per_page=1', {
            headers: auth,
        });
        scopes.push({
            name: 'Zone DNS:Edit',
            ok: zonesR.ok,
            detail: zonesR.ok
                ? 'Token can list zones.'
                : `HTTP ${zonesR.status} — token likely missing Zone DNS scope.`,
        });
        // 3. Email Routing — list addresses on the account.
        if (accountId) {
            const emailR = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/email/routing/addresses?per_page=1`, { headers: auth });
            scopes.push({
                name: 'Email Routing Addresses:Edit',
                ok: emailR.ok,
                detail: emailR.ok
                    ? 'Token can read Email Routing addresses.'
                    : `HTTP ${emailR.status} — token likely missing Email Routing scope.`,
            });
        }
        else {
            scopes.push({
                name: 'Email Routing Addresses:Edit',
                ok: false,
                detail: 'Cannot test — set the Cloudflare Account ID first.',
            });
        }
        // 4. AI Gateway — list gateways on the account.
        if (accountId) {
            const aiR = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai-gateway/gateways?per_page=1`, { headers: auth });
            scopes.push({
                name: 'AI Gateway:Edit',
                ok: aiR.ok,
                detail: aiR.ok
                    ? 'Token can list AI Gateway namespaces.'
                    : `HTTP ${aiR.status} — token likely missing AI Gateway scope.`,
            });
        }
        else {
            scopes.push({
                name: 'AI Gateway:Edit',
                ok: false,
                detail: 'Cannot test — set the Cloudflare Account ID first.',
            });
        }
        // 5. Workers R2 Storage — list buckets on the account. Powers the
        // bucket picker in the credentials tab so operators can choose an
        // R2 bucket from a dropdown rather than typing the name into
        // wrangler.toml by hand.
        if (accountId) {
            const r2R = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets`, { headers: auth });
            scopes.push({
                name: 'Workers R2 Storage:Read',
                ok: r2R.ok,
                detail: r2R.ok
                    ? 'Token can list R2 buckets.'
                    : `HTTP ${r2R.status} — token likely missing Workers R2 Storage scope.`,
            });
        }
        else {
            scopes.push({
                name: 'Workers R2 Storage:Read',
                ok: false,
                detail: 'Cannot test — set the Cloudflare Account ID first.',
            });
        }
        // Persist for the UI to render on next load without retesting.
        await setCredential(c.env, workspace.id, 'cf_token_scope_status', 'connection', JSON.stringify(scopes), { isSecret: false });
        return c.json({ scopes });
    });
    /**
     * GET /_ensemble/credentials/r2/buckets
     *
     * Lists every R2 bucket in the operator's Cloudflare account. Uses
     * the Cloudflare API token already configured in the credentials
     * tab. Powers the bucket picker so operators can choose from a
     * dropdown instead of typing the bucket name into wrangler.toml.
     *
     * Also reports binding health: whether `c.env.R2` is wired up at all,
     * and (if so) whether the previously-stored "selected bucket" is the
     * one currently bound. We can't read the bucket name from the
     * binding directly — Cloudflare doesn't expose it — so we infer it
     * from the workspace-settings `r2_selected_bucket` value plus a
     * `c.env.R2.list({ limit: 1 })` reachability probe.
     */
    app.get('/_ensemble/credentials/r2/buckets', async (c) => {
        const check = requireAdmin(c);
        if (check instanceof Response)
            return check;
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'workspace not resolved' }, 400);
        const token = await getCredential(c.env, workspace.id, 'cloudflare_api_token');
        const accountId = await getCredential(c.env, workspace.id, 'cloudflare_account_id');
        // Binding health: independent of token. Tells operators whether
        // their wrangler.toml is already wired up.
        let bindingReachable = false;
        if (c.env.R2) {
            try {
                await c.env.R2.list({ limit: 1 });
                bindingReachable = true;
            }
            catch {
                bindingReachable = false;
            }
        }
        const selectedBucket = (await getSetting(c.env, workspace.id, 'r2_selected_bucket')).trim();
        if (!token || !accountId) {
            return c.json({
                buckets: [],
                bindingReachable,
                selectedBucket,
                error: !token ? 'No Cloudflare API token set' : 'No Cloudflare Account ID set',
            });
        }
        const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) {
            return c.json({
                buckets: [],
                bindingReachable,
                selectedBucket,
                error: `Cloudflare API HTTP ${res.status} — token likely missing Workers R2 Storage:Read scope.`,
            });
        }
        const body = (await res.json());
        const buckets = (body.result?.buckets ?? []).map((b) => ({
            name: b.name,
            created_at: b.creation_date,
        }));
        return c.json({
            buckets,
            bindingReachable,
            selectedBucket,
        });
    });
    /**
     * PUT /_ensemble/credentials/r2/selected-bucket
     *
     * Stores which bucket the operator picked from the dropdown. Doesn't
     * actually change any binding — that requires editing wrangler.toml
     * and redeploying — but persisting the choice lets the UI remember
     * it and lets the wrangler-snippet auto-populate on subsequent visits.
     */
    app.put('/_ensemble/credentials/r2/selected-bucket', async (c) => {
        const check = requireAdmin(c);
        if (check instanceof Response)
            return check;
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'workspace not resolved' }, 400);
        const body = await c.req.json().catch(() => ({ name: '' }));
        const name = (body.name ?? '').trim();
        // Light validation: CF R2 bucket names are 3–63 chars, lowercase,
        // dashes/numbers/letters. Mirror that here so the UI can't store
        // garbage that won't match anything in the dropdown.
        if (name && !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(name)) {
            return c.json({ error: 'Invalid bucket name' }, 400);
        }
        await setSetting(c.env, workspace.id, 'r2_selected_bucket', name);
        return c.json({ ok: true, selectedBucket: name });
    });
    app.post('/_ensemble/credentials/test/email', async (c) => {
        const check = requireAdmin(c);
        if (check instanceof Response)
            return check;
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'workspace not resolved' }, 400);
        const result = await verifyEmailDomain(c.env, workspace.id);
        // Persist the result so the login screen / setup status can read it
        // without re-running verification.
        await setCredential(c.env, workspace.id, 'email_provider_verified', 'notifications', result.status, {
            isSecret: false,
        });
        return c.json(result);
    });
    /**
     * Test the AI Gateway namespace using the same Cloudflare API token
     * (single-token model — v0.1.14). Returns ok if the gateway exists and
     * the token can read it; otherwise a specific failure reason.
     */
    /**
     * Send a branded test email to the current admin's address. Uses the
     * magic-link template (the most visually representative). Returns
     * whether the send actually went out; UI surfaces this via toast so
     * operators can preview the template before relying on it.
     */
    app.post('/_ensemble/credentials/test/email/send', async (c) => {
        const check = requireAdmin(c);
        if (check instanceof Response)
            return check;
        const workspace = c.get('workspace');
        const user = c.get('user');
        if (!workspace?.id)
            return c.json({ ok: false, message: 'workspace not resolved' }, 400);
        if (!user?.email)
            return c.json({ ok: false, message: 'no email on file for current admin' }, 400);
        const verified = await getCredential(c.env, workspace.id, 'email_provider_verified');
        if (verified !== 'verified') {
            return c.json({ ok: false, message: 'Email provider not verified. Run "Verify domain" first.' });
        }
        const base = await getWorkspacePublicUrl(c.env, workspace.id, c.req.raw);
        // The URL doesn't have to resolve to anything meaningful — this is a
        // preview send. We point it at /login as a safe default so a click
        // doesn't surprise the operator.
        const rendered = await renderMagicLinkEmail(c.env, workspace.id, {
            url: `${base.replace(/\/$/, '')}/login`,
            expires_in_minutes: 15,
        });
        const result = await sendEmail(c.env, workspace.id, {
            to: user.email,
            subject: `[Test] ${rendered.subject}`,
            text: rendered.text,
            html: rendered.html,
        });
        if (result.ok)
            return c.json({ ok: true, sent_to: user.email });
        return c.json({
            ok: false,
            message: `Send failed: ${result.reason ?? 'unknown'}`,
            detail: result.error_detail,
        });
    });
    app.post('/_ensemble/credentials/test/ai', async (c) => {
        const check = requireAdmin(c);
        if (check instanceof Response)
            return check;
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'workspace not resolved' }, 400);
        const accountId = (await getCredential(c.env, workspace.id, 'ai_gateway_account_id'))
            ?? (await getCredential(c.env, workspace.id, 'cloudflare_account_id'));
        const gatewayName = await getCredential(c.env, workspace.id, 'ai_gateway_name');
        const cfToken = await getCredential(c.env, workspace.id, 'cloudflare_api_token');
        if (!accountId || !gatewayName || !cfToken) {
            return c.json({ ok: false, message: 'AI Gateway not configured' });
        }
        const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai-gateway/gateways/${gatewayName}`, { headers: { Authorization: `Bearer ${cfToken}` } });
        if (r.ok)
            return c.json({ ok: true });
        if (r.status === 401 || r.status === 403) {
            return c.json({ ok: false, status: r.status, message: 'Token lacks AI Gateway:Edit' });
        }
        if (r.status === 404) {
            return c.json({ ok: false, status: 404, message: `Gateway namespace "${gatewayName}" not found in this account` });
        }
        return c.json({ ok: false, status: r.status, message: `Cloudflare API ${r.status}` });
    });
    // ─── AI tiers CRUD ─────────────────────────────────────────────────
    app.get('/_ensemble/ai/tiers', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'workspace not resolved' }, 400);
        const tiers = await listTiers(c.env, workspace.id);
        return c.json({ tiers });
    });
    app.post('/_ensemble/ai/tiers', async (c) => {
        const check = requireAdmin(c);
        if (check instanceof Response)
            return check;
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'workspace not resolved' }, 400);
        const body = await c.req.json();
        try {
            const tier = await createTier(c.env, workspace.id, body);
            const provision = await provisionTierRoute(c.env, workspace.id, tier.name);
            return c.json({ tier, provision });
        }
        catch (err) {
            return c.json({ error: String(err) }, 400);
        }
    });
    app.patch('/_ensemble/ai/tiers/:name', async (c) => {
        const check = requireAdmin(c);
        if (check instanceof Response)
            return check;
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'workspace not resolved' }, 400);
        const body = await c.req.json();
        await patchTier(c.env, workspace.id, c.req.param('name'), body);
        const tier = await getTier(c.env, workspace.id, c.req.param('name'));
        return c.json({ tier });
    });
    app.delete('/_ensemble/ai/tiers/:name', async (c) => {
        const check = requireAdmin(c);
        if (check instanceof Response)
            return check;
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'workspace not resolved' }, 400);
        try {
            await deleteTier(c.env, workspace.id, c.req.param('name'));
            return c.json({ ok: true });
        }
        catch (err) {
            return c.json({ error: String(err) }, 409);
        }
    });
    /**
     * Test a tier with a canary payload appropriate for its provider.
     * Returns whatever the gateway returned plus a 'fallback' field when
     * the requested tier didn't exist. Operators use this from the AI
     * Access card to confirm a tier is wired up correctly before a guest
     * app depends on it.
     */
    app.post('/_ensemble/ai/tiers/:name/test', async (c) => {
        const check = requireAdmin(c);
        if (check instanceof Response)
            return check;
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'workspace not resolved' }, 400);
        const tier = await getTier(c.env, workspace.id, c.req.param('name'));
        if (!tier)
            return c.json({ error: `Tier "${c.req.param('name')}" not found` }, 404);
        const body = canaryForProvider(tier.provider);
        if (body === null) {
            return c.json({
                ok: false,
                message: 'No canary available for provider "custom". Pick a provider on the tier first, ' +
                    'or test from your guest app directly.',
            }, 400);
        }
        const accountId = (await getCredential(c.env, workspace.id, 'ai_gateway_account_id'))
            ?? (await getCredential(c.env, workspace.id, 'cloudflare_account_id'));
        const gatewayName = await getCredential(c.env, workspace.id, 'ai_gateway_name');
        const cfToken = await getCredential(c.env, workspace.id, 'cloudflare_api_token');
        if (!accountId || !gatewayName || !cfToken) {
            return c.json({ ok: false, message: 'AI Gateway not configured' }, 412);
        }
        const r = await fetch(`https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayName}/${tier.gateway_route}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${cfToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
        let responseBody = null;
        try {
            responseBody = await r.json();
        }
        catch {
            try {
                responseBody = await r.text();
            }
            catch { /* ignore */ }
        }
        return c.json({
            ok: r.ok,
            status: r.status,
            provider: tier.provider,
            request_sent: body,
            response: responseBody,
        });
    });
    /**
     * R2 binding probe — surfaces "do you have R2 bound, and can the
     * Worker write to it?" for the Connections tab's asset-storage row.
     * Reuses the same writability check the setup status endpoint uses.
     */
    app.get('/_ensemble/r2/status', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ bound: false, writable: false, detail: 'No workspace' });
        if (!c.env.R2) {
            return c.json({
                bound: false,
                writable: false,
                detail: 'No R2 bucket bound. Add the binding in wrangler.toml.',
            });
        }
        try {
            const probeKey = `_ensemble/setup-probe/${workspace.id}`;
            await c.env.R2.put(probeKey, 'ok');
            await c.env.R2.delete(probeKey);
            return c.json({ bound: true, writable: true, detail: 'Bucket is writable.' });
        }
        catch (err) {
            return c.json({
                bound: true,
                writable: false,
                detail: `Bucket bound but write failed: ${String(err).slice(0, 200)}`,
            });
        }
    });
    /**
     * Surfaces the Cloudflare AI Gateway dashboard URL so the UI can deep-link
     * the operator to the page where they wire routes to models.
     */
    app.get('/_ensemble/ai/dashboard-url', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'workspace not resolved' }, 400);
        const accountId = (await getCredential(c.env, workspace.id, 'ai_gateway_account_id'))
            ?? (await getCredential(c.env, workspace.id, 'cloudflare_account_id'));
        const gatewayName = await getCredential(c.env, workspace.id, 'ai_gateway_name');
        if (!accountId || !gatewayName) {
            return c.json({ url: null });
        }
        return c.json({ url: gatewayDashboardUrl(accountId, gatewayName) });
    });
    app.post('/_ensemble/ai/tiers/:name/create-route', async (c) => {
        const check = requireAdmin(c);
        if (check instanceof Response)
            return check;
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'workspace not resolved' }, 400);
        const result = await provisionTierRoute(c.env, workspace.id, c.req.param('name'));
        return c.json(result);
    });
    // ─── AI call proxy ─────────────────────────────────────────────────
    // POST /_ensemble/ai/call/:tier
    // Forwards JSON body to https://gateway.ai.cloudflare.com/v1/<acct>/<gw>/ws/<tier>
    // with the gateway token added. Guest apps never see the token.
    // Falls back to 'good' if requested tier doesn't exist.
    app.post('/_ensemble/ai/call/:tier', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'workspace not resolved' }, 400);
        const requestedTier = c.req.param('tier');
        let tier = await getTier(c.env, workspace.id, requestedTier);
        const fallbackUsed = !tier ? requestedTier : null;
        if (!tier) {
            tier = await getTier(c.env, workspace.id, 'good');
            if (!tier)
                return c.json({ error: 'No fallback tier "good" configured' }, 412);
        }
        // Single-token model (v0.1.14): the AI call uses the same Cloudflare
        // API token configured in the Connection section. There is no
        // separate ai_gateway_token. The legacy value is lazily deleted in
        // ai-tiers.ts when first read.
        const accountId = (await getCredential(c.env, workspace.id, 'ai_gateway_account_id'))
            ?? (await getCredential(c.env, workspace.id, 'cloudflare_account_id'));
        const gatewayName = await getCredential(c.env, workspace.id, 'ai_gateway_name');
        const cfToken = await getCredential(c.env, workspace.id, 'cloudflare_api_token');
        if (!accountId || !gatewayName || !cfToken) {
            return c.json({ error: 'AI Gateway not configured' }, 412);
        }
        const body = await c.req.text();
        const r = await fetch(`https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayName}/${tier.gateway_route}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${cfToken}`,
                'Content-Type': c.req.header('Content-Type') ?? 'application/json',
            },
            body,
        });
        // If we used the fallback, surface that in a response header so the
        // guest's useAI hook can log it. Don't fail the response.
        const headers = {
            'Content-Type': r.headers.get('Content-Type') ?? 'application/json',
        };
        if (fallbackUsed)
            headers['X-Ensemble-Tier-Fallback'] = fallbackUsed;
        return new Response(r.body, { status: r.status, headers });
    });
    // ─── Setup status (for the home-page checklist) ────────────────────
    app.get('/_ensemble/setup/status', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ items: [] });
        const cfAccount = await getCredential(c.env, workspace.id, 'cloudflare_account_id');
        const cfToken = await getCredential(c.env, workspace.id, 'cloudflare_api_token');
        const emailProvider = await getCredential(c.env, workspace.id, 'email_provider');
        const emailVerified = await getCredential(c.env, workspace.id, 'email_provider_verified');
        const aiGateway = await getCredential(c.env, workspace.id, 'ai_gateway_name');
        const connectionDone = !!(cfAccount && cfToken);
        const emailDone = !!(emailProvider && emailVerified === 'verified');
        // AI is "done" when the gateway namespace is configured AND the
        // Connection token is present (single-token model — v0.1.14).
        const aiDone = !!(aiGateway && cfToken);
        // R2 writability — the binding may exist but the bucket might not be
        // configured/accessible. We check by attempting a tiny put then
        // delete. If env.R2 is missing entirely, mark pending.
        let r2Done = false;
        let r2Detail = 'No R2 bucket bound — add the binding in wrangler.toml.';
        if (c.env.R2) {
            try {
                const probeKey = `_ensemble/setup-probe/${workspace.id}`;
                await c.env.R2.put(probeKey, 'ok');
                await c.env.R2.delete(probeKey);
                r2Done = true;
                r2Detail = 'Bucket is writable.';
            }
            catch (err) {
                r2Detail = `Bucket bound but write failed: ${String(err).slice(0, 120)}`;
            }
        }
        // Favicon — checked as the brand_token `logo_favicon`. If set, done.
        let faviconDone = false;
        try {
            const row = await c.env.DB.prepare(`SELECT value FROM brand_tokens
         WHERE workspace_id = ? AND category = 'identity' AND key = 'logo_favicon' AND locale = ''`)
                .bind(workspace.id)
                .first();
            faviconDone = !!(row?.value && row.value.trim());
        }
        catch {
            // table may not exist on a very fresh workspace; treat as pending
        }
        return c.json({
            items: [
                {
                    id: 'connection',
                    title: 'Cloudflare connection',
                    description: 'Required for DNS, email sending, and AI Gateway management.',
                    status: connectionDone ? 'done' : 'pending',
                    href: '/settings#connections',
                    required: true,
                },
                {
                    id: 'r2',
                    title: 'Asset storage (R2)',
                    description: r2Detail,
                    status: r2Done ? 'done' : 'pending',
                    href: '/settings#connections',
                    required: false,
                },
                {
                    id: 'favicon',
                    title: 'Favicon',
                    description: 'Upload a favicon under Brand → Logos so the workspace shows your icon in browser tabs.',
                    status: faviconDone ? 'done' : 'pending',
                    href: '/brand#logos',
                    required: false,
                },
                {
                    id: 'email',
                    title: 'Email notifications',
                    description: 'Configure Cloudflare or Resend to send invites and enable magic-link login. ' +
                        'Without it, admins use one-time invite URLs.',
                    status: emailDone ? 'done' : 'pending',
                    href: '/settings#connections',
                    required: false,
                },
                {
                    id: 'ai',
                    title: 'AI Access',
                    description: 'Connect a Cloudflare AI Gateway namespace to enable AI features.',
                    status: aiDone ? 'done' : 'pending',
                    href: '/settings#connections',
                    required: false,
                },
            ],
        });
    });
    // ─── Auth methods (for login screen to render magic-link conditionally) ────
    app.get('/_ensemble/auth/methods', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ password: true, magic_link: false });
        const verified = await getCredential(c.env, workspace.id, 'email_provider_verified');
        return c.json({
            password: true,
            magic_link: verified === 'verified',
        });
    });
    // ─── User invite + admin reset ─────────────────────────────────────
    // Both endpoints return { url, sent_via_email } so the admin can fall
    // back to manually sharing the URL when email isn't configured.
    app.post('/_ensemble/users/invite', async (c) => {
        const check = requireAdmin(c);
        if (check instanceof Response)
            return check;
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'workspace not resolved' }, 400);
        const body = await c.req.json();
        if (!body.email)
            return c.json({ error: 'email required' }, 400);
        // Token: short-lived random string, stored in KV with expiry.
        const token = crypto.randomUUID().replace(/-/g, '');
        const key = `invite:${token}`;
        const payload = JSON.stringify({
            email: body.email,
            role: body.role ?? 'member',
            workspace_id: workspace.id,
            created_at: Date.now(),
        });
        await c.env.KV.put(key, payload, { expirationTtl: 60 * 60 * 24 * 7 }); // 7d
        const base = await getWorkspacePublicUrl(c.env, workspace.id, c.req.raw);
        const url = `${base}/auth/accept-invite?token=${token}`;
        let sent_via_email = false;
        const verified = await getCredential(c.env, workspace.id, 'email_provider_verified');
        if (verified === 'verified') {
            const inviter = c.get('user');
            const rendered = await renderInviteEmail(c.env, workspace.id, {
                url,
                inviter_name: inviter?.handle ?? inviter?.email,
                expires_in_days: 7,
            });
            const result = await sendEmail(c.env, workspace.id, {
                to: body.email,
                subject: rendered.subject,
                text: rendered.text,
                html: rendered.html,
            });
            sent_via_email = result.ok;
        }
        return c.json({ url: sent_via_email ? null : url, sent_via_email });
    });
    app.post('/_ensemble/users/:id/reset-password', async (c) => {
        const check = requireAdmin(c);
        if (check instanceof Response)
            return check;
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'workspace not resolved' }, 400);
        const userId = c.req.param('id');
        const target = await c.env.DB.prepare(`SELECT email FROM users WHERE id = ?`).bind(userId).first();
        if (!target)
            return c.json({ error: 'user not found' }, 404);
        const token = crypto.randomUUID().replace(/-/g, '');
        await c.env.KV.put(`pwreset:${token}`, JSON.stringify({
            user_id: userId,
            workspace_id: workspace.id,
            created_at: Date.now(),
        }), { expirationTtl: 60 * 60 }); // 1h
        const base = await getWorkspacePublicUrl(c.env, workspace.id, c.req.raw);
        const url = `${base}/auth/reset-password?token=${token}`;
        let sent_via_email = false;
        const verified = await getCredential(c.env, workspace.id, 'email_provider_verified');
        if (verified === 'verified') {
            const rendered = await renderPasswordResetEmail(c.env, workspace.id, {
                url,
                expires_in_minutes: 60,
            });
            const result = await sendEmail(c.env, workspace.id, {
                to: target.email,
                subject: rendered.subject,
                text: rendered.text,
                html: rendered.html,
            });
            sent_via_email = result.ok;
        }
        return c.json({ url: sent_via_email ? null : url, sent_via_email });
    });
    // ─── Workspace settings (v0.1.15) ──────────────────────────────────
    //
    // GET is open to any authenticated member (some settings, like
    // session_ttl, affect everyone). Writes require admin.
    const SETTING_KEYS = [
        'session_ttl_seconds',
        'asset_public_alias_path',
        'public_brand_guide_enabled',
    ];
    function isSettingKey(k) {
        return SETTING_KEYS.includes(k);
    }
    app.get('/_ensemble/settings/:key', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'workspace not resolved' }, 400);
        const key = c.req.param('key');
        if (!isSettingKey(key))
            return c.json({ error: `Unknown setting "${key}"` }, 404);
        const value = await getSetting(c.env, workspace.id, key);
        return c.json({ key, value });
    });
    app.get('/_ensemble/settings/session/options', async (c) => {
        // Static, but lives behind auth like the rest of the settings API.
        return c.json({ options: SESSION_TTL_OPTIONS });
    });
    app.put('/_ensemble/settings/:key', async (c) => {
        const check = requireAdmin(c);
        if (check instanceof Response)
            return check;
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'workspace not resolved' }, 400);
        const key = c.req.param('key');
        if (!isSettingKey(key))
            return c.json({ error: `Unknown setting "${key}"` }, 404);
        const body = await c.req.json();
        if (typeof body.value !== 'string') {
            return c.json({ error: 'value must be a string' }, 400);
        }
        // Per-key validation.
        if (key === 'session_ttl_seconds') {
            const n = Number(body.value);
            if (!Number.isFinite(n))
                return c.json({ error: 'session_ttl_seconds must be a number' }, 400);
            if (n < 60)
                return c.json({ error: 'session_ttl_seconds must be >= 60' }, 400);
        }
        if (key === 'public_brand_guide_enabled') {
            if (body.value !== 'true' && body.value !== 'false') {
                return c.json({ error: `${key} must be "true" or "false"` }, 400);
            }
        }
        if (key === 'asset_public_alias_path') {
            const err = validateAliasPath(body.value);
            if (err)
                return c.json({ error: err }, 400);
        }
        const user = c.get('user');
        await setSetting(c.env, workspace.id, key, body.value, user?.id);
        // Echo the parsed/clamped value back so the UI sees what we actually stored.
        const stored = key === 'session_ttl_seconds'
            ? String(parseSessionTtl(body.value))
            : body.value;
        return c.json({ key, value: stored });
    });
    // ─── Workspace locales (v0.1.15) ───────────────────────────────────
    app.get('/_ensemble/locales', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'workspace not resolved' }, 400);
        const locales = await listLocales(c.env, workspace.id);
        return c.json({ locales });
    });
    app.post('/_ensemble/locales', async (c) => {
        const check = requireAdmin(c);
        if (check instanceof Response)
            return check;
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'workspace not resolved' }, 400);
        const body = await c.req.json();
        if (!body.code || !body.display_name) {
            return c.json({ error: 'code and display_name are required' }, 400);
        }
        try {
            const locale = await addLocale(c.env, workspace.id, body);
            return c.json({ locale });
        }
        catch (err) {
            return c.json({ error: String(err) }, 400);
        }
    });
    app.patch('/_ensemble/locales/:code', async (c) => {
        const check = requireAdmin(c);
        if (check instanceof Response)
            return check;
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'workspace not resolved' }, 400);
        const code = c.req.param('code');
        const body = await c.req.json();
        try {
            if (body.make_default) {
                await setDefaultLocale(c.env, workspace.id, code);
            }
            else if (body.display_name !== undefined || body.enabled !== undefined) {
                await patchLocale(c.env, workspace.id, code, body);
            }
            return c.json({ ok: true });
        }
        catch (err) {
            return c.json({ error: String(err) }, 400);
        }
    });
    /**
     * Count how many localized brand_tokens rows exist for this locale.
     * The Languages tab uses this to drive a "you're about to delete N
     * translations" confirm before allowing removal.
     */
    app.get('/_ensemble/locales/:code/usage', async (c) => {
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'workspace not resolved' }, 400);
        const code = c.req.param('code');
        const count = await countLocalizedBrandTokens(c.env, workspace.id, code);
        return c.json({ code, brand_token_count: count });
    });
    app.delete('/_ensemble/locales/:code', async (c) => {
        const check = requireAdmin(c);
        if (check instanceof Response)
            return check;
        const workspace = c.get('workspace');
        if (!workspace?.id)
            return c.json({ error: 'workspace not resolved' }, 400);
        try {
            await removeLocale(c.env, workspace.id, c.req.param('code'));
            return c.json({ ok: true });
        }
        catch (err) {
            return c.json({ error: String(err) }, 409);
        }
    });
    return app;
}
/** Pick a stable file extension for our allowlisted upload types. */
function extensionFor(mime) {
    switch (mime) {
        case 'image/png': return '.png';
        case 'image/jpeg': return '.jpg';
        case 'image/svg+xml': return '.svg';
        case 'image/webp': return '.webp';
        case 'image/x-icon':
        case 'image/vnd.microsoft.icon':
            return '.ico';
        default: return '';
    }
}
//# sourceMappingURL=credentials.js.map