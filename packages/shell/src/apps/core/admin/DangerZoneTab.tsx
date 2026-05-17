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
  const [aliasPath, setAliasPath] = useState<string | null>(null);
  const [aliasDraft, setAliasDraft] = useState<string>('');
  const [aliasError, setAliasError] = useState<string | null>(null);
  const [guideEnabled, setGuideEnabled] = useState<boolean | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [aliasRes, guideRes] = await Promise.all([
        authedFetch('/_ensemble/settings/asset_public_alias_path'),
        authedFetch('/_ensemble/settings/public_brand_guide_enabled'),
      ]);
      if (aliasRes.ok) {
        const body = (await aliasRes.json()) as { value: string };
        setAliasPath(body.value ?? '');
        setAliasDraft(body.value ?? '');
      } else {
        setAliasPath('');
        setAliasDraft('');
      }
      if (guideRes.ok) {
        const body = (await guideRes.json()) as { value: string };
        setGuideEnabled(body.value === 'true');
      } else {
        setGuideEnabled(false);
      }
    })();
  }, []);

  async function flipGuide(next: boolean, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusyKey('public_brand_guide_enabled');
    try {
      const r = await authedFetch(`/_ensemble/settings/public_brand_guide_enabled`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: next ? 'true' : 'false' }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }
      setGuideEnabled(next);
      emitWorkspaceEvent('workspace.settings.changed', {
        key: 'public_brand_guide_enabled', value: next,
      });
      toast.success(next ? 'Enabled' : 'Disabled');
    } catch (e) {
      toast.error('Failed to update', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusyKey(null);
    }
  }

  async function saveAliasPath() {
    setAliasError(null);
    // Confirm when the operator is changing an existing alias —
    // external links to the old path will break.
    if (aliasPath && aliasDraft && aliasDraft !== aliasPath) {
      if (!confirm(
        `Change the asset URL path from "/${aliasPath}" to "/${aliasDraft}"?\n\n` +
        `Any external link using /${aliasPath}/<key> will stop working.`,
      )) return;
    }
    // Confirm when clearing an enabled alias.
    if (aliasPath && !aliasDraft.trim()) {
      if (!confirm(
        `Disable pretty asset URLs?\n\n` +
        `External links using /${aliasPath}/<key> will stop working.`,
      )) return;
    }
    setBusyKey('asset_public_alias_path');
    try {
      const r = await authedFetch('/_ensemble/settings/asset_public_alias_path', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: aliasDraft.trim() }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }
      const body = (await r.json()) as { value: string };
      setAliasPath(body.value);
      setAliasDraft(body.value);
      emitWorkspaceEvent('workspace.settings.changed', {
        key: 'asset_public_alias_path', value: body.value,
      });
      toast.success(body.value ? `Asset path set to /${body.value}` : 'Pretty asset path disabled');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setAliasError(msg);
      toast.error('Failed to update', { description: msg });
    } finally {
      setBusyKey(null);
    }
  }

  // Live preview path the operator will see after Save.
  const previewPath = aliasDraft.trim() ? `/${aliasDraft.trim()}/<key>` : '(disabled)';
  const aliasDirty = aliasDraft.trim() !== (aliasPath ?? '');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Public surfaces</CardTitle>
        <CardDescription>
          Reversible settings for things visible to anyone with the URL. Lives in Danger
          Zone because changes here affect what crawlers and external visitors can see.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Pretty asset URLs — path is configurable */}
        <div className="rounded-md border p-3 space-y-3">
          <div>
            <p className="text-sm font-medium">Pretty asset URLs</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              R2-backed brand assets are always served at the canonical
              <span className="font-mono"> /_ensemble/brand/asset/&lt;key&gt;</span>.
              Set a custom path here to <em>also</em> serve them at a friendlier URL.
              Empty disables the alias. Stored data isn't affected — only external
              links to the pretty URL break when this changes.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="alias-path" className="text-xs">URL path</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-muted-foreground">/</span>
              <Input
                id="alias-path"
                value={aliasDraft}
                onChange={(e) => {
                  setAliasDraft(e.target.value);
                  setAliasError(null);
                }}
                placeholder="e.g. assets, media, brand-files (leave empty to disable)"
                className="font-mono"
                disabled={aliasPath === null}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Preview: <span className="font-mono">{previewPath}</span>
            </p>
            {aliasError && <p className="text-xs text-destructive">{aliasError}</p>}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={saveAliasPath}
              disabled={!aliasDirty || busyKey === 'asset_public_alias_path'}
            >
              {busyKey === 'asset_public_alias_path' ? 'Saving…' : 'Save'}
            </Button>
            {aliasPath && (
              <p className="text-xs text-muted-foreground">
                Currently serving at{' '}
                <span className="font-mono">/{aliasPath}/&lt;key&gt;</span>
              </p>
            )}
          </div>
        </div>

        {/* Public brand guide — boolean toggle stays */}
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
            flipGuide(
              v,
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
