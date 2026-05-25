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
export { useWorkspaceContext, useLocale, useUser, useBrand, useTheme, useWorkspace, } from './hooks/use-workspace';
export { useAuth } from './hooks/use-auth';
export type { UseAuthReturn } from './hooks/use-auth';
export { useEvents } from './hooks/use-events';
export { useAI } from './hooks/use-ai';
export type { UseAIReturn } from './hooks/use-ai';
export { aiClient, createAiClient } from './ai';
export type { AiTierName, AiMessage, AiCallOptions, AiChatCompletion, AiResult, AiClient, } from './ai';
export type { WorkspaceContext, ThemeMode } from './types';
export { workspaceContextClient } from './context';
//# sourceMappingURL=index.d.ts.map