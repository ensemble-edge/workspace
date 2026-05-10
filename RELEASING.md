# Releasing `@ensemble-edge/workspace`

This doc explains how `@ensemble-edge/workspace` ships to consumers, how to cut a new release, and how a consumer integrates it.

Workspace is pre-v1 and shipping fast — expect this process to evolve. The current setup is deliberately lightweight (one command, no npm, no CI).

---

## TL;DR for cutting a release

```bash
# From the repo root, on a clean main branch.
pnpm release 0.2.0
# Then push:
git push origin release/v0.2.0
git push origin v0.2.0
```

That's it. Consumers can immediately:

```bash
pnpm add github:ensemble-edge/workspace#v0.2.0
```

---

## TL;DR for consumers

Add the package and a pinned tag (NOT `main` — see [§ Why pin to a tag](#why-pin-to-a-tag) below):

```bash
pnpm add github:ensemble-edge/workspace#v0.1.0
```

Import via subpath — there is **no root export** by design (see [§ Design choices](#design-choices)):

```ts
// Backend (Hono + CF Workers)
import { createWorkspace } from '@ensemble-edge/workspace/core';
import { hashPassword } from '@ensemble-edge/workspace/auth';

// Frontend (React)
import { Button } from '@ensemble-edge/workspace/ui';
import { useTheme } from '@ensemble-edge/workspace/sdk';

// Guest apps
import { defineGuestApp } from '@ensemble-edge/workspace/guest';
import { adapter } from '@ensemble-edge/workspace/guest/cloudflare';
```

Available subpaths (full list in [`package.json`](./package.json) `exports`):

| Subpath | What it gives you |
|---|---|
| `/core` | `createWorkspace`, mode config, types |
| `/core/services/auth`, `/core/utils/{jwt,password,cookies}`, `/core/middleware/auth`, `/core/routes/auth` | Granular auth surface |
| `/auth` | Convenience re-export of common auth functions |
| `/ui` | Themed React components (shadcn/ui + Radix) |
| `/ui/globals.css` | Tailwind v4 entry — see [§ Tailwind v4 integration](#tailwind-v4-integration) |
| `/ui/tailwind.config` | Shared Tailwind config |
| `/shell` | Pre-bundled SPA JS (string) |
| `/shell/assets` | `SHELL_JS` + `SHELL_CSS` strings (for serving from a Worker) |
| `/shell/dist/shell.css` | Compiled shell stylesheet |
| `/sdk` | Extension hooks: `useTheme`, `useAuth`, `useWorkspace`, `useEvents` |
| `/guest` | Platform-agnostic guest-app SDK |
| `/guest/cloudflare` | CF Workers adapter for guest apps |

---

## Peer-dependency contract

Workspace declares these as **peer dependencies**. Consumers must install them themselves:

| Dep | Range | Required when |
|---|---|---|
| `react` | `^18.0.0 \|\| ^19.0.0` | You import `/ui`, `/shell`, or `/sdk`. Optional otherwise (backend-only is fine). |
| `react-dom` | `^18.0.0 \|\| ^19.0.0` | Same as `react`. |
| `@cloudflare/workers-types` | `^4.0.0` | You import `/core` types in a Worker project. |

Hard-required runtime deps that come bundled with workspace (no need to install separately): `hono`, `jose`, `@radix-ui/*`, `class-variance-authority`, `clsx`, `cmdk`, `lucide-react`, `next-themes`, `sonner`, `tailwind-merge`, `vaul`, `@preact/signals-react`, `better-sqlite3`.

If you want a version different from what workspace pins, use a [pnpm override](https://pnpm.io/package_json#pnpmoverrides) — but this is rarely needed pre-v1.

---

## Tailwind v4 integration

Workspace's UI components style themselves with Tailwind v4. To use them in your app, you need a Tailwind v4 build that knows about both your sources **and** workspace's compiled components.

`packages/ui/src/globals.css` already declares `@source` directives for workspace components. Your `styles.css` just needs:

```css
@import '@ensemble-edge/workspace/ui/globals.css';
@source './src/**/*.{ts,tsx,jsx,js}';
```

That's the entire integration. Tailwind v4 then walks both your sources and workspace's `dist/` to produce a single utility-class output.

**Why `dist/` and not `src/`:** workspace ships compiled `.js` files in `dist/`. Class strings (`bg-primary`, `text-foreground`, etc.) are preserved verbatim by tsc, so Tailwind v4 finds them just fine. The `@source` directives inside `globals.css` cover both dev and installed layouts using relative paths that work either way.

---

## How releases work mechanically

`scripts/release.mjs` does six things, in order:

1. **Preflight** — checks you're on `main`, the tree is clean, and `pnpm typecheck` passes.
2. **Version bump** — writes the new version to the root `package.json` and to every released subpackage's `package.json` (skipping `@ensemble-edge/cli`, which is deferred).
3. **Build** — runs `scripts/build-all.mjs`, which compiles all seven released packages in topological order using the root's tsc (NOT per-package `pnpm run build` — that fails on consumer installs, see [§ Design choices](#design-choices)).
4. **Cross-package rewrite** — runs `scripts/rewrite-cross-package-imports.mjs`, which fixes up bare `@ensemble-edge/*` specifiers and `@/*` aliases in the built dist files so they resolve as relative paths inside the single tarball. **This is the load-bearing piece** — without it, `@ensemble-edge/auth` would import `@ensemble-edge/core/services/auth` and consumers couldn't resolve it.
5. **Release branch** — creates `release/v<version>` off `main`, force-adds `packages/*/dist/`, commits and tags.
6. **Print push instructions** (doesn't push automatically — you do that).

Useful flags:

- `pnpm release 0.2.0 --dry-run` — print what would happen, don't write anything
- `pnpm release 0.2.0 --no-push` — also skips push (default behavior anyway)

---

## Why pin to a tag

`pnpm add github:ensemble-edge/workspace#v0.1.0` (tag) installs the prebuilt `dist/` artifacts that we committed to the `release/v0.1.0` branch. Fast install, no build step on the consumer's side.

`pnpm add github:ensemble-edge/workspace#main` (raw main) gets only source. pnpm will then run our `prepare` script, which:

1. Detects that `dist/` is missing.
2. Runs `pnpm install` recursively (to wire up workspace links inside the cloned repo).
3. Runs `scripts/build-all.mjs` to compile everything.
4. Runs the cross-package rewriter.

This adds ~30-60 seconds to consumer install and requires every devDep we use during build to be available on the consumer's machine. It works, but **pin to tags in production** — it's faster, deterministic, and doesn't depend on the consumer's environment matching ours.

---

## Design choices

These choices are unusual enough that future-you might want to know why.

### No root `.` export

The root `package.json` has no `exports['.']` entry. Doing `import 'workspace'` is an error, not a giant bundle. This forces consumers to pick a subpath and helps bundlers tree-shake correctly. If you want a meta-import for some reason, add a subpath like `/all` — don't add a root export.

### `prepare` runs a Node script, not `pnpm build`

The script `scripts/prepare.mjs` detects whether the install is into a consumer (no `dist/` present → build) vs into the dev repo (`dist/` exists → skip). This avoids hammering contributors with a 30-second build every time they run `pnpm install`. It also has an `ENSEMBLE_PREPARING=1` env-var lock to prevent infinite recursion when the prepare flow re-invokes `pnpm install` internally.

### `react`/`react-dom` are optional peer dependencies on the root

Backend-only consumers (only `/core`, `/auth`) don't need React installed at all. The `peerDependenciesMeta` entry marks them optional so pnpm doesn't yell about missing peers when they're not used. Consumers importing `/ui` will get a peer warning if React is missing, which is the correct behavior.

### Removed `private: true` from root

Required for `pnpm pack` and `github:` installs to work. We're not publishing to npm — but pnpm treats `private` as a hard refusal even for git installs.

### Cross-package rewriter instead of bundling

A package like `@ensemble-edge/auth` re-exports from `@ensemble-edge/core/...`. After build, those specifiers are bare strings in `dist/index.js`. In a normal multi-package npm publish, `@ensemble-edge/core` would be a separate npm package and consumers' resolvers would find it. In our single-tarball setup, `@ensemble-edge/core` is a folder inside the tarball — there's no node_modules entry for it.

We considered three fixes:

1. **Bundle dependencies** — esbuild auth and inline core into the bundle. Bloats the tarball; loses tree-shaking.
2. **Source-level relative paths** — `import from '../../core/dist/services/auth.js'`. Ugly in source; breaks dev DX because `core/dist/` doesn't exist until built.
3. **Post-build path rewriter** ([scripts/rewrite-cross-package-imports.mjs](./scripts/rewrite-cross-package-imports.mjs)). Source stays clean; one script handles all packages; trivially extensible. ← we picked this.

The rewriter also adds `.js` extensions to relative imports so Node's native ESM loader works. Bundlers don't need this, but it makes the install Node-ESM-clean which removes a footgun.

### CLI deferred to v0.2.0+

`@ensemble-edge/cli` is intentionally **not** in the v0.1.0 release. It's a binary that needs a `bin` field at root for `pnpm exec ensemble` to work, and we haven't designed that invocation story yet. The package stays in-repo for development; just isn't exposed by root `exports`.

### `packages/guest/*` added to `pnpm-workspace.yaml`

The original config only had `packages/*` and `demos/*`. The guest sub-packages (`packages/guest/core`, `packages/guest/cloudflare`) are one level deeper. Without `packages/guest/*`, pnpm didn't see them as workspace members and `workspace:*` references failed on fresh installs.

---

## Verification: from-scratch consumer test

You can manually verify a release works end-to-end without leaving your laptop:

```bash
# 1. From workspace root, pack the tarball.
pnpm pack
# → ensemble-edge-workspace-<version>.tgz

# 2. In a separate directory, install + smoke test.
cd /tmp && rm -rf check && mkdir check && cd check
pnpm init
pnpm add /path/to/workspace/ensemble-edge-workspace-<version>.tgz \
  react react-dom hono
pnpm add -D @types/react @types/react-dom @cloudflare/workers-types typescript

cat > test.ts <<'EOF'
import { hashPassword } from '@ensemble-edge/workspace/auth';
import { createWorkspace } from '@ensemble-edge/workspace/core';
import { Button } from '@ensemble-edge/workspace/ui';
console.log(typeof hashPassword, typeof createWorkspace, typeof Button);
EOF

pnpm exec tsc --noEmit test.ts  # types should resolve
```

For a Tailwind v4 check, add a CSS entry and run the CLI:

```bash
cat > styles.css <<'EOF'
@import '@ensemble-edge/workspace/ui/globals.css';
@source './*.{ts,tsx}';
EOF

pnpm add -D tailwindcss @tailwindcss/cli
pnpm exec tailwindcss -i ./styles.css -o ./out.css
grep -c '\.bg-primary' out.css  # should be > 0
```

For a CF Workers bundle check:

```bash
pnpm add -D esbuild
pnpm exec esbuild test.ts --bundle --platform=neutral \
  --conditions=worker,import --outfile=worker.js --format=esm
```

---

## Verification: from curalisto-app's side

Once you push the tag:

```bash
# In curalisto-app
cd apps/admin   # or wherever your worker lives
pnpm add github:ensemble-edge/workspace#v0.1.0
```

Then update your admin worker's source to import from `@ensemble-edge/workspace/*` subpaths (replace any old `@ensemble-edge/core`, `@ensemble-edge/ui` etc. imports). Your CSS entry in the admin worker:

```css
@import '@ensemble-edge/workspace/ui/globals.css';
@source './src/**/*.{ts,tsx}';
```

Run your usual `pnpm dev` / `wrangler dev`. The peer-dep check at install time will warn if React is missing — install it and you're good.

---

## Cutting a hotfix release

If `v0.1.0` is broken and you need a patch:

1. From `main`, fix the bug and merge.
2. `pnpm release 0.1.1` from main.
3. Push the new tag.

You don't need to delete the old release branch — leave it alone. Consumers pinned to `v0.1.0` keep working; new installs use `v0.1.1`.

If `main` has work-in-progress you don't want to ship, branch from the bad tag, cherry-pick the fix, run release on that branch. The script doesn't enforce "must be on main" via tag history, only by branch name — so check the branch name with `--dry-run` first.

---

## Known limitations

- **No `bin` for the CLI.** Deferred. See [§ Design choices](#design-choices).
- **`#main` installs are slow.** Build runs on install. Tag-based installs are fast.
- **No npm publish.** Intentional for pre-v1. When we go to v1, switch to publishing — these git-tarball steps go away.
- **No CHANGELOG automation.** Either write it manually in `CHANGELOG.md` before tagging, or skip until we hit v1.
- **The Tailwind v4 `@source` glob walks dist/ JS for class strings.** This means changing a Tailwind class in a workspace component requires rebuilding (which a release does). Consumers running `#main` get this for free via `prepare`; consumers on tags get whatever the release was built with.

---

## File map

The release machinery lives in three files:

- [`scripts/release.mjs`](./scripts/release.mjs) — what you run to cut a release.
- [`scripts/build-all.mjs`](./scripts/build-all.mjs) — builds every released package in dependency order.
- [`scripts/rewrite-cross-package-imports.mjs`](./scripts/rewrite-cross-package-imports.mjs) — rewrites bare specifiers in dist/ so single-tarball install works.
- [`scripts/prepare.mjs`](./scripts/prepare.mjs) — `pnpm install` hook for `#main` installs.

Per-package build config: each released package has a `tsconfig.build.json` that emits to `dist/` with declarations.
