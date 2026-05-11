#!/usr/bin/env node
import * as esbuild from "esbuild";
import { mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "dist");
if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });

// Component-tier bundle: an ES module that default-exports a React
// component. Compiles JSX against the guest-runtime jsx-runtime shim,
// which delegates to window.Ensemble.React.createElement at runtime.
// React, Radix UI, workspace UI: NONE of them are in this bundle —
// the host shell already has them on window.Ensemble.
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
  jsxImportSource: "@ensemble-edge/guest-runtime",
});
console.log("[hello-component] Component module built");
