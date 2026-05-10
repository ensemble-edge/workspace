# Curalisto consumer feedback on `@ensemble-edge/workspace` v0.1.0

Captured while wiring up the first real consumer (`cl-workspace`). This doc is **a parked plan, not a tracking system** — fix items here when you get to them, or open issues if you want assignment.

Last reviewed: 2026-05-10.

---

## Verbatim feedback (do not edit)

The following is the original feedback as received. Preserved verbatim so future readers can see what was actually observed vs. interpreted.

### Install / publish

- ✅ `pnpm add github:ensemble-edge/workspace#v0.1.0` works cleanly. `prepare` script detects shipped `dist/` and skips rebuild — perfect.
- ⚠️ The `templates/workspace/` directory in the repo is **stale**. `worker.ts`, `ensemble.config.ts`, and `package.json` all import from `@ensemble-edge/core` (the dev-tree internal package name), which doesn't exist for external consumers. Consumers following the template instead of `RELEASING.md` will hit immediate import errors. **Fix:** rewrite template files to use `@ensemble-edge/workspace/core` + the published install spec.
- ⚠️ Template's `wrangler.toml` declares bindings (D1, KV, R2) with empty IDs and no commented hint that they need to be filled in. A first-time consumer running `wrangler dev` against the template fails with cryptic errors. **Fix:** ship the template with `REPLACE_WITH_*` placeholders + comments explaining each.

### Secrets handling (BLOCKER for sec-conscious consumers)

- **Workspace reads `env.JWT_SECRET` as a synchronous `string`** (verified at `packages/core/dist/types.d.ts:16` — `JWT_SECRET: string`).
- **CF Secrets Store bindings are async** — they return a `SecretsStoreSecret` object with a `.get(): Promise<string>` method.
- This means consumers **cannot use CF Secrets Store** for `JWT_SECRET` (or any other workspace-managed secret). They MUST use `wrangler secret put`, which is the older per-worker secret pattern.
- For projects with a "no per-worker secrets" policy (curalisto, heart-hands), this forces an exception.
- **Fix:** In v0.2.0, support secrets that are either `string` OR `SecretsStoreSecret`. Resolve them lazily at request time. The auth code should `await secret.get?.() ?? secret`.
- Also: the error message *"Set it with: `wrangler secret put JWT_SECRET`"* should accept *any* binding name pattern and not assume the per-worker secret API.

### API surface

- The `createWorkspace` signature shipped is `WorkspaceConfig = { workspace: {...}, brand: {...} }`, but the `templates/workspace/worker.ts` and `templates/workspace/ensemble.config.ts` use the older flat shape `{ name, slug, theme: { primaryColor } }`. **Sync the templates and the runtime to the same config shape.**
- `WorkspaceConfig` is exported from `/core/types` but the type isn't referenced in `RELEASING.md`'s example imports. Worth adding to the doc.
- No `WorkspaceInstance` returned from `createWorkspace` exposes a `queue()` or `scheduled()` handler. Consumers wanting to add cron/queue handlers to the workspace worker would have to wrap it. Document the wrapping pattern, or add optional extension points.

### Documentation gaps

- `RELEASING.md` Tailwind v4 integration section is referenced but not shown in the snippet I saw — should walk through what a consumer's CSS entry file looks like.
- No mention of *required* `[vars]` or env vars the worker expects at runtime (auth secrets like `AUTH_SECRET` for JWT signing). Consumer hits this on first request.
- No "minimum viable workspace" example. What's the smallest possible config that produces a working worker that boots? RELEASING shows imports but not a runnable worker.

### Build / runtime

- `compatibility_flags = ["nodejs_compat"]` not mentioned anywhere but workspace bundles `better-sqlite3` (a native node module). On Cloudflare Workers, this MUST be either gated out of the bundle or excluded entirely — workers can't run native code. Need to verify this doesn't blow up at deploy time.
- `peerDependenciesMeta.optional` on React is great for backend-only consumers, but a backend-only consumer importing `/core` accidentally gets React in their bundle via transitive imports from `/shell` or `/ui`. Worth checking the import graph to ensure pure backend imports don't pull React.

### Nice-to-haves (later)

- A `RELEASING.md` checklist for "did this release ship cleanly" — verify `dist/` is in the release branch, verify exports resolve from a sandbox install, etc. The release script does this implicitly but a checklist is easier to scan.
- A `STARTER.md` or `examples/minimal-cf-worker/` that a consumer can copy verbatim, fill in 3 IDs, and deploy.
- Versioned dist could include a `RELEASE.md` per release listing breaking changes between consumer-facing versions (currently CHANGELOG isn't shipped — `files` list excludes it).

### Things working well

- Subpath exports map is clean and well-organized.
- Peer dep contract for React 18/19 is correctly declared as optional.
- The `prepare` script gating ("dist/ artifacts present — skipping build") is exactly the right behavior for installs from a release tag.
- RELEASING.md as the canonical install guide is the right call (template is wrong, doc is right).

---

## Proposed response plan

Tiered by cost/impact, not priority order. Pick by what's most blocking when you next sit down.

### Tier 1 — v0.1.1 (templates + docs)

Cheapest, highest-impact. Every item here is "consumer follows our README and hits a wall." Estimated 30 minutes.

| Item | Where | What to do |
|---|---|---|
| Template imports wrong package name | [`templates/workspace/worker.ts`](../templates/workspace/worker.ts), [`templates/workspace/ensemble.config.ts`](../templates/workspace/ensemble.config.ts), [`templates/workspace/package.json`](../templates/workspace/package.json) | Replace every `@ensemble-edge/core` with `@ensemble-edge/workspace/core`. `package.json` should depend on `@ensemble-edge/workspace` not the sub-packages. |
| Template uses old config shape | Same files | Update to current `{ workspace: {...}, brand: {...} }` shape. Cross-reference [`packages/core/src/mode/define-config.ts`](../packages/core/src/mode/define-config.ts) for the source of truth. |
| `wrangler.toml` empty IDs | [`templates/workspace/wrangler.toml`](../templates/workspace/wrangler.toml) | Replace each empty `id = ""` with `id = "REPLACE_WITH_D1_ID"` etc. Add `# Run: wrangler d1 create my-workspace-db` comments above each binding. |
| Tailwind walkthrough incomplete | [`RELEASING.md`](../RELEASING.md) § Tailwind v4 integration | Show a concrete consumer `src/styles.css` file with `@import` + `@source` paths and explain where in the file tree it lives. |
| Required env vars not documented | [`RELEASING.md`](../RELEASING.md) | Add a "Runtime expectations" section listing every `env.*` workspace reads (`JWT_SECRET`, `DB`, `KV`, `R2`, `ENVIRONMENT`). Cross-link from the install section. |
| `WorkspaceConfig` type not in examples | [`RELEASING.md`](../RELEASING.md) | Add the type import to the example block. |
| No minimum-viable example | New: `examples/minimal-cf-worker/` | 4 files: `package.json`, `wrangler.toml`, `src/worker.ts` (calls `createWorkspace`), `src/styles.css`. Should run with 3 IDs filled in. |
| Template directory typechecks should run | [`tsconfig.json`](../tsconfig.json) exclude list | Currently `templates` is excluded from typecheck, which is how the template rotted. Add a per-template tsconfig that the release preflight can run against. Or at minimum, a smoke-test step in the release script that does `cd templates/workspace && pnpm install --offline && pnpm exec tsc --noEmit`. |

**Verification before tagging v0.1.1:**

1. From a fresh `/tmp/v0.1.1-test/`, copy the template, fill in 3 placeholders, run `wrangler dev --dry-run`. Should boot to "no errors."
2. Re-run the GitHub-tag install test from RELEASING.md against `v0.1.1`.

### Tier 2 — v0.1.2 (async secrets)

The actual blocker, but big enough to want isolation from Tier 1.

**Plan:**

1. **Add a secret-resolver helper.** New file `packages/core/src/utils/secrets.ts`:
   ```ts
   export type SecretLike = string | { get(): Promise<string> };
   export async function resolveSecret(s: SecretLike | undefined): Promise<string> {
     if (s == null) throw new Error('Missing required secret');
     if (typeof s === 'string') return s;
     if (typeof s.get === 'function') return s.get();
     throw new Error('Secret binding is neither a string nor a SecretsStoreSecret');
   }
   ```

2. **Loosen `Env.JWT_SECRET` type** in [`packages/core/src/types.ts`](../packages/core/src/types.ts):
   ```ts
   JWT_SECRET: SecretLike;
   ```

3. **Thread `await resolveSecret(...)` through every JWT touchpoint**:
   - [`packages/core/src/utils/jwt.ts`](../packages/core/src/utils/jwt.ts) — `signAccessToken`, `signRefreshToken`, `verifyAccessToken`, `verifyRefreshToken` all currently take `secret: string`. Change to `SecretLike`, resolve at entry.
   - [`packages/core/src/services/auth.ts`](../packages/core/src/services/auth.ts) — any `env.JWT_SECRET` usage.
   - [`packages/core/src/middleware/auth.ts`](../packages/core/src/middleware/auth.ts) — same.
   - [`packages/core/src/routes/auth.ts`](../packages/core/src/routes/auth.ts) — same.

4. **Update the error message** when `JWT_SECRET` is missing. Currently it suggests `wrangler secret put`; change to:
   > Provide `JWT_SECRET` as a `wrangler secret`, a Secrets Store binding, or a `var` (dev only).

5. **Document in RELEASING.md** under "Runtime expectations" that secrets can be any of three shapes.

**Verification:** Build a consumer with a fake `SecretsStoreSecret` binding (object with `get()` method) and confirm token signing/verification round-trip works.

### Tier 3 — v0.2.0 (design conversations, not patches)

These need a sit-down decision before coding. Listed so they don't get forgotten.

#### In-process app registration (discovered 2026-05-10, then re-verified after pushback)

A consumer trying to add a small custom app to their workspace has no good path in v0.1.0:

- `createWorkspace()` hardcodes registration of workspace's own core apps. No public hook to add more.
- The `guest_apps` table + `/_ensemble/apps/*` gateway ([packages/core/src/routes/guest-gateway.ts](../packages/core/src/routes/guest-gateway.ts)) is the right URL space and the sidebar reads from it via `/_ensemble/nav` ([create-workspace.ts:286-298](../packages/core/src/create-workspace.ts#L286-L298)), BUT every `guest_apps` row requires either `connection_type: 'service_binding'` or `'http'` ([migration 002](../packages/core/src/db/migrations/002_guest_apps.ts)). Neither resolves to a local Hono handler.
- The shell is sealed Preact — no consumer client-route injection. UI must come from server-rendered HTML or a separate worker.

So a consumer's only working v0.1.0 path is **deploying a second Worker** (or remote HTTP service), connecting via service binding, registering in `guest_apps`. That works (curalisto is going to do this for quiz-cms), but it's overkill for trusted, small UI surfaces. We surface `@ensemble-edge/workspace/guest/cloudflare` as a real published export — make sure that path is solid since it's the only available one.

**Proposed for v0.2.0:** add `connection_type: 'in_process'` to the `guest_apps` schema and a `createWorkspace({ apps: [...] })` registration hook. The gateway gets a third dispatch branch (`proxyViaLocalHandler`) that calls into a Hono sub-app registered at workspace-creation time. Same URL space, same middleware inheritance, same sidebar integration — just no second Worker required for trusted apps.

**Migration story:** Apps built today via `@ensemble-edge/workspace/guest/cloudflare` should be able to move to in-process by changing the `connection_type` row and the wiring (no manifest or route changes). Preserves curalisto's investment.

**Bonus design surface to think through during this work:** does the in-process branch want to expose a "render a registered React component in the viewport" hook? That would let consumers ship a real component-based UI (currently impossible because the shell is sealed Preact). Probably yes — but the shell would need to grow a registration mechanism for consumer components, which is a meaningful expansion. Defer until in-process backend dispatch is shipped and we see whether the "guest worker returning HTML" pattern is actually painful enough to justify it.

#### Extension points for `queue()` / `scheduled()` handlers

Two viable shapes — pick one before implementing:

**A. Returned object pattern** (consumer composes):
```ts
const { fetch } = createWorkspace(config);
export default {
  fetch,
  queue: async (batch, env) => { /* consumer's handler */ },
  scheduled: async (event, env) => { /* consumer's handler */ },
};
```
Pro: flexible, no surprise behavior. Con: consumer must know to construct the export.

**B. Config-driven pattern** (workspace composes):
```ts
export default createWorkspace({
  ...config,
  handlers: {
    queue: (batch, env) => { ... },
    scheduled: (event, env) => { ... },
  },
});
```
Pro: discoverable, single export. Con: workspace becomes opinionated about every handler shape.

Lean: **A**. Consumers who want CF Workers feature X should be able to add X without workspace knowing X exists.

#### Audit React leakage in backend-only bundles

The claim is `/core` pulls React via transitive imports through `/shell` or `/ui`. **Verify before patching.**

```bash
# In a fresh consumer that only imports /core and /auth:
pnpm exec esbuild src/worker.ts --bundle --platform=neutral \
  --conditions=worker,import --metafile=meta.json --outfile=out.js
# Grep meta.json for react entries:
grep -c 'node_modules/react/' meta.json
```

If 0, this is a non-issue and the feedback was speculation. If >0, the fix is making [`packages/core/src/index.ts`](../packages/core/src/index.ts) not re-export anything React-dependent at the top level — split that into `/core/shell-runtime` or similar.

#### Better-sqlite3 / `nodejs_compat`

Same approach: verify before patching. Run a Workers-targeted esbuild and grep the bundle for `better-sqlite3`. If present, it's a real problem; if absent, document `nodejs_compat` as not required.

If present, the fix is gating `better-sqlite3` behind a runtime check (it's only used in [`packages/core/src/db/`](../packages/core/src/db/) for local dev tooling, never on the request path) or moving Node-only paths to a separate subpath consumers don't import in Workers.

### Pushed back on (won't do)

- **CHANGELOG in `files`** — pre-v1, every release is ad-hoc. Maintenance cost > value until the API stabilizes. Revisit at v1.
- **"Did this release ship cleanly" sidecar checklist** — the verification recipes in RELEASING.md already cover this. Better path: make `scripts/release.mjs` print a numbered list of what it ran and verified, rather than maintaining a parallel doc.

---

## Issue ordering when you sit down

1. **First**: rewrite [`templates/workspace/`](../templates/workspace/) (the biggest gotcha for new consumers).
2. **Second**: add the runtime env vars + Tailwind file-level walkthrough to RELEASING.md.
3. **Third**: ship `examples/minimal-cf-worker/`.
4. **Cut v0.1.1.**
5. Sit down separately for the secrets refactor (v0.1.2) — don't bundle with the doc work.
6. Defer v0.2.0 items until you actually need queue/scheduled handlers or measure a real React-leak bundle problem.
