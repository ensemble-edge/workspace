#!/usr/bin/env node
import * as esbuild from "esbuild";
import { mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "dist");
if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });

await esbuild.build({
  entryPoints: [join(__dirname, "src", "app.ts")],
  bundle: true,
  outfile: join(distDir, "app.bundle.js"),
  format: "iife",
  platform: "browser",
  target: ["es2020"],
  minify: true,
  treeShaking: true,
});
console.log("[hello-sandboxed] App bundle built");
