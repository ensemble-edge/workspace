#!/usr/bin/env node
/**
 * Scaffold a new Ensemble guest app from templates/guest-react/.
 *
 * Usage:
 *   node create-guest-app.mjs <target-dir> [--name "Display Name"] [--id app-id] [--icon icon-name]
 *
 * Examples:
 *   node create-guest-app.mjs ./workers/guests/quiz-cms \
 *     --name "Quiz CMS" --id quiz-cms --icon clipboard-list
 *
 *   # From a consumer repo where @ensemble-edge/workspace is installed:
 *   node node_modules/@ensemble-edge/workspace/scripts/create-guest-app.mjs ./workers/guests/quiz-cms
 *
 * What it does:
 *   - Copies templates/guest-react/ to <target-dir>
 *   - Replaces {{APP_NAME}}, {{APP_ID}}, {{ICON}}, {{WORKER_NAME}}, {{BINDING_NAME}}
 *     across every file
 *   - Prints next steps
 *
 * It does NOT install dependencies (`pnpm install` is the user's call) or
 * touch the host workspace's wrangler.toml. Those steps are in the README.
 */

import {
  readdirSync, readFileSync, writeFileSync, mkdirSync, statSync, existsSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename, resolve, relative } from 'node:path';
import { argv, exit } from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Templates dir relative to this script — works whether script lives at
// workspace's scripts/ OR at consumer's node_modules/@ensemble-edge/workspace/scripts/
const templateDir = resolve(__dirname, '..', 'templates', 'guest-react');

if (!existsSync(templateDir)) {
  console.error(`[create-guest-app] template not found at ${templateDir}`);
  console.error(`  This script must run from inside the @ensemble-edge/workspace package.`);
  exit(1);
}

// ── Parse args ────────────────────────────────────────────────────────────
const args = argv.slice(2);
if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log('Usage: create-guest-app.mjs <target-dir> [--name "..."] [--id ...] [--icon ...]');
  console.log('');
  console.log('Options:');
  console.log('  --name "..."     Display name (e.g. "Quiz CMS"). Default: derived from target-dir.');
  console.log('  --id <id>        Manifest id (e.g. "quiz-cms"). Default: derived from target-dir.');
  console.log('  --icon <name>    Lucide icon name (e.g. "clipboard-list"). Default: "sparkles".');
  exit(0);
}

const targetDir = resolve(args[0]);
const opts = parseFlags(args.slice(1));

function parseFlags(rest) {
  const out = {};
  for (let i = 0; i < rest.length; i++) {
    const k = rest[i];
    if (k === '--name') out.name = rest[++i];
    else if (k === '--id') out.id = rest[++i];
    else if (k === '--icon') out.icon = rest[++i];
    else {
      console.error(`[create-guest-app] unknown flag: ${k}`);
      exit(1);
    }
  }
  return out;
}

// ── Derive defaults from target-dir ───────────────────────────────────────
// e.g. ./workers/guests/quiz-cms → "quiz-cms"
const slug = basename(targetDir).toLowerCase().replace(/[^a-z0-9-]/g, '-');
const id = opts.id || slug;
const name = opts.name || titleCase(slug);
const icon = opts.icon || 'sparkles';
// Worker name: prefix with "guest-" if the slug doesn't already include "worker"
const workerName = /worker/.test(slug) ? slug : `${slug}-guest`;
// Binding name: SCREAMING_SNAKE_CASE of the id
const bindingName = id.toUpperCase().replace(/-/g, '_');

function titleCase(s) {
  return s.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

console.log(`[create-guest-app] Creating new guest app:`);
console.log(`  target:        ${targetDir}`);
console.log(`  app id:        ${id}`);
console.log(`  app name:      ${name}`);
console.log(`  icon:          ${icon}`);
console.log(`  worker name:   ${workerName}`);
console.log(`  binding name:  ${bindingName}`);
console.log('');

if (existsSync(targetDir)) {
  console.error(`[create-guest-app] ${targetDir} already exists. Choose a different location.`);
  exit(1);
}

// ── Copy + transform ──────────────────────────────────────────────────────
const replacements = {
  '{{APP_NAME}}': name,
  '{{APP_ID}}': id,
  '{{ICON}}': icon,
  '{{WORKER_NAME}}': workerName,
  '{{BINDING_NAME}}': bindingName,
};

function copyTree(src, dst) {
  const stat = statSync(src);
  if (stat.isDirectory()) {
    mkdirSync(dst, { recursive: true });
    for (const entry of readdirSync(src)) {
      copyTree(join(src, entry), join(dst, entry));
    }
  } else {
    const content = readFileSync(src, 'utf8');
    const transformed = Object.entries(replacements).reduce(
      (acc, [k, v]) => acc.split(k).join(v),
      content,
    );
    writeFileSync(dst, transformed);
  }
}

copyTree(templateDir, targetDir);

// ── Done ──────────────────────────────────────────────────────────────────
const rel = relative(process.cwd(), targetDir) || '.';
console.log(`✓ Scaffolded into ${rel}/`);
console.log('');
console.log('Next steps:');
console.log(`  cd ${rel}`);
console.log('  pnpm install');
console.log('  pnpm run build');
console.log('  pnpm run dev      # local smoke test on :8789');
console.log('');
console.log(`Then deploy and install into a workspace — see ${rel}/README.md for the steps.`);
