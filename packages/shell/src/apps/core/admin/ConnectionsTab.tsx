/**
 * Connections tab — configure the workspace's external service integrations.
 *
 * Three stacked sections on one page (no nested tabs):
 *   - Cloudflare connection   (account ID + ONE API token + public URL)
 *   - Email notifications     (Cloudflare or Resend)
 *   - AI Access               (gateway namespace + tiers; reuses Cloudflare token)
 *
 * v0.1.14 changes vs the original Credentials tab in Auth:
 *   - Moved from /auth#credentials to /settings#connections
 *   - Single Cloudflare token (was: separate ai_gateway_token)
 *   - Per-scope token test ("AI Gateway:Edit ✓", "DNS:Edit ✗") instead
 *     of a single ok/fail
 *   - Tier rows show last error in an info tooltip; clearer Provision flow
 *   - Toast notifications on save/test/provision actions
 */

import * as React from 'react';
import { useEffect, useState, useCallback } from 'react';
import {
  Link2, Mail, Sparkles, Plus, RefreshCw, CheckCircle2, XCircle, Info, Circle,
} from 'lucide-react';

import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
  Button, Input, Label, Badge, Separator,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Tooltip, TooltipTrigger, TooltipContent, TooltipProvider,
  toast,
} from '@ensemble-edge/ui';

interface CredentialSummary {
  key: string;
  category: string;
  is_secret: boolean;
  set: boolean;
  value: string | null;
  updated_at: string;
}

interface AiTier {
  name: string;
  display_name: string;
  description: string | null;
  icon: string;
  is_default: boolean;
  gateway_route: string;
  route_provisioned: boolean;
  last_error: string | null;
}

interface ScopeResult {
  name: string;
  ok: boolean;
  detail: string;
}

/**
 * The scopes the workspace needs to execute all admin tasks. Always
 * shown in the Connection card as a checklist so operators can see what
 * the token must allow before they generate it.
 */
const REQUIRED_SCOPES: Array<{ name: string; purpose: string }> = [
  { name: 'Zone DNS:Edit', purpose: 'Sending-domain DNS records (TXT/CNAME)' },
  { name: 'Email Routing Addresses:Edit', purpose: 'Inbound + Cloudflare-provider sends' },
  { name: 'AI Gateway:Edit', purpose: 'Provisioning AI tier routes' },
];

export function ConnectionsTab() {
  const [creds, setCreds] = useState<Record<string, CredentialSummary>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/_ensemble/credentials');
    const body = (await r.json()) as { items: CredentialSummary[] };
    const map: Record<string, CredentialSummary> = {};
    for (const item of body.items) map[item.key] = item;
    setCreds(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <TooltipProvider>
      <div className="space-y-6 max-w-3xl">
        <ConnectionCard creds={creds} onSaved={refresh} />
        <NotificationsCard creds={creds} onSaved={refresh} />
        <AiAccessCard creds={creds} onSaved={refresh} />
      </div>
    </TooltipProvider>
  );
}

// ─── Connection ───────────────────────────────────────────────────────

function ConnectionCard({
  creds,
  onSaved,
}: {
  creds: Record<string, CredentialSummary>;
  onSaved: () => void;
}) {
  const accountId = creds['cloudflare_account_id']?.value ?? '';
  const tokenSet = creds['cloudflare_api_token']?.set ?? false;
  const publicUrl = creds['workspace_public_url']?.value ?? '';
  const status: 'done' | 'pending' = accountId && tokenSet ? 'done' : 'pending';

  const [editing, setEditing] = useState(!accountId || !tokenSet);
  const [editAccountId, setEditAccountId] = useState(accountId);
  const [editToken, setEditToken] = useState('');
  const [editPublicUrl, setEditPublicUrl] = useState(
    publicUrl || (typeof window !== 'undefined' ? window.location.origin : ''),
  );
  const [testing, setTesting] = useState(false);
  const [scopes, setScopes] = useState<ScopeResult[] | null>(() => {
    // Bootstrap from the last test result stored on the workspace, so the
    // checklist shows the operator their current token state without a
    // re-test on every page load. Empty/missing → null (gray "unknown").
    const cached = creds['cf_token_scope_status']?.value;
    if (!cached) return null;
    try {
      return JSON.parse(cached) as ScopeResult[];
    } catch {
      return null;
    }
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      if (editAccountId !== accountId) {
        await putCred('cloudflare_account_id', 'connection', editAccountId, false);
      }
      if (editToken && editToken.trim()) {
        await putCred('cloudflare_api_token', 'connection', editToken.trim(), true);
      }
      if (editPublicUrl !== publicUrl) {
        await putCred('workspace_public_url', 'connection', editPublicUrl, false);
      }
      toast.success('Connection saved');
      onSaved();
      setEditing(false);
      setEditToken('');
    } catch (e) {
      toast.error('Failed to save', { description: errMsg(e) });
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    setTesting(true);
    try {
      const r = await fetch('/_ensemble/credentials/test/connection', { method: 'POST' });
      const body = (await r.json()) as { scopes?: ScopeResult[]; error?: string };
      if (!r.ok) {
        toast.error('Token test failed', { description: body.error ?? `HTTP ${r.status}` });
        return;
      }
      setScopes(body.scopes ?? []);
      onSaved(); // refresh creds so the cached scope_status reflects this run
      const allOk = (body.scopes ?? []).every((s) => s.ok);
      if (allOk) toast.success('All scopes verified');
      else toast.warning('Some scopes missing — see the checklist below');
    } catch (e) {
      toast.error('Test failed', { description: errMsg(e) });
    } finally {
      setTesting(false);
    }
  }

  // Always-visible scope checklist: merge the required scopes against the
  // last-tested result (if any). Untested scopes render as "unknown."
  const scopeMap = new Map((scopes ?? []).map((s) => [s.name, s] as const));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" /> Cloudflare connection
            </CardTitle>
            <CardDescription>
              One API token powers DNS, email verification, and AI Gateway management.
            </CardDescription>
          </div>
          <StatusBadge status={status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {editing ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="cf-account">Cloudflare Account ID</Label>
              <Input
                id="cf-account"
                value={editAccountId}
                onChange={(e) => setEditAccountId(e.target.value)}
                placeholder="e.g. 0123abcdef..."
              />
              <p className="text-xs text-muted-foreground">
                Find this in your Cloudflare dashboard URL after the slash.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-token">Cloudflare API token</Label>
              {tokenSet && !editToken ? (
                <div className="flex items-center gap-2">
                  <Badge>Set</Badge>
                  <Button variant="outline" size="sm" onClick={() => setEditToken(' ')}>
                    Replace
                  </Button>
                </div>
              ) : (
                <Input
                  id="cf-token"
                  type="password"
                  value={editToken.trim()}
                  onChange={(e) => setEditToken(e.target.value)}
                  placeholder="Paste new token"
                />
              )}
              <p className="text-xs text-muted-foreground">
                Create at{' '}
                <a
                  className="underline"
                  target="_blank"
                  rel="noreferrer noopener"
                  href="https://dash.cloudflare.com/profile/api-tokens"
                >
                  dash.cloudflare.com/profile/api-tokens
                </a>
                . The checklist below shows the scopes the token must include.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="public-url">Workspace public URL</Label>
              <Input
                id="public-url"
                value={editPublicUrl}
                onChange={(e) => setEditPublicUrl(e.target.value)}
                placeholder="https://workspace.example.com"
              />
              <p className="text-xs text-muted-foreground">
                Used as the base URL for invite/reset/magic-link emails.
              </p>
            </div>
          </>
        ) : (
          <>
            <Row label="Account ID" value={accountId} />
            <Row label="API Token" value={tokenSet ? '••••••• (Set)' : '(not set)'} />
            <Row label="Public URL" value={publicUrl || '(not set)'} />
          </>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Required token scopes</p>
            {scopes === null && (
              <span className="text-xs text-muted-foreground">
                Click <strong>Test token</strong> to check
              </span>
            )}
          </div>
          <div className="rounded-md border divide-y">
            {REQUIRED_SCOPES.map((req) => {
              const result = scopeMap.get(req.name);
              return (
                <div key={req.name} className="flex items-start gap-3 p-3 text-sm">
                  <div className="mt-0.5 shrink-0">
                    {!result ? (
                      <Circle className="h-4 w-4 text-muted-foreground" aria-label="Not tested" />
                    ) : result.ok ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" aria-label="OK" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" aria-label="Missing" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono">{req.name}</p>
                    <p className="text-xs text-muted-foreground">{req.purpose}</p>
                    {result && !result.ok && result.detail && (
                      <p className="text-xs text-destructive mt-1">{result.detail}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        {editing ? (
          <>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setEditing(false);
                setEditToken('');
              }}
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={runTest} disabled={testing || !tokenSet}>
              {testing ? 'Testing…' : 'Test token'}
            </Button>
            <Button onClick={() => setEditing(true)}>Edit</Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}

// ─── Notifications (Email) ────────────────────────────────────────────

function NotificationsCard({
  creds,
  onSaved,
}: {
  creds: Record<string, CredentialSummary>;
  onSaved: () => void;
}) {
  const provider = creds['email_provider']?.value ?? '';
  const domain = creds['email_sending_domain']?.value ?? '';
  const fromAddr = creds['email_from_address']?.value ?? '';
  const verifyStatus = creds['email_provider_verified']?.value ?? '';
  const resendKeySet = creds['email_resend_api_key']?.set ?? false;

  const status: 'done' | 'pending' =
    provider && verifyStatus === 'verified' ? 'done' : 'pending';

  const [editing, setEditing] = useState(!provider);
  const [editProvider, setEditProvider] = useState(provider || 'cloudflare');
  const [editDomain, setEditDomain] = useState(domain);
  const [editFrom, setEditFrom] = useState(fromAddr);
  const [editResendKey, setEditResendKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);

  async function save() {
    setSaving(true);
    try {
      if (editProvider !== provider) {
        await putCred('email_provider', 'notifications', editProvider, false);
      }
      if (editDomain !== domain) {
        await putCred('email_sending_domain', 'notifications', editDomain, false);
      }
      if (editFrom !== fromAddr) {
        await putCred('email_from_address', 'notifications', editFrom, false);
      }
      if (editProvider === 'resend' && editResendKey) {
        await putCred(
          'email_resend_api_key',
          'notifications',
          editResendKey.trim(),
          true,
        );
      }
      toast.success('Notifications saved');
      onSaved();
      setEditing(false);
      setEditResendKey('');
    } catch (e) {
      toast.error('Failed to save', { description: errMsg(e) });
    } finally {
      setSaving(false);
    }
  }

  async function runVerify() {
    setVerifying(true);
    try {
      const r = await fetch('/_ensemble/credentials/test/email', { method: 'POST' });
      const body = (await r.json()) as { ok: boolean; status?: string; message?: string };
      if (r.ok && body.ok) toast.success('Domain verified');
      else toast.error('Verification failed', { description: body.message ?? body.status });
      onSaved();
    } catch (e) {
      toast.error('Verification failed', { description: errMsg(e) });
    } finally {
      setVerifying(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" /> Email notifications
            </CardTitle>
            <CardDescription>
              Sending domain + provider for invites, password resets, and magic links.
              Magic-link login becomes available once the domain is verified.
            </CardDescription>
          </div>
          <StatusBadge status={status} optional />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {editing ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="provider">Email provider</Label>
              <Select value={editProvider} onValueChange={setEditProvider}>
                <SelectTrigger id="provider">
                  <SelectValue placeholder="Choose a provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cloudflare">Cloudflare Email Workers</SelectItem>
                  <SelectItem value="resend">Resend</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sending-domain">Sending domain</Label>
              <Input
                id="sending-domain"
                value={editDomain}
                onChange={(e) => setEditDomain(e.target.value)}
                placeholder="mail.example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="from-addr">From address</Label>
              <Input
                id="from-addr"
                value={editFrom}
                onChange={(e) => setEditFrom(e.target.value)}
                placeholder="workspace@mail.example.com"
              />
            </div>
            {editProvider === 'resend' && (
              <div className="space-y-1.5">
                <Label htmlFor="resend-key">Resend API key</Label>
                {resendKeySet && !editResendKey ? (
                  <div className="flex items-center gap-2">
                    <Badge>Set</Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditResendKey(' ')}
                    >
                      Replace
                    </Button>
                  </div>
                ) : (
                  <Input
                    id="resend-key"
                    type="password"
                    value={editResendKey.trim()}
                    onChange={(e) => setEditResendKey(e.target.value)}
                    placeholder="re_..."
                  />
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <Row label="Provider" value={provider || '(not set)'} />
            <Row label="Sending domain" value={domain || '(not set)'} />
            <Row label="From address" value={fromAddr || '(not set)'} />
            <Row label="Verification" value={verifyStatus || '(not run)'} />
            {provider === 'resend' && (
              <Row
                label="Resend API key"
                value={resendKeySet ? '••••••• (Set)' : '(not set)'}
              />
            )}
          </>
        )}
      </CardContent>
      <CardFooter className="gap-2">
        {editing ? (
          <>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setEditing(false);
                setEditResendKey('');
              }}
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={runVerify} disabled={verifying || !provider}>
              {verifying ? 'Verifying…' : 'Verify domain'}
            </Button>
            <Button onClick={() => setEditing(true)}>Edit</Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}

// ─── AI Access ────────────────────────────────────────────────────────

function AiAccessCard({
  creds,
  onSaved,
}: {
  creds: Record<string, CredentialSummary>;
  onSaved: () => void;
}) {
  const gatewayName = creds['ai_gateway_name']?.value ?? '';
  const cfTokenSet = creds['cloudflare_api_token']?.set ?? false;
  const cfAccountId = creds['cloudflare_account_id']?.value ?? '';
  const accountOverride = creds['ai_gateway_account_id']?.value ?? '';

  const connectionReady = !!(cfTokenSet && cfAccountId);
  const status: 'done' | 'pending' = gatewayName && connectionReady ? 'done' : 'pending';

  const [editing, setEditing] = useState(!gatewayName);
  const [editGateway, setEditGateway] = useState(gatewayName);
  const [editAccountOverride, setEditAccountOverride] = useState(accountOverride);
  const [saving, setSaving] = useState(false);

  const [tiers, setTiers] = useState<AiTier[]>([]);
  const refreshTiers = useCallback(async () => {
    const r = await fetch('/_ensemble/ai/tiers');
    if (r.ok) {
      const body = (await r.json()) as { tiers: AiTier[] };
      setTiers(body.tiers);
    }
  }, []);
  useEffect(() => {
    if (status === 'done') refreshTiers();
  }, [status, refreshTiers]);

  async function save() {
    setSaving(true);
    try {
      if (editGateway !== gatewayName) {
        await putCred('ai_gateway_name', 'ai', editGateway, false);
      }
      if (editAccountOverride !== accountOverride) {
        await putCred('ai_gateway_account_id', 'ai', editAccountOverride, false);
      }
      toast.success('AI Access saved');
      onSaved();
      setEditing(false);
      setTimeout(refreshTiers, 200);
    } catch (e) {
      toast.error('Failed to save', { description: errMsg(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" /> AI Access
            </CardTitle>
            <CardDescription>
              Connect a Cloudflare AI Gateway namespace. Tiers below map to dynamic routes
              in that namespace — point each to a model in the Cloudflare dashboard.
            </CardDescription>
          </div>
          <StatusBadge status={status} optional />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!connectionReady && (
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            Set up the <strong>Cloudflare connection</strong> above first — AI Access uses
            the same API token (it must include <span className="font-mono">AI Gateway:Edit</span>).
          </div>
        )}

        {editing ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="gw-name">Gateway namespace</Label>
              <Input
                id="gw-name"
                value={editGateway}
                onChange={(e) => setEditGateway(e.target.value)}
                placeholder="my-gateway"
              />
              <p className="text-xs text-muted-foreground">
                The slug of your AI Gateway namespace in the Cloudflare dashboard.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acct-override">Account ID override (optional)</Label>
              <Input
                id="acct-override"
                value={editAccountOverride}
                onChange={(e) => setEditAccountOverride(e.target.value)}
                placeholder="Defaults to Connection account ID"
              />
              <p className="text-xs text-muted-foreground">
                Only set this if your AI Gateway lives in a different Cloudflare account
                than the one used for DNS/email.
              </p>
            </div>
          </>
        ) : (
          <>
            <Row label="Gateway namespace" value={gatewayName || '(not set)'} />
            <Row
              label="Account override"
              value={accountOverride || 'Uses Connection account ID'}
            />

            {status === 'done' && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Tiers</h3>
                  <CreateTierButton onCreated={refreshTiers} />
                </div>
                <div className="space-y-2">
                  {tiers.map((t) => (
                    <TierRow key={t.name} tier={t} onChanged={refreshTiers} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
      <CardFooter className="gap-2">
        {editing ? (
          <>
            <Button onClick={save} disabled={saving || !connectionReady}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <Button onClick={() => setEditing(true)} disabled={!connectionReady}>
            Edit
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

function TierRow({ tier, onChanged }: { tier: AiTier; onChanged: () => void }) {
  const [renaming, setRenaming] = useState(false);
  const [editName, setEditName] = useState(tier.display_name);
  const [busy, setBusy] = useState(false);

  async function saveRename() {
    setBusy(true);
    try {
      const r = await fetch(`/_ensemble/ai/tiers/${tier.name}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: editName }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      toast.success('Tier renamed');
      setRenaming(false);
      onChanged();
    } catch (e) {
      toast.error('Rename failed', { description: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  async function provision() {
    setBusy(true);
    try {
      const r = await fetch(`/_ensemble/ai/tiers/${tier.name}/create-route`, {
        method: 'POST',
      });
      const body = (await r.json()) as { ok?: boolean; error?: string };
      if (r.ok && body.ok) {
        toast.success(`Route ${tier.gateway_route} provisioned`);
      } else {
        toast.error('Provisioning failed', {
          description:
            body.error ?? 'See the info icon next to the tier for details.',
        });
      }
      onChanged();
    } catch (e) {
      toast.error('Provisioning failed', { description: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  async function removeTier() {
    if (
      !confirm(
        `Remove "${tier.display_name}" from this workspace? The route "${tier.gateway_route}" stays in your Cloudflare gateway; delete it manually there if no longer needed.`,
      )
    )
      return;
    setBusy(true);
    try {
      const r = await fetch(`/_ensemble/ai/tiers/${tier.name}`, { method: 'DELETE' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      toast.success(`Removed ${tier.display_name}`);
      onChanged();
    } catch (e) {
      toast.error('Remove failed', { description: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {renaming ? (
            <>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="max-w-xs"
              />
              <Button size="sm" onClick={saveRename} disabled={busy}>
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => setRenaming(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <span className="font-medium">{tier.display_name}</span>
              <span className="text-xs text-muted-foreground">
                ({tier.name} → {tier.gateway_route})
              </span>
              {tier.is_default && <Badge variant="outline">Default</Badge>}
              {!tier.route_provisioned && (
                <ProvisionFailureBadge lastError={tier.last_error} />
              )}
            </>
          )}
        </div>
        {tier.description && !renaming && (
          <p className="text-sm text-muted-foreground mt-1">{tier.description}</p>
        )}
      </div>
      {!renaming && (
        <div className="flex items-center gap-2">
          {!tier.route_provisioned && (
            <Button size="sm" variant="outline" onClick={provision} disabled={busy}>
              <RefreshCw className={`h-3 w-3 mr-1 ${busy ? 'animate-spin' : ''}`} />
              Provision
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditName(tier.display_name);
              setRenaming(true);
            }}
          >
            Rename
          </Button>
          {!tier.is_default && (
            <Button size="sm" variant="outline" onClick={removeTier} disabled={busy}>
              Remove
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function ProvisionFailureBadge({ lastError }: { lastError: string | null }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">
          <Info className="h-3 w-3" />
          Not provisioned
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm">
        <div className="space-y-2 text-xs">
          <p className="font-medium">This tier hasn&apos;t been created in your AI Gateway yet.</p>
          {lastError ? (
            <p className="text-muted-foreground font-mono break-all">{lastError}</p>
          ) : (
            <p className="text-muted-foreground">Click <strong>Provision</strong> to try now.</p>
          )}
          <p>
            Common causes: the Cloudflare API token is missing <span className="font-mono">AI Gateway:Edit</span>,
            or the gateway namespace name above doesn&apos;t exist in your account.
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function CreateTierButton({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name) return;
    setBusy(true);
    try {
      const r = await fetch('/_ensemble/ai/tiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      toast.success(`Tier "${name}" created`);
      setName('');
      setOpen(false);
      onCreated();
    } catch (e) {
      toast.error('Failed to create tier', { description: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="h-3 w-3 mr-1" /> Add tier
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="tier-name"
        className="max-w-xs h-8"
      />
      <Button size="sm" onClick={submit} disabled={busy || !name}>
        Create
      </Button>
      <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-mono">{value}</span>
    </div>
  );
}

function StatusBadge({
  status,
  optional,
}: {
  status: 'done' | 'pending';
  optional?: boolean;
}) {
  if (status === 'done')
    return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Done</Badge>;
  if (optional) return <Badge variant="outline">Optional</Badge>;
  return <Badge variant="outline">Pending</Badge>;
}

async function putCred(
  key: string,
  category: string,
  value: string,
  is_secret: boolean,
) {
  const r = await fetch(`/_ensemble/credentials/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value, category, is_secret }),
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${r.status}`);
  }
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
