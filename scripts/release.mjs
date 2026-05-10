#!/usr/bin/env node
/**
 * Cuts a v<version> release.
 *
 * Usage:
 *   pnpm release 0.2.0
 *   pnpm release 0.2.0 --dry-run    (prints what would happen, no writes)
 *   pnpm release 0.2.0 --no-push    (commit and tag locally, don't push)
 *
 * What it does:
 *   1. Preflight: clean git tree, on main, typecheck passes.
 *   2. Bump version in root package.json + every released subpackage.
 *   3. Build all packages (scripts/build-all.mjs).
 *   4. Create a release/v<version> branch from main.
 *   5. Force-add packages/<pkg>/dist/ across the released set.
 *   6. Commit `chore: release v<version>` and tag `v<version>` on that branch.
 *   7. Print push instructions (or push if not --no-push).
 *
 * What it does NOT do:
 *   - Publish to npm.
 *   - Update changelogs (do that manually before running this).
 *   - Touch packages/cli (deferred to v0.2.0+).
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

const args = process.argv.slice(2);
const version = args.find((a) => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');
const noPush = args.includes('--no-push');

if (!version || !/^\d+\.\d+\.\d+(-[a-z0-9.]+)?$/.test(version)) {
  console.error('Usage: pnpm release <version> [--dry-run] [--no-push]');
  console.error('  version must be semver, e.g. 0.2.0 or 0.2.0-rc.1');
  process.exit(1);
}

const releasedPackages = [
  { dir: 'packages/core', name: '@ensemble-edge/core' },
  { dir: 'packages/auth', name: '@ensemble-edge/auth' },
  { dir: 'packages/ui', name: '@ensemble-edge/ui' },
  { dir: 'packages/shell', name: '@ensemble-edge/shell' },
  { dir: 'packages/sdk', name: '@ensemble-edge/sdk' },
  { dir: 'packages/guest/core', name: '@ensemble-edge/guest' },
  { dir: 'packages/guest/cloudflare', name: '@ensemble-edge/guest-cloudflare' },
];

function sh(cmd, opts = {}) {
  if (dryRun && opts.write) {
    console.log(`[dry-run] $ ${cmd}`);
    return '';
  }
  const result = spawnSync('sh', ['-c', cmd], {
    cwd: repoRoot,
    stdio: opts.capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
  });
  if (result.status !== 0 && !opts.allowFail) {
    console.error(`Failed: ${cmd}`);
    process.exit(result.status ?? 1);
  }
  return (result.stdout ?? '').trim();
}

function bumpVersion(pkgPath, v) {
  const full = join(repoRoot, pkgPath);
  const pkg = JSON.parse(readFileSync(full, 'utf8'));
  pkg.version = v;
  if (dryRun) {
    console.log(`[dry-run] would bump ${pkgPath} → ${v}`);
    return;
  }
  writeFileSync(full, JSON.stringify(pkg, null, 2) + '\n');
}

// 1. Preflight
console.log(`▶ Releasing v${version}${dryRun ? ' (dry-run)' : ''}`);

const branch = sh('git rev-parse --abbrev-ref HEAD', { capture: true });
if (branch !== 'main') {
  console.error(`× Not on main (currently on '${branch}'). Switch to main first.`);
  process.exit(1);
}

const dirty = sh('git status --porcelain', { capture: true });
if (dirty) {
  console.error('× Working tree not clean. Commit or stash first:');
  console.error(dirty);
  process.exit(1);
}

console.log('  ✓ on main, clean tree');

// Typecheck only the released packages. We intentionally skip
// connectors/demos/templates — those aren't in the release surface and
// historically have their own issues that shouldn't block a release.
console.log('▶ Typechecking released packages...');
const releasedDirs = [
  'packages/core',
  'packages/auth',
  'packages/ui',
  'packages/shell',
  'packages/sdk',
  'packages/guest/core',
  'packages/guest/cloudflare',
];
for (const dir of releasedDirs) {
  sh(`cd ${dir} && pnpm exec tsc -p tsconfig.build.json --noEmit`, { allowFail: false });
}

// 2. Bump versions
console.log(`▶ Bumping versions to ${version}`);
bumpVersion('package.json', version);
for (const p of releasedPackages) {
  bumpVersion(`${p.dir}/package.json`, version);
}

// 3. Build
console.log('▶ Building all packages');
if (!dryRun) {
  sh('node scripts/build-all.mjs');
}

// 4. Create release branch
const releaseBranch = `release/v${version}`;
console.log(`▶ Creating release branch ${releaseBranch}`);
sh(`git checkout -b ${releaseBranch}`, { write: true });

// 5. Force-add dist directories
console.log('▶ Staging dist artifacts');
const distGlobs = releasedPackages.map((p) => `${p.dir}/dist`).join(' ');
sh(`git add -f ${distGlobs}`, { write: true });
sh('git add package.json packages/*/package.json packages/guest/*/package.json', { write: true });

// 6. Commit and tag
console.log(`▶ Committing and tagging v${version}`);
sh(`git commit -m "chore: release v${version}"`, { write: true });
sh(`git tag -a v${version} -m "Release v${version}"`, { write: true });

// 7. Push or print
if (noPush || dryRun) {
  console.log(`\n✓ Release v${version} prepared locally.`);
  console.log(`\nTo push:`);
  console.log(`  git push origin ${releaseBranch}`);
  console.log(`  git push origin v${version}`);
} else {
  console.log('▶ Pushing branch and tag');
  sh(`git push origin ${releaseBranch}`);
  sh(`git push origin v${version}`);
}

console.log(`\n✓ Release v${version} complete.`);
console.log(`\nConsumers install with:`);
console.log(`  pnpm add github:ensemble-edge/workspace#v${version}`);
