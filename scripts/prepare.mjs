#!/usr/bin/env node
/**
 * Runs automatically on `pnpm install`.
 *
 * Behavior:
 *   - Consumer install (via `pnpm add github:ensemble-edge/workspace#main`):
 *       pnpm clones the repo into a temp dir, then runs this script.
 *       If `packages/core/dist/` doesn't exist, we build all packages so the
 *       consumer ends up with working dist/ artifacts.
 *   - Tagged release install (`#v0.1.0`):
 *       The release branch already contains dist/ artifacts. We detect that
 *       and skip the build.
 *   - Dev install (cloning the repo and running `pnpm install`):
 *       Same as consumer-install if dist/ is missing. To skip, set
 *       ENSEMBLE_SKIP_PREPARE=1 in your env.
 *
 * Why a custom script instead of a one-liner?
 *   - We need to distinguish "fresh install with prebuilt dist/" (skip) from
 *     "fresh install of raw source" (build).
 *   - We need to print helpful diagnostics — silent prepare failures are brutal.
 */

import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

if (process.env.ENSEMBLE_SKIP_PREPARE === '1') {
  console.log('[ensemble:prepare] ENSEMBLE_SKIP_PREPARE=1 — skipping build');
  process.exit(0);
}

if (process.env.ENSEMBLE_PREPARING === '1') {
  // We're inside a nested install triggered by our own prepare. Skip to avoid
  // infinite recursion — the outer invocation will do the build.
  console.log('[ensemble:prepare] inside nested install — skipping');
  process.exit(0);
}

const sentinelPaths = [
  'packages/core/dist/index.js',
  'packages/ui/dist/index.js',
  'packages/auth/dist/index.js',
  'packages/shell/dist/shell.js',
  'packages/shell/dist/assets.js',
  'packages/sdk/dist/index.js',
  'packages/guest/core/dist/index.js',
  'packages/guest/cloudflare/dist/index.js',
];

const allPresent = sentinelPaths.every((p) => existsSync(join(repoRoot, p)));

if (allPresent) {
  console.log('[ensemble:prepare] dist/ artifacts present — skipping build');
  process.exit(0);
}

console.log('[ensemble:prepare] dist/ missing — building all packages...');

// When pnpm runs `prepare` after installing a git tarball, the inner
// pnpm-workspace.yaml is not honored — internal @ensemble-edge/* symlinks
// don't exist yet. Force a recursive install inside the cloned repo to
// wire those up before we try to build packages that reference each other.
const recursiveInstall = spawnSync(
  'pnpm',
  ['install', '--no-frozen-lockfile', '--prefer-offline'],
  {
    stdio: 'inherit',
    cwd: repoRoot,
    // Strip pnpm's "I am running inside another install" guards so the inner
    // install actually runs and creates workspace links.
    env: {
      ...process.env,
      npm_config_yes: 'true',
      npm_lifecycle_event: '',
      npm_config_user_agent: '',
      ENSEMBLE_PREPARING: '1',
    },
  }
);
if (recursiveInstall.status !== 0) {
  console.error('[ensemble:prepare] Recursive install failed; cannot continue.');
  process.exit(recursiveInstall.status ?? 1);
}

const result = spawnSync(
  'node',
  [join(__dirname, 'build-all.mjs')],
  { stdio: 'inherit', cwd: repoRoot }
);

if (result.status !== 0) {
  console.error('[ensemble:prepare] Build failed.');
  console.error('  If you are installing in a consumer project and hit this,');
  console.error('  please file an issue at https://github.com/ensemble-edge/workspace/issues');
  process.exit(result.status ?? 1);
}

console.log('[ensemble:prepare] Build complete.');
