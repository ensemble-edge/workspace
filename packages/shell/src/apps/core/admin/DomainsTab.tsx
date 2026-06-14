/**
 * Domains tab — Settings → Domains.
 *
 * Manage the tenant's brand domains: the hostnames the workspace's public
 * surfaces (legal pages, brand guide, future public pages) serve under,
 * instead of the workspace subdomain. One domain serves ALL of the
 * tenant's apps, so it's a workspace-level setting (here), not an
 * app-level one. Backed by /_ensemble/domains. See
 * docs/plan/brand-domain.md.
 */

import * as React from 'react';
import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Badge,
  toast,
} from '@ensemble-edge/ui';
import { authedFetch } from '../../../state';

interface BrandDomain {
  domain: string;
  proto: string;
  verified: boolean;
  createdAt: string;
}

export function DomainsTab() {
  const [domains, setDomains] = useState<BrandDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const r = await authedFetch('/_ensemble/domains').catch(() => null);
    if (r?.ok) {
      const body = (await r.json()) as { domains: BrandDomain[] };
      setDomains(body.domains ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const add = useCallback(async () => {
    const domain = input.trim().toLowerCase();
    if (!domain) return;
    setAdding(true);
    try {
      const r = await authedFetch('/_ensemble/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      });
      const body = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(body.error || `failed: ${r.status}`);
      setInput('');
      toast.success(`Added ${domain}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add domain');
    } finally {
      setAdding(false);
    }
  }, [input, load]);

  const remove = useCallback(async (domain: string) => {
    try {
      const r = await authedFetch(`/_ensemble/domains/${encodeURIComponent(domain)}`, {
        method: 'DELETE',
      });
      if (!r.ok) throw new Error(`failed: ${r.status}`);
      toast.success(`Removed ${domain}`);
      await load();
    } catch {
      toast.error('Failed to remove domain');
    }
  }, [load]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Brand domains</CardTitle>
          <CardDescription>
            Serve this workspace's public pages (legal, brand guide) under your own domain —
            e.g. <code>curalisto.com/legal/privacy</code> instead of the workspace subdomain.
            Add the host here, then point its DNS at the workspace via a CNAME / Cloudflare
            custom hostname. Canonical URLs and hreflang automatically use the brand domain.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                placeholder="curalisto.com"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void add();
                }}
              />
            </div>
            <Button onClick={() => void add()} disabled={adding || !input.trim()}>
              {adding ? 'Adding…' : 'Add domain'}
            </Button>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : domains.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No brand domains yet. Public pages serve on the workspace subdomain.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-md border">
              {domains.map((d) => (
                <li key={d.domain} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{d.domain}</span>
                    {d.verified ? (
                      <Badge variant="secondary">verified</Badge>
                    ) : (
                      <Badge variant="outline">pending</Badge>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => void remove(d.domain)}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <p className="text-xs text-muted-foreground">
            DNS setup: point the domain at the workspace worker with a CNAME to your workspace
            host (or a Cloudflare custom hostname binding). TLS is handled by Cloudflare — no
            certificate management needed here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
