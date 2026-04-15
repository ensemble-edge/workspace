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
 * Fetch current user data from API.
 */
export async function fetchUser(): Promise<void> {
  authLoading.value = true;
  authError.value = null;

  try {
    const response = await fetch('/_ensemble/auth/me');

    if (response.status === 401) {
      // Not authenticated - this is okay
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
