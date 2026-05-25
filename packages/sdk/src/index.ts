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
// v0.1.82.
export { useAI } from './hooks/use-ai';
export type { UseAIReturn } from './hooks/use-ai';
export { aiClient, createAiClient } from './ai';
export type {
  AiTierName,
  AiMessage,
  AiCallOptions,
  AiChatCompletion,
  AiResult,
  AiClient,
} from './ai';

// Public types.
export type { WorkspaceContext, ThemeMode } from './types';

// Framework-agnostic client for non-React guest apps.
export { workspaceContextClient } from './context';
