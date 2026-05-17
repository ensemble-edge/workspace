/**
 * Danger Zone Tab — Destructive workspace operations + reversible-but-
 * scary toggles that affect public surfaces.
 */

import * as React from 'react';
import { useEffect, useState } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Switch,
  toast,
} from '@ensemble-edge/ui';

import { authedFetch, emitWorkspaceEvent } from '../../../state';

export function DangerZoneTab() {
  const [confirmText, setConfirmText] = useState('');

  return (
    <div className="space-y-6">
      <PublicSurfaceToggles />

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Delete Workspace</CardTitle>
          <CardDescription>
            Permanently delete this workspace and all its data. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="confirm-delete">
              Type <span className="font-mono font-bold">delete my workspace</span> to confirm
            </Label>
            <Input
              id="confirm-delete"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="delete my workspace"
            />
          </div>
          <Button
            variant="destructive"
            disabled={confirmText !== 'delete my workspace'}
          >
            Delete Workspace
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Transfer Ownership</CardTitle>
          <CardDescription>
            Transfer this workspace to another member. You will lose owner privileges.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" disabled>
            Transfer Ownership (coming soon)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Reversible-but-scary toggles. Lives in Danger Zone because flipping
 * them changes what's visible on the public web.
 */
function PublicSurfaceToggles() {
  const [aliasEnabled, setAliasEnabled] = useState<boolean | null>(null);
  const [guideEnabled, setGuideEnabled] = useState<boolean | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [aliasRes, guideRes] = await Promise.all([
        authedFetch('/_ensemble/settings/asset_public_alias_enabled'),
        authedFetch('/_ensemble/settings/public_brand_guide_enabled'),
      ]);
      if (aliasRes.ok) {
        const body = (await aliasRes.json()) as { value: string };
        setAliasEnabled(body.value === 'true');
      } else {
        setAliasEnabled(false);
      }
      if (guideRes.ok) {
        const body = (await guideRes.json()) as { value: string };
        setGuideEnabled(body.value === 'true');
      } else {
        setGuideEnabled(false);
      }
    })();
  }, []);

  async function flip(
    key: 'asset_public_alias_enabled' | 'public_brand_guide_enabled',
    next: boolean,
    setLocal: (v: boolean) => void,
    confirmMsg?: string,
  ) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusyKey(key);
    try {
      const r = await authedFetch(`/_ensemble/settings/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: next ? 'true' : 'false' }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }
      setLocal(next);
      emitWorkspaceEvent('workspace.settings.changed', { key, value: next });
      toast.success(next ? 'Enabled' : 'Disabled');
    } catch (e) {
      toast.error('Failed to update', {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Public surfaces</CardTitle>
        <CardDescription>
          Reversible toggles for things visible to anyone with the URL. Lives in Danger
          Zone because flipping them changes what crawlers and external visitors can see.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ToggleRow
          title="Pretty asset URLs"
          description={
            <>
              Serve R2-backed brand assets from <span className="font-mono">/assets/&lt;key&gt;</span>{' '}
              in addition to the canonical <span className="font-mono">/_ensemble/brand/asset/&lt;key&gt;</span>.
              The canonical path always works; this just gives operators a prettier URL
              to share. Disabling won't break stored data — only external links to the
              pretty URL.
            </>
          }
          checked={aliasEnabled ?? false}
          loading={aliasEnabled === null || busyKey === 'asset_public_alias_enabled'}
          onChange={(v) =>
            flip(
              'asset_public_alias_enabled',
              v,
              setAliasEnabled,
              v ? undefined : 'Disable pretty asset URLs? External links using /assets/<key> will stop working.',
            )
          }
        />
        <ToggleRow
          title="Public brand guide"
          description={
            <>
              When enabled, the workspace publishes a brand guide at{' '}
              <span className="font-mono">/brand</span> with your logos, colors, typography,
              and contact info — designed to share with partners and designers.
              The page is set to <span className="font-mono">noindex</span> so it doesn't
              appear in search. Disabling makes the URL 404.
            </>
          }
          checked={guideEnabled ?? false}
          loading={guideEnabled === null || busyKey === 'public_brand_guide_enabled'}
          onChange={(v) =>
            flip(
              'public_brand_guide_enabled',
              v,
              setGuideEnabled,
              v ? undefined : 'Disable the public brand guide? Anyone with the link to /brand will get a 404.',
            )
          }
        />
      </CardContent>
    </Card>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  loading,
  onChange,
}: {
  title: string;
  description: React.ReactNode;
  checked: boolean;
  loading: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border p-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
      <Switch
        checked={checked}
        disabled={loading}
        onCheckedChange={onChange}
      />
    </div>
  );
}
