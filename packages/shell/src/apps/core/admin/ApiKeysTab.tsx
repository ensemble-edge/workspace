/**
 * Settings → API tab.
 *
 * Operator-issued API keys for programmatic access to the workspace's
 * /_ensemble/* HTTP surface. Plaintext is shown ONCE at creation
 * via a confirmation dialog ("Save this key now — you won't see it
 * again"). Revocation is immediate. Regenerate creates a new key
 * with the same name + revokes the old one in a single step.
 */

import * as React from 'react';
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
  Button,
  Badge,
  Input,
  Label,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
  toast,
} from '@ensemble-edge/ui';
import { authedFetch } from '../../../state';
import { Copy, KeyRound, RefreshCw, Trash2 } from 'lucide-react';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function ApiKeysTab() {
  const [keys, setKeys] = React.useState<ApiKey[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [newKeyPlaintext, setNewKeyPlaintext] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function reload() {
    setLoading(true);
    try {
      const r = await authedFetch('/_ensemble/api-keys');
      if (r.ok) {
        const body = await r.json() as { keys: ApiKey[] };
        setKeys(body.keys ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { reload(); }, []);

  async function createKey(name: string) {
    setBusy(true);
    try {
      const r = await authedFetch('/_ensemble/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const body = await r.json() as { key?: ApiKey; plaintext?: string; error?: string };
      if (!r.ok || !body.plaintext) {
        toast.error('Failed to create key', { description: body.error ?? `HTTP ${r.status}` });
        return;
      }
      setNewKeyPlaintext(body.plaintext);
      setCreateOpen(false);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    const r = await authedFetch(`/_ensemble/api-keys/${id}/revoke`, { method: 'POST' });
    if (r.ok) {
      toast.success('Key revoked');
      await reload();
    } else {
      const body = await r.json().catch(() => ({})) as { error?: string };
      toast.error('Revoke failed', { description: body.error });
    }
  }

  async function regenerate(id: string) {
    const r = await authedFetch(`/_ensemble/api-keys/${id}/regenerate`, { method: 'POST' });
    const body = await r.json().catch(() => ({})) as { plaintext?: string; error?: string };
    if (r.ok && body.plaintext) {
      setNewKeyPlaintext(body.plaintext);
      await reload();
    } else {
      toast.error('Regenerate failed', { description: body.error });
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>
                Programmatic access to this workspace's HTTP API. Each key
                grants the same permissions as its creator. Send as
                <code className="ml-1 px-1.5 py-0.5 text-xs bg-muted rounded font-mono">
                  Authorization: Bearer wks_...
                </code>
              </CardDescription>
            </div>
            <Button onClick={() => setCreateOpen(true)}>
              <KeyRound className="mr-2 h-4 w-4" /> Create key
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-4">Loading…</p>
          ) : keys.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No API keys yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Create one to access the workspace from scripts, CI, or external tools.
              </p>
            </div>
          ) : (
            <div className="divide-y -mx-6">
              {keys.map((k) => (
                <ApiKeyRow key={k.id} k={k} onRevoke={() => revoke(k.id)} onRegenerate={() => regenerate(k.id)} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateKeyDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        busy={busy}
        onCreate={createKey}
      />

      <RevealKeyDialog
        plaintext={newKeyPlaintext}
        onClose={() => setNewKeyPlaintext(null)}
      />
    </div>
  );
}

function ApiKeyRow({
  k, onRevoke, onRegenerate,
}: { k: ApiKey; onRevoke: () => void; onRegenerate: () => void }) {
  const revoked = !!k.revoked_at;
  const expired = k.expires_at ? new Date(k.expires_at) <= new Date() : false;
  return (
    <div className="flex items-center justify-between gap-4 px-6 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{k.name}</span>
          <code className="px-1.5 py-0.5 text-xs bg-muted rounded font-mono text-muted-foreground">
            {k.key_prefix}…
          </code>
          {revoked && <Badge variant="secondary">Revoked</Badge>}
          {!revoked && expired && <Badge variant="secondary">Expired</Badge>}
          {!revoked && !expired && (
            <Badge variant="outline" className="text-xs">
              {k.scopes.join(', ')}
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
          <span>Created {fmtDate(k.created_at)}</span>
          <span>·</span>
          <span>Last used {fmtDate(k.last_used_at)}</span>
          {k.expires_at && (<><span>·</span><span>Expires {fmtDate(k.expires_at)}</span></>)}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {!revoked && (
          <>
            <Button variant="outline" size="sm" onClick={onRegenerate}>
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="ml-1.5 hidden sm:inline">Regenerate</span>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="ml-1.5 hidden sm:inline">Revoke</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Revoke API key?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The key <strong>{k.name}</strong> ({k.key_prefix}…) will stop working
                    immediately. Any scripts or services using it will return 401 on the
                    next request. This can't be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onRevoke}>Revoke</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
    </div>
  );
}

function CreateKeyDialog({
  open, onClose, busy, onCreate,
}: { open: boolean; onClose: () => void; busy: boolean; onCreate: (name: string) => void }) {
  const [name, setName] = React.useState('');
  React.useEffect(() => { if (open) setName(''); }, [open]);
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create API key</DialogTitle>
          <DialogDescription>
            Give the key a name that describes where it'll be used (e.g. "CI pipeline",
            "Local debug"). You'll see the key value only once.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="api-key-name">Name</Label>
          <Input
            id="api-key-name"
            placeholder="Local debug"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={() => onCreate(name.trim())} disabled={!name.trim() || busy}>
            {busy ? 'Creating…' : 'Create key'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RevealKeyDialog({
  plaintext, onClose,
}: { plaintext: string | null; onClose: () => void }) {
  const open = !!plaintext;
  async function copy() {
    if (!plaintext) return;
    await navigator.clipboard.writeText(plaintext);
    toast.success('Copied to clipboard');
  }
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save this key now</DialogTitle>
          <DialogDescription>
            This is the only time the full key is shown. Copy it and store it somewhere
            safe (a password manager, your shell's keyring, etc).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <code className="block p-3 bg-muted rounded text-xs font-mono break-all">
            {plaintext}
          </code>
          <p className="text-xs text-muted-foreground">
            Use it as <code className="font-mono">Authorization: Bearer {plaintext?.slice(0, 12)}…</code>
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={copy}>
            <Copy className="mr-2 h-4 w-4" /> Copy
          </Button>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
