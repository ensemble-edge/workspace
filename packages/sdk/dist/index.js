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
export { useWorkspaceContext, useLocale, useUser, useBrand, useTheme, useWorkspace, } from './hooks/use-workspace.js';
// Real auth hook (was a stub in v0).
export { useAuth } from './hooks/use-auth.js';
// Events bus.
export { useEvents } from './hooks/use-events.js';
// AI tier access — guest apps call workspace-managed AI tiers
// (smart / good / simple / etc) without seeing provider credentials.
// v0.1.83: shape harmonized with @ensemble-edge/guest-runtime so the
// same code lifts cleanly between iframe-tier and component-tier
// guests. useAI({ tier }) → { call, loading, error, fallback }.
export { useAI } from './hooks/use-ai.js';
// Framework-agnostic client for non-React guest apps.
export { workspaceContextClient } from './context.js';
//# sourceMappingURL=index.js.map