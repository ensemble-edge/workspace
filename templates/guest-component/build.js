#!/usr/bin/env node
import * as esbuild from "esbuild";
import { mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "dist");
if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });

await esbuild.build({
  entryPoints: [join(__dirname, "src", "component.tsx")],
  bundle: true,
  outfile: join(distDir, "component.bundle.js"),
  format: "esm",
  platform: "browser",
  target: ["es2020"],
  minify: true,
  treeShaking: true,
  jsx: "automatic",
  jsxImportSource: "@ensemble-edge/workspace/guest-runtime",
});
console.log("[{{WORKER_NAME}}] Component module built");
