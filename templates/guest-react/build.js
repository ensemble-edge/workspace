#!/usr/bin/env node
import * as esbuild from "esbuild";
import { execSync } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "dist");
if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });

await esbuild.build({
  entryPoints: [join(__dirname, "src", "app.tsx")],
  bundle: true,
  outfile: join(distDir, "app.bundle.js"),
  format: "iife",
  globalName: "__EnsembleApp",
  platform: "browser",
  target: ["es2020"],
  minify: true,
  treeShaking: true,
  jsx: "automatic",
  jsxImportSource: "@ensemble-edge/workspace/guest-runtime",
  footer: { js: "window.__EnsembleApp=__EnsembleApp.default||__EnsembleApp;" },
});
console.log("[{{WORKER_NAME}}] JS built");

execSync(
  `npx @tailwindcss/cli -i ${join(__dirname, "src", "styles.css")} -o ${join(distDir, "app.bundle.css")} --minify`,
  { cwd: __dirname, stdio: "inherit" },
);
console.log("[{{WORKER_NAME}}] CSS built");
