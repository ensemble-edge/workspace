## 5. The Three-Tier App Architecture

> **⚠️ Architecture Update (March 2026):** The shell is now edge-served by Ensemble. Core and bundled apps have UI in the shell + API routes in `@ensemble-edge/core`. Auth is handled by `app.ensemble.ai` + edge proxy. See [`02-shell-shift.md`](./02-shell-shift.md).

This is AIUX's most important architectural decision. **The shell has no features. Apps have all the features.** The shell is pure chrome: a workspace switcher, a sidebar, a toolbar, a viewport, and panel slots. Auth is handled by the edge proxy, not the shell.

Every app — whether it manages users, defines the brand, or tracks loans — follows the same architecture: manifest, SDK hooks, themed components, scoped storage, permissioned access. The difference between tiers is **where the code lives and how it's deployed**, not how it's built.

### The Three Tiers

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  ┌─── CORE ─────────────────────────────────────────────────────┐   │
│  │                                                              │   │
│  │  Part of Ensemble's platform (UI in shell, API in core SDK).  │   │
│  │  Ships with every workspace. Cannot be uninstalled — only     │   │
│  │  enabled/disabled per workspace. Handles "operating system"   │   │
│  │  concerns. Upgrades automatically when Ensemble deploys.      │   │
│  │                                                              │   │
│  │  Examples: Workspace Admin, Brand Manager, People & Teams,   │   │
│  │  Auth & Security, Knowledge Editor, App Manager, Audit Log,  
│  │  Navigation Hub                                              │   │
│  │                                                              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─── BUNDLED ──────────────────────────────────────────────────┐   │
│  │                                                              │   │
│  │  Part of Ensemble's platform (UI in shell, API in core SDK).  │   │
│  │  Can be enabled/disabled per workspace. Represents common     │   │
│  │  functionality most workspaces want. Upgrades automatically   │   │
│  │  when Ensemble deploys.                                       │   │
│  │                                                              │   │
│  │  Examples: Dashboard, AI Assistant, File Manager,            │   │
│  │  Notifications, Activity Feed                    │   │
│  │                                                              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─── GUEST ───────────────────────────────────────────────────┐    │
│  │                                                              │   │
│  │  External code loaded at runtime. Installed from the app     │   │
│  │  registry, built custom, or created by agents. Follows the   │   │
│  │  same manifest/SDK/theming contract. Sandboxed (iframe for   │   │
│  │  untrusted, component for trusted). Independent versioning.  │   │
│  │                                                              │   │
│  │  Examples: CRM, Wiki, Support Tickets, Data Room, Email      │   │
│  │  Client, Chat, Calendar, custom industry tools               │   │
│  │                                                              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### What's the Same Across All Tiers

Every app, regardless of tier:

- Has a **manifest** declaring its identity, nav, permissions, display mode, API routes, and events
- Uses `@ensemble-edge/sdk` hooks for auth, storage, navigation, theming, bus, AI, knowledge
- Uses `@ensemble-edge/ui` components that automatically inherit the workspace theme
- Respects the workspace **permission engine** — the same check that gates a custom CRM also gates the Brand Manager
- Writes to **scoped storage** (D1 tables namespaced by workspace + app)
- Is visible in the **command palette** (registers searchable commands)
- Appears in the **audit log** (every mutation tracked)
- Exposes a **parallel API** (UI for humans, REST for agents)

### What's Different

| Aspect | Core | Bundled | Guest |
|---|---|---|---|
| **Where code lives** | Shell (UI) + `@ensemble-edge/core` (API) | Shell (UI) + `@ensemble-edge/core` (API) | Separate Workers or external services |
| **Part of workspace Worker** | API routes only | API routes only | No (separate service) |
| **Can be uninstalled** | No (only disabled) | No (only disabled) | Yes |
| **Versioning** | Matches shell version | Matches shell version | Independent semver |
| **Upgrade path** | Automatic with `git pull` | Automatic with `git pull` | Manual or registry-managed |
| **Isolation model** | Shared context (trusted) | Shared context (trusted) | Component (trusted) or iframe (untrusted) |
| **Storage access** | Scoped (same as others) | Scoped (same as others) | Scoped (same as others) |
| **Can access shell internals** | Limited privileged APIs | No | No |
| **Default state (new workspace)** | Enabled | Configurable (on/off per template) | Not installed |

### App Manifest — Unified Format

The manifest format is identical across tiers. The `tier` field is the only structural difference:

```typescript
interface AppManifest {
  // Identity
  id: string                    // unique: "core:brand-manager", "bundled:dashboard", "guest:my-crm"
  name: string                  // human-readable
  version: string               // semver
  ensemble_api: string              // API contract version: "1"
  description: string
  icon: string                  // Lucide icon name
  author: string
  license: string

  // Tier
  tier: 'core' | 'bundled' | 'guest'

  // Entry point
  entry: string                 // relative path to component/module
  type: 'component' | 'iframe' | 'api-only' | 'hybrid'

  // Display
  display: {
    modes: ('viewport' | 'panel' | 'popover' | 'background')[]
    default: 'viewport' | 'panel' | 'popover' | 'background'
    panel?: {
      side: 'left' | 'right'
      width: string
      resizable: boolean
      pinnable: boolean
    }
    popover?: {
      trigger: 'toolbar' | 'keyboard' | 'context'
      width: string
      height: string
    }
  }

  // Navigation
  nav: {
    label: string
    icon: string
    position: 'sidebar' | 'panel-bar' | 'toolbar' | 'hidden'
    order?: number              // sort order within position
    section?: string            // group: "workspace", "tools", "settings"
    children?: { label: string; path: string; icon?: string }[]
  }

  // API (dual interface — same routes serve UI and JSON)
  api?: {
    routes: {
      method: string
      path: string
      description: string
      auth?: 'required' | 'optional' | 'public'
    }[]
  }

  // Events (inter-app communication)
  events?: {
    emits: string[]
    listens: string[]
  }

  // Permissions
  permissions: {
    required: string[]
    optional: string[]
  }

  // Workspace-configurable settings
  settings?: {
    schema: Record<string, {
      type: string
      default: any
      label?: string
      description?: string
      options?: any[]           // for select/enum types
    }>
  }

  // Visibility
  visibility: {
    default: 'all_members' | 'admins_only' | 'custom'
    allow_public: boolean
    allow_restricted: boolean
  }

  // Migrations (D1 schema for this app)
  migrations?: string[]
}
```

### Workspace App Configuration

Each workspace stores which apps are enabled and their per-workspace settings:

```sql
CREATE TABLE workspace_apps (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  app_id TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,          -- 0 = disabled, 1 = enabled
  settings TEXT,                       -- JSON: workspace-specific config
  visibility TEXT DEFAULT 'all_members', -- override per workspace
  installed_at TEXT DEFAULT (datetime('now')),
  installed_by TEXT,
  PRIMARY KEY (workspace_id, app_id)
);
```

When a new workspace is created, core apps are auto-registered (enabled by default). Bundled apps are auto-registered with a configurable default (workspace templates can set which are on/off). Guest apps must be explicitly installed.

---

