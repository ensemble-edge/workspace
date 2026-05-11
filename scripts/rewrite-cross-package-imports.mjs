#!/usr/bin/env node
/**
 * Rewrites @ensemble-edge/* import specifiers across all built dist/
 * directories so they resolve as relative paths inside the single
 * @ensemble-edge/workspace tarball.
 *
 * Why this exists:
 *   The repo is a pnpm monorepo of @ensemble-edge/* packages, but
 *   consumers install the whole thing as a single @ensemble-edge/workspace
 *   tarball. Inside that tarball, @ensemble-edge/core, @ensemble-edge/shell,
 *   @ensemble-edge/guest, etc. are folders — not resolvable npm specifiers.
 *
 *   When tsc compiles packages/auth/src/index.ts that imports from
 *   '@ensemble-edge/core/services/auth', the emitted dist/index.js keeps that
 *   bare specifier verbatim. Consumers' bundlers can't resolve it.
 *
 *   This script rewrites those bare specifiers to relative paths like
 *   '../../core/dist/services/auth.js' so the consumer's bundler can follow
 *   the file on disk.
 *
 * Mapping rules:
 *   @ensemble-edge/core/<subpath>      → ../../core/dist/<subpath>
 *   @ensemble-edge/shell/<subpath>     → ../../shell/dist/<subpath>
 *   @ensemble-edge/guest               → ../../guest/core/dist/index
 *   @ensemble-edge/guest-cloudflare    → ../../guest/cloudflare/dist/index
 *   @ensemble-edge/sdk                 → ../../sdk/dist/index
 *   @ensemble-edge/ui                  → ../../ui/dist/index
 *
 * Idempotent — running it twice produces the same output.
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

// Each package whose dist/ we'll scan. Order doesn't matter — rewrites are
// per-file and independent.
const packagesToScan = [
  'packages/core',
  'packages/auth',
  'packages/sdk',
  'packages/ui',
  'packages/shell',
  'packages/guest/core',
  'packages/guest/cloudflare',
];

// Map a bare specifier (e.g. '@ensemble-edge/core/services/auth') to the
// path of its compiled file inside the tarball (e.g. 'packages/core/dist/services/auth').
//
// The order matters: longer specifiers must match before their prefixes.
// Specifiers without a subpath resolve to the package's index.
function resolveSpecifier(spec, file) {
  // Handle ui's `@/` alias — it means "packages/ui/src/" in dev, which after
  // build maps to "packages/ui/dist/". Only applies when the importing file
  // lives under packages/ui/dist/.
  if (spec.startsWith('@/')) {
    if (file && file.includes('/packages/ui/dist/')) {
      return `packages/ui/dist/${spec.slice(2)}`;
    }
    return null;
  }
  if (spec === '@ensemble-edge/core') return 'packages/core/dist/index';
  if (spec.startsWith('@ensemble-edge/core/')) {
    return `packages/core/dist/${spec.slice('@ensemble-edge/core/'.length)}`;
  }
  if (spec === '@ensemble-edge/shell') return 'packages/shell/dist/shell';
  if (spec.startsWith('@ensemble-edge/shell/')) {
    return `packages/shell/dist/${spec.slice('@ensemble-edge/shell/'.length)}`;
  }
  if (spec === '@ensemble-edge/guest') return 'packages/guest/core/dist/index';
  if (spec.startsWith('@ensemble-edge/guest/')) {
    return `packages/guest/core/dist/${spec.slice('@ensemble-edge/guest/'.length)}`;
  }
  if (spec === '@ensemble-edge/guest-cloudflare') return 'packages/guest/cloudflare/dist/index';
  if (spec === '@ensemble-edge/guest-runtime') return 'packages/guest-runtime/dist/index';
  if (spec === '@ensemble-edge/guest-runtime/assets') return 'packages/guest-runtime/dist/assets';
  if (spec === '@ensemble-edge/guest-runtime/jsx-runtime') return 'packages/guest-runtime/dist/jsx-runtime';
  if (spec === '@ensemble-edge/guest-sandbox') return 'packages/guest-sandbox/dist/index';
  if (spec === '@ensemble-edge/guest-sandbox/protocol') return 'packages/guest-sandbox/dist/protocol';
  if (spec === '@ensemble-edge/sdk') return 'packages/sdk/dist/index';
  if (spec === '@ensemble-edge/ui') return 'packages/ui/dist/index';
  if (spec.startsWith('@ensemble-edge/ui/')) {
    return `packages/ui/dist/${spec.slice('@ensemble-edge/ui/'.length)}`;
  }
  return null;
}

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (entry.endsWith('.js') || entry.endsWith('.d.ts')) acc.push(full);
  }
  return acc;
}

// Matches "@ensemble-edge/<name>[/<subpath>]" OR "@/<subpath>" inside quotes.
const re = /(['"])(@ensemble-edge\/[a-z0-9-]+(?:\/[a-z0-9-/_]+)?|@\/[a-z0-9-/_]+)\1/g;
// Match relative imports without an extension so we can add .js for Node ESM.
// Matches `from './foo'`, `from '../bar/baz'`, `import('./foo')`, etc.
// We deliberately do NOT match imports that already end with .js / .css / .json.
const relRe = /(\bfrom\s*|\bimport\s*\(\s*|\bexport\s+(?:\*|\{[^}]*\})\s+from\s*)(['"])(\.\.?\/[^'"]*?)(['"])/g;

let totalFilesRewritten = 0;
let totalSpecifiersRewritten = 0;

for (const pkg of packagesToScan) {
  const distDir = join(repoRoot, pkg, 'dist');
  if (!existsSync(distDir)) continue;

  for (const file of walk(distDir)) {
    const content = readFileSync(file, 'utf8');
    const isDts = file.endsWith('.d.ts');

    let count = 0;
    let next = content.replace(re, (match, quote, spec) => {
      const target = resolveSpecifier(spec, file);
      if (!target) return match;

      // Build relative path from the current file's directory to the target.
      const targetAbs = join(repoRoot, target);
      let rel = relative(dirname(file), targetAbs).replace(/\\/g, '/');
      if (!rel.startsWith('.')) rel = './' + rel;

      count++;
      // For runtime imports (.js files), append .js. For .d.ts, leave bare
      // (tsc resolves '../foo' to '../foo.d.ts').
      return `${quote}${rel}${isDts ? '' : '.js'}${quote}`;
    });

    // Second pass: add .js extension to relative imports that lack one,
    // so Node's native ESM loader (which strictly requires extensions,
    // unlike bundlers) can resolve them. Skip .d.ts files.
    //
    // Subtle case: './mode' might refer to a file (./mode.js) OR a directory
    // (./mode/index.js). We check the filesystem to pick the right one.
    if (!isDts) {
      next = next.replace(relRe, (_m, keyword, q1, spec, q2) => {
        if (/\.(js|mjs|cjs|css|json|wasm)$/.test(spec)) return _m;
        const baseDir = dirname(file);
        const asFile = join(baseDir, spec + '.js');
        const asIndex = join(baseDir, spec, 'index.js');
        let resolved;
        if (existsSync(asFile)) resolved = spec + '.js';
        else if (existsSync(asIndex)) resolved = spec + '/index.js';
        else {
          // Leave as-is; bundlers will figure it out, Node will error clearly.
          return _m;
        }
        return `${keyword}${q1}${resolved}${q2}`;
      });
    }

    if (next !== content) {
      writeFileSync(file, next);
      totalFilesRewritten++;
      totalSpecifiersRewritten += count;
    }
  }
}

console.log(
  `[rewrite] rewrote ${totalSpecifiersRewritten} specifier(s) across ${totalFilesRewritten} file(s)`
);
