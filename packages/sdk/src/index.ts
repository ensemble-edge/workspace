/**
 * @ensemble-edge/sdk — Workspace context hooks for guest apps.
 *
 * Primary surface: useWorkspaceContext() returns the full versioned
 * workspace state (workspace identity, current user, locale config,
 * theme, brand, future capabilities + feature flags).
 *
 * Selector hooks (useLocale, useUser, useTheme, useBrand, useWorkspace)
 * are typed wrappers around individual domains — use whichever is
 * ergonomic for your code.
 *
 * Adding a domain is purely additive: extend WorkspaceContext, add a
 * resolver in @ensemble-edge/core/services/workspace-context.ts,
 * optionally add a selector hook. Guest apps using older SDK versions
 * see new fields as undefined and continue working.
 *
 * See README.md for the extensibility contract.
 */

// Primary unified hook + selector hooks.
export {
  useWorkspaceContext,
  useLocale,
  useUser,
  useBrand,
  useTheme,
  useWorkspace,
} from './hooks/use-workspace';

// Real auth hook (was a stub in v0).
export { useAuth } from './hooks/use-auth';
export type { UseAuthReturn } from './hooks/use-auth';

// Events bus.
export { useEvents } from './hooks/use-events';

// AI tier access — guest apps call workspace-managed AI tiers
// (smart / good / simple / etc) without seeing provider credentials.
// v0.1.83: shape harmonized with @ensemble-edge/guest-runtime so the
// same code lifts cleanly between iframe-tier and component-tier
// guests. useAI({ tier }) → { call, loading, error, fallback }.
export { useAI } from './hooks/use-ai';
export type { UseAIReturn, UseAIOptions, AiCallResult } from './hooks/use-ai';

// Encrypted per-app secret storage (v0.1.85). Workspace owns the key;
// the guest never sees plaintext at rest. Two scopes: 'app' (shared,
// admin-write) and 'user' (private to the user, admins cannot read).
// Guest apps don't HAVE to use this — they can keep secrets in their
// own worker storage — but using it means no key management on their
// side and the workspace's encryption envelope.
export { useSecret, createSecretsClient } from './hooks/use-secret';
export type {
  UseSecretOptions,
  UseSecretReturn,
  SecretScope,
} from './hooks/use-secret';

// Public types.
export type { WorkspaceContext, ThemeMode } from './types';

// Framework-agnostic client for non-React guest apps.
export { workspaceContextClient } from './context';
