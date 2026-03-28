// @ensemble-edge/core — Ensemble Workspace Engine

export { createWorkspace } from './create-workspace';
export type { WorkspaceConfig, WorkspaceInstance } from './create-workspace';

// Re-export services
export * from './services/theme';
export * from './services/i18n';
export * from './services/permissions';
export * from './services/gateway';
export * from './services/app-registry';
export * from './services/knowledge';
export * from './services/event-bus';
export * from './services/notifications';
