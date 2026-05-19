/**
 * Theme hook.
 *
 * Reads theme state from the unified workspace context. Re-exports
 * the selector from use-workspace.ts so consumers can import from
 * either location.
 */

export { useTheme } from './use-workspace';
export type { ThemeMode } from '../types';
