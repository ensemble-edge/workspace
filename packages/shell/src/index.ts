/**
 * @ensemble-edge/shell
 *
 * Re-export shell components from @ensemble-edge/core.
 * This package exists to allow independent versioning and imports.
 *
 * Usage:
 *   import { Shell, Sidebar, mountShell } from '@ensemble-edge/shell';
 *
 * Or directly from core:
 *   import { Shell, Sidebar, mountShell } from '@ensemble-edge/core/shell';
 */

// Re-export everything from core's shell module
export * from '@ensemble-edge/core/shell';
