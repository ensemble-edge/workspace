# Ensemble Workspace Documentation

> The programmable surface of a company.

## Quick Start

**New here?** Start with the [Hello World Plan](./HELLO-WORLD.md) — a focused guide to getting the first real workspace running.

---

## Documentation Structure

```
docs/
├── spec/       # WHAT — Product vision, architecture, domain specifications
├── plan/       # HOW — Active implementation plans (what we're building now)
├── backlog/    # LATER — Well-spec'd future work, not yet active
└── archive/    # DONE — Completed or superseded plans
```

**Lifecycle:** `backlog/` → `plan/` → `archive/`

---

## Active Plan

Current implementation phases — **read these to know what to do today:**

| Phase | Doc | Status |
|-------|-----|--------|
| Overview | [00-status.md](./plan/00-status.md) | Project status, what's built vs. not |
| Phase 1 | [01-app-contract.md](./plan/01-app-contract.md) | Core app contract + Viewport refactor |
| Phase 2 | [02-core-apps.md](./plan/02-core-apps.md) | Build the 8 core apps |
| Phase 3 | [03-shell-extract.md](./plan/03-shell-extract.md) | Extract shell as `@ensemble-edge/shell` |
| Phase 4 | [04-cloud-mode.md](./plan/04-cloud-mode.md) | Edge proxy + cloud mode deployment |

---

## Specifications

Product vision and architecture — **read these to understand what Ensemble is:**

| File | Content |
|------|---------|
| [00-workspace.md](./spec/00-workspace.md) | Full canonical specification |
| [01-overview.md](./spec/01-overview.md) | Vision, principles, tech stack, architecture |
| [02-app-architecture.md](./spec/02-app-architecture.md) | Three-tier app model (core/bundled/guest) |
| [03-core-apps.md](./spec/03-core-apps.md) | The 8 core apps |
| [04-bundled-apps.md](./spec/04-bundled-apps.md) | Dashboard, AI Assistant, Files, etc. |
| [05-guest-sdk.md](./spec/05-guest-sdk.md) | Guest SDK, manifest, platform adapters |
| [06-workspace-model.md](./spec/06-workspace-model.md) | Workspace types, templates, tilde addresses |
| [07-identity-auth.md](./spec/07-identity-auth.md) | @handle system, auth methods, memberships |
| [08-knowledge-graph.md](./spec/08-knowledge-graph.md) | Company knowledge system |
| [09-api-gateway.md](./spec/09-api-gateway.md) | Gateway middleware, agent protocol |
| [10-shell-navigation.md](./spec/10-shell-navigation.md) | Shell anatomy, navigation, theming |
| [11-sharing-portals.md](./spec/11-sharing-portals.md) | Cross-workspace sharing, public views |
| [12-security.md](./spec/12-security.md) | Security model |
| [13-extensibility.md](./spec/13-extensibility.md) | Upgrade strategy, extension system |
| [14-native-apps.md](./spec/14-native-apps.md) | Tauri v2 native apps |
| [15-project-structure.md](./spec/15-project-structure.md) | Monorepo layout, database schema |
| [16-roadmap.md](./spec/16-roadmap.md) | Phased roadmap |
| [17-testing.md](./spec/17-testing.md) | Testing infrastructure |
| [18-documentation.md](./spec/18-documentation.md) | Documentation strategy |

UI specifications:

| File | Content |
|------|---------|
| [01-ui-animations.md](./spec/01-ui-animations.md) | Animation patterns |
| [01-ui-page-architecture.md](./spec/01-ui-page-architecture.md) | Page layout patterns |
| [01-ui-shared-components.md](./spec/01-ui-shared-components.md) | Shared component specs |
| [01-ui-sytle.md](./spec/01-ui-sytle.md) | Visual style guide |

---

## Backlog

Well-spec'd future work — **move to `plan/` when ready to start:**

| File | Content |
|------|---------|
| [bundled-apps.md](./backlog/04-bundled-apps.md) | Dashboard, AI Assistant, Files, Notifications |
| [guest-platform.md](./backlog/05-guest-platform.md) | Guest SDK, gateway, extension stitching |
| [native-apps.md](./backlog/06-native-apps.md) | Tauri v2 desktop + mobile apps |
| [testing.md](./backlog/07-testing.md) | Testing infrastructure |
| [connectors.md](./backlog/08-connectors.md) | First-party connectors (Stripe, GitHub, etc.) |

---

## Archive

Completed or superseded implementation plans:

| File | Content | Status |
|------|---------|--------|
| [shadcn-ui.md](./archive/02-shadcdn-ui.md) | shadcn/ui integration | Completed |
| [foundation-bootstrap.md](./archive/01-foundation-bootstrap.md) | Bootstrap + auth flow | Completed |
| [shell-shift.md](./archive/02-shell-shift.md) | Edge-served shell architecture | Reference (arch still valid) |
| [reorg.md](./archive/02-reorg.md) | EmDash alignment plan | Partially superseded |
| [reorg-and-shell-shift.md](./archive/00-reorg-and-shell-shift.md) | Original reorg workstream | Superseded |
| [foundation.md](./archive/01-foundation.md) | Foundation workstream | Largely done |
| [shell-navigation.md](./archive/02-shell-navigation.md) | Shell workstream | Largely done |
| [core-apps.md](./archive/03-core-apps.md) | Original core apps workstream | Superseded by plan/02 |

---

## Dependency Graph

```
Phase 1: App Contract     ← WE ARE HERE
    │
    ▼
Phase 2: Core Apps (8)
    │
    ▼
Phase 3: Shell Extract (@ensemble-edge/shell)
    │
    ▼
Phase 4: Cloud Mode (Edge Proxy)
    │
    ├──── Backlog: Bundled Apps
    ├──── Backlog: Guest Platform
    ├──── Backlog: Connectors
    ├──── Backlog: Testing
    └──── Backlog: Native Apps
```
