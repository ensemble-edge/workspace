/**
 * User State
 *
 * Preact Signals for user authentication and membership state.
 */

import { signal, computed } from '@preact/signals-react';
import type { User, Membership, Role } from '../../types';

/**
 * Current authenticated user.
 */
export const user = signal<User | null>(null);

/**
 * Current user's membership in the workspace.
 */
export const membership = signal<Membership | null>(null);

/**
 * Authentication loading state.
 */
export const authLoading = signal(true);

/**
 * Authentication error.
 */
export const authError = signal<string | null>(null);

/**
 * Computed: Is the user authenticated?
 */
export const isAuthenticated = computed(() => user.value !== null);

/**
 * Computed: User's role in the current workspace.
 */
export const userRole = computed<Role | null>(() => membership.value?.role ?? null);

/**
 * Computed: Is the user an admin (admin or owner)?
 */
export const isAdmin = computed(() => {
  const role = userRole.value;
  return role === 'admin' || role === 'owner';
});

/**
 * Computed: Is the user an owner?
 */
export const isOwner = computed(() => userRole.value === 'owner');

/**
 * Computed: User's display name or email.
 */
export const displayName = computed(() =>
  user.value?.displayName ?? user.value?.email ?? 'User'
);

/**
 * Computed: User's initials for avatar.
 */
export const userInitials = computed(() => {
  const name = user.value?.displayName ?? user.value?.email ?? 'U';
  const parts = name.split(/[\s@]/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
});

/**
 * Authenticated fetch wrapper — use this for ALL shell-internal calls
 * to `/_ensemble/*`.
 *
 * Session model recap: access tokens live 15 min, refresh tokens live
 * up to the workspace's configured session lifetime (default 30d). When
 * a request returns 401 it almost always means the *access* token just
 * expired — the refresh token is still valid. This wrapper attempts a
 * refresh + retry once before giving up and redirecting to /login.
 *
 * Without this two-step, the operator gets kicked to /login every 15
 * minutes regardless of the configured session lifetime — because the
 * refresh path is never exercised.
 *
 * Concurrency: multiple in-flight requests can race a 401 simultaneously.
 * We dedupe refresh attempts via a single shared promise so only one
 * actual /refresh call goes out per 401 storm.
 */

let inFlightRefresh: Promise<boolean> | null = null;

async function attemptRefresh(): Promise<boolean> {
  if (inFlightRefresh) return inFlightRefresh;
  inFlightRefresh = (async () => {
    try {
      const r = await fetch('/_ensemble/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      return r.ok;
    } catch {
      return false;
    } finally {
      // Clear the singleton at the next microtask so other in-flight
      // requests that hit 401 in the same tick share this attempt, but
      // a *later* 401 (e.g. minutes later) gets a fresh attempt.
      queueMicrotask(() => {
        inFlightRefresh = null;
      });
    }
  })();
  return inFlightRefresh;
}

export async function authedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const doFetch = () => fetch(input, { credentials: 'include', ...init });
  let response = await doFetch();

  if (response.status !== 401) return response;

  // Don't try to refresh if we got 401 *from* the auth endpoints — that
  // would loop. Specifically /refresh and /me speak for themselves.
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.includes('/_ensemble/auth/refresh') || url.includes('/_ensemble/auth/me')) {
    user.value = null;
    membership.value = null;
    redirectToLogin();
    return response;
  }

  const refreshed = await attemptRefresh();
  if (refreshed) {
    // Retry the original request once. If it 401s again, we're really
    // out (e.g. role changed, user deleted) — fall through to redirect.
    response = await doFetch();
    if (response.status !== 401) return response;
  }

  // Refresh failed (or retry still 401). Real session loss.
  user.value = null;
  membership.value = null;
  redirectToLogin();
  return response;
}

function redirectToLogin() {
  if (typeof window === 'undefined') return;
  if (window.location.pathname === '/login') return;
  const from = encodeURIComponent(
    window.location.pathname + window.location.search + window.location.hash,
  );
  window.location.href = `/login?from=${from}`;
}

/**
 * Fetch current user data from API.
 */
export async function fetchUser(): Promise<void> {
  authLoading.value = true;
  authError.value = null;

  try {
    // First attempt: bare fetch (no redirect-on-401 side effects — this
    // function is *the* "are we logged in?" probe, called on shell mount,
    // and it must return cleanly on 401 without bouncing to login itself).
    let response = await fetch('/_ensemble/auth/me', { credentials: 'include' });

    // 401 here is the critical path: it can mean either "real logout"
    // (refresh token expired or revoked) or "access token expired but
    // refresh still valid" — and the difference is the entire reason
    // operators kept getting kicked to login. Try a refresh before
    // concluding we're logged out.
    if (response.status === 401) {
      const refreshed = await attemptRefresh();
      if (refreshed) {
        response = await fetch('/_ensemble/auth/me', { credentials: 'include' });
      }
    }

    if (response.status === 401) {
      // Real logout: refresh failed or wasn't possible. Caller
      // (Viewport) decides whether to redirect.
      user.value = null;
      membership.value = null;
      return;
    }

    if (!response.ok) {
      throw new Error('Failed to load user');
    }

    const data = (await response.json()) as { user: User; membership: Membership };
    user.value = data.user;
    membership.value = data.membership;
  } catch (error) {
    authError.value = error instanceof Error ? error.message : 'Unknown error';
    user.value = null;
    membership.value = null;
  } finally {
    authLoading.value = false;
  }
}

/**
 * Login with email and password.
 */
export async function login(email: string, password: string): Promise<void> {
  authLoading.value = true;
  authError.value = null;

  try {
    const response = await fetch('/_ensemble/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorData = (await response.json()) as { error?: string };
      throw new Error(errorData.error ?? 'Login failed');
    }

    const data = (await response.json()) as { user: User; membership: Membership };
    user.value = data.user;
    membership.value = data.membership;

    // Navigate to home
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  } catch (error) {
    authError.value = error instanceof Error ? error.message : 'Login failed';
    throw error;
  } finally {
    authLoading.value = false;
  }
}

/**
 * Logout the current user.
 */
export async function logout(): Promise<void> {
  try {
    await fetch('/_ensemble/auth/logout', { method: 'POST' });
  } finally {
    user.value = null;
    membership.value = null;
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }
}

/**
 * Register a new user.
 */
export async function register(
  email: string,
  password: string,
  displayName?: string
): Promise<void> {
  authLoading.value = true;
  authError.value = null;

  try {
    const response = await fetch('/_ensemble/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName }),
    });

    if (!response.ok) {
      const errorData = (await response.json()) as { error?: string };
      throw new Error(errorData.error ?? 'Registration failed');
    }

    const data = (await response.json()) as { user: User; membership: Membership };
    user.value = data.user;
    membership.value = data.membership;

    // Navigate to home
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  } catch (error) {
    authError.value = error instanceof Error ? error.message : 'Registration failed';
    throw error;
  } finally {
    authLoading.value = false;
  }
}
