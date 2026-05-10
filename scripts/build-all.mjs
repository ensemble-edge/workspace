#!/usr/bin/env node
/**
 * Build all release packages from the repo root.
 *
 * Why we invoke tsc/esbuild directly instead of `pnpm run build` per-package:
 *
 *   When pnpm runs `prepare` on a consumer install, per-package symlinks
 *   in node_modules/.bin/ are not yet wired up. Calling `pnpm run build`
 *   per-package can fail to find `tsc`. By running tsc from the root —
 *   where it's a top-level devDependency — we avoid that whole problem.
 *
 * Build order (matters for type resolution downstream):
 *   1. guest/core, sdk, ui     (no internal deps; parallelizable)
 *   2. guest/cloudflare         (uses guest types)
 *   3. shell                    (needs ui types + emits assets.d.ts)
 *   4. core                     (needs shell/assets types)
 *   5. auth                     (re-exports from core)
 *
 * @ensemble-edge/cli is intentionally excluded — deferred to v0.2.0.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const tsc = join(repoRoot, 'node_modules', '.bin', 'tsc');
const tailwindcss = join(repoRoot, 'node_modules', '.bin', 'tailwindcss');

if (!existsSync(tsc)) {
  console.error('[ensemble:build] tsc not found at', tsc);
  console.error('  Run `pnpm install` first.');
  process.exit(1);
}

function run(cmd, args, opts) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: opts?.cwd ?? repoRoot });
  if (r.status !== 0) {
    console.error(`[ensemble:build] FAILED: ${cmd} ${args.join(' ')}`);
    process.exit(r.status ?? 1);
  }
}

function buildTsc(pkgDir, label) {
  console.log(`\n[ensemble:build] ${label}`);
  run(tsc, ['-p', join(repoRoot, pkgDir, 'tsconfig.build.json')]);
}

// 1. Independent packages
buildTsc('packages/guest/core', 'guest/core');
buildTsc('packages/sdk', 'sdk');
buildTsc('packages/ui', 'ui');

// 2. guest/cloudflare
buildTsc('packages/guest/cloudflare', 'guest/cloudflare');

// 3. shell — esbuild + tailwind + assets.d.ts
console.log('\n[ensemble:build] shell');
run('node', [join(repoRoot, 'packages/shell/build.js')], { cwd: join(repoRoot, 'packages/shell') });

// 4. core
buildTsc('packages/core', 'core');

// 5. auth
buildTsc('packages/auth', 'auth');

// 6. Rewrite cross-package @ensemble-edge/* specifiers to relative paths.
// This is what makes the single-tarball install work — see the script
// header for the full rationale.
console.log('\n[ensemble:build] rewriting cross-package imports');
run('node', [join(repoRoot, 'scripts/rewrite-cross-package-imports.mjs')]);

console.log('\n[ensemble:build] All packages built.');
