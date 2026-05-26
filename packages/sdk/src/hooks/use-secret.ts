/**
 * useSecret() — React hook for reading/writing encrypted per-guest-app
 * secrets stored by the workspace.
 *
 * The workspace owns the encryption key; the guest app never sees it.
 * Each call goes through /_ensemble/apps/<your-app-id>/_secrets/<key>
 * which the workspace handles directly (not forwarded to the guest
 * worker). Plaintext only crosses the wire — never sits in any
 * client-side storage by default.
 *
 * Scopes:
 *   • 'app'  (default) — app-global secret, shared across all users
 *                        of this app. Admin-only write; member-read.
 *   • 'user' — per-user secret, scoped to the authenticated user.
 *                        User reads + writes their own; nobody else
 *                        (not even admins) can read or write it.
 *
 * Caller passes the guest app's appId (from the manifest). For
 * iframe-tier guests the gateway has already routed by appId, but
 * the hook still needs it explicitly for non-iframe contexts
 * (component-tier, standalone public pages with API key auth).
 */

import * as React from 'react';

export type SecretScope = 'app' | 'user';

export interface UseSecretOptions {
  /** Guest app id from your manifest (e.g. 'quiz-cms'). */
  appId: string;
  /** Secret name within the (app, scope) namespace. */
  key: string;
  /** 'app' (default) for shared, 'user' for per-user. */
  scope?: SecretScope;
}

export interface UseSecretReturn {
  /** Fetch and decrypt the current value. Null if unset. */
  get: () => Promise<string | null>;
  /** Encrypt + store. Throws on auth/permission failure. */
  set: (value: string) => Promise<void>;
  /** Remove. Returns true if a row was deleted, false if none existed. */
  remove: () => Promise<boolean>;
  /** True while the most recent call is in flight. */
  loading: boolean;
  /** Set on the most recent failure; cleared on next call start. */
  error: string | null;
}

export function useSecret(options: UseSecretOptions): UseSecretReturn {
  const { appId, key, scope = 'app' } = options;
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const baseUrl = React.useMemo(
    () => `/_ensemble/apps/${encodeURIComponent(appId)}/_secrets/${encodeURIComponent(key)}?scope=${scope}`,
    [appId, key, scope],
  );

  const get = React.useCallback(async (): Promise<string | null> => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(baseUrl, { credentials: 'include' });
      if (r.status === 404) return null;
      if (!r.ok) {
        const detail = await r.text().catch(() => '');
        throw new Error(`secret read failed (HTTP ${r.status}): ${detail.slice(0, 200)}`);
      }
      const body = await r.json() as { value: string };
      return body.value;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'secret read failed';
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  const set = React.useCallback(async (value: string): Promise<void> => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(baseUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ value }),
      });
      if (!r.ok) {
        const detail = await r.text().catch(() => '');
        throw new Error(`secret write failed (HTTP ${r.status}): ${detail.slice(0, 200)}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'secret write failed';
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  const remove = React.useCallback(async (): Promise<boolean> => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(baseUrl, { method: 'DELETE', credentials: 'include' });
      if (!r.ok) {
        const detail = await r.text().catch(() => '');
        throw new Error(`secret delete failed (HTTP ${r.status}): ${detail.slice(0, 200)}`);
      }
      const body = await r.json() as { ok: boolean };
      return body.ok;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'secret delete failed';
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  return { get, set, remove, loading, error };
}

/**
 * Framework-agnostic secrets client for non-React guest apps (Vue,
 * Solid, vanilla). Same semantics as the hook, no React dependency.
 */
export function createSecretsClient(appId: string) {
  const base = (key: string, scope: SecretScope) =>
    `/_ensemble/apps/${encodeURIComponent(appId)}/_secrets/${encodeURIComponent(key)}?scope=${scope}`;
  return {
    async get(key: string, scope: SecretScope = 'app'): Promise<string | null> {
      const r = await fetch(base(key, scope), { credentials: 'include' });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`secret read failed (HTTP ${r.status})`);
      const body = await r.json() as { value: string };
      return body.value;
    },
    async set(key: string, value: string, scope: SecretScope = 'app'): Promise<void> {
      const r = await fetch(base(key, scope), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ value }),
      });
      if (!r.ok) throw new Error(`secret write failed (HTTP ${r.status})`);
    },
    async remove(key: string, scope: SecretScope = 'app'): Promise<boolean> {
      const r = await fetch(base(key, scope), { method: 'DELETE', credentials: 'include' });
      if (!r.ok) throw new Error(`secret delete failed (HTTP ${r.status})`);
      const body = await r.json() as { ok: boolean };
      return body.ok;
    },
    async list(scope: SecretScope = 'app'): Promise<Array<{ key: string; updated_at: string }>> {
      const url = `/_ensemble/apps/${encodeURIComponent(appId)}/_secrets?scope=${scope}`;
      const r = await fetch(url, { credentials: 'include' });
      if (!r.ok) throw new Error(`secret list failed (HTTP ${r.status})`);
      const body = await r.json() as { secrets: Array<{ key: string; updated_at: string }> };
      return body.secrets;
    },
  };
}
