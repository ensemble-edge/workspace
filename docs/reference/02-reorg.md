# Ensemble Workspace → EmDash Alignment

Structural comparison and concrete action plan to align `ensemble-edge/workspace` with the patterns established in `emdash-cms/emdash`.

---

## 1. Side-by-Side: Monorepo Root

| Aspect | EmDash (`emdash-cms/emdash`) | Ensemble (`ensemble-edge/workspace`) | Gap |
|---|---|---|---|
| Package manager | **pnpm** workspaces | **Bun** workspaces | Different runtime — fine, but see catalog gap below |
| Task runner | pnpm `--filter` scripts (no Turbo) | **Turbo** | EmDash runs all tasks through pnpm filter scripts directly. Simpler, fewer moving parts. |
| Workspace config | `pnpm-workspace.yaml` with `catalog:` for shared dep versions | `package.json` `"workspaces"` field | **Missing: version catalog.** Bun doesn't support `catalog:` natively. You need a different strategy (see below). |
| Linting | **oxlint** (sub-second `lint:quick`) + oxfmt | **Prettier** only | **Missing: linter.** No linter at all in Ensemble. |
| Formatting | **oxfmt** (primary) + Prettier (Astro only) | **Prettier** (all files) | Fine — but oxfmt is 10-100x faster for the agent loop |
| Build tool | **tsdown** (per-package) | `tsc --build` (project references) | EmDash uses tsdown for production bundle output. `tsc --build` only does type-checking + declaration emit. |
| Testing | **Vitest** + real SQLite (no mocks) + **Playwright** E2E | **Vitest** (configured but no tests written) | **Missing: actual tests, E2E setup** |
| Changesets | ✅ `@changesets/cli` + `@changesets/changelog-github` | ✅ `@changesets/cli` | Parity. But EmDash adds GitHub changelog integration. |
| Dead code | **Knip** | ❌ None | Missing |
| Dep management | **Renovate** (`renovate.json`) | ❌ None | Missing |
| TypeScript | **6.0-beta** root / **5.9** catalog | **5.4** | Stale — should bump |
| Agent instructions | **AGENTS.md** + **CLAUDE.md** (symlink) + `.claude/skills/` + `.opencode/skills/` → `skills/` | ❌ None | **Big gap.** EmDash is built for agent-assisted dev. Ensemble has zero agent scaffolding. |

## 2. Side-by-Side: Package Decomposition

### EmDash packages (7 packages + plugins namespace)

```
packages/
├── core/              # emdash — THE package. Astro integration, APIs, admin UI, CLI
├── admin/             # @emdash-cms/admin — React admin SPA (separate build)
├── auth/              # @emdash-cms/auth — passkeys, OAuth, magic links
├── blocks/            # @emdash-cms/blocks — Portable Text block definitions
├── cloudflare/        # @emdash-cms/cloudflare — CF adapter (D1, R2, Worker sandbox)
├── create-emdash/     # create-emdash — npm create scaffolder
├── gutenberg-to-pt/   # @emdash-cms/gutenberg-to-portable-text — migration
└── plugins/           # nested workspace: packages/plugins/*
    ├── forms/
    ├── embeds/
    ├── seo/
    ├── audit-log/
    └── ...
```

### Ensemble packages (6 packages)

```
packages/
├── core/              # @ensemble-edge/core — workspace engine, shell, gateway, services
├── sdk/               # @ensemble-edge/sdk — extension hooks
├── ui/                # @ensemble-edge/ui — Preact + Tailwind components
├── cli/               # @ensemble-edge/cli — ensemble init/dev/deploy
└── guest/
    ├── core/          # @ensemble-edge/guest — platform-agnostic guest SDK
    └── cloudflare/    # @ensemble-edge/guest-cloudflare — CF adapter
```

### Key Structural Differences

**EmDash extracted auth as a standalone package; Ensemble didn't.** EmDash's `@emdash-cms/auth` handles passkeys/WebAuthn, OAuth, and magic links independently. In Ensemble, auth lives inside `packages/core/src/services/`. Given that Ensemble auth (workspace membership, guest app capability tokens, agent auth) is at least as complex as EmDash's, this should be extracted.

**EmDash extracted the admin UI as a separate package; Ensemble didn't.** EmDash's `@emdash-cms/admin` is a React SPA with its own build pipeline (browser tests via Playwright). In Ensemble, the shell SPA (Preact) lives inside `packages/core/src/shell/`. Extracting it would let you run browser tests independently and keep the core package focused on the Worker runtime.

**EmDash has a Cloudflare adapter package; Ensemble has `guest-cloudflare` but no core adapter.** EmDash's `@emdash-cms/cloudflare` isolates all CF-specific code (D1 bindings, R2 bindings, Worker Loader for plugin sandboxing) behind a clean adapter interface. The core package uses portable abstractions (Kysely for SQL, S3 API for storage). Ensemble's core is **hard-wired to Cloudflare** — D1, KV, R2, Durable Objects are used directly. There's no portability layer. This is fine if you never intend to run outside CF, but EmDash's approach is more resilient.

**EmDash has `packages/plugins/*` as nested workspaces; Ensemble has no plugin/connector namespace.** Guest apps and connectors are external repos. There's no first-party connector set in the monorepo. EmDash ships with forms, embeds, SEO, audit-log etc. as proof that the plugin API works.

**Ensemble has `packages/ui` extracted; EmDash doesn't.** EmDash's admin components live inside `packages/admin`. Ensemble already separated the themed component library (`@ensemble-edge/ui`). This is actually ahead of EmDash.

**Ensemble has `native/` (Tauri); EmDash doesn't.** Ensemble has native app scaffolding in the monorepo. EmDash is web-only.

## 3. Side-by-Side: Core Package Internals

### EmDash `packages/core/` (inferred from docs + AGENTS.md)

```
packages/core/
├── src/
│   ├── index.ts           # Main export: emdash() Astro integration
│   ├── cli/               # CLI commands (types, seed, etc.)
│   ├── api/               # REST API routes
│   ├── admin/             # Admin panel injection into Astro
│   ├── content/           # Content type system, collections, Portable Text
│   ├── db/                # Database layer (Kysely abstractions)
│   │   ├── schema.ts      # SQL schema definitions
│   │   ├── migrations/    # Migration files
│   │   └── adapters/      # SQLite, D1, Turso, PostgreSQL
│   ├── storage/           # File storage abstraction (S3 API)
│   ├── plugins/           # Plugin system (definePlugin, hooks, sandbox)
│   ├── media/             # Media library, signed URLs
│   ├── search/            # Full-text search (FTS5)
│   └── types/             # Shared type definitions
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### Ensemble `packages/core/` (from our design conversations)

```
packages/core/
├── src/
│   ├── create-workspace.ts   # Main export: createWorkspace()
│   ├── middleware/            # Hono middleware chain
│   ├── routes/                # API routes
│   ├── shell/                 # Preact shell SPA (sidebar, toolbar, viewport, AI panel)
│   ├── apps/
│   │   ├── core/              # 8 core apps (Settings, Users, Apps, Files, etc.)
│   │   └── bundled/           # 7 bundled apps
│   ├── services/
│   │   ├── theme.ts
│   │   ├── i18n.ts
│   │   ├── permissions.ts
│   │   ├── gateway.ts         # API gateway + guest app proxy
│   │   ├── app-registry.ts
│   │   ├── knowledge.ts
│   │   ├── event-bus.ts
│   │   └── notifications.ts
│   ├── db/
│   │   └── migrations/
│   └── locales/
│       └── en.json
├── package.json
└── tsconfig.json
```

### Structural Observations

EmDash's core is organized by **domain** (content, media, search, plugins, storage, db). Each domain encapsulates its own types, routes, and logic. The API routes are a thin layer over domain services.

Ensemble's core is organized by **layer** (middleware, routes, shell, services, apps, db). This is the typical Hono/Express pattern but it means cross-cutting concerns (e.g., "everything about permissions") are scattered across multiple directories.

EmDash's approach scales better because when you need to understand how search works, you look in `src/search/`. In Ensemble, understanding how permissions work requires looking at `services/permissions.ts`, the middleware, the routes that enforce permissions, and the shell components that display permission UI.

## 4. Action Plan: What To Change

### Phase 1: Tooling Parity (do first — low risk, high signal)

1. **Add oxlint** — `bun add -D oxlint` at root. Add `lint:quick` and `lint` scripts matching EmDash's pattern. The sub-second feedback loop matters for Claude Code sessions.

2. **Add AGENTS.md** — Create `AGENTS.md` at repo root with workflow rules, lint-before-commit discipline, testing conventions. Symlink `CLAUDE.md → AGENTS.md`. Create `skills/` directory with skill files for core development. Wire `.claude/skills → skills/` and `.opencode/skills → skills/`.

3. **Add Knip** — `bun add -D knip`. Add `knip` script. Catches dead exports and unused dependencies early.

4. **Add Renovate** — `renovate.json` at root. Keeps dependencies current automatically.

5. **Bump TypeScript** — Move from 5.4 to 5.9+. You're two major minor versions behind.

6. **Add tsdown** (or keep tsc --build) — EmDash uses tsdown for each package's production build. If you want publishable ESM + CJS bundles with proper exports maps, you need a bundler. `tsc --build` only emits declarations.

7. **Consider dropping Turbo** — EmDash runs everything through `pnpm --filter` scripts with no Turbo. Since you're using Bun (which is already fast), Turbo adds a layer of config and caching that may not be worth it for a repo this size. At minimum, move the critical scripts (typecheck, lint, test) to direct `bun --filter` commands so they don't depend on Turbo's task graph.

### Phase 2: Package Extraction (do second — moderate refactor)

8. **Extract `@ensemble-edge/auth`** — Pull auth out of `packages/core/src/services/` into `packages/auth/`. This package handles workspace membership, passkeys/WebAuthn, OAuth providers, capability tokens for guest apps, and agent authentication. EmDash did this and it gives auth its own test suite, security review surface, and potential for reuse.

9. **Extract `@ensemble-edge/shell`** (equivalent to EmDash's `@emdash-cms/admin`) — Pull the Preact shell SPA out of `packages/core/src/shell/` into `packages/shell/`. This lets you run browser tests (Playwright) against the shell independently, iterate on UI without rebuilding core, and keep `packages/core` focused on the Worker runtime.

10. **Add `packages/connectors/*`** as nested workspaces (equivalent to EmDash's `packages/plugins/*`) — Create a few first-party connectors (Stripe, Google Drive, Slack) inside the monorepo. This proves the guest app / connector API works and gives you reference implementations. Add `"packages/connectors/*"` to your bun workspaces config.

### Phase 3: Core Reorganization (do third — bigger refactor)

11. **Reorganize core from layer-based to domain-based** — Restructure `packages/core/src/` to match EmDash's pattern:

```
packages/core/src/
├── index.ts              # createWorkspace() — main export
├── workspace/            # Workspace lifecycle, config, branding
├── auth/                 # (thin re-export layer after extraction)
├── apps/                 # App registry, manifest validation, lifecycle
├── gateway/              # API gateway, guest app proxy, routing
├── permissions/          # RBAC, capability tokens, policy engine
├── knowledge/            # Knowledge base, RAG, search
├── events/               # Event bus, real-time (Durable Objects)
├── notifications/        # Notification system
├── media/                # File storage (R2), uploads, signed URLs
├── ai/                   # AI panel, agent orchestration, Workers AI
├── db/                   # D1 abstractions, migrations, schema
├── middleware/            # Hono middleware (auth, CORS, etc.)
├── routes/               # Thin API route layer over domains
└── types/                # Shared type definitions
```

12. **Add a portability layer** (optional — EmDash's strongest architectural bet) — Abstract D1 behind Kysely, R2 behind S3 API, KV behind a generic cache interface. This lets Ensemble run on non-CF runtimes (Node.js + SQLite for local dev, Turso for hybrid, etc.). EmDash's `@emdash-cms/cloudflare` adapter package is the pattern. You'd create `@ensemble-edge/cloudflare` for the CF-specific bindings and keep `@ensemble-edge/core` runtime-agnostic.

### Phase 4: Developer Experience (do alongside everything else)

13. **Add E2E tests** — `playwright.config.ts` at root. Write E2E tests against the demo workspace. EmDash uses real in-memory SQLite for unit tests (no mocks) and Playwright for E2E.

14. **Add demo workspace** — `demos/simple/` as a primary dev target (matching EmDash's pattern). This is different from `examples/demo/` — it's the workspace you actually develop against daily, kept in sync with templates.

15. **Add seed scripts** — `bun --filter ensemble-demo seed` to populate a dev workspace with sample data. EmDash has this and it makes onboarding trivial.

16. **Add `bun create ensemble`** — Equivalent to `npm create emdash`. `packages/create-ensemble/` scaffolder that generates a new workspace project.

---

## 5. Priority Matrix

| Action | Effort | Impact | Do When |
|---|---|---|---|
| Add AGENTS.md + skill files | 2 hours | High — unlocks agent-assisted dev | **Now** |
| Add oxlint | 30 min | High — sub-second lint feedback | **Now** |
| Bump TypeScript | 30 min | Medium — catches more bugs | **Now** |
| Add Knip | 30 min | Medium — finds dead code | **Now** |
| Extract `@ensemble-edge/auth` | 1-2 days | High — cleaner security boundary | **Next sprint** |
| Extract `@ensemble-edge/shell` | 1-2 days | High — independent browser testing | **Next sprint** |
| Add first-party connectors | 2-3 days | High — proves the API works | **Next sprint** |
| Reorganize core to domain-based | 2-3 days | High — scales better | **Next sprint** |
| Add Playwright E2E | 1 day | Medium — regression safety | **Next sprint** |
| Add demo workspace + seed | 1 day | Medium — dev experience | **Next sprint** |
| Add portability layer | 3-5 days | Medium — future flexibility | **Later** |
| Drop Turbo | 1 hour | Low — simplification | **Whenever** |
| Add Renovate | 15 min | Low — auto dep updates | **Whenever** |
| Add `bun create ensemble` | 1-2 days | Medium — onboarding | **Before public launch** |

---

## 6. What Ensemble Already Has That EmDash Doesn't

Not everything is a gap to close. Ensemble has some structural advantages:

- **`packages/ui`** — Extracted themed component library. EmDash's components are locked inside `packages/admin`.
- **`packages/guest/`** — Two-package guest SDK (platform-agnostic + CF adapter). EmDash plugins are all CF-or-in-process. Ensemble's approach is more flexible for multi-runtime guest apps.
- **`native/`** — Tauri v2 desktop app. EmDash is web-only.
- **AI panel as first-class shell component** — EmDash has MCP and agent skills but no persistent AI surface in the product. Ensemble's AI panel with context/tools/actions is a differentiator.
- **Guest agents** — EmDash has no concept of autonomous agents acting on behalf of users. Ensemble does.
- **Tilde addressing** — Namespace for workspaces and apps (`~acme`, `~acme/crm`). EmDash has no equivalent.

Keep these. They're your differentiation.