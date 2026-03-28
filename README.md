# Ensemble Workspace

> The programmable surface of a company.

Ensemble Workspace is a unified shell (sidebar, toolbar, viewport, AI panel) that runs on a single Cloudflare Worker. Companies install it, configure their brand, and plug in guest apps — internal tools, customer portals, connectors to third-party services, and autonomous AI agents. Everything inherits the same auth, permissions, branding, and navigation automatically.

**Guest apps are the new website. Guest agents are the new employee.**

## Quick Start

```bash
# Create a new workspace
bun create ensemble my-workspace

# Start development
cd my-workspace
ensemble dev

# Open browser at http://localhost:8787
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Cloudflare Worker                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Workspace Shell                         │  │
│  │  ┌─────────┐  ┌──────────────────────┐  ┌──────────────┐  │  │
│  │  │ Sidebar │  │      Viewport        │  │   AI Panel   │  │  │
│  │  │         │  │  ┌────────────────┐  │  │              │  │  │
│  │  │  Apps   │  │  │   Guest App    │  │  │   Context    │  │  │
│  │  │  Nav    │  │  │   (iframe)     │  │  │   Tools      │  │  │
│  │  │         │  │  └────────────────┘  │  │   Actions    │  │  │
│  │  └─────────┘  └──────────────────────┘  └──────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────┴───────────────────────────────┐  │
│  │                      Gateway API                           │  │
│  │   Auth │ Permissions │ Events │ Knowledge │ Notifications  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────┬───────────┬───┴────┬────────────┬─────────────┐  │
│  │    D1     │    KV     │   R2   │   Queues   │  Workers AI │  │
│  │  SQLite   │   Cache   │ Files  │   Async    │     LLM     │  │
│  └───────────┴───────────┴────────┴────────────┴─────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Packages

| Package | Description |
|---------|-------------|
| [`@ensemble-edge/core`](./packages/core) | Workspace engine — shell, gateway, services |
| [`@ensemble-edge/sdk`](./packages/sdk) | Extension hooks for workspace customization |
| [`@ensemble-edge/ui`](./packages/ui) | Themed component library (Preact + Tailwind) |
| [`@ensemble-edge/cli`](./packages/cli) | Developer tooling — `ensemble init`, `ensemble dev`, `ensemble deploy` |
| [`@ensemble-edge/guest`](./packages/guest/core) | Guest app SDK — platform-agnostic core |
| [`@ensemble-edge/guest-cloudflare`](./packages/guest/cloudflare) | Cloudflare Workers adapter for guest apps |

## Key Concepts

- **Workspaces** — Self-contained instances with their own auth, branding, and apps
- **Guest Apps** — Isolated applications that run inside the workspace viewport
- **Guest Agents** — AI-powered autonomous agents that act on behalf of users
- **Connectors** — Integrations with third-party services (Stripe, Google Drive, etc.)
- **Manifest** — JSON schema defining an app's metadata, permissions, and capabilities
- **AI Panel** — Contextual AI assistant with access to workspace tools
- **Tilde Addresses** — Namespace for workspaces and apps (~acme, ~acme/crm)

## Documentation

Full documentation at [docs.ensemble.ai/workspace](https://docs.ensemble.ai/workspace)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines.

## License

MIT — Ensemble Edge AI LLC
