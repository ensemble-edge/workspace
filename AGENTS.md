# Ensemble Workspace — Agent Instructions

> This file provides context and rules for AI agents (Claude Code, OpenCode, Cursor, etc.) working on the Ensemble workspace monorepo.

---

## Repository Overview

Ensemble is a **workspace platform** — a shell that loads themed apps for team collaboration. Think of it as a white-label operating system for business apps.

### Key Concepts

- **Workspace** — A deployed instance (e.g., `hub.acme.com`). Contains users, apps, brand config, data.
- **Shell** — The Preact SPA that provides the UI chrome (sidebar, toolbar, viewport, AI panel).
- **Core Apps** — Built-in apps that ship with every workspace (People, Brand, Admin, Files, etc.).
- **Bundled Apps** — Optional first-party apps the developer can include (Docs, Tasks, etc.).
- **Guest Apps** — Third-party apps that run in sandboxed iframes or as separate Workers.
- **Deployment Modes** — Standalone (self-contained) or Ensemble Cloud (managed shell + auth).

### Architecture

```
Browser → [Proxy or Worker] → Workspace Worker → D1/KV/R2
                                    │
                              ┌─────┴─────┐
                              ▼           ▼
                          Core Apps   Guest Apps
```

---

## Monorepo Structure

```
workspace/
├── packages/
│   ├── core/           # @ensemble-edge/core — workspace engine
│   ├── shell/          # @ensemble-edge/shell — Preact SPA (extracted)
│   ├── auth/           # @ensemble-edge/auth — auth module (extracted)
│   ├── ui/             # @ensemble-edge/ui — themed components
│   ├── sdk/            # @ensemble-edge/sdk — extension hooks
│   ├── cli/            # @ensemble-edge/cli — CLI tool
│   └── guest/
│       ├── core/       # @ensemble-edge/guest — platform-agnostic SDK
│       └── cloudflare/ # @ensemble-edge/guest-cloudflare — CF adapter
├── demos/
│   └── simple/         # Primary development workspace
├── native/             # Tauri desktop app
├── examples/           # Example workspaces
├── templates/          # Starter templates
├── skills/             # Agent skill files
└── docs/               # Documentation
```

---

## Development Workflow

### Before Every Commit

1. **Lint** — `bun run lint:quick` (must pass, sub-second)
2. **Typecheck** — `bun run typecheck` (must pass)
3. **Test** — `bun run test` (must pass if touching tested code)

### Commands

| Command | Purpose |
|---------|---------|
| `bun run dev` | Start dev server for all packages |
| `bun run build` | Build all packages |
| `bun run typecheck` | TypeScript type checking |
| `bun run lint:quick` | Fast lint with oxlint |
| `bun run lint` | Full lint |
| `bun run test` | Run all tests |
| `bun run knip` | Find dead code and unused exports |
| `bun --filter @ensemble-edge/core dev` | Dev server for core package only |
| `bun --filter ensemble-demo dev` | Dev server for demo workspace |

### Package-Specific Development

```bash
# Work on the shell
cd packages/shell
bun run dev

# Work on auth
cd packages/auth
bun run test

# Work on the demo workspace
cd demos/simple
bun run dev
```

---

## Code Conventions

### TypeScript

- Use `type` imports: `import type { Foo } from './foo'`
- Prefer `interface` for object shapes, `type` for unions/intersections
- No `any` — use `unknown` and narrow
- Explicit return types on exported functions

### File Organization

- **Domain-based** in core: `workspace/`, `apps/`, `gateway/`, `permissions/`, etc.
- One export per file when possible
- Index files re-export public API: `export * from './foo'`
- Tests co-located: `foo.ts` → `foo.test.ts`

### Naming

- Files: `kebab-case.ts`
- Types/Interfaces: `PascalCase`
- Functions/Variables: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- React/Preact components: `PascalCase.tsx`

### Imports Order

```typescript
// 1. Node/external modules
import { Hono } from 'hono'
import { signal } from '@preact/signals'

// 2. Internal packages
import { Button } from '@ensemble-edge/ui'
import type { User } from '@ensemble-edge/core'

// 3. Relative imports
import { validateEmail } from './utils'
import type { AuthConfig } from './types'
```

---

## Testing

### Unit Tests (Vitest)

- Test files: `*.test.ts`
- Run: `bun run test`
- Use real data structures, not mocks (when possible)
- Test behavior, not implementation

```typescript
import { describe, it, expect } from 'vitest'
import { validateManifest } from './manifest'

describe('validateManifest', () => {
  it('rejects manifest without id', () => {
    const result = validateManifest({ name: 'Test' })
    expect(result.valid).toBe(false)
  })
})
```

### E2E Tests (Playwright)

- Test files: `e2e/*.spec.ts`
- Run: `bun run test:e2e`
- Test against demo workspace

---

## Key Files to Understand

| File | Purpose |
|------|---------|
| `packages/core/src/create-workspace.ts` | Main entry point — creates the Hono app (standalone) |
| `packages/core/src/create-workspace-v2.ts` | Mode-aware factory (standalone + cloud) |
| `packages/core/src/mode/index.ts` | Standalone vs Cloud mode detection |
| `packages/core/src/shell/components/Shell.tsx` | Main shell layout component |
| `packages/core/src/shell/components/Viewport.tsx` | App viewport with client-side routing |
| `packages/core/src/shell/state/` | Preact Signals state management |
| `packages/core/src/middleware/` | Auth, CORS, workspace resolver middleware |
| `demos/simple/src/index.ts` | Example workspace configuration |

---

## Documentation

```
docs/
├── spec/       # WHAT — Product vision, architecture, domain specs
├── plan/       # HOW — Active implementation plans (what we're building now)
├── backlog/    # LATER — Well-spec'd future work, not yet active
└── archive/    # DONE — Completed or superseded plans
```

### Key Specs

| Doc | Content |
|-----|---------|
| `docs/spec/00-workspace.md` | Complete workspace specification (~6000 lines) |
| `docs/spec/02-app-architecture.md` | Three-tier app model (core/bundled/guest) |
| `docs/spec/05-guest-sdk.md` | Guest app SDK and manifest format |

### Active Plans

| Doc | Content |
|-----|---------|
| `docs/plan/00-status.md` | Project status — what's built vs. not |
| `docs/plan/01-app-contract.md` | Phase 1: Core app contract + Viewport refactor |
| `docs/plan/02-core-apps.md` | Phase 2: Build the 8 core apps |
| `docs/plan/03-shell-extract.md` | Phase 3: Extract shell as @ensemble-edge/shell |
| `docs/plan/04-cloud-mode.md` | Phase 4: Edge proxy + cloud mode |

---

## Common Tasks

### Adding a New Package

1. Create `packages/<name>/` directory
2. Add `package.json` with `@ensemble-edge/<name>` name
3. Add to root `package.json` workspaces (already covered by `packages/*`)
4. Run `bun install` to link

### Adding a New Core App

1. Create `packages/core/src/apps/core/<app-name>/`
2. Add manifest in `manifest.ts`
3. Add routes in `routes.ts`
4. Register in `packages/core/src/apps/core/index.ts`

### Adding a New Shell Component

1. Create in `packages/shell/src/components/`
2. Export from `packages/shell/src/components/index.ts`
3. Add Storybook story if complex

### Changing Database Schema

1. Create new migration in `packages/core/src/db/migrations/`
2. Increment migration number: `002_add_foo.ts`
3. Test migration locally before committing

---

## Deployment Modes

### Standalone Mode

The workspace Worker handles everything:
- Shell serving (bundled in Worker)
- Auth (magic link, password, OIDC)
- Session management (JWT cookies)
- API routes

### Ensemble Cloud Mode

Ensemble's proxy handles shell + auth:
- Shell served from R2 (globally cached)
- Auth via `app.ensemble.ai`
- Worker receives pre-authenticated requests with `X-Ensemble-User` header
- Worker is pure JSON API

**Config flag:** `mode: 'standalone' | 'cloud'` in `ensemble.config.ts`

---

## Troubleshooting

### "Module not found" errors

```bash
bun install  # Re-link workspace packages
```

### Type errors after package changes

```bash
bun run typecheck --force  # Rebuild type cache
```

### Tests failing unexpectedly

```bash
bun run test --reporter=verbose  # See full output
```

### Lint errors

```bash
bun run lint:quick --fix  # Auto-fix what's possible
```

### Dev container / remote environment

This project runs in a dev container. When starting wrangler:

```bash
cd demos/simple && npx wrangler dev --port 8787 --ip 0.0.0.0
```

Use `--ip 0.0.0.0` to bind to all interfaces. To test from the CLI, use `http://127.0.0.1:8787` (not `localhost`, which may not resolve correctly in all containers). The `package.json` in `packages/core` points to source files (`src/index.ts`) instead of `dist/` so wrangler compiles TypeScript directly — no build step needed during development.

---

## Questions?

- Check `docs/spec/` for detailed specifications
- Check `docs/plan/` for current implementation status
- File structure follows domain-based organization
