# Workstream 0: Reorg + Shell Shift Implementation

> A comprehensive plan to restructure the monorepo AND implement standalone/cloud deployment modes.

**Status:** Planning
**Prerequisites:** None
**Blocks:** All other workstreams (this is foundational)

---

## Why This Order

The reorg must come **before** implementing shell shift features because:

1. **Structure before features** — Clean package boundaries make the standalone/cloud mode logic easier to implement
2. **Tooling enables velocity** — oxlint, AGENTS.md, Knip help us move faster
3. **Package extraction** — `@ensemble-edge/shell` and `@ensemble-edge/auth` need to exist before we can conditionally bundle them

---

## Current State

```
workspace/
├── packages/
│   ├── core/           # @ensemble-edge/core — monolith (shell + auth + services + apps)
│   ├── sdk/            # @ensemble-edge/sdk — extension hooks
│   ├── ui/             # @ensemble-edge/ui — Preact components
│   ├── cli/            # @ensemble-edge/cli — CLI tool
│   └── guest/
│       ├── core/       # @ensemble-edge/guest — platform-agnostic
│       └── cloudflare/ # @ensemble-edge/guest-cloudflare — CF adapter
├── native/             # Tauri app (placeholder)
├── examples/           # Example workspaces
├── templates/          # Starter templates
└── docs/               # Documentation
```

**Problems:**
- `packages/core` is a monolith containing shell, auth, services, routes, apps
- No `AGENTS.md` or agent scaffolding
- No linter (only Prettier)
- No dead code detection (Knip)
- Layer-based organization (harder to navigate)
- Can't run shell in isolation, can't test auth independently

---

## Target State

```
workspace/
├── packages/
│   ├── core/           # @ensemble-edge/core — workspace engine (domain-based)
│   │   └── src/
│   │       ├── index.ts           # createWorkspace() — main export
│   │       ├── workspace/         # Workspace lifecycle, config
│   │       ├── apps/              # App registry, core apps, bundled apps
│   │       ├── gateway/           # API gateway, guest app proxy
│   │       ├── permissions/       # RBAC, capability tokens
│   │       ├── knowledge/         # Knowledge base, RAG
│   │       ├── events/            # Event bus (Durable Objects)
│   │       ├── notifications/     # Notification system
│   │       ├── media/             # File storage (R2)
│   │       ├── ai/                # AI panel, agent orchestration
│   │       ├── db/                # D1 migrations, schema
│   │       ├── mode/              # Standalone vs Cloud mode logic
│   │       └── types/             # Shared types
│   │
│   ├── shell/          # @ensemble-edge/shell — Preact SPA (NEW)
│   │   └── src/
│   │       ├── index.tsx          # Shell entry point
│   │       ├── Shell.tsx          # Main layout
│   │       ├── components/        # Sidebar, Toolbar, Viewport, AIPanel
│   │       ├── state/             # Preact Signals
│   │       ├── hooks/             # useAuth, useTheme, useNav
│   │       ├── pages/             # Login, Setup, Home
│   │       └── html.ts            # Server HTML wrapper
│   │
│   ├── auth/           # @ensemble-edge/auth — Auth module (NEW)
│   │   └── src/
│   │       ├── index.ts           # Auth service exports
│   │       ├── magic-link.ts      # Magic link flow
│   │       ├── password.ts        # Password auth
│   │       ├── oidc.ts            # OIDC/SAML provider
│   │       ├── session.ts         # Session management
│   │       ├── jwt.ts             # JWT utilities
│   │       └── middleware.ts      # Auth middleware
│   │
│   ├── sdk/            # @ensemble-edge/sdk — extension hooks
│   ├── ui/             # @ensemble-edge/ui — themed components
│   ├── cli/            # @ensemble-edge/cli — CLI tool
│   ├── guest/
│   │   ├── core/       # @ensemble-edge/guest
│   │   └── cloudflare/ # @ensemble-edge/guest-cloudflare
│   └── connectors/     # First-party connectors (NEW)
│       ├── stripe/     # @ensemble-edge/stripe
│       └── ...
│
├── demos/              # Development workspaces (NEW)
│   └── simple/         # Primary dev target
│
├── native/             # Tauri app
├── examples/           # Example workspaces
├── templates/          # Starter templates
├── skills/             # Agent skills (NEW)
├── AGENTS.md           # Agent instructions (NEW)
├── CLAUDE.md           # Symlink → AGENTS.md (NEW)
└── docs/
```

---

## Implementation Phases

### Phase 0: Tooling Foundation (Day 1)

Before any code changes, set up the tooling that will help us move faster.

#### 0.1 Add AGENTS.md

Create `AGENTS.md` at repo root with:
- Workflow rules (lint before commit, test before PR)
- Package structure documentation
- Development conventions
- Symlink `CLAUDE.md → AGENTS.md`

#### 0.2 Add oxlint

```bash
bun add -D oxlint
```

Add to `package.json`:
```json
{
  "scripts": {
    "lint:quick": "oxlint --fix",
    "lint": "oxlint"
  }
}
```

#### 0.3 Add Knip (dead code detection)

```bash
bun add -D knip
```

Add `knip.json`:
```json
{
  "workspaces": {
    "packages/*": {
      "entry": ["src/index.ts"],
      "project": ["src/**/*.ts"]
    }
  }
}
```

#### 0.4 Bump TypeScript

Update to 5.9+ in root `package.json`.

#### 0.5 Create skills/ directory

```
skills/
├── workspace-dev.md    # Workspace development patterns
├── shell-components.md # Shell component conventions
├── testing.md          # Testing patterns
└── deployment.md       # Deployment workflow
```

Wire up:
- `.claude/skills → skills/`
- `.opencode/skills → skills/`

---

### Phase 1: Package Extraction (Days 2-4)

Extract shell and auth into separate packages so they can be conditionally included.

#### 1.1 Extract `@ensemble-edge/shell`

**Move:**
- `packages/core/src/shell/` → `packages/shell/src/`

**Create `packages/shell/package.json`:**
```json
{
  "name": "@ensemble-edge/shell",
  "version": "0.0.1",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./html": "./dist/html.js"
  },
  "dependencies": {
    "preact": "^10.19.0",
    "@preact/signals": "^1.2.0",
    "@ensemble-edge/ui": "workspace:*"
  }
}
```

**Update `packages/core`:**
- Add `@ensemble-edge/shell` as dependency
- Re-export shell from core for backwards compatibility:
  ```typescript
  // packages/core/src/shell.ts
  export * from '@ensemble-edge/shell'
  ```

#### 1.2 Extract `@ensemble-edge/auth`

**Move:**
- `packages/core/src/services/auth.ts` → `packages/auth/src/service.ts`
- `packages/core/src/utils/jwt.ts` → `packages/auth/src/jwt.ts`
- `packages/core/src/utils/password.ts` → `packages/auth/src/password.ts`
- `packages/core/src/utils/cookies.ts` → `packages/auth/src/cookies.ts`
- `packages/core/src/middleware/auth.ts` → `packages/auth/src/middleware.ts`
- `packages/core/src/routes/auth.ts` → `packages/auth/src/routes.ts`

**Create `packages/auth/package.json`:**
```json
{
  "name": "@ensemble-edge/auth",
  "version": "0.0.1",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./middleware": "./dist/middleware.js",
    "./routes": "./dist/routes.js"
  },
  "dependencies": {
    "hono": "^4.0.0",
    "jose": "^5.0.0"
  }
}
```

**Update `packages/core`:**
- Add `@ensemble-edge/auth` as dependency
- Re-export auth from core:
  ```typescript
  // packages/core/src/auth.ts
  export * from '@ensemble-edge/auth'
  ```

#### 1.3 Update workspace config

Update root `package.json` workspaces:
```json
{
  "workspaces": [
    "packages/*",
    "packages/guest/*",
    "packages/connectors/*"
  ]
}
```

---

### Phase 2: Standalone/Cloud Mode Implementation (Days 5-8)

With shell and auth extracted, implement the mode switching logic.

#### 2.1 Create mode detection module

**File: `packages/core/src/mode/index.ts`**

```typescript
export type DeploymentMode = 'standalone' | 'cloud'

export interface StandaloneConfig {
  auth: {
    provider: 'magic-link' | 'password' | 'oidc'
    email?: {
      provider: 'resend' | 'sendgrid' | 'smtp'
      from: string
    }
    oidc?: {
      issuer: string
      clientId: string
      clientSecret: string
    }
  }
  session: {
    secret: string
    lifetime: string
  }
}

export interface WorkspaceConfig {
  mode: DeploymentMode
  standalone?: StandaloneConfig
  workspace: {
    name: string
    slug: string
  }
}

export function detectMode(config: WorkspaceConfig): DeploymentMode {
  return config.mode
}

export function isStandalone(config: WorkspaceConfig): boolean {
  return config.mode === 'standalone'
}

export function isCloud(config: WorkspaceConfig): boolean {
  return config.mode === 'cloud'
}
```

#### 2.2 Update createWorkspace() to handle modes

**File: `packages/core/src/create-workspace.ts`**

```typescript
import { Hono } from 'hono'
import { WorkspaceConfig, isStandalone } from './mode'
import { createShellRoutes, serveShellAssets } from '@ensemble-edge/shell'
import { createAuthRoutes, standaloneAuthMiddleware, cloudAuthMiddleware } from '@ensemble-edge/auth'

export function createWorkspace(config: WorkspaceConfig) {
  const app = new Hono()

  // Common middleware
  app.use('*', corsMiddleware())
  app.use('*', workspaceResolverMiddleware(config))

  if (isStandalone(config)) {
    // STANDALONE MODE
    // ────────────────
    // Worker handles shell, auth, and API

    // Serve shell assets (HTML, JS, CSS)
    app.use('*', serveShellAssets())

    // Auth middleware (parses JWT from cookies)
    app.use('*', standaloneAuthMiddleware(config.standalone!))

    // Auth routes (login, logout, magic-link, etc.)
    app.route('/_ensemble/auth', createAuthRoutes(config.standalone!))

    // Shell routes (login page, setup page)
    app.route('/', createShellRoutes())

  } else {
    // CLOUD MODE
    // ──────────
    // Proxy handles shell and auth; Worker is pure JSON API

    // Auth middleware (reads X-Ensemble-User header)
    app.use('*', cloudAuthMiddleware())

    // No shell routes — proxy serves shell
    // No auth routes — app.ensemble.ai handles auth
  }

  // Common: API routes (both modes)
  app.route('/_ensemble', createApiRoutes())

  return app
}
```

#### 2.3 Create auth middleware for both modes

**File: `packages/auth/src/middleware.ts`**

```typescript
import type { MiddlewareHandler } from 'hono'
import { verifyJwt } from './jwt'
import type { StandaloneConfig } from '@ensemble-edge/core/mode'

// STANDALONE: Parse JWT from cookie
export function standaloneAuthMiddleware(config: StandaloneConfig): MiddlewareHandler {
  return async (c, next) => {
    const token = c.req.cookie('ensemble_session')

    if (token) {
      try {
        const payload = await verifyJwt(token, config.session.secret)
        c.set('user', {
          id: payload.sub,
          email: payload.email,
          roles: payload.roles,
        })
      } catch {
        // Invalid token — clear cookie, continue as unauthenticated
        c.res.headers.set('Set-Cookie', 'ensemble_session=; Max-Age=0')
      }
    }

    await next()
  }
}

// CLOUD: Read X-Ensemble-User header (trusted, set by proxy)
export function cloudAuthMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const userHeader = c.req.header('X-Ensemble-User')

    if (userHeader) {
      try {
        const user = JSON.parse(atob(userHeader))
        c.set('user', user)
      } catch {
        // Malformed header — shouldn't happen if proxy is working correctly
      }
    }

    await next()
  }
}
```

#### 2.4 Update shell to work in both modes

**File: `packages/shell/src/hooks/useAuth.ts`**

```typescript
import { signal, computed } from '@preact/signals'

// Shell doesn't care about mode — it just calls APIs
// In standalone: APIs are on the same domain
// In cloud: APIs are proxied through the same domain

export function useAuth() {
  const user = signal(null)
  const loading = signal(true)

  async function fetchUser() {
    loading.value = true
    try {
      const res = await fetch('/_ensemble/auth/me')
      if (res.ok) {
        user.value = await res.json()
      }
    } finally {
      loading.value = false
    }
  }

  async function login(email: string) {
    // POST to magic link endpoint
    // Works in both modes — endpoint exists in standalone, proxied in cloud
    const res = await fetch('/_ensemble/auth/magic-link', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
    return res.ok
  }

  async function logout() {
    await fetch('/_ensemble/auth/logout', { method: 'POST' })
    user.value = null
  }

  return { user, loading, fetchUser, login, logout }
}
```

---

### Phase 3: Core Reorganization (Days 9-11)

Restructure core from layer-based to domain-based organization.

#### 3.1 Create domain directories

```bash
mkdir -p packages/core/src/{workspace,apps,gateway,permissions,knowledge,events,notifications,media,ai,types}
```

#### 3.2 Move files to domains

| From | To |
|------|-----|
| `services/theme.ts` | `workspace/theme.ts` |
| `services/app-registry.ts` | `apps/registry.ts` |
| `services/gateway.ts` | `gateway/proxy.ts` |
| `services/permissions.ts` | `permissions/rbac.ts` |
| `services/knowledge.ts` | `knowledge/index.ts` |
| `services/event-bus.ts` | `events/bus.ts` |
| `services/notifications.ts` | `notifications/index.ts` |
| `services/i18n.ts` | `workspace/i18n.ts` |
| `apps/core/*` | `apps/core/*` (keep) |
| `apps/bundled/*` | `apps/bundled/*` (keep) |

#### 3.3 Update imports

Run a find-and-replace to update import paths throughout the codebase.

---

### Phase 4: Demo Workspace + Testing (Days 12-14)

#### 4.1 Create demo workspace

```
demos/
└── simple/
    ├── package.json
    ├── wrangler.toml
    ├── ensemble.config.ts
    └── src/
        └── index.ts
```

**File: `demos/simple/ensemble.config.ts`**

```typescript
import { defineConfig } from '@ensemble-edge/core'

export default defineConfig({
  mode: 'standalone',  // Start with standalone for local dev

  standalone: {
    auth: {
      provider: 'password',  // Simple password auth for demo
    },
    session: {
      secret: process.env.JWT_SECRET || 'dev-secret-change-me',
      lifetime: '7d',
    },
  },

  workspace: {
    name: 'Demo Workspace',
    slug: 'demo',
  },
})
```

#### 4.2 Add seed script

**File: `demos/simple/scripts/seed.ts`**

```typescript
// Seed demo data for local development
export async function seed(db: D1Database) {
  // Create demo users
  // Create demo apps
  // Create demo brand tokens
}
```

#### 4.3 Add Playwright E2E tests

```bash
bun add -D @playwright/test
```

**File: `playwright.config.ts`**

```typescript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  webServer: {
    command: 'bun --filter ensemble-demo dev',
    port: 8787,
  },
})
```

**File: `e2e/auth.spec.ts`**

```typescript
import { test, expect } from '@playwright/test'

test('login flow works', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL('/login')

  await page.fill('[name="email"]', 'test@example.com')
  await page.fill('[name="password"]', 'password')
  await page.click('button[type="submit"]')

  await expect(page).toHaveURL('/')
  await expect(page.locator('[data-testid="user-menu"]')).toBeVisible()
})
```

---

### Phase 5: First-Party Connector (Day 15)

Prove the guest app API works by creating one connector in the monorepo.

#### 5.1 Create Stripe connector scaffold

```
packages/connectors/stripe/
├── package.json
├── manifest.json
├── wrangler.toml
└── src/
    ├── index.ts        # Worker entry
    ├── routes/
    │   ├── customers.ts
    │   ├── payments.ts
    │   └── invoices.ts
    └── ai-tools.ts     # AI panel tools
```

---

## Summary: Execution Order

| Day | Phase | Tasks |
|-----|-------|-------|
| 1 | **Phase 0** | Add AGENTS.md, oxlint, Knip, bump TS, create skills/ |
| 2-3 | **Phase 1a** | Extract `@ensemble-edge/shell` |
| 3-4 | **Phase 1b** | Extract `@ensemble-edge/auth` |
| 5-6 | **Phase 2a** | Create mode detection, update createWorkspace() |
| 7-8 | **Phase 2b** | Implement auth middleware for both modes |
| 9-11 | **Phase 3** | Reorganize core to domain-based structure |
| 12-13 | **Phase 4a** | Create demo workspace with seed scripts |
| 14 | **Phase 4b** | Add Playwright E2E tests |
| 15 | **Phase 5** | Create Stripe connector scaffold |

**Total: ~15 days** (3 weeks) for complete reorg + shell shift foundation.

---

## Success Criteria

- [ ] `AGENTS.md` exists and is comprehensive
- [ ] `bun run lint:quick` runs in <1 second
- [ ] `bun run knip` finds no unused exports
- [ ] `packages/shell` is a separate package
- [ ] `packages/auth` is a separate package
- [ ] `ensemble.config.ts` supports `mode: 'standalone' | 'cloud'`
- [ ] Demo workspace runs in standalone mode with `bun --filter ensemble-demo dev`
- [ ] Demo workspace can switch to cloud mode by changing config + DNS
- [ ] E2E tests pass for login flow
- [ ] Stripe connector scaffold exists and validates manifest
- [ ] All existing tests still pass

---

## Open Decisions

1. **Drop Turbo?** — EmDash doesn't use it. Bun is fast enough. Simplifies config.
2. **tsdown vs tsc?** — Need bundler for publishable packages. tsdown is EmDash's choice.
3. **Portability layer?** — Abstract D1/KV/R2 behind interfaces? Deferred to later phase.

---

## Dependencies to Add

```json
{
  "devDependencies": {
    "oxlint": "latest",
    "knip": "latest",
    "@playwright/test": "latest",
    "typescript": "^5.9.0"
  }
}
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing tests | Run tests after each extraction step |
| Import path breakage | Use TypeScript project references for refactoring support |
| Shell/auth coupling | Keep thin re-exports in core for backwards compatibility |
| Demo workspace drift | CI runs against demo workspace |
