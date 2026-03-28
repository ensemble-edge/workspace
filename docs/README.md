# Ensemble Workspace Documentation

> The programmable surface of a company.

## Overview

This documentation covers the Ensemble Workspace platform — the core engine that powers branded workspaces with apps, agents, and connectors.

## 🚀 Quick Start: Hello World

**New here?** Start with the [Hello World Plan](./HELLO-WORLD.md) — a focused guide to getting the first real workspace (Nendo) running at `workspace.nendo.ai` in ~2 weeks.

## Reference Specifications

Detailed specifications extracted from the master plan:

| File | Content |
|------|---------|
| [00-workspace.md](./reference/00-workspace.md) | **Full canonical specification** (read-only reference) |
| [01-overview.md](./reference/01-overview.md) | Vision, principles, tech stack, architecture |
| [02-app-architecture.md](./reference/02-app-architecture.md) | Three-tier app model (core/bundled/guest) |
| [03-core-apps.md](./reference/03-core-apps.md) | The 8 core apps |
| [04-bundled-apps.md](./reference/04-bundled-apps.md) | Dashboard, AI Assistant, Files, etc. |
| [05-guest-sdk.md](./reference/05-guest-sdk.md) | Guest SDK, manifest, platform adapters |
| [06-workspace-model.md](./reference/06-workspace-model.md) | Workspace types, templates, tilde addresses |
| [07-identity-auth.md](./reference/07-identity-auth.md) | @handle system, auth methods, memberships |
| [08-knowledge-graph.md](./reference/08-knowledge-graph.md) | Company knowledge system |
| [09-api-gateway.md](./reference/09-api-gateway.md) | Gateway middleware, agent protocol |
| [10-shell-navigation.md](./reference/10-shell-navigation.md) | Shell anatomy, navigation, theming |
| [11-sharing-portals.md](./reference/11-sharing-portals.md) | Cross-workspace sharing, public views |
| [12-security.md](./reference/12-security.md) | Security model |
| [13-extensibility.md](./reference/13-extensibility.md) | Upgrade strategy, extension system |
| [14-native-apps.md](./reference/14-native-apps.md) | Tauri v2 native apps |
| [15-project-structure.md](./reference/15-project-structure.md) | Monorepo layout, database schema |
| [16-roadmap.md](./reference/16-roadmap.md) | Phased roadmap |
| [17-testing.md](./reference/17-testing.md) | Testing infrastructure |

## Workstreams

Execution plans organized by cohesive bodies of work:

| Workstream | Description | Dependencies |
|------------|-------------|--------------|
| [01-foundation.md](./workstreams/01-foundation.md) | Core infrastructure (Worker, auth, theme) | None |
| [02-shell-navigation.md](./workstreams/02-shell-navigation.md) | Shell chrome (sidebar, toolbar, panels) | Foundation |
| [03-core-apps.md](./workstreams/03-core-apps.md) | The 8 core apps | Foundation, Shell |
| [04-bundled-apps.md](./workstreams/04-bundled-apps.md) | Dashboard, AI Assistant, etc. | Shell, Core Apps |
| [05-guest-platform.md](./workstreams/05-guest-platform.md) | Guest SDK and API gateway | Foundation, Shell, Core Apps |
| [06-native-apps.md](./workstreams/06-native-apps.md) | Tauri v2 native apps | Shell |
| [07-testing.md](./workstreams/07-testing.md) | Testing infrastructure | Foundation, Guest Platform |
| [08-connectors.md](./workstreams/08-connectors.md) | First-party connectors | Guest Platform |

## Dependency Graph

```
                    ┌─────────────────┐
                    │   Foundation    │
                    │  (Workstream 1) │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
      ┌───────────┐  ┌───────────┐  ┌───────────┐
      │   Shell   │  │  Testing  │  │  Identity │
      │   (WS 2)  │  │   (WS 7)  │  │ (in WS 1) │
      └─────┬─────┘  └───────────┘  └───────────┘
            │
      ┌─────┴─────┐
      │           │
      ▼           ▼
┌───────────┐ ┌───────────┐
│ Core Apps │ │Native Apps│
│   (WS 3)  │ │   (WS 6)  │
└─────┬─────┘ └───────────┘
      │
      ▼
┌───────────┐
│  Bundled  │
│   (WS 4)  │
└─────┬─────┘
      │
      ▼
┌───────────┐
│   Guest   │
│ Platform  │
│   (WS 5)  │
└─────┬─────┘
      │
      ▼
┌───────────┐
│Connectors │
│   (WS 8)  │
└───────────┘
```

## Suggested Execution Order

1. **Foundation** (Weeks 1-3) — Worker, auth, theme engine
2. **Shell & Navigation** (Weeks 2-4) — Can start during Foundation
3. **Core Apps** (Weeks 3-7) — Start after Shell basics
4. **Bundled Apps** (Weeks 5-9) — Start after Core Apps basics
5. **Guest Platform** (Weeks 6-11) — Start after Core Apps
6. **Testing** (Weeks 3-6) — Parallel with everything
7. **Native Apps** (Weeks 10-18) — After Shell stable
8. **Connectors** (Weeks 12+) — After Guest Platform

## Related Documentation

- **Cloud Services**: See [`/cloud/docs/`](../../cloud/docs/) for web app, directory, registry
- **Spec Library**: See [`/specs/`](../../specs/) for application blueprints
- **Conductor**: See `/conductor/` for workflow orchestration
