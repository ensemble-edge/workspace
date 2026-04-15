/**
 * @ensemble-edge/shell
 *
 * The Ensemble workspace shell — a React SPA that provides
 * the sidebar, toolbar, viewport, and core app pages.
 *
 * Usage in a Worker (standalone mode):
 *   import { SHELL_JS, SHELL_CSS } from '@ensemble-edge/shell/assets';
 *   // Serve these strings at /_ensemble/shell/shell.js and shell.css
 *
 * The shell is built separately and outputs:
 *   dist/shell.js   — Bundled React SPA
 *   dist/shell.css  — Compiled Tailwind CSS
 *   dist/assets.js  — Exports both as strings (for Worker inline serving)
 */

export { initShell } from './client';
export { registerPage, findPage, getPages } from './apps/registry';
export type { AppPageRegistration } from './apps/registry';
