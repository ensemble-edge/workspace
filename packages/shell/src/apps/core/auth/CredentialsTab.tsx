/**
 * Credentials tab — configure Connection, Notifications, and AI Access.
 * All UI built from @ensemble-edge/ui primitives.
 *
 * Per-card pattern:
 *   - Status badge (Done / Pending / Optional) in the header
 *   - Editable fields; secrets show "Set" + Replace pattern
 *   - Test button calls the corresponding /_ensemble/credentials/test/* route
 *   - Save persists via PUT /_ensemble/credentials/:key
 */

import * as React from 'react';
import { useEffect, useState, useCallback } from 'react';
import { Link2, Mail, Sparkles, Plus, RefreshCw, AlertCircle } from 'lucide-react';

import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
  Button, Input, Label, Badge, Separator,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Alert, AlertTitle, AlertDescription,
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
}

export function CredentialsTab() {
  const [creds, setCreds] = useState<Record<string, CredentialSummary>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/_ensemble/credentials');
    const body = await r.json() as { items: CredentialSummary[] };
    const map: Record<string, CredentialSummary> = {};
    for (const item of body.items) map[item.key] = item;
    setCreds(map);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  if (loading) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <ConnectionCard creds={creds} onSaved={refresh} />
      <NotificationsCard creds={creds} onSaved={refresh} />
      <AiAccessCard creds={creds} onSaved={refresh} />
    </div>
  );
}

// ─── Connection ───────────────────────────────────────────────────────

function ConnectionCard({ creds, onSaved }: { creds: Record<string, CredentialSummary>; onSaved: () => void }) {
  const accountId = creds['cloudflare_account_id']?.value ?? '';
  const tokenSet = creds['cloudflare_api_token']?.set ?? false;
  const publicUrl = creds['workspace_public_url']?.value ?? '';
  const status: 'done' | 'pending' = accountId && tokenSet ? 'done' : 'pending';

  const [editing, setEditing] = useState(!status || !accountId);
  const [editAccountId, setEditAccountId] = useState(accountId);
  const [editToken, setEditToken] = useState('');
  const [editPublicUrl, setEditPublicUrl] = useState(publicUrl || (typeof window !== 'undefined' ? window.location.origin : ''));
  const [testResult, setTestResult] = useState<{ ok: boolean; message?: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      if (editAccountId !== accountId) {
        await putCred('cloudflare_account_id', 'connection', editAccountId, false);
      }
      if (editToken) {
        await putCred('cloudflare_api_token', 'connection', editToken, true);
      }
      if (editPublicUrl !== publicUrl) {
        await putCred('workspace_public_url', 'connection', editPublicUrl, false);
      }
      onSaved();
      setEditing(false);
      setEditToken('');
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    setTestResult(null);
    const r = await fetch('/_ensemble/credentials/test/connection', { method: 'POST' });
    setTestResult(await r.json());
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2"><Link2 className="h-5 w-5" /> Connection (Cloudflare)</CardTitle>
            <CardDescription>
              Account ID and API token used for DNS, email verification, and AI Gateway management.
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
              <Input id="cf-account" value={editAccountId} onChange={(e) => setEditAccountId(e.target.value)} placeholder="e.g. 0123abcdef..." />
              <p className="text-xs text-muted-foreground">Find this in your Cloudflare dashboard URL after the slash.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-token">Cloudflare API Token</Label>
              {tokenSet && !editToken ? (
                <div className="flex items-center gap-2">
                  <Badge>Set</Badge>
                  <Button variant="outline" size="sm" onClick={() => setEditToken(' ')}>Replace</Button>
                </div>
              ) : (
                <Input id="cf-token" type="password" value={editToken.trim()} onChange={(e) => setEditToken(e.target.value)} placeholder="Paste new token" />
              )}
              <p className="text-xs text-muted-foreground">
                Create a scoped token at <a className="underline" target="_blank" rel="noreferrer noopener" href="https://dash.cloudflare.com/profile/api-tokens">dash.cloudflare.com/profile/api-tokens</a> with permissions: Zone DNS:Edit, AI Gateway:Edit, Email Routing:Edit.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="public-url">Workspace public URL</Label>
              <Input id="public-url" value={editPublicUrl} onChange={(e) => setEditPublicUrl(e.target.value)} placeholder="https://workspace.example.com" />
              <p className="text-xs text-muted-foreground">Used as the base URL for invite/reset/magic-link emails.</p>
            </div>
          </>
        ) : (
          <>
            <Row label="Account ID" value={accountId} />
            <Row label="API Token" value={tokenSet ? '••••••• (Set)' : '(not set)'} />
            <Row label="Public URL" value={publicUrl || '(not set)'} />
          </>
        )}

        {testResult && (
          <Alert variant={testResult.ok ? 'default' : 'destructive'}>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{testResult.ok ? 'Connected' : 'Failed'}</AlertTitle>
            {testResult.message && <AlertDescription>{testResult.message}</AlertDescription>}
          </Alert>
        )}
      </CardContent>
      <CardFooter className="gap-2">
        {editing ? (
          <>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            <Button variant="outline" onClick={() => { setEditing(false); setEditToken(''); }}>Cancel</Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={runTest}>Test connection</Button>
            <Button onClick={() => setEditing(true)}>Edit</Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}

// ─── Notifications (Email) ────────────────────────────────────────────

function NotificationsCard({ creds, onSaved }: { creds: Record<string, CredentialSummary>; onSaved: () => void }) {
  const provider = creds['email_provider']?.value ?? '';
  const domain = creds['email_sending_domain']?.value ?? '';
  const fromAddr = creds['email_from_address']?.value ?? '';
  const verifyStatus = creds['email_provider_verified']?.value ?? '';
  const resendKeySet = creds['email_resend_api_key']?.set ?? false;

  const status: 'done' | 'pending' = (provider && verifyStatus === 'verified') ? 'done' : 'pending';

  const [editing, setEditing] = useState(!provider);
  const [editProvider, setEditProvider] = useState(provider || 'cloudflare');
  const [editDomain, setEditDomain] = useState(domain);
  const [editFrom, setEditFrom] = useState(fromAddr);
  const [editResendKey, setEditResendKey] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      if (editProvider !== provider) await putCred('email_provider', 'notifications', editProvider, false);
      if (editDomain !== domain) await putCred('email_sending_domain', 'notifications', editDomain, false);
      if (editFrom !== fromAddr) await putCred('email_from_address', 'notifications', editFrom, false);
      if (editProvider === 'resend' && editResendKey) {
        await putCred('email_resend_api_key', 'notifications', editResendKey, true);
      }
      onSaved();
      setEditing(false);
      setEditResendKey('');
    } finally {
      setSaving(false);
    }
  }

  async function runVerify() {
    await fetch('/_ensemble/credentials/test/email', { method: 'POST' });
    onSaved();
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> Notifications (Email)</CardTitle>
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
                <SelectTrigger id="provider"><SelectValue placeholder="Choose a provider" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cloudflare">Cloudflare Email Workers</SelectItem>
                  <SelectItem value="resend">Resend</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sending-domain">Sending domain</Label>
              <Input id="sending-domain" value={editDomain} onChange={(e) => setEditDomain(e.target.value)} placeholder="mail.example.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="from-addr">From address</Label>
              <Input id="from-addr" value={editFrom} onChange={(e) => setEditFrom(e.target.value)} placeholder="workspace@mail.example.com" />
            </div>
            {editProvider === 'resend' && (
              <div className="space-y-1.5">
                <Label htmlFor="resend-key">Resend API key</Label>
                {resendKeySet && !editResendKey ? (
                  <div className="flex items-center gap-2">
                    <Badge>Set</Badge>
                    <Button variant="outline" size="sm" onClick={() => setEditResendKey(' ')}>Replace</Button>
                  </div>
                ) : (
                  <Input id="resend-key" type="password" value={editResendKey.trim()} onChange={(e) => setEditResendKey(e.target.value)} placeholder="re_..." />
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
            {provider === 'resend' && <Row label="Resend API key" value={resendKeySet ? '••••••• (Set)' : '(not set)'} />}
          </>
        )}
      </CardContent>
      <CardFooter className="gap-2">
        {editing ? (
          <>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            <Button variant="outline" onClick={() => { setEditing(false); setEditResendKey(''); }}>Cancel</Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={runVerify}>Verify domain</Button>
            <Button onClick={() => setEditing(true)}>Edit</Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}

// ─── AI Access ────────────────────────────────────────────────────────

function AiAccessCard({ creds, onSaved }: { creds: Record<string, CredentialSummary>; onSaved: () => void }) {
  const gatewayName = creds['ai_gateway_name']?.value ?? '';
  const tokenSet = creds['ai_gateway_token']?.set ?? false;
  const accountOverride = creds['ai_gateway_account_id']?.value ?? '';
  const status: 'done' | 'pending' = (gatewayName && tokenSet) ? 'done' : 'pending';

  const [editing, setEditing] = useState(!gatewayName);
  const [editGateway, setEditGateway] = useState(gatewayName);
  const [editToken, setEditToken] = useState('');
  const [editAccountOverride, setEditAccountOverride] = useState(accountOverride);
  const [saving, setSaving] = useState(false);

  const [tiers, setTiers] = useState<AiTier[]>([]);
  const refreshTiers = useCallback(async () => {
    const r = await fetch('/_ensemble/ai/tiers');
    if (r.ok) {
      const body = await r.json() as { tiers: AiTier[] };
      setTiers(body.tiers);
    }
  }, []);
  useEffect(() => { if (status === 'done') refreshTiers(); }, [status, refreshTiers]);

  async function save() {
    setSaving(true);
    try {
      if (editGateway !== gatewayName) await putCred('ai_gateway_name', 'ai', editGateway, false);
      if (editToken) await putCred('ai_gateway_token', 'ai', editToken, true);
      if (editAccountOverride !== accountOverride) await putCred('ai_gateway_account_id', 'ai', editAccountOverride, false);
      onSaved();
      setEditing(false);
      setEditToken('');
      // After saving, refresh tiers (server seeds defaults on save).
      setTimeout(refreshTiers, 200);
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    const r = await fetch('/_ensemble/credentials/test/ai', { method: 'POST' });
    const result = await r.json() as { ok: boolean; message?: string };
    alert(result.ok ? 'AI Gateway reachable.' : `Failed: ${result.message ?? ''}`);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" /> AI Access</CardTitle>
            <CardDescription>
              Connect a Cloudflare AI Gateway. Tiers below map to dynamic routes managed in the gateway.
              Map each tier to a model in the Cloudflare dashboard.
            </CardDescription>
          </div>
          <StatusBadge status={status} optional />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {editing ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="gw-name">Gateway name</Label>
              <Input id="gw-name" value={editGateway} onChange={(e) => setEditGateway(e.target.value)} placeholder="my-gateway" />
              <p className="text-xs text-muted-foreground">The slug of your gateway in the Cloudflare AI Gateway dashboard.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gw-token">Gateway token</Label>
              {tokenSet && !editToken ? (
                <div className="flex items-center gap-2">
                  <Badge>Set</Badge>
                  <Button variant="outline" size="sm" onClick={() => setEditToken(' ')}>Replace</Button>
                </div>
              ) : (
                <Input id="gw-token" type="password" value={editToken.trim()} onChange={(e) => setEditToken(e.target.value)} placeholder="Paste gateway token" />
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acct-override">Account ID override (optional)</Label>
              <Input id="acct-override" value={editAccountOverride} onChange={(e) => setEditAccountOverride(e.target.value)} placeholder="Defaults to Connection's account ID" />
            </div>
          </>
        ) : (
          <>
            <Row label="Gateway name" value={gatewayName || '(not set)'} />
            <Row label="Token" value={tokenSet ? '••••••• (Set)' : '(not set)'} />
            <Row label="Account override" value={accountOverride || 'Uses Connection account ID'} />

            {status === 'done' && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Tiers</h3>
                  <CreateTierButton onCreated={refreshTiers} />
                </div>
                <div className="space-y-2">
                  {tiers.map((t) => <TierRow key={t.name} tier={t} onChanged={refreshTiers} />)}
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
      <CardFooter className="gap-2">
        {editing ? (
          <>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            <Button variant="outline" onClick={() => { setEditing(false); setEditToken(''); }}>Cancel</Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={runTest}>Test connection</Button>
            <Button onClick={() => setEditing(true)}>Edit</Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}

function TierRow({ tier, onChanged }: { tier: AiTier; onChanged: () => void }) {
  const [renaming, setRenaming] = useState(false);
  const [editName, setEditName] = useState(tier.display_name);

  async function saveRename() {
    await fetch(`/_ensemble/ai/tiers/${tier.name}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: editName }),
    });
    setRenaming(false);
    onChanged();
  }

  async function retryProvision() {
    await fetch(`/_ensemble/ai/tiers/${tier.name}/create-route`, { method: 'POST' });
    onChanged();
  }

  async function removeTier() {
    if (!confirm(`Remove "${tier.display_name}" from workspace? The route "${tier.gateway_route}" stays in the gateway; delete it manually in Cloudflare if no longer needed.`)) return;
    await fetch(`/_ensemble/ai/tiers/${tier.name}`, { method: 'DELETE' });
    onChanged();
  }

  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          {renaming ? (
            <>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="max-w-xs" />
              <Button size="sm" onClick={saveRename}>Save</Button>
              <Button size="sm" variant="outline" onClick={() => setRenaming(false)}>Cancel</Button>
            </>
          ) : (
            <>
              <span className="font-medium">{tier.display_name}</span>
              <span className="text-xs text-muted-foreground">({tier.name} → {tier.gateway_route})</span>
              {tier.is_default && <Badge variant="outline">Default</Badge>}
              {!tier.route_provisioned && <Badge variant="destructive">Route not provisioned</Badge>}
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
            <Button size="sm" variant="outline" onClick={retryProvision}>
              <RefreshCw className="h-3 w-3 mr-1" /> Retry
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => { setEditName(tier.display_name); setRenaming(true); }}>Rename</Button>
          {!tier.is_default && (
            <Button size="sm" variant="outline" onClick={removeTier}>Remove</Button>
          )}
        </div>
      )}
    </div>
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
      await fetch('/_ensemble/ai/tiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      setName('');
      setOpen(false);
      onCreated();
    } finally { setBusy(false); }
  }
  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus className="h-3 w-3 mr-1" /> Add tier</Button>;
  return (
    <div className="flex items-center gap-2">
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="tier-name" className="max-w-xs h-8" />
      <Button size="sm" onClick={submit} disabled={busy || !name}>Create</Button>
      <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
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

function StatusBadge({ status, optional }: { status: 'done' | 'pending'; optional?: boolean }) {
  if (status === 'done') return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Done</Badge>;
  if (optional) return <Badge variant="outline">Optional</Badge>;
  return <Badge variant="outline">Pending</Badge>;
}

async function putCred(key: string, category: string, value: string, is_secret: boolean) {
  await fetch(`/_ensemble/credentials/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value, category, is_secret }),
  });
}
