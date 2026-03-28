# Ensemble Workspace — The Programmable Surface of a Company

> *Guest apps are the new website. Guest agents are the new employee.*

**Version:** 1.5.0
**Author:** Ensemble Edge AI / The Ownly Group
**Date:** March 2026
**Status:** Definitive specification
**Codename:** AIUX (internal engineering codename only — all public packages, CLI, and config use `@ensemble-edge`)
**Changelog:** v1.5 renames all public-facing references from `@aiux/*` to `@ensemble-edge/*` (matching the existing npm scope used by `@ensemble-edge/edgit`). Package names: `@ensemble-edge/core`, `@ensemble-edge/sdk`, `@ensemble-edge/ui`, `@ensemble-edge/cli`, `@ensemble-edge/guest`, `@ensemble-edge/guest-cloudflare`, etc. CLI command: `ensemble` (not `aiux`). Config file: `ensemble.config.ts` (not `aiux.config.ts`). AIUX remains as the internal engineering codename only. All URLs updated to `ensemble.ai` domain.

## 1. What Is Ensemble Workspace?

Ensemble Workspace is an open-source, developer-first **workspace operating layer** that runs on Cloudflare Workers. It provides a unified shell for building, deploying, managing, and sharing internal tools, customer-facing portals, and AI-powered applications — all under centralized auth, branding, navigation, and permissions.

**AIUX** is the internal engineering codename for the workspace engine — the packages are `@ensemble-edge/core`, `@ensemble-edge/sdk`, `@ensemble-edge/guest`, etc. The product that people download, talk about, and run their companies on is **Ensemble Workspace**, or just **Ensemble**.

### The Problem

AI is letting teams build faster than ever. The result? Dozens of bespoke internal tools — each with its own auth, its own CSS, its own deployment pipeline, its own permission model. Every app is a snowflake. For a 50-person company running 15 internal tools, this means:

- 15 different login flows
- 15 different designs (none matching the brand)
- 15 sets of user management
- No shared navigation or discoverability
- No centralized audit trail
- Upgrade hell
- No way for AI agents to understand or interact with the company's tool landscape
- No single source of truth for brand, messaging, or development standards

Vercel's CFO publicly stated they've replaced all SaaS with internally-built tools. Many companies are following suit. **Ensemble is the harness that keeps it all under control** — for humans building, agents building, and everyone using.

### The Vision

A single deployment that gives any organization:

- A **branded workspace** with consistent nav, theming, and layout
- An **app registry** where tools and agents are installed, configured, and permissioned
- A **multi-workspace identity** model so one person can move between companies, boards, clients, and projects seamlessly
- **Everything is an app** — tools, agents, panels, assistants, portals, connectors — all apps in the same model, all the same manifest
- An **AI panel** that talks to every app and agent through the API gateway — the command line for your entire workspace
- A **Company Knowledge Graph** — brand guidelines, messaging architecture, development standards — all queryable and enforceable
- A path from **internal tool → customer portal → public app** without rebuilding
- **Guest apps are the new website. Guest agents are the new employee.**

---

## 2. Core Principles

| Principle | What It Means |
|---|---|
| **Single Worker** | The entire platform — shell, core apps, bundled apps — runs in one Cloudflare Worker. No origin servers. No containers. Global edge deployment from day one. |
| **Everything Is an App** | Panels, assistants, email clients, admin tools, brand management — everything is an app. Core apps use the same architecture as custom apps. The shell is just chrome + router + auth. |
| **Batteries Included** | AIUX ships with a rich set of core and bundled apps that cover workspace management, brand identity, user management, and common utilities. A fresh deployment is immediately useful. |
| **Identity Is Universal** | A user has one AIUX identity. Workspaces grant scoped access. Switching context is instant. |
| **Dual Interface / API Gateway** | Every capability is accessible via UI (for humans) and API (for agents). AIUX is the single endpoint gateway for the entire workspace — one URL, one auth layer, every app's API unified behind it. Same auth, same permissions, same data. |
| **The Company Is Queryable** | Brand, messaging, standards, org structure — they're not just docs in a folder. They're structured, versioned, and enforceable configuration. |
| **OSS-First** | MIT licensed. Hosted on Ensemble's GitHub. Cloud-managed version comes later. |
| **Upgrade-Safe** | Apps declare a manifest version. Shell upgrades never break apps. Core apps upgrade with the shell seamlessly. The contract is sacred. |
| **Tilde Addressable** | Every workspace has a tilde address (`~ownly`). Speakable, memorable, human-first. Resolves via the Ensemble Directory or local cache. |
| **Edge-Native** | Built for Cloudflare's primitives: Workers, D1, R2, KV, Durable Objects, Queues, AI. No Node.js assumptions. |

---

## 3. Technical Stack

### Runtime & Framework

| Layer | Choice | Rationale |
|---|---|---|
| **Runtime** | Cloudflare Workers | Global edge, zero cold start, binding-rich |
| **Server Framework** | Hono | Lightweight, Workers-native, middleware-friendly, excellent DX |
| **Build Tool** | Bun | Fast builds, native TS, compatible with Workers toolchain |
| **Package Manager** | Bun | Lockfile, workspace support, speed |

### Frontend

| Layer | Choice | Rationale |
|---|---|---|
| **UI Library** | Preact + Signals | 3KB, React-compatible API, signals for reactive state without VDOM overhead |
| **Styling** | Tailwind CSS v4 | Utility-first, design token system via CSS variables, tree-shakeable |
| **Icons** | Lucide | OSS, consistent, tree-shakeable |
| **Component Primitives** | Radix-like headless (custom) | Accessible, unstyled, composable — themed by AIUX shell |

### Storage (Cloudflare Bindings)

| Binding | Use |
|---|---|
| **D1** | Relational data — users, workspaces, app configs, permissions, audit logs, knowledge graph |
| **KV** | Session tokens, feature flags, workspace config cache, app manifest cache, company standards cache |
| **R2** | File uploads, app assets, workspace brand assets (logos, fonts), knowledge documents |
| **Durable Objects** | Real-time collaboration state, presence, live cursors, WebSocket management, agent sessions |
| **Queues** | Background jobs — email sends, webhook delivery, audit log writes, agent task queues |
| **Workers AI** | Built-in AI capabilities available to any app via SDK |

### Auth

| Layer | Choice |
|---|---|
| **Session Management** | Stateless JWTs (short-lived) + KV-backed refresh tokens |
| **Identity Provider** | Built-in email/password + OAuth2 connectors (Google, GitHub, Microsoft) |
| **MFA** | TOTP (built-in) + WebAuthn/passkeys |
| **Workspace Auth** | SAML 2.0 / OIDC federation for enterprise workspaces |
| **Agent Auth** | API keys (workspace-scoped) + short-lived capability tokens |

---


### Native App

| Layer | Choice | Rationale |
|---|---|---|
| **Framework** | Tauri v2 | Single codebase for macOS, Windows, Linux, iOS, Android. Uses OS-native WebView (tiny binary, low memory). Rust core with Swift/Kotlin plugins. |
| **Core Language** | Rust | Fast, safe, small binary. Handles workspace management, credentials, push notifications. |
| **Apple Plugins** | Swift | Keychain, Touch ID/Face ID, APNs, Spotlight, Handoff, Share extension. |
| **Android Plugins** | Kotlin | Keystore, biometrics, FCM, app shortcuts, share intents. |

## 4. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AIUX SHELL (SPA)                             │
│  ┌──────────┐  ┌─────────────────────────────┐  ┌───────────────┐  │
│  │ Workspace │  │        App Viewport          │  │  Panel Apps   │  │
│  │ Switcher  │  │  ┌───────────────────────┐   │  │  ┌─────────┐ │  │
│  │           │  │  │                       │   │  │  │  Mail   │ │  │
│  │ [Acme Co] │  │  │    Active App         │   │  │  │  (app)  │ │  │
│  │ [Board X] │  │  │    (core, bundled,    │   │  │  │         │ │  │
│  │ [Client Y]│  │  │     or guest)         │   │  │  ├─────────┤ │  │
│  │           │  │  │                       │   │  │  │  Chat   │ │  │
│  ├──────────┤  │  └───────────────────────┘   │  │  │  (app)  │ │  │
│  │ App Nav   │  │                              │  │  ├─────────┤ │  │
│  │ ─────── │  │  ┌─ Toolbar ─────────────┐   │  │  │   AI    │ │  │
│  │ 📊 Dash  │  │  │ Breadcrumb  [⌘K] [👤] │   │  │  │ Assist  │ │  │
│  │ 👥 CRM   │  │  └────────────────────────┘   │  │  │  (app)  │ │  │
│  │ 📝 Wiki  │  │                              │  │  └─────────┘ │  │
│  │ 🎫 Tickets│  │                              │  │               │  │
│  │ 📁 Data  │  │                              │  │               │  │
│  └──────────┘  └─────────────────────────────┘  └───────────────┘  │
│  ┌─────────────────── Bookmark Bar ──────────────────────────────┐  │
│  │  [Quick Link 1] [Quick Link 2] [+ Add]                        │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
     │              │                  │                    │
     │    HUMAN     │                  │      AGENT         │
     │    USERS     │                  │    (AI/API)        │
     ▼              ▼                  ▼                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE WORKER (Hono)                         │
│                                                                     │
│  ┌────────────────────── DUAL INTERFACE ────────────────────────┐   │
│  │                                                              │   │
│  │  UI Routes (SSR + SPA)          API Routes (REST + WS)      │   │
│  │  ──────────────────            ──────────────────────        │   │
│  │  GET /app/crm/contacts         GET /_ensemble/crm/contacts     │   │
│  │  (renders shell + app)          (returns JSON)               │   │
│  │                                                              │   │
│  │  Same auth. Same permissions. Same data. Same audit log.     │   │
│  │                                                              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────── APP TIERS ───────────────────────────────┐   │
│  │                                                              │   │
│  │  CORE APPS          BUNDLED APPS         GUEST APPS          │   │
│  │  (in binary)        (in binary)          (loaded at runtime) │   │
│  │  ─────────          ────────────         ────────────        │   │
│  │  Workspace Admin    Dashboard            Custom CRM          │   │
│  │  Brand Manager      AI Assistant         Custom Wiki         │   │
│  │  People & Teams     File Manager         Industry tools      │   │
│  │  Auth & Security    Notifications        3rd party apps      │   │
│  │  Knowledge Editor   Activity Feed        Agent-built apps    │   │
│  │  App Manager        Bookmarks                                │   │
│  │  Audit Log                                                   │   │
│  │                                                              │   │
│  │  All three tiers use the same manifest, SDK, theming,        │   │
│  │  permissions, and API architecture.                          │   │
│  │                                                              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────────┐  │
│  │ Auth     │  │ App      │  │ Theme    │  │ Workspace          │  │
│  │ Middleware│  │ Router   │  │ Engine   │  │ Resolver           │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────────────┘  │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────────┐  │
│  │ App      │  │ Permission│ │ Company  │  │ App Sandbox        │  │
│  │ Registry │  │ Engine   │  │ Knowledge│  │ Runtime            │  │
│  └──────────┘  └──────────┘  │ Graph    │  └────────────────────┘  │
│                               └──────────┘                          │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    AGENT PROTOCOL LAYER                       │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐  │   │
│  │  │ Workspace │  │ App      │  │ Knowledge│  │ Task        │  │   │
│  │  │ Discovery │  │ Invoke   │  │ Query    │  │ Orchestrate │  │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────────┘  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─ Cloudflare Bindings ─────────────────────────────────────────┐  │
│  │  D1 │ KV │ R2 │ Durable Objects │ Queues │ Workers AI │ ...  │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### System Architecture — Full Reference

```
ACCESS LAYER — how users reach workspaces
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ Ensemble native   │  │ Ensemble web app │  │ Direct URL       │
│ app (Tauri v2)   │  │ app.ensemble.ai  │  │ acme.ensemble.ai │
│ macOS, iOS,      │  │ Zero download.   │  │ or hub.acme.com  │
│ Android, Win, Lin│  │ Swaps API per    │  │ Single workspace │
│ Rust + WebView   │  │ workspace.       │  │ No switcher.     │
└────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
         │  User types ~acme or opens URL             │
         └──────────────────┬──────────────────────────┘
                            ▼
ENSEMBLE SERVICES — discovery + registry
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ Ensemble         │  │ App registry     │  │ Ensemble Cloud   │
│ directory        │  │ registry.        │  │ cloud.           │
│ dir.ensemble.ai  │  │ ensemble.ai      │  │ ensemble.ai      │
│ ~slug → endpoint │  │ @org/app-name    │  │ Managed hosting  │
└────────┬─────────┘  └──────────────────┘  └──────────────────┘
         │  Resolves to workspace endpoint
         ▼
WORKSPACE WORKER — the thin core (@ensemble-edge/core)
┌─────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────┐  ┌──────────────────────────────┐  │
│  │ Preact shell (SPA)      │  │ API gateway                  │  │
│  │ Sidebar, toolbar,       │  │ Unified /_ensemble/* routing.   │  │
│  │ viewport, panels,       │  │ Auth, permissions, rate      │  │
│  │ theme engine, cmd-K     │  │ limiting, guest app proxy,   │  │
│  │                         │  │ audit log, CORS              │  │
│  └─────────────────────────┘  └──────────────────────────────┘  │
│                                                                  │
│  8 core apps: Admin|Brand|People|Auth|Knowledge|Apps|Audit|Nav   │
│  Bundled apps: Dashboard|AI Assistant|Files|Notifications|Activity│
└──────┬───────────────────────┬───────────────────────┬──────────┘
       │ service binding       │ service binding       │ HTTP proxy
       │ (0ms latency)        │ (0ms latency)        │ (normal)
       ▼                      ▼                      ▼
GUEST APPS — separate services connected via @ensemble-edge/guest SDK
┌─────────────────────────┐  ┌──────────────────────────────────┐
│ Same-zone CF Workers    │  │ Remote apps (any platform)       │
│ CRM, Loan Tracker,     │  │ @linear/sync, @stripe/billing,   │
│ Wiki, Support...        │  │ @figma/design...                 │
│ @ensemble-edge/guest-cloudflare  │  │ @ensemble-edge/guest-vercel / -node / etc │
└─────────────────────────┘  └──────────────────────────────────┘

CLOUDFLARE INFRASTRUCTURE
┌──────┐ ┌────┐ ┌────┐ ┌────────────────┐ ┌────────┐ ┌───────────┐
│  D1  │ │ KV │ │ R2 │ │ Durable Objects│ │ Queues │ │Workers AI │
└──────┘ └────┘ └────┘ └────────────────┘ └────────┘ └───────────┘
```

### Request Flow — What Happens When You Type `~acme`

```
1. User types ~acme in app or app.ensemble.ai
2. Shell calls dir.ensemble.ai/resolve/acme
   → Returns: { endpoint: "https://acme.ensemble.ai" }
3. Shell calls GET /_ensemble/brand/theme                (KV: <1ms)
   → CSS variables injected. Brand appears instantly.
4. Auth check: JWT valid? Membership exists?           (KV + Cache API)
5. Shell calls GET /_ensemble/nav                         (role-filtered)
   → Sidebar config, app list, bookmarks loaded.
6. Shell renders: branded sidebar + toolbar + empty viewport
7. User clicks "Customers" in sidebar
8. Gateway resolves: /app/customers/* → guest app @nendo/customers
9. Gateway checks: does user have permission for this app?
10. Gateway proxies request:
    - Same-zone CF Worker? → service binding (0ms)
    - Remote service? → HTTP + capability token + context headers
11. Guest app returns data → renders in viewport
12. Audit log entry written (D1)
    Total: ~50ms (same-zone) or ~150ms (remote)
```

---

## 5. The Three-Tier App Architecture

This is AIUX's most important architectural decision. **The shell has no features. Apps have all the features.** The shell is pure chrome: a workspace switcher, a sidebar, a toolbar, a viewport, and panel slots. That's it.

Every app — whether it manages users, defines the brand, or tracks loans — follows the same architecture: manifest, SDK hooks, themed components, scoped storage, permissioned access. The difference between tiers is **where the code lives and how it's deployed**, not how it's built.

### The Three Tiers

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  ┌─── CORE ─────────────────────────────────────────────────────┐   │
│  │                                                              │   │
│  │  Compiled into the Worker binary. Ships with every AIUX      │   │
│  │  deployment. Cannot be uninstalled — only enabled/disabled    │   │
│  │  per workspace. Handles "operating system" concerns.          │   │
│  │  Upgrades atomically with the shell.                         │   │
│  │                                                              │   │
│  │  Examples: Workspace Admin, Brand Manager, People & Teams,   │   │
│  │  Auth & Security, Knowledge Editor, App Manager, Audit Log,  
│  │  Navigation Hub                                              │   │
│  │                                                              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─── BUNDLED ──────────────────────────────────────────────────┐   │
│  │                                                              │   │
│  │  Also compiled into the Worker binary. Ships with every      │   │
│  │  AIUX deployment. Can be enabled/disabled per workspace.     │   │
│  │  Represents common functionality most workspaces want.       │   │
│  │  Upgrades atomically with the shell.                         │   │
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
| **Where code lives** | `packages/core/src/apps/` | `packages/core/src/apps/` | `apps/` directory or loaded from registry |
| **Compiled into Worker** | Yes | Yes | No (loaded at runtime) |
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

## 6. Core Apps — Deep Dive

Core apps are the "operating system" of a workspace. They handle the concerns that every workspace needs, regardless of what it's used for. They ship in the Worker binary and upgrade atomically with the shell.

### Core App: Workspace Admin

**ID:** `core:admin`
**Display:** viewport
**Nav:** Settings (sidebar, section: "workspace")

The master control panel for a workspace. Only visible to users with `admin` or `owner` role.

**Features:**

- **General Settings** — Workspace name, slug, description, type, custom domain configuration
- **Locale & Region** — Base language, supported languages, timezone, date format, number format (see §18.5 Multilingual Support)
- **Appearance** — Quick theme picker (delegates to Brand Manager for full control)
- **App Settings (extensible)** — Centralized configuration for all installed guest apps. Each app that declares `settings.admin` in its manifest gets a section here with grouped fields (API keys, toggles, thresholds, defaults). Admins configure all apps in one place. Required fields gate app activation. Secret fields encrypted at rest.
- **App Management** — Enable/disable core and bundled apps. Install/remove guest apps. Configure app settings per workspace. Reorder sidebar nav.
- **Integrations** — Webhook management, API key management, external service connections
- **Danger Zone** — Transfer ownership, archive workspace, delete workspace

**Workspace Settings Schema:**

```typescript
interface WorkspaceSettings {
  // General
  name: string
  slug: string
  description: string
  type: 'organization' | 'team' | 'project' | 'personal' | 'board'
  custom_domain?: string

  // Locale & region
  locale: {
    base_language: string           // ISO 639-1: 'en', 'es', 'pt', 'fr', etc.
    supported_languages: string[]   // Additional languages: ['es', 'pt']
    timezone: string                // IANA: 'America/Chicago'
    date_format: 'us' | 'eu' | 'iso'  // MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD
    number_format: 'us' | 'eu'     // 1,000.00 vs 1.000,00
  }

  // Appearance (delegates to Brand Manager for full control)
  appearance: {
    base_theme: 'warm' | 'cool' | 'neutral' | 'midnight' | 'stone'
    accent_color: string            // hex
  }
}
```

The `base_language` is the source of truth language — all content is authored in this language first. When the admin adds a supported language, the system offers to AI-translate existing brand messaging tokens into the new language (see Brand Manager multilingual support). Users can override their display language in personal settings; the shell renders in the user's preferred language if a translation exists, falling back to the workspace's base language.

**API Routes:**

```
GET    /_ensemble/admin/settings          — workspace settings (full)
PUT    /_ensemble/admin/settings          — update settings
PATCH  /_ensemble/admin/settings/locale   — update just locale settings
GET    /_ensemble/admin/apps              — list all apps + status
PUT    /_ensemble/admin/apps/:id          — toggle/configure an app
GET    /_ensemble/admin/integrations      — list integrations
POST   /_ensemble/admin/integrations      — create integration
GET    /_ensemble/admin/languages         — list base + supported languages
POST   /_ensemble/admin/languages         — add a supported language (triggers AI translation offer)
DELETE /_ensemble/admin/languages/:code   — remove a supported language
```

---

### Core App: Brand Manager — The Company Brand System

**ID:** `core:brand`
**Display:** viewport
**Nav:** Brand (sidebar, section: "workspace")

The Brand Manager is more than a theme picker. It's the **canonical source of truth for the company's entire brand identity** — visual, verbal, and structural. Change a color, a tagline, or a logo here and it propagates everywhere: the workspace shell, guest apps, the public website, email templates, AI agents writing copy, pitch decks, investor materials. This is what makes "the programmable surface of a company" literal.

#### Two Layers

**Layer 1: Workspace appearance** — The 4 constrained controls that theme the shell (documented in §18 Brand Theming). Accent color, logo mark, base theme, workspace name. These drive how the workspace looks internally.

**Layer 2: Company brand system** — A comprehensive set of tokens describing everything about the company's identity. Colors, typography, logos, messaging, tone, identity, plus extensible custom token groups. These drive how the company looks everywhere — the workspace is just one consumer.

Both layers are managed in the same Brand Manager app, on separate tabs.

#### Built-in Token Categories

Each category has a dedicated visual editor — not a form with text fields, but purpose-built UI appropriate to the content type.

**Colors:**
A visual color grid rendered as swatches — not a list of hex inputs. Click a swatch to edit. Built-in contrast checker shows which text colors work on which backgrounds. Dark mode variants auto-generated with manual override.

```yaml
colors:
  primary: "#1a1a2e"          # Headers, primary backgrounds
  secondary: "#2d2d4a"        # Secondary backgrounds, hover states
  accent: "#c8a951"           # CTAs, highlights, active states, buttons
  surface: "#fafaf8"          # Default page background
  surface_elevated: "#ffffff" # Cards, modals, elevated surfaces
  text_primary: "#1a1a1e"     # Headings, body text
  text_secondary: "#6b6b68"  # Secondary text, descriptions
  text_muted: "#9a9a96"      # Captions, placeholders, disabled
  border: "#e8e8e4"           # Default borders
  success: "#0d9e74"          # Success states, positive indicators
  warning: "#ef9f27"          # Warning states, attention needed
  error: "#e24b4a"            # Error states, destructive actions
  info: "#378add"             # Informational, links, neutral highlights
```

**Typography:**
Font picker with live preview. Type your heading in the heading font, body copy in the body font — see them side by side at various sizes. Google Fonts integration. Upload option for custom fonts (stored in R2).

```yaml
typography:
  heading_font: "Gloock"
  heading_weight: "600"
  body_font: "DM Sans"
  body_weight: "400"
  mono_font: "JetBrains Mono"
  font_urls:
    - "https://fonts.googleapis.com/css2?family=Gloock&family=DM+Sans:wght@300;400;500;600"
  scale:                       # Optional: type scale for consistency
    h1: "2.25rem"
    h2: "1.75rem"
    h3: "1.375rem"
    body: "1rem"
    small: "0.875rem"
    caption: "0.75rem"
```

**Logos:**
Drag-and-drop upload zones for each variant. Live preview showing how each logo renders at different sizes and on different backgrounds. Auto-generated favicon from the icon mark if none uploaded.

```yaml
logos:
  wordmark: "/brand/assets/wordmark.svg"          # Full wordmark (light bg)
  wordmark_dark: "/brand/assets/wordmark-dark.svg" # Full wordmark (dark bg)
  icon_mark: "/brand/assets/icon.svg"              # Square icon (light bg)
  icon_mark_dark: "/brand/assets/icon-dark.svg"    # Square icon (dark bg)
  favicon: "/brand/assets/favicon.ico"             # Auto-generated if absent
  social_avatar: "/brand/assets/social.png"        # Square, for social profiles
  og_image: "/brand/assets/og.png"                 # 1200x630 Open Graph image
```

All assets stored in R2, served via the brand assets API with proper cache headers.

**Messaging:**
Rich text editors with character count targets. A "messaging hierarchy" view showing all copy stacked vertically so you can see how it flows.

```yaml
messaging:
  tagline: "The intelligent capital platform"
  elevator_pitch: "Ownly connects borrowers with the right capital through AI-powered matching and streamlined deal management."
  mission: "To make capital accessible and transparent for every business."
  value_props:
    - headline: "AI-powered matching"
      description: "Our algorithms connect borrowers with optimal lending partners in seconds, not weeks."
    - headline: "Transparent process"
      description: "Track your application status in real-time. No black boxes."
    - headline: "One application"
      description: "Fill out one form. Get matched with dozens of lenders."
  boilerplate: "Ownly Group is an Austin-based fintech company building the intelligent capital platform. Founded in 2024, Ownly connects borrowers with optimal lending partners through AI-powered matching and streamlined deal management."
  legal_footer: "© {year} The Ownly Group, LLC. All rights reserved."
```

**Tone:**
Tag chips for descriptors, a dos/don'ts list, voice guidelines.

```yaml
tone:
  descriptors: ["confident", "clear", "approachable", "technical when needed"]
  avoid: ["jargon without explanation", "hype", "superlatives without evidence"]
  voice: "First person plural ('we'). Active voice. Short sentences. Lead with the benefit, follow with the proof."
```

**Identity:**
Simple fields that power legal footers, boilerplate generation, and "about" content.

```yaml
identity:
  legal_name: "The Ownly Group, LLC"
  display_name: "Ownly"
  founding_year: 2024
  headquarters: "Austin, TX"
  website: "https://ownly.com"
  industry: "Fintech"
```

**Spatial:**
Layout tokens for consistent UI across all surfaces.

```yaml
spatial:
  radius: "8px"
  radius_lg: "12px"
  spacing_unit: "8px"
```

#### Extensible Custom Token Groups

Below the built-in categories, admins can create custom token groups for brand elements that don't fit the standard schema. Every company is different — a PE firm needs fund branding, a biotech needs pipeline stage colors, a DTC brand needs packaging palette tokens.

An admin clicks "Add token group," names it (e.g., "Fund branding"), and adds named tokens with types:

```yaml
custom:
  fund_branding:
    fund_name:
      value: "Ownly Diversified Credit Fund I"
      type: text
      label: "Fund name"
    fund_vintage:
      value: "2026"
      type: text
      label: "Vintage year"
    fund_color:
      value: "#1a3d5c"
      type: color
      label: "Fund primary color"
    fund_target:
      value: "$50M"
      type: text
      label: "Fund target"
    fund_legal:
      value: "Ownly Diversified Credit Fund I, LP"
      type: text
      label: "Fund legal name"
```

Available token types:

| Type | Editor | Example |
|---|---|---|
| `text` | Single-line text input | Fund name, vintage year |
| `color` | Color picker with hex input | Fund primary color |
| `image` | Drag-and-drop upload (stored in R2) | Fund logo, partner headshot |
| `url` | URL input with validation | Fund data room link |
| `number` | Number input | Target raise amount |
| `rich_text` | Rich text editor | Fund description, disclosures |

Custom tokens get the same treatment as built-in tokens: stored in D1, cached in KV, served via API, included in generated CSS, written to the Knowledge Graph, and triggering webhooks on change. The API consumer doesn't care whether a token is built-in or custom — it's just a key with a value.

#### Storage Model

On the backend, all tokens — built-in and custom — are stored in a single flexible table:

```sql
CREATE TABLE brand_tokens (
  workspace_id TEXT NOT NULL,
  category     TEXT NOT NULL,       -- 'colors' | 'typography' | 'logos' | 'messaging' |
                                    -- 'tone' | 'identity' | 'spatial' | 'custom:{group_slug}'
  key          TEXT NOT NULL,       -- 'primary' | 'tagline' | 'fund_name' | etc.
  value        TEXT NOT NULL,       -- the value (text, hex, URL to R2 asset, JSON for structured)
  type         TEXT NOT NULL,       -- 'text' | 'color' | 'image' | 'url' | 'number' | 'rich_text'
  label        TEXT,                -- human-readable label for the UI
  description  TEXT,                -- usage guidance (included in machine context)
  locale       TEXT,                -- NULL = base language, 'es' = Spanish, etc.
  is_stale     BOOLEAN DEFAULT FALSE, -- TRUE when source language version changed after this translation
  sort_order   INTEGER DEFAULT 0,
  updated_at   TEXT NOT NULL,
  updated_by   TEXT NOT NULL,       -- user handle

  PRIMARY KEY (workspace_id, category, key, COALESCE(locale, ''))
);

CREATE TABLE brand_token_groups (
  workspace_id TEXT NOT NULL,
  slug         TEXT NOT NULL,       -- 'fund_branding'
  label        TEXT NOT NULL,       -- 'Fund branding'
  sort_order   INTEGER DEFAULT 0,

  PRIMARY KEY (workspace_id, slug)
);
```

#### Four Delivery Endpoints

One source of truth, four ways to consume it:

**1. Visual brand page** — for designers, contractors, new hires

```
GET ~acme/brand                     (public read-only URL)
GET /_ensemble/brand/page              (same content, API path)
```

A beautifully rendered HTML page showing the full brand identity: color swatches on a visual grid, typography specimens at various sizes, logos on light and dark backgrounds, the messaging hierarchy, tone guidelines, custom token groups. Always current. Send this link to anyone who needs to understand the brand.

The workspace admin controls whether this page is public (anyone with the URL can view) or restricted (workspace members only).

**2. Machine brand context** — for AI systems, claude.md, system prompts

```
GET /_ensemble/brand/context                        → markdown (default)
GET /_ensemble/brand/context?format=json             → structured JSON
GET /_ensemble/brand/context?format=yaml             → YAML
GET /_ensemble/brand/context?for=website             → scoped to website-relevant tokens
GET /_ensemble/brand/context?for=email               → scoped to email-relevant tokens
GET /_ensemble/brand/context?for=pitch-deck          → scoped to pitch-relevant tokens
GET /_ensemble/brand/context?for=ai                  → full compiled narrative (default)
```

The markdown format is a **compiled narrative** — not a raw dump of tokens, but prose with context that tells an AI system how to apply the brand:

```markdown
# Ownly — Brand context

## Identity
Ownly (legal: The Ownly Group, LLC) is an Austin-based fintech company
founded in 2024. Website: ownly.com

## Visual identity
Primary color: #1a1a2e (dark navy — use for headers, primary backgrounds)
Accent color: #c8a951 (gold — use for CTAs, highlights, active states)
Surface: #fafaf8 (warm off-white — default page background)
Error: #e24b4a, Warning: #ef9f27, Success: #0d9e74

Heading font: Gloock (serif, 600 weight — use for h1-h3, hero text)
Body font: DM Sans (sans-serif, 400 weight — use for all body copy)
Mono font: JetBrains Mono (code blocks, data, API references)

Border radius: 8px (buttons, cards, inputs)
The aesthetic is: premium, minimal, warm.

## Logos
Wordmark (light bg): https://acme.ensemble.ai/_ensemble/brand/assets/wordmark.svg
Icon mark (light bg): https://acme.ensemble.ai/_ensemble/brand/assets/icon.svg
Wordmark (dark bg): https://acme.ensemble.ai/_ensemble/brand/assets/wordmark-dark.svg

## Messaging
Tagline: "The intelligent capital platform"
Elevator pitch: "Ownly connects borrowers with the right capital through
AI-powered matching and streamlined deal management."
Mission: "To make capital accessible and transparent for every business."

Value propositions:
1. AI-powered matching — algorithms connect borrowers with optimal lenders
2. Transparent process — real-time application tracking, no black boxes
3. One application — fill out one form, get matched with dozens of lenders

Boilerplate: "Ownly Group is an Austin-based fintech company..."
Legal footer: © 2026 The Ownly Group, LLC. All rights reserved.

## Tone
Voice: confident, clear, approachable, technical when needed
Avoid: jargon without explanation, hype, superlatives without evidence
Style: first person plural ("we"), active voice, short sentences

## Custom: Fund branding
Fund name: Ownly Diversified Credit Fund I
Fund vintage: 2026
Fund target: $50M
Fund legal name: Ownly Diversified Credit Fund I, LP
```

The `description` field on each token powers the parenthetical guidance — `(dark navy — use for headers, primary backgrounds)`. Admins can add usage guidance to any token and it shows up in the machine context.

The `for` parameter controls scoping. Workspace admins configure which token categories are included in each scope via the Brand app settings. The `for=ai` scope (default) includes everything.

**3. Raw tokens API** — for build tools, programmatic consumption

```
GET /_ensemble/brand/tokens                          → full token set (JSON)
GET /_ensemble/brand/tokens/colors                   → just colors
GET /_ensemble/brand/tokens/typography               → just typography
GET /_ensemble/brand/tokens/messaging                → just messaging
GET /_ensemble/brand/tokens/identity                 → just identity
GET /_ensemble/brand/tokens/custom/fund_branding     → just the fund branding group
```

Returns structured JSON with `etag` for cache validation and `last_modified` timestamp:

```json
{
  "last_modified": "2026-03-26T14:30:00Z",
  "etag": "abc123",
  "tokens": {
    "colors": {
      "primary": { "value": "#1a1a2e", "type": "color", "label": "Primary", "description": "Headers, primary backgrounds" },
      "accent": { "value": "#c8a951", "type": "color", "label": "Accent", "description": "CTAs, highlights, active states" }
    },
    "messaging": {
      "tagline": { "value": "The intelligent capital platform", "type": "text", "label": "Tagline" }
    },
    "custom": {
      "fund_branding": {
        "fund_name": { "value": "Ownly Diversified Credit Fund I", "type": "text", "label": "Fund name" }
      }
    }
  }
}
```

**4. Generated CSS** — for websites and apps

```
GET /_ensemble/brand/css
```

Returns a CSS file that any website can include with a single `<link>` tag:

```html
<link rel="stylesheet" href="https://acme.ensemble.ai/_ensemble/brand/css">
```

The generated CSS:

```css
/* Ensemble Brand Tokens — Ownly */
/* Generated: 2026-03-26T14:30:00Z */
/* Source: https://acme.ensemble.ai/_ensemble/brand */

@import url('https://fonts.googleapis.com/css2?family=Gloock&family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500');

:root {
  /* Colors */
  --brand-primary: #1a1a2e;
  --brand-secondary: #2d2d4a;
  --brand-accent: #c8a951;
  --brand-surface: #fafaf8;
  --brand-surface-elevated: #ffffff;
  --brand-text-primary: #1a1a1e;
  --brand-text-secondary: #6b6b68;
  --brand-text-muted: #9a9a96;
  --brand-border: #e8e8e4;
  --brand-success: #0d9e74;
  --brand-warning: #ef9f27;
  --brand-error: #e24b4a;
  --brand-info: #378add;

  /* Typography */
  --brand-font-heading: 'Gloock', serif;
  --brand-font-body: 'DM Sans', sans-serif;
  --brand-font-mono: 'JetBrains Mono', monospace;

  /* Spatial */
  --brand-radius: 8px;
  --brand-radius-lg: 12px;
  --brand-spacing: 8px;

  /* Custom: Fund branding */
  --brand-custom-fund-color: #1a3d5c;
}
```

Cached in KV, regenerated on token change. Short cache TTL (5 minutes) so changes propagate quickly.

#### Webhooks

When any brand or messaging token changes, the workspace can fire webhooks to configured URLs:

```json
{
  "event": "brand.tokens.updated",
  "workspace": "~acme",
  "timestamp": "2026-03-26T14:30:00Z",
  "changed_categories": ["colors", "messaging"],
  "changed_keys": ["accent", "tagline"],
  "actor": "@hawkins",
  "endpoints": {
    "tokens": "https://acme.ensemble.ai/_ensemble/brand/tokens",
    "css": "https://acme.ensemble.ai/_ensemble/brand/css",
    "context": "https://acme.ensemble.ai/_ensemble/brand/context"
  }
}
```

Use case: the webhook hits your CI/CD pipeline → your static site generator pulls the new tokens from `/_ensemble/brand/tokens` → your website deploys with the updated brand. Change the tagline in Ensemble at 2pm, your website reflects it by 2:05pm. No manual deploy.

#### Knowledge Graph Integration

All messaging and tone tokens are automatically written to the Knowledge Graph at `brand.*`. This means:

- The AI panel can answer "what's our tagline?" or "write an email using our value props"
- Guest agents writing content pull from the canonical source
- The `claude.md` context endpoint includes brand context
- Knowledge validation can check whether guest apps' content aligns with the brand voice

When tokens change, the Knowledge Graph updates in the same transaction.

#### The Visual Layer

The Brand Manager UI should feel like a **brand studio**, not a settings page. This is the app where the CEO or brand manager lives.

- **Brand preview card** — a live-rendered mockup showing how the brand looks in context (email header, website hero section, social post, business card). Updates in real-time as tokens change.
- **Each category is a collapsible section** with a visual editor appropriate to the content type. No raw JSON. No code unless you want it.
- **Export panel** — shows all the ways to consume the brand: the CSS link tag, the API URLs, the context endpoint for claude.md, the webhook config. One-click copy for each.
- **Change log** — who changed what, when. Pulled from the audit trail. "Sara changed the tagline from X to Y on March 15."
- **Share button** — generates the read-only brand page URL (`~acme/brand`). Your brand guidelines as a live URL that never goes stale.
- **Custom token groups** — "Add token group" button at the bottom. Create, name, add typed tokens, reorder.

**API Routes:**

```
Public (no auth required by default, configurable):
GET    /_ensemble/brand/page              — visual brand page (HTML)
GET    /_ensemble/brand/context           — compiled brand context (MD/JSON/YAML)
GET    /_ensemble/brand/tokens            — full token set (JSON)
GET    /_ensemble/brand/tokens/{category} — tokens for a specific category
GET    /_ensemble/brand/css               — generated CSS custom properties
GET    /_ensemble/brand/assets/{filename} — logo/image assets (R2)

Authenticated (workspace members):
PUT    /_ensemble/brand/tokens            — update tokens (batch)
PUT    /_ensemble/brand/tokens/{category}/{key} — update a single token
POST   /_ensemble/brand/assets            — upload brand asset
DELETE /_ensemble/brand/assets/{filename} — delete brand asset
POST   /_ensemble/brand/groups            — create custom token group
PUT    /_ensemble/brand/groups/{slug}     — update group metadata
DELETE /_ensemble/brand/groups/{slug}     — delete group (and its tokens)
GET    /_ensemble/brand/changelog         — recent changes with actor + timestamp
POST   /_ensemble/brand/webhooks          — configure webhook URLs
GET    /_ensemble/brand/webhooks          — list configured webhooks
```

#### How It All Connects

```
Admin updates tagline in Brand Manager
        │
        ├──→ D1: token updated in brand_tokens table
        ├──→ KV: cache key busted, new value written
        ├──→ Knowledge Graph: brand.messaging.tagline updated
        ├──→ Audit log: "admin changed tagline from X to Y"
        ├──→ Event bus: brand.tokens.updated emitted
        │         │
        │         ├──→ Shell re-reads theme (if visual token changed)
        │         ├──→ AI panel context refreshed
        │         └──→ Webhooks fired to configured URLs
        │                   │
        │                   └──→ CI/CD rebuilds ownly.com with new tagline
        │
        └──→ All delivery endpoints serve updated data:
              /_ensemble/brand/tokens   → new tagline in JSON
              /_ensemble/brand/context  → new tagline in narrative
              /_ensemble/brand/css      → regenerated (if visual token)
              ~acme/brand            → visual page shows new tagline
```

One change. Everywhere. Immediately.

---

### Core App: People & Teams

**ID:** `core:people`
**Display:** viewport
**Nav:** 👥 People (sidebar, section: "workspace")

User and team management for the workspace.

**Features:**

- **Member Directory** — Searchable, filterable list of all workspace members. Shows role, teams, last active, app access.
- **Invite Flow** — Generate invite links or email invites. Set role, app access, and expiry. Bulk invite via CSV.
- **Role Management** — Built-in roles (owner, admin, member, viewer, guest). Custom roles with granular permission checkboxes. Role templates for common patterns (e.g., "Board Member" = viewer + data-room access).
- **Teams / Groups** — Create groups that inherit permission sets. Assign members to groups. Groups can be used for app access control (e.g., "Engineering" team gets access to the deployment dashboard).
- **Profile Management** — Each member has a workspace-specific profile (display name, title, avatar, contact info). Distinct from their global AIUX identity.
- **Deactivation** — Suspend or remove members. Suspended members can't access the workspace but their data/audit trail is preserved.
- **Agent Management** — Create and manage API keys for agents. Set scopes, rate limits, expiry. View agent activity.

**API Routes:**

```
GET    /_ensemble/people                  — list members
POST   /_ensemble/people/invite           — create invitation
GET    /_ensemble/people/:id              — member profile
PUT    /_ensemble/people/:id              — update member
DELETE /_ensemble/people/:id              — remove member
GET    /_ensemble/people/teams            — list teams
POST   /_ensemble/people/teams            — create team
PUT    /_ensemble/people/teams/:id        — update team
GET    /_ensemble/people/roles            — list roles
POST   /_ensemble/people/roles            — create custom role
GET    /_ensemble/people/agents           — list agent keys
POST   /_ensemble/people/agents           — create agent key
```

---

### Core App: Auth & Security

**ID:** `core:auth`
**Display:** viewport
**Nav:** 🔒 Security (sidebar, section: "settings")

Workspace-level authentication and security policies.

**Features:**

- **Auth Policies** — Require MFA for all members. Set session duration. Enforce password complexity. Allow/block specific OAuth providers.
- **SSO / Federation** — Configure SAML 2.0 or OIDC for enterprise SSO. Map IdP groups to workspace roles.
- **Domain Verification** — Verify email domains for auto-join (e.g., anyone with `@acme.com` can join the Acme workspace automatically).
- **Session Management** — View active sessions across all members. Force logout for specific users or all users. IP allowlisting.
- **API Security** — Global rate limiting. CORS configuration. Allowed origins for iframe embedding.
- **Login Page Customization** — Custom welcome message, background image, OAuth button visibility. Brand Manager theme applies automatically.

**API Routes:**

```
GET    /_ensemble/auth/policies           — auth policy config
PUT    /_ensemble/auth/policies           — update policies
GET    /_ensemble/auth/sso                — SSO configuration
PUT    /_ensemble/auth/sso                — update SSO
GET    /_ensemble/auth/sessions           — list active sessions
DELETE /_ensemble/auth/sessions/:id       — revoke session
GET    /_ensemble/auth/domains            — verified domains
POST   /_ensemble/auth/domains            — add domain for verification
```

---

### Core App: Knowledge Editor

**ID:** `core:knowledge`
**Display:** viewport
**Nav:** 📚 Knowledge (sidebar, section: "workspace")

The structured knowledge graph for the company — brand guidelines, messaging architecture, engineering standards, org structure, and custom domains.

**Features:**

- **Domain Browser** — Tree view of all knowledge domains and entries. Brand, messaging, engineering, org, custom.
- **Rich Editor** — Markdown editor with live preview for long-form entries (code style guides, messaging playbooks). JSON/YAML editor for structured entries (color palettes, terminology lists).
- **Messaging Architecture** — Dedicated UI for managing audience definitions, tone guidelines, preferred/forbidden terminology, boilerplate (signatures, disclaimers, legal footers), message templates.
- **Engineering Standards** — The "company claude.md." Code style, API conventions, component patterns, testing requirements, git workflow, CI/CD expectations. This is what agents receive when they build apps.
- **Org Structure** — Visual org chart builder. Define departments, teams, reporting lines, key contacts.
- **Version History** — Every knowledge entry is versioned. Diff viewer to compare changes. Rollback to any previous version.
- **Import / Export** — Import from YAML/JSON/Markdown files. Export the full knowledge graph. CLI support: `ensemble knowledge push` / `ensemble knowledge pull`.
- **Validation** — Lint installed apps against knowledge (e.g., check if an app uses the correct brand colors, follows naming conventions).

**The Knowledge-Agent Loop:**

```
1. Admin writes engineering standards in Knowledge Editor
2. Standards saved to knowledge graph (D1 + KV cache)
3. Agent requests context: GET /_ensemble/knowledge/context?for=app-development
4. Agent receives compiled standards document
5. Agent builds app following those standards
6. Knowledge Editor can lint the result against the standards
7. Admin refines standards based on what agents produce
```

**API Routes:**

```
GET    /_ensemble/knowledge                        — list domains
GET    /_ensemble/knowledge/:domain                 — list entries in domain
GET    /_ensemble/knowledge/:domain/:path           — get entry
PUT    /_ensemble/knowledge/:domain/:path           — upsert entry
DELETE /_ensemble/knowledge/:domain/:path           — delete entry
GET    /_ensemble/knowledge/:domain/:path/history   — version history
GET    /_ensemble/knowledge/context?for=:purpose    — compiled context document
GET    /_ensemble/knowledge/search?q=:query         — semantic search
POST   /_ensemble/knowledge/validate                — lint an app against standards
```

---

### Core App: App Manager

**ID:** `core:apps`
**Display:** viewport (also embedded in Workspace Admin)
**Nav:** 🧩 Apps (sidebar, section: "settings")

The app registry and lifecycle manager.

**Features:**

- **Installed Apps** — Grid/list of all apps in this workspace. Toggle enabled/disabled. Configure per-workspace settings.
- **App Details** — Manifest info, version, permissions requested, storage usage, API routes, event subscriptions.
- **App Store** — Browse available guest apps from the registry. One-click install. Preview before installing.
- **Ordering** — Drag-and-drop to reorder sidebar navigation. Organize apps into sections.
- **Per-Role Access** — Configure which roles/groups can see which apps. E.g., "only Engineering team sees the Deploy app."
- **App Health** — Error rates, response times, storage usage per app. Alert on anomalies.
- **Agent-Built Apps** — Review apps that agents have created. Approve/reject before they go live (if human-in-the-loop is enabled).

**API Routes:**

```
GET    /_ensemble/apps                    — list all apps (installed + available)
GET    /_ensemble/apps/:id                — app details
POST   /_ensemble/apps/:id/install        — install guest app
DELETE /_ensemble/apps/:id/uninstall      — uninstall guest app
PUT    /_ensemble/apps/:id/settings       — update app settings
PUT    /_ensemble/apps/:id/access         — update app access rules
POST   /_ensemble/apps                    — deploy new guest app (agent API)
```

---

### Core App: Audit Log

**ID:** `core:audit`
**Display:** viewport
**Nav:** 📋 Audit Log (sidebar, section: "settings")

Every action in the workspace — by humans and agents — is logged and browsable.

**Features:**

- **Event Stream** — Real-time feed of all workspace events. Filterable by actor, app, action type, date range.
- **Actor Filter** — Filter by humans vs. agents. See exactly what an agent did and when.
- **Export** — Export audit log as CSV/JSON for compliance.
- **Retention** — Configure log retention period per workspace.
- **Alerting** — Set up alerts for specific events (e.g., "notify me when any admin role is granted").

**API Routes:**

```
GET    /_ensemble/audit                   — query audit log
GET    /_ensemble/audit/export            — export audit log
GET    /_ensemble/audit/stats             — audit summary statistics
```


---

---

### Core App: Navigation Hub

**ID:** `core:nav`
**Display:** viewport (admin config UI) + background (renders the actual nav)
**Nav:** 🧭 Navigation (sidebar, section: "workspace")

This is one of AIUX's most important core apps because it controls the single most visible thing in the platform: **how people move around.** The Navigation Hub is a unified configuration surface for the sidebar, toolbar, bookmark bar, quick links, and mobile nav — with deep role-awareness and multiple layout strategies.

### The Problem It Solves

In most internal tool platforms, navigation is an afterthought — a flat list of app names in a sidebar. For a 5-app workspace, that's fine. For a 25-app workspace with 8 different roles, it's chaos. Different people need different views. Some apps should be grouped. Some should be pinned. Some should be hidden behind a "More" menu. External links need to live alongside internal apps. And it all needs to adapt to mobile.

### Navigation Zones (What the Hub Configures)

The Navigation Hub manages **six configurable zones**:

```
┌─────────────────────────────────────────────────────────────────┐
│  ❶ WORKSPACE HEADER                                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ [Logo] Ownly Group          [▾ Quick Switcher]             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ❷ PRIMARY NAV (sidebar)                                       │
│  ┌──────────────┐  ┌──────────────────────────────────────────┐ │
│  │ ── Main ──── │  │                                          │ │
│  │ 📊 Dashboard │  │  ❹ TOOLBAR                               │ │
│  │ 👥 CRM      │  │  ┌──────────────────────────────────────┐ │ │
│  │ 📝 Wiki     │  │  │ Breadcrumb │ [⌘K] [🔔] [🤖] [👤]   │ │ │
│  │ 🎫 Support  │  │  └──────────────────────────────────────┘ │ │
│  │              │  │                                          │ │
│  │ ── Finance ──│  │                                          │ │
│  │ 💰 Pipeline │  │           App Viewport                    │ │
│  │ 📄 Invoices │  │                                          │ │
│  │              │  │                                          │ │
│  │ ── Links ─── │  │                                          │ │
│  │ 🔗 Notion ↗ │  │                                          │ │
│  │ 🔗 GitHub ↗ │  │                                          │ │
│  │              │  │                                          │ │
│  │ ── Admin ─── │  │  ❺ BOOKMARK BAR                          │ │
│  │ ⚙️ Settings │  │  ┌──────────────────────────────────────┐ │ │
│  │              │  │  │ [Q3 Report] [Deal Tracker] [+ Add]   │ │ │
│  │ ❸ DOCK      │  │  └──────────────────────────────────────┘ │ │
│  │ ┌──────────┐│  │                                          │ │
│  │ │ 📌 Pinned ││  │                                          │ │
│  │ │ [+] Quick ││  │                                          │ │
│  │ └──────────┘│  │                                          │ │
│  └──────────────┘  └──────────────────────────────────────────┘ │
│                                                                 │
│  ❻ MOBILE NAV (responsive override)                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ [🏠 Home] [👥 CRM] [🤖 AI] [📁 Files] [⋯ More]          │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### ❶ Workspace Header

The top of the sidebar. Configurable elements:

- Workspace logo (from Brand Manager) or custom mark
- Workspace name display (full name, abbreviated, or hidden)
- Quick switcher dropdown (search + recent workspaces)
- Optional: custom subtitle, status indicator, or workspace-level banner

### ❷ Primary Nav (Sidebar)

This is the most complex zone. The admin has multiple layout strategies:

**Layout Strategies:**

| Strategy | Description | Best For |
|---|---|---|
| **Flat** | Simple vertical list of apps | Small workspaces (< 8 apps) |
| **Sectioned** | Apps grouped under collapsible section headers | Medium workspaces (8-20 apps) |
| **Categorized** | Multi-level with categories, subcategories, and dividers | Large workspaces (20+ apps) |
| **Role-Driven** | Different nav layouts per role | Complex orgs with diverse audiences |

**Sidebar Item Types:**

```typescript
type NavItem =
  | { type: 'app'; appId: string }                          // Installed app (any tier)
  | { type: 'app-page'; appId: string; path: string; label: string; icon?: string }  // Deep link into an app
  | { type: 'link'; url: string; label: string; icon?: string; external: boolean }    // External URL
  | { type: 'section'; label: string; collapsible: boolean; defaultOpen: boolean }    // Section header
  | { type: 'divider' }                                     // Visual separator
  | { type: 'spacer' }                                      // Push remaining items to bottom
  | { type: 'custom'; component: string; props?: any }      // Custom rendered item

interface NavSection {
  id: string
  label: string
  icon?: string
  collapsible: boolean
  defaultOpen: boolean
  items: NavItem[]
  visibility: NavVisibility
}

interface NavVisibility {
  roles?: string[]         // ["admin", "member"] — only these roles see it
  groups?: string[]        // ["engineering", "finance"] — only these groups
  apps?: string[]          // Show only if these apps are enabled
  condition?: 'all' | 'any' // Must match all or any of the above
}
```

**Example: Ownly Group Sidebar Configuration**

```json
{
  "strategy": "sectioned",
  "sections": [
    {
      "id": "main",
      "label": "Main",
      "collapsible": false,
      "items": [
        { "type": "app", "appId": "bundled:dashboard" },
        { "type": "app", "appId": "bundled:activity" }
      ],
      "visibility": { "roles": ["owner", "admin", "member"] }
    },
    {
      "id": "lending",
      "label": "Lending",
      "collapsible": true,
      "defaultOpen": true,
      "items": [
        { "type": "app", "appId": "guest:loan-pipeline" },
        { "type": "app", "appId": "guest:borrower-tracker" },
        { "type": "app-page", "appId": "bundled:files", "path": "/folders/loan-docs", "label": "Loan Documents", "icon": "folder" }
      ],
      "visibility": { "groups": ["lending-team"] }
    },
    {
      "id": "external",
      "label": "Quick Links",
      "collapsible": true,
      "defaultOpen": false,
      "items": [
        { "type": "link", "url": "https://notion.so/ownly", "label": "Notion", "icon": "external-link", "external": true },
        { "type": "link", "url": "https://github.com/ensemble-edge", "label": "GitHub", "icon": "github", "external": true },
        { "type": "link", "url": "https://app.attio.com", "label": "Attio CRM", "icon": "external-link", "external": true }
      ],
      "visibility": { "roles": ["owner", "admin", "member"] }
    },
    {
      "id": "workspace",
      "label": "Workspace",
      "items": [
        { "type": "app", "appId": "core:people" },
        { "type": "app", "appId": "core:knowledge" },
        { "type": "app", "appId": "core:brand" }
      ],
      "visibility": { "roles": ["owner", "admin"] }
    },
    {
      "id": "admin",
      "label": "Admin",
      "items": [
        { "type": "app", "appId": "core:admin" },
        { "type": "app", "appId": "core:apps" },
        { "type": "app", "appId": "core:auth" },
        { "type": "app", "appId": "core:audit" },
        { "type": "app", "appId": "core:nav" }
      ],
      "visibility": { "roles": ["owner", "admin"] }
    }
  ]
}
```

**Per-Role Overrides:**

Beyond section visibility, the admin can define entirely different nav layouts per role:

```json
{
  "strategy": "role-driven",
  "layouts": {
    "default": { "sections": [ ... ] },
    "guest": {
      "sections": [
        {
          "id": "portal",
          "label": null,
          "items": [
            { "type": "app", "appId": "guest:loan-tracker" },
            { "type": "app", "appId": "guest:support" },
            { "type": "app", "appId": "bundled:files" }
          ]
        }
      ]
    },
    "viewer": {
      "sections": [
        {
          "id": "dataroom",
          "label": null,
          "items": [
            { "type": "app", "appId": "bundled:files" }
          ]
        }
      ]
    }
  }
}
```

A board member with `viewer` role at Circuit Holdings sees a single-item nav: just the file manager (data room). Clean, uncluttered, obvious.

### ❸ Dock (Sidebar Footer)

The bottom of the sidebar. Persists across sections. Configurable:

- Pinned items (admin-set or user-customizable)
- Quick-add button (context-sensitive: "New Contact" in CRM section, "New Page" in Wiki section)
- User avatar + status
- Collapse/expand sidebar toggle

### ❹ Toolbar

The horizontal bar above the viewport. Configurable:

- Breadcrumb display (auto-generated from routing, or custom per app)
- Toolbar actions: which panel toggle buttons appear, in what order
- Search trigger style: icon only, icon + shortcut hint, or full search bar
- Custom toolbar items (apps can register toolbar actions via manifest)
- Optional: workspace-wide announcement banner (dismissable)

### ❺ Bookmark Bar

A horizontal bar of quick links below the toolbar (optional, can be toggled per workspace).

**Three layers of bookmarks:**

| Layer | Who Sets It | Who Sees It |
|---|---|---|
| **Workspace bookmarks** | Admin via Navigation Hub | Everyone (or per-role) |
| **Group bookmarks** | Group admin | Group members |
| **Personal bookmarks** | Individual user | Only them |

They render in order: workspace → group → personal, with visual separators.

```typescript
interface Bookmark {
  id: string
  label: string
  icon?: string              // Lucide icon or emoji
  target:
    | { type: 'app-page'; appId: string; path: string }
    | { type: 'external'; url: string }
    | { type: 'command'; commandId: string }  // Triggers a command palette action
  scope: 'workspace' | 'group' | 'personal'
  groupId?: string           // For group bookmarks
  userId?: string            // For personal bookmarks
  order: number
}
```

### ❻ Mobile Nav

On screens below the responsive breakpoint, the sidebar collapses and the mobile nav activates. The admin configures:

- **Bottom tab bar** — 3-5 primary items shown as bottom tabs
- **"More" menu** — Everything else, organized by section
- **Gesture nav** — Swipe right for sidebar overlay, swipe left for panels

```json
{
  "mobile": {
    "strategy": "bottom-tabs",
    "tabs": [
      { "type": "app", "appId": "bundled:dashboard", "label": "Home" },
      { "type": "app", "appId": "guest:crm", "label": "CRM" },
      { "type": "panel", "panelId": "bundled:ai-assistant", "label": "AI" },
      { "type": "app", "appId": "bundled:files", "label": "Files" },
      { "type": "more", "label": "More" }
    ],
    "swipeToSidebar": true,
    "swipeToPanels": true
  }
}
```

### Navigation Hub Admin UI

The admin interface for the Navigation Hub is a drag-and-drop builder:

- Left panel: available items (all enabled apps, link creator, section creator, divider)
- Center: preview of the sidebar as it will appear for the selected role
- Right panel: item configuration (icon, label, visibility rules, order)
- Role switcher at the top to preview how each role sees the nav
- Mobile preview toggle
- Live preview — changes reflect in real-time (not saved until confirmed)

### API Routes

```
GET    /_ensemble/nav                     — full nav config for current user (resolved by role)
GET    /_ensemble/nav/config              — raw nav configuration (admin)
PUT    /_ensemble/nav/config              — update nav configuration (admin)
GET    /_ensemble/nav/bookmarks           — user's bookmarks (all layers merged)
POST   /_ensemble/nav/bookmarks           — create personal bookmark
PUT    /_ensemble/nav/bookmarks/:id       — update bookmark
DELETE /_ensemble/nav/bookmarks/:id       — delete bookmark
GET    /_ensemble/nav/mobile              — mobile nav config
PUT    /_ensemble/nav/mobile              — update mobile nav config
```

### How the Shell Consumes It

At page load, the shell calls `GET /_ensemble/nav` which returns the pre-resolved navigation for the current user. The nav service:

1. Loads the workspace nav config from D1 (cached in KV)
2. Determines the user's role and groups
3. Selects the appropriate layout (default or role-specific override)
4. Filters sections and items by visibility rules
5. Merges bookmark layers (workspace → group → personal)
6. Returns a ready-to-render nav structure

The shell renders it directly — no client-side filtering needed. This means the nav respects permissions server-side: a `viewer` literally cannot discover that admin apps exist by inspecting the DOM.

---
---

## 7. Bundled Apps — Overview

Bundled apps ship in the same binary as core apps but represent optional functionality that most workspaces will want. Workspace admins can enable or disable them. Workspace templates can set default states.

### Bundled App: Dashboard

**ID:** `bundled:dashboard`
**Display:** viewport
**Nav:** 📊 Dashboard (sidebar, section: "tools", order: 1)

Customizable widget grid. Each widget is a mini-view from another app or a standalone metric.

**Features:** Widget grid layout (drag/drop), built-in widget types (stat card, chart, activity feed, quick actions, recent items), apps can register custom widgets via SDK, per-user dashboard customization within workspace.

---

### Bundled App: AI Assistant (The AI Panel)

**ID:** `bundled:ai-assistant`
**Display:** panel (right, pinnable, resizable)
**Nav:** AI (panel-bar, keyboard shortcut)
**Toggle:** toolbar button or `⌘+Shift+A`

The AI panel is the most important bundled app. It's not a chatbot — it's a **workspace-aware agent** that can see what you're looking at, query any app's API through the gateway, execute multi-step actions across apps, read the knowledge graph, and compose workflows from natural language prompts.

**The core insight:** Every guest app exposes API routes through the gateway. Every API route is documented in the app's manifest. The AI panel can call any of them on behalf of the user — with the user's permissions. "Show me customers with low credits and send them a reminder" triggers a GET to the customer manager app's API, filters results, then calls the email extension. All from one sentence.

#### How the AI Panel Works

```
User types: "approve both pending trials and draft a recharge email for DataDriven"
                                     │
                                     ▼
┌─── AI Panel (bundled:ai-assistant) ────────────────────────────────────┐
│                                                                        │
│  1. CONTEXT ASSEMBLY                                                   │
│     - Active app: @nendo/customers (from viewport state)               │
│     - Current view: customer list, filtered by "all"                   │
│     - Available APIs: all installed guest app manifests                 │
│     - User permissions: admin (can approve trials, send emails)        │
│     - Knowledge: workspace knowledge graph (brand voice, etc.)         │
│                                                                        │
│  2. TOOL RESOLUTION                                                    │
│     - "approve trials" → POST /_ensemble/customers/trials/{id}/approve    │
│     - "draft email" → calls LLM to compose, presents as action card    │
│     - "send email" → POST /_ensemble/extensions/resend/send               │
│                                                                        │
│  3. EXECUTION (via API gateway, same auth as user)                     │
│     - Gateway validates permissions per call                           │
│     - Audit log records each action                                    │
│     - Results streamed back to AI panel                                │
│                                                                        │
│  4. RESPONSE RENDERING                                                 │
│     - Text responses as chat bubbles                                   │
│     - Data results as action cards (structured, interactive)           │
│     - Pending actions as confirmation cards (user must approve)        │
│     - Links to navigate to relevant app views                          │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

#### Interactive Response Types

The AI panel doesn't just return text. It renders structured, interactive content:

**Chat bubbles** — standard conversational text for explanations and summaries.

**Action cards** — structured results with data and optional action buttons. Example: a list of customers matching a query, with "Email all" or "Export CSV" buttons. The buttons call guest app APIs through the gateway.

**Confirmation cards** — when the AI wants to take a destructive or significant action (send an email, revoke a key, approve a trial), it presents a confirmation card first. The user clicks "Confirm" or "Edit first." No actions happen without explicit approval.

**Navigation links** — "View this customer" links that navigate the viewport to the relevant app and page.

**Inline data** — small tables, metric summaries, charts that render directly in the panel without navigating away from the current viewport.

#### LLM Configuration — Who Pays?

LLM calls are a real cost. The configuration is hierarchical:

```
┌─ Ensemble-level defaults ─────────────────────────────────────────┐
│  Workers AI (free tier models) — available to all workspaces      │
│  This is the zero-config baseline. The AI panel works out of the  │
│  box with Workers AI models at no additional cost.                │
└───────────────────────────────┬───────────────────────────────────┘
                                │ workspace can override
                                ▼
┌─ Workspace-level config ──────────────────────────────────────────┐
│  Set in ensemble.config.ts or Admin → AI settings:                    │
│                                                                    │
│  ai: {                                                             │
│    provider: 'anthropic',           // or 'openai', 'workers-ai'  │
│    model: 'claude-sonnet-4-20250514',                              │
│    apiKey: env.ANTHROPIC_API_KEY,   // workspace secret            │
│    maxTokensPerRequest: 4096,                                      │
│    maxRequestsPerUser: 100,         // daily per-user limit        │
│    systemPrompt: 'You are the AI assistant for Nendo...',          │
│  }                                                                 │
│                                                                    │
│  The workspace owner pays for LLM calls. The API key is stored    │
│  as a Worker secret, never exposed to the client.                 │
└───────────────────────────────┬───────────────────────────────────┘
                                │ guest apps can add context
                                ▼
┌─ Guest app-level context ─────────────────────────────────────────┐
│  Guest apps don't configure their own LLM. Instead, they          │
│  contribute context and tools to the workspace AI panel:          │
│                                                                    │
│  // In the guest app manifest                                      │
│  "ai": {                                                           │
│    "tools": [                                                      │
│      {                                                             │
│        "name": "list_customers",                                   │
│        "description": "List customers with optional filters",     │
│        "api_route": "GET /customers",                             │
│        "parameters": {                                             │
│          "status": "active | trial | exhausted",                  │
│          "credits_below": "number",                               │
│          "sort": "last_active | credits | calls"                  │
│        }                                                           │
│      },                                                            │
│      {                                                             │
│        "name": "approve_trial",                                    │
│        "description": "Approve a pending trial request",          │
│        "api_route": "POST /trials/{id}/approve",                  │
│        "requires_confirmation": true                               │
│      }                                                             │
│    ],                                                              │
│    "context_prompt": "This app manages Nendo API customers..."    │
│  }                                                                 │
│                                                                    │
│  The AI panel reads all installed apps' ai.tools at startup and   │
│  includes them as available function calls in the LLM context.    │
└───────────────────────────────────────────────────────────────────┘
```

**The billing model is clean:** The workspace owner configures and pays for the LLM. They choose the provider and model. They set per-user limits. Guest apps contribute tools and context but don't incur LLM costs themselves — they just expose API routes that the AI panel can call. The LLM call happens in the workspace Worker; the API calls to guest apps happen through the gateway with normal auth.

**For Ensemble Cloud:** Cloud workspaces get Workers AI for free (bundled in the hosting cost). Upgrading to Anthropic/OpenAI models is a workspace-level setting with usage-based billing.

#### SDK Support for AI Panel

**For guest app developers (`@ensemble-edge/guest`):**

Add an `ai` section to your manifest to make your app AI-panel-aware:

```typescript
export default defineGuestApp({
  manifest: {
    // ...existing manifest fields...

    ai: {
      // Tools the AI panel can call (maps to your API routes)
      tools: [
        {
          name: 'list_customers',
          description: 'Search and filter customers by status, credits, usage',
          api_route: 'GET /customers',
          parameters: {
            status: { type: 'string', enum: ['active', 'trial', 'exhausted'] },
            credits_below: { type: 'number', description: 'Filter by credit threshold' },
          },
        },
        {
          name: 'approve_trial',
          description: 'Approve a pending trial request and provision API key',
          api_route: 'POST /trials/{id}/approve',
          requires_confirmation: true,  // AI must show confirmation card
        },
        {
          name: 'send_recharge_reminder',
          description: 'Send a recharge reminder email to a customer',
          api_route: 'POST /customers/{id}/remind',
          requires_confirmation: true,
        },
      ],

      // Additional context for the AI when this app is in the viewport
      context_prompt: 'The Nendo customer manager tracks API key customers. Customers have statuses (active, trial, exhausted), credit balances, and usage history. Trial customers need manual approval.',

      // What the AI should know about the current view state
      context_provider: 'viewport',  // AI gets notified of viewport state changes
    },
  },
})
```

**For the workspace shell (`@ensemble-edge/sdk`):**

The AI panel uses the SDK's event bus to know what's happening in the viewport:

```typescript
// The AI panel listens to viewport state changes
import { useAppContext } from '@ensemble-edge/sdk'

// Inside a guest app, broadcast context to the AI panel
const { broadcastAIContext } = useAppContext()

broadcastAIContext({
  currentView: 'customer-list',
  filters: { status: 'all' },
  selectedItems: ['customer_123'],
  dataCount: 147,
})
```

#### What Makes This Different from ChatGPT

This isn't a generic LLM chat. The difference is:

1. **It knows your workspace.** The system prompt includes the workspace name, the knowledge graph, the installed apps, and the current user's role.

2. **It can act.** Function calling through the API gateway means it doesn't just answer questions — it approves trials, sends emails, queries databases, exports reports. Every guest app's API is a tool.

3. **It respects permissions.** The AI calls APIs with the user's JWT. If a viewer asks the AI to revoke an API key, the gateway returns 403. The AI tells the user they don't have permission. No special-casing needed.

4. **It shows, not tells.** Action cards, confirmation dialogs, navigation links, inline data. The AI panel renders structured UI, not just text.

5. **It's contextual.** When you're looking at a customer list, the AI knows. When you switch to usage analytics, the AI's available tools and context change. The viewport drives the conversation context.

---

### Bundled App: File Manager

**ID:** `bundled:files`
**Display:** viewport / panel
**Nav:** 📁 Files (sidebar, section: "tools")

R2-backed file storage with workspace-scoped permissions.

**Features:** Folder hierarchy, file upload (drag/drop, bulk), preview (images, PDFs, text), file sharing (internal links), storage quota management, version history for documents.

---

### Bundled App: Notifications

**ID:** `bundled:notifications`
**Display:** panel (right)
**Nav:** 🔔 Notifications (panel-bar)

Unified notification center across all apps.

**Features:** Aggregated notifications from all installed apps. Read/unread state. Notification preferences (per app, per event type). Mark all read. Click to navigate to source.

---

### Bundled App: Activity Feed

**ID:** `bundled:activity`
**Display:** viewport / panel
**Nav:** 📡 Activity (sidebar, section: "tools")

Real-time feed of everything happening in the workspace.

**Features:** Event stream from all apps (human and agent activity). Filterable by app, person, event type. "What happened while I was away" summary. Subscribable — follow specific apps or people.

---

### Bundled App: Status

**ID:** `bundled:status`
**Display:** viewport
**Nav:** Status (sidebar, section: "workspace")

Unified health dashboard for the entire workspace. Aggregates health check endpoints from all installed guest apps and external services into one view.

**How it works:** Guest apps declare a `health` field in their manifest:

```json
{
  "health": {
    "endpoint": "GET /health",
    "interval": 60,
    "timeout": 5000,
    "display_name": "Customer manager",
    "dependencies": [
      {
        "name": "iq.ensemble.ai",
        "endpoint": "https://iq.ensemble.ai/health",
        "type": "external"
      },
      {
        "name": "Unkey API",
        "endpoint": "https://api.unkey.dev/v1/liveness",
        "type": "external"
      }
    ]
  }
}
```

The status app polls each guest app's health endpoint through the gateway (same-zone via service binding, remote via HTTP). It also polls declared external dependencies directly. Results are cached in KV with the configured interval.

**Features:**

- Consolidated health view — every installed app + their declared dependencies in one page
- Status indicators: healthy (green), degraded (yellow), down (red), unknown (gray)
- Response time tracking per endpoint (p50, p95, p99 over last 24h)
- Incident timeline — when did something go down, when did it recover
- Uptime percentages (24h, 7d, 30d) per app and dependency
- Alert configuration — workspace admins set thresholds for email/push notifications
- AI panel integration — "is anything down?" returns a summary from the status app
- Public status page option — toggle `visibility: public` to expose a branded status page at `~acme/status` for customers
- Cron-powered: a scheduled trigger polls all endpoints at their configured intervals and writes results to D1. The dashboard reads from D1/KV, not from live checks.

**The manifest `health` field:**

| Field | Type | Description |
|---|---|---|
| `endpoint` | string | The app's own health check route (called through gateway) |
| `interval` | number | Poll interval in seconds (default: 60) |
| `timeout` | number | Max response time in ms before marking degraded (default: 5000) |
| `display_name` | string | How this app appears in the status dashboard |
| `dependencies` | array | External services this app depends on (polled directly) |
| `dependencies[].name` | string | Display name of the dependency |
| `dependencies[].endpoint` | string | Full URL to poll |
| `dependencies[].type` | string | `external` (third-party) or `internal` (another workspace app) |

A healthy response is any `2xx` status code returned within the timeout. The response body can optionally include structured health data:

```json
{
  "status": "healthy",
  "checks": {
    "database": "ok",
    "cache": "ok",
    "enrichment_api": "degraded"
  },
  "latency_ms": 12
}
```

If the response includes `checks`, the status app displays per-subsystem health, giving more granular visibility than a simple up/down.

---

## 8. Guest Apps, Delivery Methods & The Guest SDK

Guest apps are where the real power of Ensemble lives. They're the company's custom tools, the community's shared utilities, and — ultimately — the way major SaaS products integrate with the workspace. Every guest app, whether built by the workspace developer or by Linear or Stripe, shows up identically in the workspace: same sidebar, same theme, same permissions, same audit trail.

### The Architectural Principle: Guest Apps Are Always Separate Services

In prior versions of this spec, guest apps could be compiled into the workspace Worker. We've revised this. **The workspace Worker is thin — it runs the shell, core apps, bundled apps, and the API gateway. Guest apps always run as separate services.** Even "your own" guest apps run on separate Workers in the same Cloudflare zone.

Why:

- The workspace Worker stays small, fast, and easily upgradeable (it's just `@ensemble-edge/core`)
- Guest apps have independent deployment lifecycles — deploy your CRM without touching the workspace
- Guest apps can be built on any platform — Cloudflare Workers, Vercel, AWS Lambda, Node, Deno
- The same guest app can serve multiple workspaces without being compiled into each one
- The security boundary is cleaner — guest apps never run in the same execution context as the core

The workspace's API gateway proxies requests between the shell and guest apps. For same-zone Cloudflare Workers, this uses service bindings (effectively zero latency). For remote apps, it's a standard HTTP proxy with auth token injection.

```
┌─── Workspace Worker (thin) ─────────────────────────────┐
│                                                          │
│  @ensemble-edge/core: shell, core apps, bundled apps, gateway     │
│                                                          │
│  All guest app requests are proxied through the gateway:  │
│                                                          │
│  /app/crm/*        → CRM Worker (same CF zone)          │
│  /app/wiki/*       → Wiki Worker (same CF zone)          │
│  /app/linear/*     → linear-ensemble.app (remote)        │
│  /app/stripe/*     → stripe-ensemble.app (remote)        │
│                                                          │
│  Gateway handles: auth, permissions, rate limiting,       │
│  audit logging, theme injection, settings injection       │
│                                                          │
└──────────────────────────────────────────────────────────┘
         │                    │                    │
    Service binding      Service binding      HTTP proxy
    (0ms latency)        (0ms latency)        (normal latency)
         │                    │                    │
         ▼                    ▼                    ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐
│ CRM Worker   │  │ Wiki Worker  │  │ linear-ensemble.app  │
│ (your CF     │  │ (your CF     │  │ (Linear's infra,     │
│  account,    │  │  account,    │  │  could be anywhere)  │
│  same zone)  │  │  same zone)  │  │                      │
│              │  │              │  │ Uses @ensemble-edge/guest      │
│ Uses         │  │ Uses         │  │ SDK for auth +        │
│ @ensemble-edge/guest  │  │ @ensemble-edge/guest  │  │ context               │
│ -cloudflare  │  │ -cloudflare  │  │                      │
└──────────────┘  └──────────────┘  └──────────────────────┘
```

### Two SDKs, Clear Boundary

| Package | Who uses it | Where it runs | Purpose |
|---|---|---|---|
| `@ensemble-edge/sdk` | Core and bundled app code | Inside the workspace Worker | Hooks for code that's part of the workspace engine |
| `@ensemble-edge/guest` | Guest app developers | On their own infrastructure | SDK for building independently deployed guest apps |

`@ensemble-edge/sdk` is internal to the workspace. `@ensemble-edge/guest` is the public contract — the interface that any developer, anywhere, uses to build apps that connect to Ensemble workspaces.

### The `@ensemble-edge/guest` SDK

This is the SDK that guest app developers install. It handles workspace communication, auth token validation, theme consumption, event bus integration, and context parsing.

#### Platform Adapters

The guest SDK has a core package and platform-specific adapters:

| Package | Platform | What it adds |
|---|---|---|
| `@ensemble-edge/guest` | Core (platform-agnostic) | Manifest types, context parsing, auth validation, theme helpers |
| `@ensemble-edge/guest-cloudflare` | Cloudflare Workers | Service binding support, D1 storage adapter, Workers-native request handling |
| `@ensemble-edge/guest-vercel` | Vercel Functions | Edge/serverless function adapter, Vercel KV/Postgres helpers |
| `@ensemble-edge/guest-node` | Node.js / Express / Fastify | Standard Node HTTP adapter, any database |
| `@ensemble-edge/guest-deno` | Deno / Deno Deploy | Deno-native adapter |
| `@ensemble-edge/guest-aws` | AWS Lambda | Lambda handler adapter, DynamoDB helpers |
| `@ensemble-edge/guest-bun` | Bun | Bun-native HTTP adapter |

A guest app developer picks the adapter for their platform:

```typescript
// A guest app on Cloudflare Workers
import { defineGuestApp } from '@ensemble-edge/guest'
import { cloudflareAdapter } from '@ensemble-edge/guest-cloudflare'

export default defineGuestApp({
  adapter: cloudflareAdapter(),
  manifest: { ... },
  handlers: { ... },
})
```

```typescript
// The same guest app on Vercel
import { defineGuestApp } from '@ensemble-edge/guest'
import { vercelAdapter } from '@ensemble-edge/guest-vercel'

export default defineGuestApp({
  adapter: vercelAdapter(),
  manifest: { ... },  // Same manifest
  handlers: { ... },  // Same handlers
})
```

```typescript
// The same guest app on a plain Node server
import { defineGuestApp } from '@ensemble-edge/guest'
import { nodeAdapter } from '@ensemble-edge/guest-node'
import express from 'express'

const app = express()
const guestApp = defineGuestApp({
  adapter: nodeAdapter({ expressApp: app }),
  manifest: { ... },
  handlers: { ... },
})
app.listen(3000)
```

The manifest and handlers are identical across platforms. Only the adapter changes. Build once, deploy anywhere.

#### The Guest App Manifest

Every guest app serves its manifest at a well-known URL:

```
https://my-app.com/.well-known/ensemble-manifest.json
```

```json
{
  "id": "loan-tracker",
  "name": "Loan tracker",
  "version": "1.0.0",
  "description": "Track loan applications and status",
  "author": "Ownly Capital",
  "icon": "file-text",
  "homepage": "https://github.com/ownly/loan-tracker",

  "display": {
    "modes": ["viewport"],
    "default": "viewport"
  },

  "nav": {
    "label": "Loans",
    "icon": "file-text",
    "position": "sidebar",
    "children": [
      { "label": "Applications", "path": "/applications" },
      { "label": "Pipeline", "path": "/pipeline" }
    ]
  },

  "permissions": {
    "required": ["storage:read", "storage:write"],
    "optional": ["ai:invoke", "knowledge:read"]
  },

  "events": {
    "emits": ["loan:application.submitted", "loan:status.changed"],
    "listens": ["people:member.created"]
  },

  "api": {
    "backend": "https://loan-tracker.ownly-workers.dev",
    "routes": [
      { "method": "GET", "path": "/applications", "description": "List applications" },
      { "method": "POST", "path": "/applications", "description": "Create application" },
      { "method": "GET", "path": "/applications/:id", "description": "Get application" }
    ]
  },

  "ui": {
    "type": "url",
    "entry": "https://loan-tracker.ownly-workers.dev/ui"
  },

  "settings": {
    "schema": {
      "defaultReviewer": { "type": "string", "label": "Default reviewer handle" },
      "autoNotify": { "type": "boolean", "label": "Auto-notify on status change", "default": true }
    }
  }
}
```

#### The Guest App Context

When the workspace gateway proxies a request to a guest app, it injects a rich context:

```typescript
interface GuestAppContext {
  // The workspace
  workspace: {
    id: string
    slug: string
    name: string
    endpoint: string
    locale: {
      base_language: string       // 'en' — the workspace's source language
      supported_languages: string[] // ['en', 'es', 'pt']
      timezone: string            // 'America/Chicago'
      date_format: string         // 'us' | 'eu' | 'iso'
      number_format: string       // 'us' | 'eu'
    }
  }

  // The user (null for webhook/system calls)
  user: {
    id: string
    handle: string
    name: string
    role: string
    email: string
    locale: string                // User's preferred language ('es') — falls back to workspace base
  } | null

  // This app's settings for this workspace
  settings: Record<string, any>

  // Scoped storage (workspace's D1, namespaced to this app)
  storage: {
    query: (sql: string, params?: any[]) => Promise<any>
  }

  // Event bus
  events: {
    emit: (event: string, data: any) => Promise<void>
  }

  // Theme tokens
  theme: {
    colors: Record<string, string>
    fonts: Record<string, string>
    radius: string
    density: string
  }

  // Knowledge graph (if permitted)
  knowledge: {
    get: (path: string) => Promise<any>
    search: (query: string) => Promise<any[]>
  } | null

  // Helpers
  json: (data: any) => Response
  error: (status: number, message: string) => Response
}
```

#### Cloudflare Service Bindings (Same-Zone Optimization)

When both the workspace Worker and a guest app Worker are in the same Cloudflare account, the gateway uses service bindings instead of HTTP. This gives effectively zero-latency communication — the Workers talk directly, no network round-trip:

```toml
# In the workspace's wrangler.toml
[services]
loan_tracker = { service = "loan-tracker-worker", environment = "production" }
wiki = { service = "wiki-worker", environment = "production" }
```

```typescript
// In the workspace gateway, when routing to a same-zone guest app
const response = await c.env.loan_tracker.fetch(proxiedRequest)
// vs. for a remote guest app
const response = await fetch('https://remote-app.com/api/...', proxiedRequest)
```

The developer's experience is the same either way — they build with `@ensemble-edge/guest-cloudflare` and deploy to their CF account. The workspace admin configures the service binding in `wrangler.toml`. The gateway detects whether a service binding exists and uses it automatically, falling back to HTTP.

### Guest App Addresses & The Registry

Guest apps have their own address format in the Ensemble Registry:

| Format | Example | Meaning |
|---|---|---|
| `@app-name` | `@loan-tracker` | Community or individual app |
| `@org/app-name` | `@linear/sync` | Organization-scoped app |
| `@ensemble-edge/app-name` | `@ensemble-edge/crm` | Official Ensemble app |
| Manifest URL | `https://my-app.com/.well-known/ensemble-manifest.json` | Self-hosted, unregistered |

Publishing to the registry:

```bash
# Publish your guest app
ensemble app publish

# Register a self-hosted app (no registry, just makes the manifest discoverable)
ensemble app register --url https://my-app.com/.well-known/ensemble-manifest.json
```

Installing in a workspace:

```bash
# From registry
ensemble app install @linear/sync

# From URL
ensemble app install --url https://my-internal-tool.com/.well-known/ensemble-manifest.json

# Via the App Manager UI in the workspace
# Via the API (agent-driven)
POST /_ensemble/apps/install { "registry_id": "@linear/sync" }
```

### Security Model for Guest Apps

| Concern | How it's handled |
|---|---|
| **Auth** | Workspace issues short-lived capability tokens per request. Guest app validates against workspace's public key. Never sees the user's main JWT. |
| **Data isolation** | Each workspace gets its own scoped storage namespace. A guest app serving 100 workspaces has 100 isolated data stores. |
| **Settings encryption** | API keys and secrets are encrypted at rest in D1, decrypted only when injected into proxied requests. |
| **Frontend isolation** | Remote app frontends render in sandboxed iframe. Theme tokens passed via postMessage only. Cannot access parent shell DOM. |
| **Rate limiting** | Gateway rate-limits per user, per app. A misbehaving app can't DoS the workspace. |
| **Audit trail** | Every proxied request logged with actor, app, action, timestamp. |
| **Permissions** | Declared in manifest, approved at install time. Apps cannot escalate. |
| **Revocation** | Uninstall immediately revokes tokens, removes routes, optionally purges scoped storage. |

### The Future: Major Products as Guest Apps

When Ensemble reaches critical mass:

```
Linear builds @linear/sync        →  Issues inside any workspace
Stripe builds @stripe/billing      →  Payment management inside any workspace
Figma builds @figma/design         →  Design review inside any workspace
GitHub builds @github/repos        →  Repo management inside any workspace
Notion builds @notion/docs         →  Docs inside any workspace
Intercom builds @intercom/support  →  Support inside any workspace
```

Each renders inside the workspace shell with the workspace's brand. Each respects permissions. Each is searchable via the command palette. Each flows through the API gateway. Each is audited. The workspace becomes the universal shell for all business software.

### Guest App Categories

All guest apps use the same SDK, same manifest, same gateway proxy, same theming. The architecture is one thing. But the marketplace categorizes them for discoverability via a `category` field in the manifest:

| Category | What it is | Examples |
|---|---|---|
| **Connector** | Thin wrapper around a third-party API. Renders their data inside the workspace. The most reusable type — every company using Stripe can install `@ensemble-edge/stripe`. | Stripe billing, Google Drive browser, Slack bridge, GitHub repos, QuickBooks sync, HubSpot CRM, Intercom support |
| **Tool** | Purpose-built business application. May be company-specific or general-purpose. | CRM, project tracker, invoice generator, loan tracker, recruitment pipeline |
| **Portal** | Customer-facing or partner-facing app. Set to `visibility: public` or `restricted`. | Borrower portal, investor data room, client dashboard, vendor onboarding |
| **Agent** | AI-powered app that acts autonomously. Subscribes to events, executes workflows, reports results. **Same manifest, same SDK, same gateway.** | Deal sourcing agent, compliance checker, content generator, churn predictor, auto-recharge monitor |
| **Utility** | Small single-purpose tools. Calculators, converters, generators. | Timezone converter, invoice calculator, QR generator, URL shortener |

### Guest Agents ARE Guest Apps

This is a foundational architectural insight: **a guest agent is just a guest app with `category: "agent"` that acts autonomously instead of waiting for clicks.** There is no separate agent framework, no separate SDK, no separate gateway, no separate permission model. The manifest declares everything an agent needs — because everything an agent needs is already in the guest app manifest.

| Manifest field | How a tool uses it | How an agent uses it |
|---|---|---|
| `api.routes` | Endpoints the user hits via the viewport | Endpoints the AI panel or other agents call |
| `events.listens` | Reacts when user navigates or data changes | Triggers autonomous behavior (the primary interaction mode) |
| `events.emits` | Notifies on user actions | Reports what the agent did |
| `ai.tools` | AI panel can call the app's APIs | Other agents and the AI panel can invoke the agent |
| `notifications` | Shows results of user actions | Shows results of autonomous actions |
| `activity` | Logs user activity | Logs agent activity (who did what, when, why) |
| `health` | Is the app running? | Is the agent running? |
| `settings` | User-facing configuration | Agent behavior configuration (thresholds, schedules, toggles) |
| `widgets` | Dashboard data cards | Agent activity dashboard (runs, successes, failures, actions taken) |
| `nav` | Sidebar link to the viewport UI | Sidebar link to agent config/monitoring UI (or omitted for headless agents) |

An agent guest app might have a viewport UI for monitoring and configuration — a dashboard showing its recent actions, success rates, and settings toggles. Or it might be **headless** — no `nav` entry, no viewport, just a background service that subscribes to events and acts. Both are valid. Both use the same manifest.

**Example: auto-recharge agent for Nendo**

```json
{
  "id": "nendo-auto-recharge",
  "name": "Auto-recharge monitor",
  "category": "agent",
  "description": "Monitors customer credit balances and triggers auto-recharge when thresholds are hit",

  "events": {
    "listens": ["credits.low", "credits.exhausted", "customer.settings.changed"],
    "emits": ["agent:recharge.triggered", "agent:recharge.failed", "agent:recharge.skipped"]
  },

  "settings": {
    "schema": {
      "enabled": { "type": "boolean", "label": "Agent active", "default": true },
      "check_interval_minutes": { "type": "number", "label": "Check interval", "default": 60 },
      "notify_on_failure": { "type": "boolean", "label": "Notify admin on failure", "default": true }
    }
  },

  "health": {
    "endpoint": "GET /health",
    "interval": 120,
    "display_name": "Auto-recharge agent"
  },

  "widgets": [
    {
      "id": "recharge-activity",
      "name": "Auto-recharge activity",
      "size": "medium",
      "api_route": "GET /widgets/activity"
    }
  ],

  "notifications": [
    {
      "event": "agent:recharge.triggered",
      "display": "Auto-recharged {customer} with {amount} credits",
      "icon": "zap",
      "priority": "normal"
    },
    {
      "event": "agent:recharge.failed",
      "display": "Auto-recharge failed for {customer}: {reason}",
      "icon": "alert-circle",
      "priority": "high"
    }
  ],

  "activity": [
    {
      "event": "agent:recharge.triggered",
      "template": "Auto-recharge agent recharged {customer} with {amount} credits",
      "icon": "zap"
    }
  ],

  "ai": {
    "tools": [
      {
        "name": "check_recharge_status",
        "description": "Check which customers are near their recharge threshold",
        "api_route": "GET /status"
      },
      {
        "name": "trigger_manual_recharge",
        "description": "Manually trigger a recharge for a specific customer",
        "api_route": "POST /recharge/{customer_id}",
        "requires_confirmation": true
      }
    ],
    "context_prompt": "This agent monitors customer credit balances and triggers auto-recharge via Stripe when thresholds are hit."
  }
}
```

This agent has no `nav` entry — it's headless. It shows up in the sidebar only if the workspace admin pins it. Its presence in the workspace is felt through notifications ("Auto-recharged Clay Power Users with 10,000 credits"), activity feed entries, the dashboard widget, and the status dashboard's health check. The AI panel can query it ("which customers are near recharge?") and invoke it ("manually recharge DataDriven").

**The Conductor connection:** For complex multi-step agent workflows (check balance → verify payment method → charge Stripe → add credits → send confirmation → handle failure), the agent's internal logic can be orchestrated using Ensemble Conductor's YAML workflow definitions. Conductor becomes the engine that powers agent behavior under the hood — not a separate product, but the orchestration layer that guest agents use to define their workflows.

The category appears in the manifest:

```json
{
  "id": "stripe-billing",
  "name": "Stripe",
  "category": "connector",
  "connects_to": "stripe.com",
  "...": "..."
}
```

The marketplace at `registry.ensemble.ai` uses this to power browse, filter, and search. "Show me all connectors" or "What tools are available for finance teams."

### Connectors — API Gateway Guest Apps

Connectors deserve special attention because they're the highest-leverage guest apps. A single connector — say `@ensemble-edge/stripe` — can be installed in thousands of workspaces. Building connectors is how you seed the marketplace and make Ensemble immediately useful.

A connector is a guest app that wraps a third-party API and renders its data inside the workspace shell. It typically:

1. Authenticates to the third-party service via OAuth or API key (configured per workspace in the app's settings)
2. Exposes the third-party service's data through the standard guest app API routes
3. Renders a themed UI for browsing, searching, and managing the external data
4. Registers AI panel tools so the assistant can query and act on the external service
5. Emits events to the workspace event bus (e.g., `stripe:payment.received`, `github:pr.merged`)

```
User installs @ensemble-edge/stripe
        │
        ▼
App settings: "Enter your Stripe API key"
        │
        ▼
Now in the workspace:
  - Sidebar shows "Stripe" with sub-items: Payments, Customers, Invoices
  - Viewport renders Stripe data with workspace branding
  - AI panel can "show me recent failed payments"
  - Event bus fires on payment events
  - Command palette: "stripe: search customer John"
```

The beauty is that the workspace owner doesn't build any of this. They install a connector like installing an npm package. The connector developer built it once with `@ensemble-edge/guest`, and it works in every workspace.

**Ensemble-built connectors (first-party):** These are published under the `@ensemble-edge/` org in the registry and maintained by the Ensemble team. They're the reason someone says "wow, I installed Ensemble and all my tools are already here."

Planned first-party connectors:

| Connector | Third-party service |
|---|---|
| `@ensemble-edge/stripe` | Payment management, invoices, customers |
| `@ensemble-edge/google-drive` | File browser, search, sharing |
| `@ensemble-edge/google-calendar` | Calendar view, scheduling |
| `@ensemble-edge/github` | Repos, issues, PRs, code review |
| `@ensemble-edge/slack` | Channel browser, message search, notifications |
| `@ensemble-edge/notion` | Page browser, database views |
| `@ensemble-edge/linear` | Issue tracker, project boards |
| `@ensemble-edge/quickbooks` | Accounting, invoices, reports |
| `@ensemble-edge/hubspot` | CRM contacts, deals, pipelines |
| `@ensemble-edge/intercom` | Support tickets, conversations |

Each one follows the same pattern: `@ensemble-edge/guest` SDK, manifest with `category: "connector"` and `connects_to`, OAuth/API key settings, themed UI, AI panel tools, event bus integration.

### Manifest Extension Points — How Guest Apps Extend the Workspace

Guest apps don't just live in the viewport. They bleed into every shared surface of the workspace. The manifest is the single declaration of how an app participates — the shell reads all installed app manifests at startup and stitches their contributions together. No app knows about any other app. They just declare. The shell composes.

#### The Shared Surfaces

| Surface | What the shell provides | What guest apps contribute |
|---|---|---|
| **Dashboard** | Widget grid with drag-and-drop layout | Widgets: small data cards, charts, lists, quick-action panels |
| **Command palette** (`⌘K`) | Federated search across all apps | Search endpoint + result types |
| **Docs** | Unified docs browser, navigable by section | Documentation pages stitched into the tree |
| **Notifications** | Aggregated notification center | Event types with display templates and priority |
| **Activity feed** | Chronological stream from all apps | Event templates with actor/object rendering |
| **AI panel** | Tool calling, context assembly | Callable API routes, context prompts (covered in §7) |
| **Quick actions** | Bookmark bar and command palette shortcuts | Pinnable actions (navigate, create, trigger) |
| **Status** | Unified health dashboard | Health check endpoint + external dependencies |
| **Settings** | Centralized workspace admin UI | Admin-configurable fields (API keys, toggles, defaults) |

#### Full Manifest Extension Schema

Every field below is optional. A guest app can contribute to all surfaces or none — the simplest app just declares `nav` and `api` and everything else defaults to absent.

```json
{
  "id": "nendo-customers",
  "name": "Customers",
  "version": "1.2.0",
  "category": "tool",

  "nav": { "...": "as documented above" },
  "api": { "...": "as documented above" },
  "permissions": { "...": "as documented above" },
  "settings": { "...": "as documented above" },
  "ui": { "...": "as documented above" },

  "ai": {
    "tools": [
      {
        "name": "list_customers",
        "description": "Search and filter customers",
        "api_route": "GET /customers",
        "parameters": {
          "status": { "type": "string", "enum": ["active", "trial", "exhausted"] },
          "credits_below": { "type": "number" }
        }
      },
      {
        "name": "approve_trial",
        "description": "Approve a pending trial request",
        "api_route": "POST /trials/{id}/approve",
        "requires_confirmation": true
      }
    ],
    "context_prompt": "Manages Nendo API customers. Customers have statuses, credit balances, and usage history."
  },

  "widgets": [
    {
      "id": "credit-balance",
      "name": "Credit balance",
      "description": "Shows total credits in circulation across all keys",
      "size": "small",
      "api_route": "GET /widgets/credit-balance",
      "refresh_interval": 60
    },
    {
      "id": "active-customers",
      "name": "Active customers",
      "description": "List of recently active customers with call counts",
      "size": "medium",
      "api_route": "GET /widgets/active-customers",
      "refresh_interval": 300
    },
    {
      "id": "trial-queue",
      "name": "Trial queue",
      "description": "Pending trial requests awaiting approval",
      "size": "small",
      "api_route": "GET /widgets/trial-queue",
      "refresh_interval": 60,
      "badge": true
    }
  ],

  "search": {
    "endpoint": "GET /search",
    "debounce_ms": 200,
    "result_types": [
      {
        "type": "customer",
        "icon": "user",
        "display": "{name} — {email}",
        "action": "navigate",
        "path": "/customers/{id}"
      },
      {
        "type": "trial_request",
        "icon": "clock",
        "display": "Trial: {company} ({email})",
        "action": "navigate",
        "path": "/trials/{id}"
      }
    ]
  },

  "docs": [
    {
      "title": "Managing API customers",
      "path": "/docs/managing-customers",
      "section": "Operations",
      "order": 1
    },
    {
      "title": "Trial approval workflow",
      "path": "/docs/trial-workflow",
      "section": "Operations",
      "order": 2
    },
    {
      "title": "Credit system and auto-recharge",
      "path": "/docs/credit-system",
      "section": "Billing",
      "order": 1
    }
  ],

  "notifications": [
    {
      "event": "trial_request.submitted",
      "display": "New trial request from {customer}",
      "icon": "user-plus",
      "priority": "normal",
      "action": { "type": "navigate", "path": "/trials/{id}" }
    },
    {
      "event": "credits.exhausted",
      "display": "{customer} has run out of credits",
      "icon": "alert-circle",
      "priority": "high",
      "action": { "type": "navigate", "path": "/customers/{id}" }
    },
    {
      "event": "credits.low",
      "display": "{customer} below {threshold} credits",
      "icon": "alert-triangle",
      "priority": "normal"
    }
  ],

  "activity": [
    {
      "event": "customer.created",
      "template": "{actor} added new customer {customer}",
      "icon": "user-plus"
    },
    {
      "event": "trial.approved",
      "template": "{actor} approved trial for {customer}",
      "icon": "check-circle"
    },
    {
      "event": "credits.purchased",
      "template": "{customer} purchased {amount} credits",
      "icon": "credit-card"
    },
    {
      "event": "key.revoked",
      "template": "{actor} revoked API key for {customer}",
      "icon": "x-circle"
    }
  ],

  "quick_actions": [
    {
      "id": "new-customer",
      "label": "New customer",
      "icon": "user-plus",
      "action": "navigate",
      "path": "/customers/new",
      "pinnable": true
    },
    {
      "id": "approve-trials",
      "label": "Review trials",
      "icon": "check-square",
      "action": "navigate",
      "path": "/trials",
      "pinnable": true,
      "badge_source": "trial_request.submitted"
    }
  ],

  "health": {
    "endpoint": "GET /health",
    "interval": 60,
    "timeout": 5000,
    "display_name": "Customer manager",
    "dependencies": [
      {
        "name": "iq.ensemble.ai",
        "endpoint": "https://iq.ensemble.ai/health",
        "type": "external"
      },
      {
        "name": "Unkey API",
        "endpoint": "https://api.unkey.dev/v1/liveness",
        "type": "external"
      },
      {
        "name": "Stripe API",
        "endpoint": "https://api.stripe.com/healthcheck",
        "type": "external"
      }
    ]
  },

  "settings": {
    "admin": [
      {
        "group": "API connection",
        "order": 1,
        "fields": [
          {
            "key": "iq_tenant_key",
            "type": "secret",
            "label": "Ensemble tenant key",
            "description": "ens_master_ key for iq.ensemble.ai. Stored encrypted.",
            "required": true
          },
          {
            "key": "unkey_root_key",
            "type": "secret",
            "label": "Unkey root key",
            "required": true
          }
        ]
      },
      {
        "group": "Notifications",
        "order": 2,
        "fields": [
          {
            "key": "low_credit_threshold",
            "type": "number",
            "label": "Low credit alert threshold",
            "description": "Percentage at which low-credit emails fire",
            "default": 25
          },
          {
            "key": "send_admin_alerts",
            "type": "toggle",
            "label": "Send admin alerts",
            "description": "Email admin on new signups, exhausted credits, churn risk",
            "default": true
          },
          {
            "key": "admin_email",
            "type": "text",
            "label": "Admin notification email",
            "default": ""
          }
        ]
      }
    ],
    "internal": {
      "schema": {
        "defaultReviewer": { "type": "string", "label": "Default trial reviewer handle" },
        "autoNotify": { "type": "boolean", "label": "Auto-notify on status change", "default": true }
      }
    }
  }
}
```

#### How the Shell Stitches It Together

At workspace startup, the shell loads all installed guest app manifests (cached in KV). Each shared surface reads the relevant section from every manifest and composes a unified view:

**Dashboard:**

```
Shell loads: all manifests with "widgets" field
User opens dashboard → sees widget catalog
Available widgets: 3 from @nendo/customers + 2 from @nendo/usage + 1 from @ensemble-edge/stripe
User drags "Credit balance" into their grid
Widget calls: GET /_ensemble/customers/widgets/credit-balance (through gateway)
Data renders in the widget card, refreshes every 60 seconds
```

Widget sizes: `small` (1 grid unit, stat card or single metric), `medium` (2 units, list or mini-chart), `large` (3-4 units, full chart or table). The dashboard is a CSS grid. Users drag and arrange widgets per their preference. Layout is stored per user in D1.

Widgets can declare `badge: true` — the widget shows a badge count from its data (e.g., "2 pending trials"). This badge also appears on the dashboard's sidebar nav item.

**Command palette (`⌘K`):**

```
User hits ⌘K, types "acme"
Shell sends "acme" to every installed app's search endpoint in parallel:
  GET /_ensemble/customers/search?q=acme    → [{ type: "customer", name: "Acme Corp", ... }]
  GET /_ensemble/usage/search?q=acme        → [{ type: "usage_report", name: "Acme Corp March", ... }]
  GET /_ensemble/stripe/search?q=acme       → [{ type: "stripe_customer", name: "Acme Corp", ... }]
Shell merges, deduplicates, and ranks results
Each result renders with its app icon + display template
User selects → navigates to the result's path in the contributing app
```

The command palette also shows quick actions from all apps (filtered by the search query). Typing "new" shows "New customer" from the CRM, "New deal" from the pipeline, "New file" from the file manager.

Search is debounced per the app's `debounce_ms` setting. Slow endpoints don't block fast ones — results stream in as they arrive.

**Docs:**

```
Shell loads: all manifests with "docs" field
Builds a unified doc tree:

  Operations
  ├── Managing API customers         (from @nendo/customers)
  ├── Trial approval workflow         (from @nendo/customers)
  └── Usage monitoring               (from @nendo/usage)

  Billing
  ├── Credit system and auto-recharge (from @nendo/customers)
  └── Stripe integration guide        (from @ensemble-edge/stripe)

  Platform
  ├── Getting started with Ensemble   (from core:admin)
  └── Brand guidelines               (from core:brand)
```

Each doc page is served by the contributing guest app (via the gateway). The docs browser just provides the navigation tree and renders the content in its viewport. Core apps also contribute docs — the admin app provides onboarding guides, the brand app provides theming documentation.

The docs browser IS the built-in docs bundled app discussed earlier. Guest app docs get stitched into it automatically. The workspace admin can reorder sections, add custom docs pages, or hide specific contributions.

This means a workspace's documentation is always complete and always current — when you install `@ensemble-edge/stripe`, its docs pages appear in the docs browser immediately. Uninstall it, they disappear.

**Notifications:**

```
Guest app emits: { event: "trial_request.submitted", data: { customer: "RevenueOS", id: "trial_123" } }
Shell matches: event → @nendo/customers manifest → notifications[0]
Renders: "New trial request from RevenueOS" with user-plus icon
User clicks → navigates to /app/customers/trials/trial_123
```

The notification center aggregates events from all apps. Users configure preferences per event type (email me for "credits.exhausted" but just show in-app for "trial_request.submitted"). Priority levels determine badge urgency — `high` events bump the notification count and may trigger push notifications in the native app.

**Activity feed:**

```
Shell loads recent events from all apps (via gateway):
  GET /_ensemble/events?since=2026-03-25&limit=50

Returns merged, chronological stream:
  10:30 — @hawkins approved trial for RevenueOS         (from @nendo/customers)
  10:28 — RevenueOS purchased 1,000 credits              (from @nendo/customers)
  10:15 — Stripe payment received: $45.00 from Acme Corp (from @ensemble-edge/stripe)
  09:45 — @hawkins updated brand colors                   (from core:brand)

Each entry rendered with its app icon + template + actor avatar
```

The activity feed is the workspace's "what happened" timeline. It subscribes to events from all installed apps via the event bus. Each app's manifest defines which events should appear in the feed and how to display them.

**Quick actions:**

Quick actions appear in two places — the command palette (always) and the bookmark bar (if the user pins them).

```
⌘K → shows all quick actions from all apps:
  [+] New customer         (@nendo/customers)
  [✓] Review trials        (@nendo/customers)  [2]
  [+] New deal             (@pipeline/deals)
  [📄] Upload file         (bundled:files)

Bookmark bar → user pins their favorites:
  [New customer] [Review trials ②] [Stripe dashboard ↗]
```

Quick actions with `badge_source` show a live badge count from the corresponding notification event. "Review trials" shows [2] because there are 2 pending trial_request.submitted events.

**Settings:**

Guest apps declare admin-configurable settings in their manifest. The workspace admin UI (`core:admin`) stitches them into a centralized settings area — no need to open each app individually.

```
Settings (core:admin viewport)
├── General                         (workspace-level: name, slug, domain)
├── Locale & region                 (workspace-level: language, timezone)
├── Appearance                      (workspace-level: delegates to Brand)
│
├── Customer manager                (from @nendo/customers manifest)
│   ├── API connection
│   │   ├── Ensemble tenant key: ●●●●●●●●
│   │   └── Unkey root key: ●●●●●●●●
│   └── Notifications
│       ├── Low credit alert threshold: 25%
│       ├── Send admin alerts: ON
│       └── Admin notification email: matt@hoss.com
│
├── Stripe                          (from @ensemble-edge/stripe manifest)
│   ├── API connection
│   │   ├── Stripe API key: ●●●●●●●●
│   │   └── Webhook signing secret: ●●●●●●●●
│   └── Defaults
│       ├── Default currency: USD
│       └── Auto-sync transactions: ON
│
├── Auto-recharge agent             (from @nendo/auto-recharge manifest)
│   └── Behavior
│       ├── Agent active: ON
│       ├── Check interval: 60 min
│       └── Notify admin on failure: ON
│
├── Integrations                    (workspace-level: webhooks, API keys)
└── Danger zone                     (workspace-level: transfer, archive, delete)
```

Three levels of settings, clear separation:

| Level | Where configured | Who owns it | Examples |
|---|---|---|---|
| **Workspace** | `core:admin` built-in sections | The workspace | Name, slug, language, timezone, appearance, integrations |
| **App-admin** | `core:admin` app sections (from manifest `settings.admin`) | The app, configured centrally | API keys, behavior toggles, thresholds, defaults |
| **App-internal** | Inside the app's own UI (from manifest `settings.internal`) | The app, managed locally | User preferences, per-record config, view settings |

The admin UI renders each app's `settings.admin` groups as collapsible sections. Groups have an `order` field for sorting within the app's section. Apps are sorted alphabetically or by install order.

**Field types:**

| Type | Editor | Use case |
|---|---|---|
| `text` | Single-line text input | Email addresses, names, identifiers |
| `secret` | Masked input, stored encrypted in D1 | API keys, tokens, signing secrets |
| `number` | Number input with optional min/max | Thresholds, intervals, limits |
| `toggle` | On/off switch | Feature flags, enable/disable |
| `select` | Dropdown | Currency, region, mode |
| `multi_select` | Multi-select chips | Tags, categories, roles |
| `url` | URL input with validation | Webhook endpoints, external service URLs |
| `color` | Color picker | App-specific brand colors |
| `textarea` | Multi-line text | Descriptions, templates, custom messages |

**How it works technically:**

1. Shell loads all installed app manifests at startup
2. `core:admin` reads `settings.admin` from each manifest
3. Admin opens Settings → sees workspace sections + one section per app
4. Admin fills in fields → values stored per-workspace, per-app in D1
5. When the gateway proxies a request to the guest app, it injects `context.settings` — a merged object of both admin and internal settings
6. `secret` type fields are encrypted at rest in D1, decrypted only when injected into the context
7. Fields with `required: true` must be filled before the app can be activated
8. Changes trigger `app:settings.updated` event on the event bus
9. Audit log records who changed which setting, when

**Activation gating:** If a guest app has required admin settings that haven't been configured yet, the app shows as "Needs configuration" in the sidebar instead of being active. Clicking it navigates to the admin settings section for that app. This prevents apps from failing at runtime because an API key was never entered.

#### The Principle

The manifest is the contract between a guest app and the workspace shell. The app declares what it can contribute. The shell decides how to compose those contributions into a coherent experience. No app reaches into another app's territory. The shell is the compositor.

This is why Ensemble isn't just "a shell for apps" — it's a workspace where every app makes every other app's experience richer, without any of them knowing about each other.

---

## 9. The Workspace Model

### Workspace = Tenant

A **workspace** is the fundamental organizational unit. It has:

- A unique slug (e.g., `acme`, `ownly`, `higher-order`)
- A tilde address (`~acme`, `~ownly`) — the human-friendly workspace identifier
- Brand configuration (managed by the Brand Manager core app)
- A set of enabled core/bundled apps + installed guest apps
- A set of members with roles (managed by People & Teams core app)
- Permission policies (managed by Auth & Security core app)
- A Company Knowledge Graph (managed by Knowledge Editor core app)
- Optional custom domain (e.g., `hub.acme.com`)
- Agent access configuration (managed by People & Teams core app)

### Workspace Types

| Type | Description | Default Apps | Example |
|---|---|---|---|
| **Organization** | A company's primary workspace | All core + most bundled | Ownly Group's internal hub |
| **Project** | A scoped workspace for a specific initiative | Core + dashboard + files | Santo Domingo development data room |
| **Client Portal** | Customer-facing workspace with restricted apps | Core (admin-only) + select guest apps | Borrower tracking portal |
| **Community** | Public or semi-public workspace | Core + bundled + public guest apps | OSS project hub |

### Workspace Templates

When creating a new workspace, the admin chooses a template that pre-configures which bundled apps are enabled:

```typescript
const WORKSPACE_TEMPLATES = {
  'organization': {
    type: 'organization',
    bundledApps: {
      'bundled:dashboard': true,
      'bundled:ai-assistant': true,
      'bundled:files': true,
      'bundled:notifications': true,
      'bundled:activity': true,
    },
    defaultRole: 'member',
  },
  'data-room': {
    type: 'project',
    bundledApps: {
      'bundled:dashboard': false,
      'bundled:ai-assistant': false,
      'bundled:files': true,        // the main feature
      'bundled:notifications': true,
      'bundled:activity': true,
    },
    defaultRole: 'viewer',
  },
  'client-portal': {
    type: 'portal',
    bundledApps: {
      'bundled:dashboard': true,
      'bundled:ai-assistant': false,
      'bundled:files': false,
      'bundled:notifications': true,
      'bundled:activity': false,
    },
    defaultRole: 'guest',
  },
}
```

### Workspace Resolution

Every request hits the Worker. The workspace is resolved via:

1. **Tilde address** → `~acme` → resolved via Ensemble Directory or local cache → workspace `acme`
2. **Custom domain** → `hub.acme.com` → workspace `acme`
3. **Subdomain** → `acme.ensemble.ai` → workspace `acme`
4. **Path prefix** → `app.ensemble.ai/w/acme` → workspace `acme`

```typescript
import { createMiddleware } from 'hono/factory'

export const workspaceResolver = createMiddleware(async (c, next) => {
  const host = c.req.header('host') ?? ''
  const path = c.req.path

  let slug: string | null = null

  // 1. Custom domain lookup (cached in KV)
  slug = await resolveCustomDomain(host, c.env)

  // 2. Subdomain
  if (!slug) {
    const sub = host.split('.')[0]
    if (sub !== 'app' && sub !== 'www' && sub !== 'api') slug = sub
  }

  // 3. Path prefix
  if (!slug) {
    const match = path.match(/^\/w\/([a-z0-9-]+)/)
    if (match) slug = match[1]
  }

  if (!slug) return c.redirect('/select-workspace')

  const workspace = await getWorkspace(slug, c.env)
  if (!workspace) return c.notFound()

  c.set('workspace', workspace)
  await next()
})
```

---

## 10. The Workspace Address System

### The Problem with URLs

URLs are the addressing system of the web, but they're ugly, forgettable, and feel like plumbing:

```
https://ownly.ensemble.ai
https://app.ensemble.ai/w/ownly
https://hub.ownly.com
```

Nobody wants to tell a colleague "go to h-t-t-p-s colon slash slash ownly dot ensemble dot ai." That's not the future. That's not fun. That's not a product people love.

### The Tilde (`~`) Address

Ensemble workspaces use the **tilde** (`~`) as their address sigil. It's inspired by the Unix home directory (`~` = home), but repurposed for a new era:

```
~ownly
~circuit
~ho-capital
~ownly-portal
```

The tilde means "this is an Ensemble workspace." It's:

- **Short** — 1 character prefix + the workspace slug
- **Speakable** — "join me on tilde ownly" / "connect to tilde circuit"
- **Typeable** — In the Ensemble app, you just type `~ownly` in the connect field
- **Distinctive** — No other product uses tilde as an address sigil
- **Memorable** — People remember words, not URLs
- **Universal** — Works for self-hosted and cloud instances

### How Tilde Addresses Resolve

```
User types: ~ownly
             │
             ▼
┌─ Resolution Order ──────────────────────────────────────┐
│                                                          │
│  1. LOCAL CACHE                                          │
│     The app checks: have I connected to ~ownly before?   │
│     If yes → stored endpoint URL is used directly        │
│     (e.g., https://ownly.ensemble.ai or https://hub.ownly.com)│
│                                                          │
│  2. ENSEMBLE DIRECTORY (cloud)                           │
│     If not cached, query ensemble.ai's directory:        │
│     GET https://dir.ensemble.ai/resolve/~ownly           │
│     → { "endpoint": "https://ownly.ensemble.ai",            │
│         "name": "Ownly Group",                           │
│         "logo": "https://...",                            │
│         "type": "organization" }                         │
│                                                          │
│  3. SELF-HOSTED FALLBACK                                 │
│     If not in the cloud directory, the user can manually │
│     enter the full URL as a fallback                     │
│     (for air-gapped / private deployments)               │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### The Ensemble Directory

The directory at `dir.ensemble.ai` is a lightweight registry that maps tilde addresses to workspace endpoints. It's not a hosting platform — it's a DNS-like lookup service.

**Registration:**

When you deploy an AIUX workspace (self-hosted or cloud), you can optionally register your tilde address with the Ensemble Directory:

```bash
# Via CLI
ensemble register ~ownly --endpoint https://ownly.ensemble.ai

# Or via the Workspace Admin core app (Settings → Ensemble Directory)
```

Registration works like publishing an npm package:
- A valid workspace endpoint that responds to the AIUX discovery protocol
- Verification of ownership (DNS TXT record or endpoint verification)
- The tilde slug must be unique in the directory
- Once registered, the workspace is discoverable by anyone with the Ensemble app
- Workspaces can always fall back to direct URL access
- Direct URL access can be toggled on or off per workspace (default: on)

**For Cloud workspaces:** Registration is automatic. You create a workspace on ensemble.ai, you get `~your-slug` immediately.

**For self-hosted workspaces:** Registration is optional but recommended. You can use tilde addresses within your own app (locally cached after first connection) without registering in the directory. Direct URL access (`https://hub.ownly.com`) is always available as a fallback, and workspace admins can toggle whether the direct URL is publicly accessible or restricted to the tilde address / invite flow only.

### Address Variations

| Format | Context | Example |
|---|---|---|
| **`~slug`** | The primary address. Used in the app. | `~ownly` |
| **`~slug/app/path`** | Deep link to a specific app and page | `~ownly/app/crm/contacts/123` |
| **`ensemble://~slug`** | Protocol handler for deep links from web/other apps | `ensemble://~ownly/app/dashboard` |
| **`slug.ensemble.ai`** | Web URL (for Cloud workspaces) | `ownly.ensemble.ai` |
| **`custom.domain`** | Custom domain (any workspace) | `hub.ownly.com` |
| **QR Code** | Encodes `ensemble://~slug` | Scan to connect |
| **Invite Code** | Short code for one-time join | `~ownly/join/ABC123` |

### How It Feels in Practice

**Scenario 1: H.O. adds a new workspace**

```
1. Opens Ensemble macOS app
2. Clicks [+] in workspace switcher
3. Types: ~circuit
4. App resolves → Circuit Holdings workspace appears
5. H.O. is already a member (via @maycotte identity)
6. Circuit Holdings appears in the workspace switcher
7. Done. 2 seconds.
```

**Scenario 2: Tucker invites a board member**

```
1. Tucker opens People & Teams → Invite
2. Enters email: boardmember@acme.com
3. Board member receives email:
   "You've been invited to Circuit Holdings on Ensemble"
   [Connect to ~circuit]
4. Board member downloads Ensemble app
5. Opens app, types: ~circuit
6. Creates account (or signs in if they have @handle)
7. Sees only the data room app
```

**Scenario 3: A borrower checks loan status**

```
1. Borrower receives email from Ownly Capital:
   "Track your loan application on Ensemble"
   [Open ~ownly-portal]
2. Clicks link → opens Ensemble app (or web if no app)
3. Signs in via magic link
4. Sees: Loan Tracker app + Document Upload
5. Clean, branded, minimal
```

**Scenario 4: Sharing a workspace verbally**

```
H.O. on a phone call: "Hey, our deal room is on Ensemble.
  The address is tilde ownly-portal. Just download the app
  and type it in."
```

Compare that to: "Go to h-t-t-p-s colon slash slash ownly-portal dot ensemble dot ai." Night and day.

### Tilde Slug Rules

- 3-32 characters
- Lowercase alphanumeric + hyphens
- Must start with a letter
- No consecutive hyphens
- Must be unique in the Ensemble Directory (for registered workspaces)
- Reserved slugs: `admin`, `api`, `app`, `auth`, `cloud`, `dir`, `docs`, `help`, `www`, `ensemble`, etc.

### QR Codes

Every workspace has an auto-generated QR code (displayed in Workspace Admin → Settings):

```
┌──────────────────┐
│  ▄▄▄▄▄ ▄ ▄▄▄▄▄  │
│  █   █ █ █   █  │
│  ▀▀▀▀▀ █ ▀▀▀▀▀  │
│  ▄▄▄ █▄█▄█ ▄▄▄  │
│  ▀▀▀▀▀ █ ▀▀▀▀▀  │
│                  │
│   ~ownly         │
│   Ownly Group    │
└──────────────────┘
```

The QR encodes `ensemble://~ownly`. When scanned:
- If Ensemble app is installed → opens the app, prompts to connect
- If not installed → opens `ensemble.ai/connect/~ownly` in the browser (with app store links)

---

## 11. The Identity & Authentication Model

This is the hardest design problem in AIUX. The requirements pull in opposite directions:

- **Simplicity:** A user should be able to sign in and start working in seconds
- **Cross-workspace identity:** `@maycotte` should work across 10 different workspaces
- **Enterprise SSO:** A company using Google Workspace / Okta / Azure AD shouldn't have to manage a second identity system
- **Developer simplicity:** A workspace admin shouldn't need a PhD in SAML to set this up
- **Guest access:** A borrower checking their loan status shouldn't need to understand any of this

The solution: **a layered identity model where federation creates identity rather than replacing it.**

### The Three Layers

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1: AIUX IDENTITY                                        │
│  ─────────────────────                                          │
│  The universal, portable layer. One per human.                  │
│                                                                 │
│  @maycotte                                                      │
│  id: usr_abc123                                                 │
│  handle: maycotte                                               │
│  email: ho@ownly.com (primary)                                  │
│  name: H.O. Maycotte                                            │
│  avatar: [uploaded image]                                       │
│  mfa: enabled (TOTP)                                            │
│  created: 2026-03-25                                            │
│                                                                 │
│  This is like a GitHub account. It exists independent of any    │
│  workspace. It persists even if every workspace kicks you out.  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 2: AUTH METHODS                                          │
│  ────────────────────                                           │
│  How the identity proves itself. Multiple methods can be        │
│  linked to a single identity.                                   │
│                                                                 │
│  ┌─ Password ──────────────────────────────────────────────┐    │
│  │ hash: argon2id$...                                      │    │
│  │ set: 2026-03-25                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─ Google OAuth ──────────────────────────────────────────┐    │
│  │ provider_id: google                                     │    │
│  │ provider_user_id: 1029384756                            │    │
│  │ email: ho@ownly.com                                     │    │
│  │ linked: 2026-03-25                                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─ Google Workspace SSO (via Ownly's IdP) ────────────────┐   │
│  │ provider_id: saml_ws_ownly                              │   │
│  │ provider_user_id: ho@ownly.com                          │   │
│  │ linked: 2026-03-26 (auto-linked on first SSO login)     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─ Passkey ───────────────────────────────────────────────┐   │
│  │ credential_id: cred_xxx                                  │   │
│  │ device: "MacBook Pro Touch ID"                          │   │
│  │ registered: 2026-04-01                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  An identity can have many auth methods. Any method can         │
│  prove the identity. New methods can be linked over time.       │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 3: WORKSPACE MEMBERSHIPS                                 │
│  ──────────────────────────────                                 │
│  What the identity can access. Scoped per workspace.            │
│                                                                 │
│  ┌─ Ownly Group (ws_ownly) ─────────────────────────────────┐  │
│  │ role: superadmin                                          │  │
│  │ apps: [ALL]                                               │  │
│  │ display_name: H.O.                                        │  │
│  │ joined_via: direct (created the workspace)                │  │
│  │ sso_required: false (admin override)                      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ Circuit Holdings (ws_circuit) ───────────────────────────┐  │
│  │ role: viewer                                              │  │
│  │ apps: [bundled:files]                                     │  │
│  │ display_name: Higinio Oliver Maycotte                     │  │
│  │ joined_via: invite (link from Tucker)                     │  │
│  │ sso_required: false                                       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ Ownly Capital Portal (ws_ownly_portal) ──────────────────┐ │
│  │ role: admin                                               │ │
│  │ apps: [ALL]                                               │ │
│  │ display_name: H.O.                                        │ │
│  │ joined_via: workspace_creation                            │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Handles

Every AIUX identity has a globally unique handle (within the deployment):

- Format: `@lowercase-alphanumeric` (3-32 chars, hyphens allowed)
- Set during account creation (suggested from name or email)
- Changeable (with cooldown to prevent squatting abuse)
- Used for: mentions (`@maycotte`), invite targets, profile URLs, API references

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,              -- usr_xxxxxxxxxxxx
  handle TEXT UNIQUE NOT NULL,      -- 'maycotte' (stored without @)
  email TEXT UNIQUE NOT NULL,       -- primary email
  email_verified INTEGER DEFAULT 0,
  name TEXT NOT NULL,
  avatar_key TEXT,
  mfa_secret TEXT,
  mfa_enabled INTEGER DEFAULT 0,
  handle_changed_at TEXT,           -- rate-limit handle changes
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Auth methods (replaces the old password_hash column + user_oauth table)
CREATE TABLE auth_methods (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,               -- 'password', 'oauth', 'saml', 'passkey'
  provider TEXT,                    -- 'google', 'github', 'microsoft', 'saml_ws_ownly'
  provider_user_id TEXT,            -- external ID from provider
  credential TEXT,                  -- password hash, or passkey credential, etc.
  email TEXT,                       -- email associated with this method
  metadata TEXT,                    -- JSON: tokens, device info, etc.
  last_used_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(type, provider, provider_user_id)
);

-- Workspace SSO configuration
CREATE TABLE workspace_sso (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  protocol TEXT NOT NULL,           -- 'saml', 'oidc'
  provider_name TEXT,               -- 'Google Workspace', 'Okta', 'Azure AD'
  -- SAML fields
  idp_entity_id TEXT,
  idp_sso_url TEXT,
  idp_certificate TEXT,
  -- OIDC fields
  oidc_issuer TEXT,
  oidc_client_id TEXT,
  oidc_client_secret_enc TEXT,
  -- Shared config
  email_domain TEXT,                -- 'ownly.com' — auto-match users from this domain
  auto_create_membership INTEGER DEFAULT 1,  -- auto-add users who SSO in
  default_role TEXT DEFAULT 'member',
  enforce_sso INTEGER DEFAULT 0,    -- require SSO for this workspace
  group_mapping TEXT,               -- JSON: map IdP groups to AIUX roles
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now'))
);
```

### The Eight Auth Flows

Here's every way a person ends up authenticated in an AIUX workspace:

#### Flow 1: Direct Signup (Self-Service)

The simplest path. User creates an AIUX identity from scratch.

```
1. User visits ensemble.ai/signup (or workspace login page)
2. Enters: name, email, password, chooses handle
3. Email verification sent
4. Identity created: usr_xxx, @chosen-handle
5. Auth method created: type=password
6. If they arrived via invite link → membership auto-created
7. If not → they land on "select workspace" (empty until invited somewhere)
```

#### Flow 2: OAuth Signup (Google/GitHub/Microsoft)

User signs up using an existing social/work account.

```
1. User clicks "Continue with Google"
2. OAuth flow completes → we receive: email, name, Google ID
3. Check: does an AIUX identity exist for this email?
   - No → create identity, suggest handle from name
   - Yes → link this OAuth method to existing identity
4. Auth method created: type=oauth, provider=google
5. User logged in
```

#### Flow 3: Invite Link (No Account Yet)

Someone invites `jane@acme.com` to the Acme workspace. Jane has never used AIUX.

```
1. Admin creates invite for jane@acme.com (role: member, apps: [ALL])
2. Jane receives email with invite link
3. Jane clicks link → lands on signup page (pre-filled email)
4. Jane creates identity (password or OAuth) + chooses handle
5. Membership auto-created based on invite params
6. Jane lands in the Acme workspace, ready to work
```

#### Flow 4: Invite Link (Existing Account)

H.O. (`@maycotte`, already has AIUX identity) is invited to the Circuit Holdings workspace.

```
1. Tucker creates invite for ho@ownly.com to Circuit Holdings
2. H.O. receives email → clicks link
3. AIUX recognizes the email → "Sign in to accept this invite"
4. H.O. signs in (any method: password, Google, passkey)
5. Membership created: Circuit Holdings, role: viewer, apps: [bundled:files]
6. Circuit Holdings appears in H.O.'s workspace switcher
```

#### Flow 5: Enterprise SSO — First Login (No AIUX Account)

Acme Corp has Google Workspace. They configure SSO in AIUX. Employee Bob has never used AIUX.

```
1. Acme admin configures SSO:
   - Protocol: OIDC (Google Workspace)
   - Email domain: acme.com
   - Auto-create membership: yes
   - Default role: member
   - Enforce SSO: yes (only SSO login allowed for this workspace)

2. Bob visits acme.ensemble.ai
3. Sees "Sign in with Acme Google Workspace" (branded by Brand Manager)
4. Clicks → Google OAuth flow → returns with bob@acme.com
5. AIUX checks: no identity for bob@acme.com
6. Auto-creates AIUX identity:
   - email: bob@acme.com
   - name: Bob Smith (from Google profile)
   - handle: @bob-smith (auto-suggested, Bob can change later)
7. Auth method created: type=saml, provider=saml_ws_acme
8. Membership auto-created: Acme workspace, role: member
9. Bob is in. He never typed a password. He might not even know AIUX is a separate thing.
```

**The key insight:** Bob now has an AIUX identity (`@bob-smith`). If he's later invited to a different workspace (say, a client portal), his identity already exists. He just gets a new membership. His Acme SSO auth method can log him into any workspace where he has membership (unless that workspace also enforces its own SSO).

#### Flow 6: Enterprise SSO — Returning Login (Has AIUX Account)

H.O. already has `@maycotte`. Ownly Group configures Google Workspace SSO.

```
1. Ownly admin configures SSO for ownly.com domain
2. H.O. visits ownly.ensemble.ai
3. Sees "Sign in with Ownly Google Workspace" + regular login options
4. H.O. clicks SSO → Google flow → returns with ho@ownly.com
5. AIUX checks: identity exists for ho@ownly.com → usr_abc123
6. Links SSO auth method to existing identity (if not already linked)
7. Logs in as @maycotte, lands in Ownly workspace
```

H.O. can still use password or other methods for workspaces that don't enforce SSO.

#### Flow 7: Domain Auto-Join

A workspace can be configured so anyone with a matching email domain is auto-invited.

```
1. Acme admin enables: "Auto-join for @acme.com emails"
2. New Acme employee Carol visits acme.ensemble.ai
3. Signs up or uses SSO → identity created with carol@acme.com
4. Domain match detected → membership auto-created (role: member)
5. Carol is immediately in the workspace
```

#### Flow 8: Magic Link / Passwordless

For low-friction guest access (e.g., borrower portals):

```
1. Ownly Capital Portal sends magic link to borrower@gmail.com
2. Borrower clicks link → email verified → logged in
3. If no identity: auto-created with suggested handle
4. Auth method: type=magic-link (upgradeable to password or OAuth later)
5. Borrower lands in portal, sees only their permitted apps
```

### SSO Configuration — The Admin Experience

The Auth & Security core app provides a guided SSO setup:

```
┌── SSO Configuration ────────────────────────────────────────┐
│                                                              │
│  Provider: [Google Workspace ▾]                              │
│                                                              │
│  ┌─ Step 1: Connect ──────────────────────────────────────┐  │
│  │ Client ID:     [_________________________]             │  │
│  │ Client Secret: [_________________________]             │  │
│  │ Domain:        [ownly.com________________]             │  │
│  │                                                        │  │
│  │ AIUX Callback URL (copy to Google Admin):              │  │
│  │ https://ownly.ensemble.ai/auth/sso/callback               │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ Step 2: Behavior ─────────────────────────────────────┐  │
│  │ ☑ Auto-create membership for new SSO users             │  │
│  │   Default role: [Member ▾]                             │  │
│  │   Default apps: [All enabled apps ▾]                   │  │
│  │                                                        │  │
│  │ ☐ Enforce SSO (block password login for this workspace)│  │
│  │                                                        │  │
│  │ ☑ Sync display name from IdP                          │  │
│  │ ☐ Sync avatar from IdP                                │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ Step 3: Group Mapping (optional) ─────────────────────┐  │
│  │ IdP Group          →  AIUX Role                        │  │
│  │ ──────────────────────────────────                     │  │
│  │ Engineering        →  member (+ engineering group)     │  │
│  │ Leadership         →  admin                            │  │
│  │ Contractors        →  viewer                           │  │
│  │ [+ Add mapping]                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  [Test Connection]  [Save & Activate]                        │
└──────────────────────────────────────────────────────────────┘
```

### The Resolution Algorithm

When a request comes in, the auth middleware resolves identity through this flow:

```
Request arrives
    │
    ▼
┌─ Has JWT cookie? ─┐
│                   │
│ YES               │ NO
│                   │
▼                   ▼
Validate JWT     ┌─ Workspace enforces SSO? ─┐
│                │                           │
│ Valid          │ YES                       │ NO
│                │                           │
▼                ▼                           ▼
Resolve user     Redirect to SSO            Show login page
Load memberships provider login              (password + OAuth
Check workspace                              + SSO if configured)
membership                                       │
│                                               │
▼                                               ▼
Inject into      ──── Auth completes ────────►  Resolve identity
Hono context                                    │
│                                               │
▼                                   ┌──────────┤
Proceed to                          │          │
route handler                 Existing    New identity
                              identity     │
                                  │        Create identity
                                  │        Create auth method
                                  │        Check pending invites
                                  │        Check domain auto-join
                                  │        │
                                  ▼        ▼
                              Create JWT session
                              Set cookie
                              Redirect to workspace
```

### Cross-Instance Identity (Future: AIUX Cloud)

In the self-hosted world, handles are unique within a single AIUX deployment (one Worker). A company deploying their own AIUX has their own handle namespace.

When AIUX Cloud launches, we introduce **federated identity**:

- Cloud-hosted instances share a global handle registry
- `@maycotte` is globally unique across all Cloud workspaces
- Self-hosted instances can optionally join the federation
- Identity portability: `@maycotte@cloud.ensemble.ai` (ActivityPub-style, if needed)

But this is a future concern. For v1, handles are deployment-scoped, which is fine because a typical deployment serves one company (with multiple workspaces).

### Permission Hierarchy — Complete

```
AIUX Identity (@maycotte)
    │
    ├─ Global capabilities
    │   ├─ Create new workspaces
    │   ├─ Accept invitations
    │   └─ Manage personal profile + auth methods
    │
    ├─ Workspace Membership (Ownly Group)
    │   ├─ Role: superadmin
    │   │   ├─ All admin permissions
    │   │   ├─ Can delete workspace
    │   │   ├─ Can transfer ownership
    │   │   └─ Can configure SSO
    │   │
    │   ├─ App Access: [ALL]
    │   │   ├─ Core apps: all visible
    │   │   ├─ Bundled apps: all enabled visible
    │   │   └─ Guest apps: all installed visible
    │   │
    │   ├─ Group: "Leadership"
    │   │   └─ Inherits: leadership-specific nav section, bonus bookmarks
    │   │
    │   └─ Workspace-specific profile
    │       ├─ display_name: "H.O."
    │       ├─ title: "Managing Partner & CTO"
    │       └─ avatar: (uses global avatar unless overridden)
    │
    ├─ Workspace Membership (Circuit Holdings)
    │   ├─ Role: viewer
    │   ├─ App Access: [bundled:files]
    │   ├─ Groups: none
    │   └─ Profile: display_name: "Higinio Oliver Maycotte"
    │
    └─ Workspace Membership (Ownly Capital Portal)
        ├─ Role: admin
        ├─ App Access: [ALL]
        └─ Profile: display_name: "H.O."
```

### Roles — Built-In + Custom

| Role | Description | Typical Permissions |
|---|---|---|
| **superadmin** | Workspace creator / owner. Unrestricted. | Everything, including destructive actions |
| **admin** | Day-to-day administrator. | Manage people, apps, brand, knowledge. Can't delete workspace. |
| **member** | Standard team member. | Use enabled apps, create content, view people directory. |
| **viewer** | Read-only access. | View permitted apps, no create/edit. |
| **guest** | External user with minimal access. | View specific apps only. No workspace settings. |
| **custom:___** | Workspace-defined role. | Admin configures exact permissions. |

Custom roles are defined in the People & Teams core app. They're permission bundles:

```json
{
  "id": "role:board-member",
  "name": "Board Member",
  "description": "External board member with data room access",
  "base": "viewer",
  "permissions": {
    "files:read": true,
    "files:download": true,
    "files:comment": true,
    "files:upload": false,
    "knowledge:read": false,
    "people:directory": true,
    "people:manage": false
  },
  "default_app_access": ["bundled:files", "bundled:dashboard"],
  "default_nav_section": "dataroom"
}
```

---

---

## 12. The Company Knowledge Graph

Covered in depth in the Knowledge Editor core app (Section 6). The knowledge graph stores structured, versioned, queryable data about how the company works, looks, speaks, and builds.

### Knowledge Domains

| Domain | What It Contains | Managed By |
|---|---|---|
| `brand` | Colors, typography, logos, usage guidelines | Brand Manager core app |
| `messaging` | Tone, audiences, terminology, boilerplate, templates | Knowledge Editor |
| `engineering` | Code style, API conventions, testing, CI/CD, component patterns | Knowledge Editor |
| `org` | Departments, teams, reporting lines, key contacts | People & Teams core app |
| Custom | Anything: compliance, product specs, sales playbooks | Knowledge Editor |

### The Knowledge-Agent Loop

The knowledge graph is what makes AIUX more than a tool container. When an AI agent builds an app, it receives the company's standards as context. When a human writes copy, the messaging guidelines are queryable. When a new hire joins, the org structure is browsable. It's the company's operating manual, alive and enforceable.

---


## 13. The API Gateway

This is where the "Dual Interface" principle becomes something much bigger. Because every app — core, bundled, and guest — declares API routes in its manifest, and because all routes flow through the same Hono Worker with the same auth middleware, **AIUX is automatically an API gateway for the entire company.**

### What This Means

Every AIUX workspace exposes a unified API surface:

```
https://acme.ensemble.ai/_ensemble/
    │
    ├── /discover                    ← Agent discovery
    ├── /admin/...                   ← core:admin API
    ├── /brand/...                   ← core:brand API
    ├── /people/...                  ← core:people API
    ├── /auth/...                    ← core:auth API
    ├── /knowledge/...               ← core:knowledge API
    ├── /apps/...                    ← core:apps API
    ├── /audit/...                   ← core:audit API
    ├── /nav/...                     ← core:nav API
    ├── /dashboard/...               ← bundled:dashboard API
    ├── /files/...                   ← bundled:files API
    ├── /notifications/...           ← bundled:notifications API
    ├── /crm/...                     ← guest:crm API
    ├── /wiki/...                    ← guest:wiki API
    ├── /loan-tracker/...            ← guest:loan-tracker API
    └── /events/...                  ← Event subscriptions (WebSocket/webhook)
```

One base URL. One auth token. Every capability in the workspace. This is fundamentally different from having 15 separate APIs for 15 separate tools.

### The Gateway Middleware Pipeline

Every API request passes through the same pipeline:

```
Request: GET https://acme.ensemble.ai/_ensemble/crm/contacts?limit=50
         Authorization: Bearer <jwt_or_api_key>

    │
    ▼
┌─ 1. Workspace Resolution ──────────────────────────────────┐
│  Host: acme.ensemble.ai → workspace: ws_acme                   │
│  Load workspace config from D1 (cached in KV)               │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─ 2. Authentication ────────────────────────────────────────┐
│  JWT cookie → human user (usr_abc123)                       │
│  Bearer ak_xxx → agent key (ak_acme_deploy_bot)            │
│  Neither → 401 Unauthorized                                 │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─ 3. Membership Check ─────────────────────────────────────┐
│  Is usr_abc123 a member of ws_acme? → Yes (role: admin)     │
│  No → 403 Forbidden                                         │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─ 4. App Resolution ───────────────────────────────────────┐
│  Path: /_ensemble/crm/contacts → app: guest:crm               │
│  Is guest:crm enabled in ws_acme? → Yes                     │
│  Does the user have access to guest:crm? → Yes              │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─ 5. Rate Limiting ────────────────────────────────────────┐
│  Check per-workspace + per-key rate limits                   │
│  Log request to Durable Object counter                       │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─ 6. Route Handler ────────────────────────────────────────┐
│  Delegate to guest:crm's API handler for GET /contacts      │
│  Handler uses @ensemble-edge/sdk for scoped storage access            │
│  Storage automatically scoped to ws_acme + guest:crm         │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─ 7. Response + Audit ─────────────────────────────────────┐
│  Return JSON response with standard envelope                 │
│  Log to audit_log: who, what, when, which app                │
└─────────────────────────────────────────────────────────────┘
```

### Standard API Envelope

All API responses follow a consistent envelope:

```json
{
  "data": { ... },
  "meta": {
    "workspace": "ws_acme",
    "app": "guest:crm",
    "request_id": "req_xxxxx",
    "timestamp": "2026-03-25T10:30:00Z"
  },
  "pagination": {
    "total": 142,
    "limit": 50,
    "offset": 0,
    "has_more": true
  },
  "errors": null
}
```

### Why This Is Powerful

**For agents:** One API key, one base URL, every tool in the company. An agent doesn't need separate credentials for the CRM, the wiki, the file manager, and the knowledge graph. It authenticates once and can orchestrate across all of them.

**For integrations:** Webhooks from external services (Stripe, GitHub, Slack) hit one URL. The gateway routes them to the right app. No per-app webhook configuration.

**For mobile apps:** The native shell app has one API surface to call. Authentication is shared. Data from any app is one fetch away.

**For inter-company communication:** When AIUX Cloud launches, workspace-to-workspace API calls become possible. Ownly Capital's workspace can query a borrower's portal workspace — same protocol, different data, proper auth.

**For compliance:** Every API call is logged in the audit trail. One place to review all access. One place to set rate limits. One place to revoke access.

### OpenAPI Auto-Generation

Because every app declares its routes in the manifest, AIUX can auto-generate an OpenAPI spec for the entire workspace:

```
GET /_ensemble/openapi.json
```

Returns a complete OpenAPI 3.1 document describing every available endpoint across all enabled apps. This means:
- Agents can auto-discover and understand the full API surface
- Developer portals are auto-generated
- Client SDKs can be generated for any language
- API documentation stays in sync with reality

### Webhook Ingress

The gateway also handles inbound webhooks — external services calling into the workspace:

```
POST /_ensemble/webhooks/:app_id/:hook_id
```

Each app can register webhook receivers. The gateway validates the webhook signature, routes to the correct app handler, and logs the event. This replaces per-app webhook URLs scattered across different services.

### Event Egress

The flip side — the gateway can push events out:

```
POST /_ensemble/events/subscribe
{
  "events": ["crm:contact.created", "files:document.uploaded", "audit:role.changed"],
  "delivery": "webhook",
  "url": "https://agent.example.com/hooks",
  "secret": "whsec_XXXXX"
}
```

Or via WebSocket:

```
WS /_ensemble/events/stream
→ { "subscribe": ["crm:*", "knowledge:*"] }
← { "event": "crm:contact.created", "data": { ... }, "app": "guest:crm" }
```

The gateway aggregates events from all apps into a single stream. An agent subscribing to `crm:*` gets every CRM event without knowing the CRM's internal architecture.

### Gateway Configuration (Per Workspace)

Workspace admins can configure gateway behavior in the Auth & Security core app:

```typescript
interface GatewayConfig {
  // Rate limiting
  rateLimits: {
    global: number            // requests/minute across all keys
    perKey: number            // requests/minute per API key
    perUser: number           // requests/minute per human user
  }

  // CORS
  cors: {
    allowedOrigins: string[]  // ['https://app.acme.com', 'https://mobile.acme.com']
    allowedMethods: string[]
    allowCredentials: boolean
  }

  // IP allowlisting (optional)
  ipAllowlist?: string[]

  // Webhook signing
  webhookSecret: string

  // Response headers
  customHeaders?: Record<string, string>

  // API versioning
  defaultVersion: string      // 'v1'
  supportedVersions: string[] // ['v1']
}
```

---

## 14. The Agent Protocol Layer

Every capability in AIUX is accessible via UI (for humans clicking) and API (for agents calling).

### Agent Authentication

```bash
curl -H "Authorization: Bearer ak_ownly_XXXXX" \
     https://acme.ensemble.ai/_ensemble/discover
```

### Discovery Endpoint

An agent's first call — "what can I do here?"

```json
{
  "workspace": {
    "id": "ws_ownly",
    "name": "Ownly Group",
    "type": "organization"
  },
  "apps": {
    "core": [
      { "id": "core:brand", "enabled": true },
      { "id": "core:people", "enabled": true },
      { "id": "core:knowledge", "enabled": true }
    ],
    "bundled": [
      { "id": "bundled:dashboard", "enabled": true },
      { "id": "bundled:ai-assistant", "enabled": true },
      { "id": "bundled:files", "enabled": true }
    ],
    "guest": [
      { "id": "guest:crm", "version": "1.2.0", "endpoints": [...] },
      { "id": "guest:wiki", "version": "2.0.1", "endpoints": [...] }
    ]
  },
  "knowledge": {
    "domains": ["brand", "messaging", "engineering", "org"],
    "context_endpoints": [
      "/_ensemble/knowledge/context?for=app-development",
      "/_ensemble/knowledge/context?for=content-writing",
      "/_ensemble/knowledge/context?for=onboarding"
    ]
  },
  "agent": {
    "scopes": ["apps:read", "apps:write", "knowledge:read", "build:*"],
    "rate_limit": { "requests_per_minute": 1000, "remaining": 987 }
  }
}
```

### App Building via API

An agent can create and deploy guest apps programmatically:

```
POST /_ensemble/apps
Content-Type: application/json

{
  "manifest": {
    "id": "guest:loan-tracker",
    "name": "Loan Tracker",
    "tier": "guest",
    ...
  },
  "source": {
    "type": "inline",
    "entry": "... (compiled Preact component) ..."
  }
}
```

The agent built this app having already consumed the workspace's brand, code standards, and messaging guidelines from the knowledge graph. The result looks native.

---

## 15. Navigation Architecture

### Design Reference: Slack-Inspired Sidebar

The navigation draws from Slack's proven sidebar model — dedicated sections that organize different types of workspace content, with clear visual hierarchy and collapsible groups. But where Slack organizes by channels and DMs, Ensemble organizes by apps, agents, people, and docs.

### Shell Navigation Zones

```
┌── Workspace Switcher (left edge, 52-56px) ──────┐
│ Fixed vertical bar, always dark (#0f172a)         │
│ Workspace logos/initials (34-36px rounded squares)│
│ Active workspace has ring/border                  │
│ ⌘+[number] to jump                              │
│ Drag to reorder                                   │
│ Badge: red notification dot per workspace          │
│ [+] at bottom to add workspace                    │
└───────────────────────────────────────────────────┘

┌── Sidebar (200-240px, themed to workspace brand) ────────┐
│                                                           │
│  [Logo] Workspace Name               [compose ✎] [▾]    │
│                                                           │
│  ── APPS ──                           (collapsible)       │
│  ◆ Dashboard          (bundled)       — active: accent bg │
│  ◆ Customers          (guest: tool)   — badge: 2          │
│  ◆ Usage              (guest: tool)                       │
│  ◆ Reconciliation     (guest: tool)                       │
│  ◆ Stripe             (guest: connector)                  │
│  ◆ Google Drive       (guest: connector)                  │
│  + Add app                                                │
│                                                           │
│  ── AGENTS ──                         (collapsible)       │
│  ⚡ Auto-recharge      (guest: agent)  — status: green dot│
│  ⚡ Churn predictor     (guest: agent)  — status: green dot│
│  ⚡ Trial approver      (guest: agent)  — status: yellow   │
│  + Add agent                                              │
│                                                           │
│  ── PEOPLE ──                         (collapsible)       │
│  ○ Matt Hawkins        @hawkins       — online (green)    │
│  ○ Sara Park           @spark         — away (yellow)     │
│  ○ Tucker Sulzberger   @tucker        — offline (gray)    │
│  → View all people                                        │
│                                                           │
│  ── DOCS ──                           (collapsible)       │
│  ▸ Operations                         — folder            │
│    ▪ Managing customers               (from @nendo/crm)   │
│    ▪ Trial workflow                   (from @nendo/crm)   │
│  ▸ Billing                            — folder            │
│    ▪ Credit system                    (from @nendo/crm)   │
│    ▪ Stripe integration               (from @ensemble-edge/stripe) │
│  ▸ Platform                           — folder            │
│    ▪ Getting started                  (from core:admin)   │
│  + Add doc page                                           │
│                                                           │
│  ── QUICK LINKS ──                    (collapsible)       │
│  ↗ nendo.com                                              │
│  ↗ Stripe dashboard                                       │
│  ↗ iq.ensemble.ai                                         │
│  + Add link                                               │
│                                                           │
│  ── WORKSPACE ──                      (admin only)        │
│  ◇ Brand                              (core:brand)        │
│  ◇ Apps & agents                      (core:apps)         │
│  ◇ People & teams                     (core:people)       │
│  ◇ Knowledge                          (core:knowledge)    │
│  ◇ Navigation                         (core:nav)          │
│  ◇ Security                           (core:auth)         │
│  ◇ Audit log                          (core:audit)        │
│  ◇ Status                             (bundled:status)    │
│  ◇ Settings                           (core:admin)        │
│                                                           │
│  ─────────────────────────────────────────                │
│  [○ MH] Matt Hawkins  @hawkins         (user footer)      │
└───────────────────────────────────────────────────────────┘

┌── Toolbar (top of main area, 40-44px) ────────────────────┐
│ Breadcrumb: Section / Page    │   [⌘K Search...]   │ [AI] │
└───────────────────────────────────────────────────────────┘

┌── Bookmark Bar (bottom, 34px, optional) ──────────────────┐
│ [Quick action 1] [Quick action 2] [Quick action 3] [+]    │
└───────────────────────────────────────────────────────────┘
```

### Key Differences from Slack's Navigation

| Concept | Slack | Ensemble |
|---|---|---|
| Primary content | Channels + DMs | Apps + Agents |
| People section | DM list with presence | Team directory with presence + roles |
| Content section | N/A | Docs (stitched from all apps) |
| External links | N/A | Quick links section |
| Admin section | Workspace settings (separate page) | Inline workspace admin apps |
| Status indicators | User presence (online/away) | User presence + agent health (green/yellow/red) |
| Add actions | Create channel | Add app, add agent, add doc, add link |
| Badges | Unread message count | App-specific badges (pending trials, low credits, etc.) |

### Section Behavior

**Apps section** — Shows all installed guest apps (tools, connectors, portals, utilities) and enabled bundled apps. Ordered by the Navigation Hub config (admin-set default, users can reorder). Each item shows its manifest icon and label. Badges come from the app's `notifications` manifest field. Clicking opens the app in the viewport.

**Agents section** — Shows all installed guest apps with `category: "agent"`. Each shows a live health status dot (green = healthy, yellow = degraded, red = down, gray = disabled) pulled from the status app's data. Clicking opens the agent's monitoring/config UI in the viewport (if it has `nav`), or shows a summary panel.

**People section** — Shows workspace members with presence status. Pulled from the People core app's API. Shows online/away/offline indicators. "View all people" opens the full People directory in the viewport. Clicking a person could open their profile or start a DM (if a communication app is installed).

**Docs section** — Shows the unified docs tree stitched from all installed apps' `docs` manifest fields, organized by section. Collapsible folders. Each doc page shows which app contributed it. Clicking opens the doc in the viewport via the docs bundled app.

**Quick links section** — External URLs bookmarked by the workspace admin or user. Opens in a new tab. Configured via the Navigation Hub core app.

**Workspace section** — Core management apps. Visible only to admins (or partially visible based on role — e.g., members might see People and Knowledge but not Security or Audit). This section is always at the bottom.

### Section Visibility and Customization

The Navigation Hub core app (`core:nav`) controls which sections are visible, their order, their default collapsed/expanded state, and role-based visibility rules. The full configuration:

```typescript
// nav config in core:nav
{
  sections: [
    {
      id: 'apps',
      label: 'Apps',
      type: 'auto',           // auto-populated from installed apps
      filter: { category: ['tool', 'connector', 'portal', 'utility'] },
      collapsible: true,
      defaultExpanded: true,
      addAction: 'install-app',
      visibility: 'all',      // everyone sees this
    },
    {
      id: 'agents',
      label: 'Agents',
      type: 'auto',
      filter: { category: ['agent'] },
      collapsible: true,
      defaultExpanded: true,
      addAction: 'install-agent',
      showHealthStatus: true,
      visibility: 'all',
    },
    {
      id: 'people',
      label: 'People',
      type: 'people',         // special type: pulls from People core app
      showPresence: true,
      maxVisible: 8,          // show top 8, "View all" link for rest
      collapsible: true,
      defaultExpanded: true,
      visibility: 'all',
    },
    {
      id: 'docs',
      label: 'Docs',
      type: 'docs',           // special type: stitches from all app manifests
      collapsible: true,
      defaultExpanded: false,  // collapsed by default (can be many pages)
      addAction: 'create-doc',
      visibility: 'all',
    },
    {
      id: 'quick-links',
      label: 'Quick links',
      type: 'links',
      collapsible: true,
      defaultExpanded: true,
      addAction: 'add-link',
      visibility: 'all',
    },
    {
      id: 'workspace',
      label: 'Workspace',
      type: 'manual',         // manually configured list of core apps
      items: ['core:brand', 'core:apps', 'core:people', 'core:knowledge',
              'core:nav', 'core:auth', 'core:audit', 'bundled:status', 'core:admin'],
      collapsible: true,
      defaultExpanded: false,
      visibility: 'admin',    // admin-only (or role-specific)
    },
  ]
}
```

Workspace admins can add custom sections, reorder sections, rename them, change visibility rules, and set collapsed/expanded defaults — all via the Navigation Hub's visual builder.

### Routing

```
URL structure:
https://acme.ensemble.ai/app/crm/contacts/123

Breakdown:
  acme.ensemble.ai  → workspace: acme
  /app/crm          → app: guest:crm (the tier prefix is implied)
  /contacts/123     → app-internal route

Core/bundled apps use the same pattern:
  /app/_brand       → core:brand     (_ prefix for core)
  /app/_people      → core:people
  /app/dashboard    → bundled:dashboard
  /app/status       → bundled:status
```

### Command Palette (`⌘K`)

Global search and command execution across all installed apps and agents:

- Federated search across all apps' search endpoints (results stream in parallel)
- Navigate to any page, any app, any doc, any person
- Execute quick actions from all apps' `quick_actions` manifest fields
- Switch workspaces
- Open/close AI panel
- Knowledge graph search ("what are our brand colors?")
- Agent commands ("check recharge status," "run churn prediction")

---
## 16. Cross-Workspace App Sharing

Guest apps are developed once and can be installed in multiple workspaces. Core and bundled apps are always present (they're in the binary) — the sharing model is simpler: workspaces just toggle them on/off.

```
     Same AIUX Binary (core + bundled built in)
                        │
          ┌─────────────┼──────────────┐
          ▼             ▼              ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐
    │ Acme Co  │  │ StartupX │  │ Board Y  │
    │          │  │          │  │          │
    │ CORE: all│  │ CORE: all│  │ CORE: all│
    │ BUNDLED: │  │ BUNDLED: │  │ BUNDLED: │
    │  dash ✓  │  │  dash ✓  │  │  dash ✗  │
    │  AI   ✓  │  │  AI   ✓  │  │  AI   ✗  │
    │  files ✓ │  │  files ✗ │  │  files ✓ │
    │ GUEST:   │  │ GUEST:   │  │ GUEST:   │
    │  CRM  ✓  │  │  CRM  ✓  │  │  (none)  │
    │  Wiki ✓  │  │  Wiki ✗  │  │          │
    │          │  │          │  │          │
    │ Theme: 🔵│  │ Theme: 🟢│  │ Theme: ⚫│
    └──────────┘  └──────────┘  └──────────┘
```

---

## 17. Public & Customer-Facing Views

AIUX isn't just an intranet. Workspaces can expose public or restricted views.

### Visibility Levels

| Level | Description | Auth Required |
|---|---|---|
| **Private** | Only workspace members | Yes (membership) |
| **Restricted** | Specific external users (e.g., clients) | Yes (guest membership) |
| **Public Auth** | Anyone can view after creating an AIUX account | Yes (account, no membership) |
| **Public** | Anyone on the internet | No |

### Example: Ownly Capital Borrower Portal

1. Create workspace `ownly-capital-portal` using "client-portal" template
2. Core apps auto-configure (admin-only, minimal UI for the admin)
3. Most bundled apps disabled by template (only notifications + dashboard enabled)
4. Install guest app "Loan Tracker" (visibility: restricted)
5. Install guest app "Document Upload" (visibility: restricted)
6. Brand Manager → apply Ownly Capital brand
7. Invite borrowers as guests → they see only Loan Tracker + Document Upload + Dashboard
8. Clean, branded, minimal UI

---

## 18. Brand Theming

The theming system is intentionally constrained: a small number of high-impact levers that are guaranteed to look good in every combination, rather than a sprawling set of options that create QA nightmares and amateur results.

The guiding principle: **the shell is Ensemble's territory, the viewport is theirs.** The workspace shell (sidebar, toolbar, AI panel, workspace switcher) uses Ensemble's design system with brand accents applied systematically. Guest apps, customer portals, and embedded content inside the viewport can use the full brand kit.

### Brand Configuration — Four Controls

The workspace brand settings panel exposes exactly four controls:

#### 1. Accent color

A single hex color that serves as the workspace's primary brand expression. Applied systematically across the shell:

- Active workspace icon in the switcher (fill color)
- Sidebar active nav item highlight
- Badges and notification dots
- Buttons (primary actions)
- User message bubbles in the AI panel
- AI send button
- Link and action text
- Filter/tab active states
- User avatar background

Validated for minimum contrast ratio against both light and dark backgrounds to ensure accessibility. If a customer's accent is too dark or too saturated for legible use in user message bubbles, the system generates a "safe" variant automatically (slightly lightened or desaturated) rather than exposing a secondary color config.

#### 2. Logo mark

A small image (rendered at 24–28px in the sidebar header, 34–36px in the workspace switcher). Automatically cropped to a rounded square. Used in:

- Workspace switcher strip (one icon per workspace)
- Sidebar header (next to workspace name)

Should be a square mark or icon — not a full wordmark. Admins upload a square image; the system handles rounding and sizing.

#### 3. Base theme

A curated palette preset that controls all background, surface, border, and text colors across the shell:

| Theme | Description | Modes |
|---|---|---|
| **Warm** | Chocolate/espresso darks, cream/linen lights. Claude-inspired undertones. Premium, approachable, editorial. | Light + Dark |
| **Cool** | Slate/blue-gray undertones. Linear/GitHub energy. Technical, precise, developer-friendly. | Light + Dark |
| **Neutral** | True grays, no color cast. Corporate, universal. Disappears completely — lets the accent do all the work. | Light + Dark |
| **Midnight** | Deep navy/indigo undertones. Premium, financial, serious. | Dark only |
| **Stone** | Olive/green-gray undertones. Earthy, organic, natural. | Light + Dark |

Each base theme defines a complete set of derived tokens. All tokens are pre-tested against every accent color range to ensure legibility and harmony. New base themes can be shipped over time as feature drops.

#### 4. Workspace name

A text string displayed in the sidebar header and window title bar. Truncated with ellipsis if it exceeds the sidebar width.

### Light/Dark Mode

Light and dark mode is a single global toggle — set by the user's system preference or a manual toggle. When the mode switches, **everything switches together**: sidebar, viewport, toolbar, AI panel, cards. There is no independent sidebar mode.

What "dark" and "light" look like depends on the base theme. Dark Warm (chocolate browns) and Dark Cool (slate grays) are very different rooms, but both are internally coherent and paired with the workspace's accent color.

Light/dark mode is a **user-level** preference, not a workspace-level setting. Every user in the workspace can independently choose light or dark, and the selected base theme adapts accordingly.

### What the Shell Does NOT Pick Up From Brand Config

These are deliberate exclusions to protect the integrity of the shell:

- **No custom fonts in the shell.** The shell uses Ensemble's system typeface everywhere — nav labels, toolbar, AI panel, badges, table headers. Brand fonts apply only inside the viewport (guest apps, portals, customer-facing content). Custom fonts in nav items break spacing, readability, and visual consistency.

- **No custom sidebar background color.** The sidebar background is derived from the base theme + light/dark mode. This prevents clashing combinations and ensures text contrast is always correct.

- **No custom border radius, density, or spacing.** Fixed by Ensemble's design system. Not meaningful brand expression — implementation details that create infinite QA permutations for zero user benefit.

- **No custom text colors.** All text colors (primary, secondary, muted, dim) are derived from the base theme. The accent color is the only custom color in the system.

- **No secondary or tertiary brand colors in the shell.** One accent color is sufficient. Additional colors create visual noise and competing hierarchies.

### Design Token Reference

For each base theme + mode combination, the system generates:

```
Shell tokens (derived from base theme + mode):
  shell.switcher.bg          — workspace switcher strip background
  shell.sidebar.bg           — sidebar background
  shell.sidebar.text         — primary sidebar text
  shell.sidebar.muted        — secondary sidebar text
  shell.sidebar.dim          — tertiary/section label text
  shell.sidebar.hover        — nav item hover background
  shell.sidebar.active       — nav item active background (accent-derived)
  shell.main.bg              — viewport background
  shell.card.bg              — card/surface background
  shell.border               — default border color
  shell.toolbar.bg           — toolbar background
  shell.input.bg             — input field background
  shell.text.primary         — primary content text
  shell.text.soft            — secondary content text
  shell.text.muted           — tertiary content text
  shell.text.dim             — quaternary/disabled text

Brand tokens (from admin config):
  brand.accent               — the workspace accent color
  brand.accent.dim           — accent at ~12% opacity (backgrounds, badges)
  brand.accent.safe          — contrast-validated variant for colored surfaces
  brand.logo                 — logo mark image URL
  brand.name                 — workspace name string
```

### How Theming Works (Lifecycle)

1. Admin configures brand in the Brand Manager core app (4 controls)
2. Brand Manager writes to `workspaces.theme_config` in D1 + updates KV cache
3. Shell reads theme config (from KV, <1ms) and computes all derived tokens based on base theme + mode
4. Shell injects CSS custom properties into `:root` — all `@ensemble-edge/ui` components consume these variables
5. Guest app frontends in sandboxed iframes receive brand tokens via `postMessage` — they can use the accent color, base theme, and mode to match the shell
6. The AI panel, command palette, notifications, status page — everything in the shell responds to the same token set
7. Result: Every surface — shell and guest apps alike — is branded from one set of 4 controls

### Multilingual Support

Ensemble supports three layers of internationalization, designed to be implemented from day one at minimal cost.

#### Layer 1: Shell i18n

All shell UI strings are wrapped in a `t()` function from the very first build. No string is ever hardcoded in English.

```typescript
// Every shell string goes through t()
<span>{t('nav.section.apps')}</span>           // "Apps" / "Aplicaciones" / "Aplicativos"
<span>{t('toolbar.search.placeholder')}</span>  // "Search or jump to..." / "Buscar o ir a..."
<span>{t('ai.panel.title')}</span>              // "Ensemble AI" (unchanged across locales)
```

Translations live in JSON locale files:

```
packages/core/src/locales/
├── en.json        ← ships with v1.0
├── es.json        ← community or AI-translated
├── pt.json
├── fr.json
├── de.json
└── ja.json
```

Example locale file (~200-300 strings total for the entire shell):

```json
{
  "nav.section.apps": "Apps",
  "nav.section.agents": "Agents",
  "nav.section.people": "People",
  "nav.section.docs": "Docs",
  "nav.section.quick_links": "Quick links",
  "nav.section.workspace": "Workspace",
  "toolbar.search.placeholder": "Search or jump to...",
  "toolbar.search.shortcut": "⌘K",
  "ai.panel.title": "Ensemble AI",
  "ai.panel.subtitle": "workspace-aware",
  "ai.panel.input.placeholder": "Ask about your workspace...",
  "ai.panel.context.active": "Active",
  "status.healthy": "Healthy",
  "status.degraded": "Degraded",
  "status.down": "Down",
  "dashboard.greeting": "Good morning, {name}",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.confirm": "Confirm",
  "common.delete": "Delete"
}
```

The locale resolver checks in order: user preference (from personal settings) → browser `Accept-Language` header → workspace base language (from workspace settings). The shell renders in the first match that has a translation file.

Adding a new language is a single JSON file — no code changes. Community PRs for new languages are low-effort to review and merge. AI-assisted translation of the base English file provides a draft that native speakers refine.

#### Layer 2: Guest App Locale

Guest apps receive the user's resolved locale and the workspace's locale config via the `GuestAppContext` (see §8). Two fields:

- `workspace.locale` — the workspace's base language, supported languages, timezone, date/number formats
- `user.locale` — the current user's preferred language (resolved by the shell)

Guest apps use this or ignore it. A guest app that supports Spanish checks `user.locale === 'es'` and renders accordingly. A guest app that's English-only ignores the field. The workspace doesn't enforce guest app localization — it just provides the information.

#### Layer 3: Brand Token Translations

This is where multilingual support becomes genuinely powerful. All `text` and `rich_text` brand tokens (messaging, tone, identity, custom groups) can have per-locale translations.

**The storage model** adds an optional `locale` column to `brand_tokens`:

```sql
-- Base token (source of truth, in the workspace's base language)
INSERT INTO brand_tokens (workspace_id, category, key, value, type, locale)
VALUES ('ws_acme', 'messaging', 'tagline', 'The intelligent capital platform', 'text', NULL);

-- Spanish translation
INSERT INTO brand_tokens (workspace_id, category, key, value, type, locale)
VALUES ('ws_acme', 'messaging', 'tagline', 'La plataforma de capital inteligente', 'text', 'es');

-- Portuguese translation
INSERT INTO brand_tokens (workspace_id, category, key, value, type, locale)
VALUES ('ws_acme', 'messaging', 'tagline', 'A plataforma de capital inteligente', 'text', 'pt');
```

`locale = NULL` means the base language version (source of truth). Non-null locale values are translations. Visual tokens (colors, images, spatial) never have locale variants — they're universal.

**The "Add language" flow in the Brand Manager:**

1. Admin clicks "Add language" → selects from supported languages (or types a language code)
2. The system identifies all `text` and `rich_text` tokens that need translation
3. The AI panel's LLM translates all tokens into the new language automatically, using the brand's tone guidelines for style consistency
4. Translations appear in a review panel — side by side with the source language
5. Admin reviews, tweaks, and saves
6. The new language is now active — all delivery endpoints respect `?locale=es`

**Stale translation tracking:**

When the source language version of a token changes, all translations of that token are marked as stale:

```sql
ALTER TABLE brand_tokens ADD COLUMN source_updated_at TEXT;
ALTER TABLE brand_tokens ADD COLUMN is_stale BOOLEAN DEFAULT FALSE;
```

When the English tagline changes, the Spanish and Portuguese versions are flagged `is_stale = TRUE`. The Brand Manager shows a "Translations need updating" indicator. The admin can click "Re-translate" to have the AI update the stale translations, or manually edit them.

**API behavior with locale:**

All brand delivery endpoints accept a `?locale=` parameter:

```
GET /_ensemble/brand/tokens?locale=es            → Spanish text tokens + universal visual tokens
GET /_ensemble/brand/context?locale=es           → Compiled narrative in Spanish
GET /_ensemble/brand/css                          → No change (visual tokens are universal)
GET ~acme/brand?locale=es                      → Visual brand page in Spanish
```

Resolution order: requested locale → workspace base language → raw value. If a Spanish translation doesn't exist for a token, the base language version is returned. The response includes a `locale` field indicating which language was served and a `translations_available` array listing all available locales.

**The generated CSS endpoint is locale-agnostic** — colors, fonts, radii, and spacing don't change per language. The context and tokens endpoints are locale-aware — messaging, tone, and text-based custom tokens resolve to the requested language.

---
## 19. Security Model

### Defense Layers

| Layer | Protection |
|---|---|
| **Edge** | Cloudflare WAF, DDoS, Bot Management |
| **Auth** | JWTs + refresh tokens, MFA, session binding (core:auth app manages policies) |
| **Workspace** | Membership verification on every request |
| **App (all tiers)** | Permission checks via SDK, scoped storage |
| **Agent** | API key scoping, rate limiting, capability tokens |
| **Data** | Row-level security via workspace + app scoping (even core apps are scoped) |
| **Iframe** | CSP sandbox for untrusted guest apps |
| **Knowledge** | Read/write permissions on knowledge domains |
| **API Gateway** | Unified rate limiting, CORS, IP allowlisting, request logging |
| **Audit** | Every mutation logged (core:audit app) — humans and agents |

---
## 20. Upgrade Strategy & Extensibility

### Core as a Dependency, Not a Template

The AIUX core is published as npm packages. A workspace project installs them as dependencies. The developer's Worker entry point is a thin file that imports core, configures it, and optionally registers extensions. **The developer never edits core code. Upgrades never cause merge conflicts.**

This is the Next.js / Remix / SvelteKit model: you `bun add @ensemble-edge/core`, you configure it, you extend it. You never clone or fork the framework.

### What the Developer's Project Looks Like

```
my-company-workspace/
├── package.json              # Dependencies: @ensemble-edge/core, @ensemble-edge/sdk, @ensemble-edge/ui
├── ensemble.config.ts            # All configuration lives here
├── wrangler.toml             # Cloudflare Worker config (workspace + service bindings)
├── bun.lockb
│
├── apps/                     # Guest app Workers (separate deployments)
│   ├── loan-tracker/
│   │   ├── wrangler.toml     # Its own Worker config
│   │   ├── package.json      # Depends on @ensemble-edge/guest-cloudflare
│   │   ├── manifest.json
│   │   ├── src/
│   │   └── migrations/
│   └── borrower-portal/
│       ├── wrangler.toml
│       ├── package.json
│       ├── manifest.json
│       └── src/
│
├── extensions/               # Custom middleware, routes, hooks (run IN the workspace Worker)
│   ├── stripe-webhook.ts
│   └── weekly-report.ts
│
├── knowledge/                # Company knowledge files
│   ├── brand.yaml
│   ├── messaging.yaml
│   └── engineering.md
│
└── worker.ts                 # ★ THE ENTRY POINT (~20 lines, rarely changes)
```

### The Worker Entry Point

```typescript
// worker.ts
import { createWorkspace } from '@ensemble-edge/core'
import config from './ensemble.config'

// Import custom extensions (optional, these run IN the workspace Worker)
import { stripeWebhook } from './extensions/stripe-webhook'
import { weeklyReport } from './extensions/weekly-report'

// Create the workspace Worker
const app = createWorkspace({
  config,
  extensions: [stripeWebhook, weeklyReport],
  // Guest apps are NOT imported here — they're separate Workers
  // connected via service bindings or HTTP
})

export default app
```

Guest apps are NOT compiled into the workspace Worker. They're separate Workers declared in `wrangler.toml` via service bindings, or remote services configured in the App Manager.

### The Configuration File

```typescript
// ensemble.config.ts
import { defineConfig } from '@ensemble-edge/core'

export default defineConfig({
  workspace: {
    name: 'Ownly Group',
    slug: 'ownly',
    type: 'organization',
    tildeAddress: 'ownly',
  },

  brand: {
    colors: { primary: '#1a1a2e', accent: '#c8a951' },
    fonts: { heading: 'Gloock', body: 'DM Sans', mono: 'JetBrains Mono' },
    radius: 'md',
    density: 'comfortable',
  },

  bundledApps: {
    dashboard: true,
    aiAssistant: true,
    files: true,
    notifications: true,
    activity: true,
  },

  auth: {
    providers: ['email', 'google'],
    sso: { provider: 'google-workspace', domain: 'ownly.com', defaultRole: 'member' },
  },

  gateway: {
    cors: { allowedOrigins: ['https://app.ensemble.ai', 'https://ownly.com'] },
    rateLimit: { perKey: 1000, perUser: 500 },
  },

  knowledge: { importFrom: './knowledge/' },
})
```

### The Extension System

Extensions are for code that needs to run inside the workspace Worker itself — middleware, custom routes, auth providers, scheduled tasks, and event handlers. They're the escape hatch for things that don't fit the guest app model.

```typescript
import { defineExtension } from '@ensemble-edge/core'

// Middleware — runs on every request
export const requestLogger = defineExtension({
  type: 'middleware',
  name: 'request-logger',
  position: 'after-auth',
  handler: async (c, next) => {
    const start = Date.now()
    await next()
    console.log(`${c.req.method} ${c.req.path} — ${Date.now() - start}ms`)
  },
})

// Route — custom API endpoint
export const stripeWebhook = defineExtension({
  type: 'route',
  name: 'stripe-webhook',
  routes: (app) => {
    app.post('/_ensemble/webhooks/stripe', async (c) => {
      const body = await c.req.text()
      await c.get('storage').prepare('INSERT INTO payments ...').run()
      return c.json({ received: true })
    })
  },
})

// Scheduled — runs on cron
export const weeklyReport = defineExtension({
  type: 'scheduled',
  name: 'weekly-digest',
  cron: '0 9 * * MON',
  handler: async (env) => { /* send digest emails */ },
})

// Event handler — reacts to workspace events
export const slackNotifier = defineExtension({
  type: 'event-handler',
  name: 'deal-closed-slack',
  events: ['crm:deal.closed'],
  handler: async (event) => {
    await fetch('https://hooks.slack.com/...', {
      method: 'POST',
      body: JSON.stringify({ text: `Deal closed: ${event.data.name}` }),
    })
  },
})

// Auth provider — custom SSO
export const corporateSSO = defineExtension({
  type: 'auth-provider',
  name: 'corporate-okta',
  provider: {
    id: 'corporate-okta',
    label: 'Sign in with Corporate SSO',
    initiateLogin: async (c) => { /* redirect to IdP */ },
    handleCallback: async (c) => { /* validate, return user */ },
  },
})

// App hook — extend a core app's behavior
export const customBrandExport = defineExtension({
  type: 'app-hook',
  name: 'brand-export-pdf',
  app: 'core:brand',
  hook: 'after-export',
  handler: async (exportData, c) => {
    return { ...exportData, pdfUrl: await generatePDF(exportData) }
  },
})
```

### The Upgrade Flow

```bash
# Check for updates
ensemble update --check
# → @ensemble-edge/core: 1.4.2 → 1.5.0 (minor)
# → 2 migrations pending
# → Your extensions: compatible
# → Your guest apps: unaffected (they're separate Workers)

# Apply
bun update @ensemble-edge/core @ensemble-edge/sdk @ensemble-edge/ui
ensemble migrate
ensemble deploy
```

No merge conflicts. Ever. The developer's code (config, extensions, knowledge files) is never touched by an upgrade. Guest apps are completely independent — they upgrade on their own schedule.

### What Ensemble Owns vs. What the Developer Owns

```
ENSEMBLE OWNS (upgradeable via bun update):
  @ensemble-edge/core — shell, core apps, bundled apps, gateway, auth, migration runner
  @ensemble-edge/sdk — hooks for code inside the Worker
  @ensemble-edge/ui — themed component library
  @ensemble-edge/cli — developer tooling
  @ensemble-edge/guest — guest app SDK (core + platform adapters)

DEVELOPER OWNS (never touched by upgrades):
  worker.ts — entry point (~20 lines)
  ensemble.config.ts — all configuration
  extensions/ — custom middleware, routes, hooks
  knowledge/ — company knowledge files
  apps/ — guest app Workers (separate deployments)
  wrangler.toml — Cloudflare config + service bindings
```

### Ensemble Cloud: Zero-Friction Upgrades

For Cloud customers, upgrades are invisible. Ensemble deploys new core versions automatically. Custom code (extensions, knowledge) is merged at deploy time. Guest apps are unaffected — they're separate services.

## 21. The Ensemble Web App (`app.ensemble.ai`)

Before a user downloads anything, they can experience multi-workspace Ensemble in a browser tab. The web app at `app.ensemble.ai` is a hosted instance of the AIUX shell that can connect to any workspace — no iframes, no proxying, no redirects.

### Three-Tier Access Model

Every workspace is accessible through three paths, each adding a layer of convenience:

| Tier | URL | What you get |
|---|---|---|
| **Direct URL** | `acme.xyz.com` or `acme.ensemble.ai` | Single workspace in a browser tab. Shell + API served from the same Worker. No workspace switching. |
| **Web app** | `app.ensemble.ai` | Multi-workspace shell in a browser tab. Add workspaces, switch between them, unified notification badges. Zero download. |
| **Native app** | Downloaded Ensemble | Everything above + OS integration: Keychain, Touch ID, menu bar, push notifications, `ensemble://` deep links. |

Each tier up adds convenience. The core experience — the AIUX shell, the apps, the data — is identical across all three.

### How the Web App Works (No Iframes)

The web app is NOT an iframe wrapper around workspace URLs. It's the same Preact shell that every workspace serves, but hosted at `app.ensemble.ai` with one key difference: it can swap its API endpoint to talk to different workspace Workers.

**Direct URL architecture (single workspace):**

```
Browser → acme.xyz.com
                │
                ▼
    ┌─── Cloudflare Worker (acme) ───┐
    │                                │
    │  Serves: Shell HTML + JS       │
    │  Serves: /_ensemble/* responses   │
    │                                │
    │  Same origin. No CORS needed.  │
    └────────────────────────────────┘
```

The Worker serves both the shell (HTML/JS/CSS) and the API. Everything is same-origin. Simple.

**Web app architecture (multi-workspace):**

```
Browser → app.ensemble.ai
                │
                ▼
    ┌─── Ensemble CDN ───────────────┐
    │                                │
    │  Serves: Universal shell       │
    │  (same Preact code, no         │
    │   workspace-specific data)     │
    │                                │
    └────────────────────────────────┘
                │
    User types ~acme → resolves to acme.xyz.com
                │
                ▼
    Shell makes API calls to acme.xyz.com/_ensemble/*
                │
    ┌─── Cloudflare Worker (acme) ───┐
    │                                │
    │  Returns: theme, nav config,   │
    │  user profile, app data —      │
    │  everything the shell needs    │
    │                                │
    │  CORS: allows app.ensemble.ai  │
    └────────────────────────────────┘
                │
                ▼
    Shell renders Acme's branded workspace
    (colors, fonts, logo, sidebar, apps)

    ───────────────────────────────────

    User switches to ~circuit
                │
                ▼
    Shell swaps API endpoint to circuit.ensemble.ai/_ensemble/*
    Re-fetches: theme, nav, user, apps
    Re-renders with Circuit's brand
    Same shell. Different data. Different look.
```

No iframe. No redirect. No full page reload. The shell is a single-page app that treats the workspace API as a configurable data source. Switching workspaces swaps the API base URL and re-renders.

### The Connect Flow

When a user arrives at `app.ensemble.ai` for the first time:

```
1. Shell loads (generic Ensemble branding, no workspace context)
2. Connect screen shows: "Connect to your workspace"
3. User types: ~acme
4. Shell calls: dir.ensemble.ai/resolve/acme
   → Returns: { "endpoint": "https://acme.xyz.com", "name": "Acme Co", "logo": "..." }
5. Shell calls: acme.xyz.com/_ensemble/brand/theme
   → Returns: colors, fonts, logo, density, radius
6. Shell injects CSS variables → UI transforms to Acme's brand
7. Shell shows Acme's login page (themed)
8. User authenticates → receives JWT from Acme's Worker
9. Shell calls: acme.xyz.com/_ensemble/nav
   → Returns: sidebar config, app list, bookmark bar
10. Full workspace renders. User is in.
```

The first API call after resolution is always `GET /_ensemble/brand/theme`. The shell applies the brand before rendering anything else. So even on a slow connection, the user sees Acme's colors and logo immediately — not a flash of generic Ensemble chrome.

### Local State Management

The web app stores workspace state in the browser:

```typescript
// localStorage at app.ensemble.ai
{
  "workspaces": [
    {
      "slug": "acme",
      "endpoint": "https://acme.xyz.com",
      "name": "Acme Co",
      "logo": "https://acme.xyz.com/_ensemble/brand/assets/logo",
      "primaryColor": "#1a1a2e",
      "lastAccessed": "2026-03-26T10:30:00Z",
      "position": 0
    },
    {
      "slug": "circuit",
      "endpoint": "https://circuit.ensemble.ai",
      "name": "Circuit Holdings",
      "logo": "https://circuit.ensemble.ai/_ensemble/brand/assets/logo",
      "primaryColor": "#0f172a",
      "lastAccessed": "2026-03-25T14:00:00Z",
      "position": 1
    }
  ],
  "active": "acme"
}

// Per-workspace auth tokens (stored separately for security)
// sessionStorage or secure cookie per workspace
{
  "tokens": {
    "acme": { "jwt": "eyJ...", "refresh": "ref_...", "expires": "2026-03-26T11:00:00Z" },
    "circuit": { "jwt": "eyJ...", "refresh": "ref_...", "expires": "2026-03-27T14:00:00Z" }
  }
}
```

When the shell loads, it reads the workspace list from localStorage, renders the workspace switcher strip, and connects to the active workspace. If the JWT for the active workspace is expired, the shell uses the refresh token to get a new one — or redirects to login if the refresh token is also expired.

### CORS Configuration

For the web app to work, each workspace's Worker must allow `app.ensemble.ai` as a CORS origin. This is handled by the API Gateway (Section 13) and is enabled by default:

```typescript
// In the Worker's CORS middleware
const ALLOWED_ORIGINS = [
  // The workspace's own domain (same-origin, no CORS needed)
  c.get('workspace').customDomain,
  c.get('workspace').ensembleDomain,

  // The Ensemble web app (always allowed)
  'https://app.ensemble.ai',

  // Any additional origins the workspace admin configures
  ...c.get('workspace').gateway_config?.cors?.allowedOrigins ?? []
]
```

Workspace admins can toggle this off if they want to restrict access to direct URL only (e.g., for highly sensitive workspaces). But the default is on — most workspaces want to be accessible from the web app.

### Authentication Across Workspaces

Each workspace issues its own JWT. The web app stores tokens per-workspace. When you switch workspaces:

1. Shell swaps the active workspace in state
2. Loads the stored JWT for the target workspace
3. If valid → makes API calls with that JWT → workspace renders
4. If expired → attempts refresh token exchange
5. If refresh fails → shows that workspace's login screen (themed to the workspace's brand)

There is no shared authentication between workspaces. Each workspace is a completely independent auth domain. This is critical for security — a compromised token for one workspace doesn't affect any other workspace.

The one exception: if two workspaces both use the same SSO provider (e.g., both use Google Workspace), the browser's SSO session may auto-authenticate the user without a visible login step. But that's the SSO provider's session, not Ensemble's.

### Notifications in the Web App

Without the native app, push notifications use the browser's Notification API:

```typescript
// On workspace connect, request notification permission
if ('Notification' in window && Notification.permission === 'default') {
  await Notification.requestPermission()
}

// Each workspace's Worker can push notifications via a WebSocket or SSE connection
const eventSource = new EventSource(`${endpoint}/_ensemble/events/stream?token=${jwt}`)
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data)
  // Update badge count on workspace switcher
  updateBadge(workspace.slug, data.unreadCount)
  // Show browser notification if permitted
  if (Notification.permission === 'granted') {
    new Notification(data.title, { body: data.body, icon: workspace.logo })
  }
}
```

The web app maintains an SSE (Server-Sent Events) connection to the active workspace only. For inactive workspaces, it polls periodically (every 30-60 seconds) to update unread badge counts. This is a conscious tradeoff — the native app uses push notifications for all workspaces (via APNs/FCM), while the web app only has a live connection to the one you're looking at.

### Progressive Enhancement: Web App → Native App

The web app can detect when the native app is installed and offer to hand off:

```
┌─────────────────────────────────────────────┐
│  You have 4 workspaces connected.           │
│  Get the Ensemble app for a better          │
│  experience — Touch ID, push notifications, │
│  and menu bar access.                       │
│                                             │
│  [Download for macOS]  [Not now]            │
└─────────────────────────────────────────────┘
```

If the user installs the native app, it can import the workspace list from the web app (via a one-time QR code or export/import flow) so they don't have to re-add and re-authenticate every workspace.

### What the Web App is NOT

The web app does NOT host, proxy, or store any workspace data. It is a static client-side application that:

- Stores workspace URLs and tokens locally in the browser
- Makes API calls directly to each workspace's Worker
- Renders the AIUX shell locally
- Never sees or caches workspace content server-side

Ensemble (the company) cannot see what's happening inside a workspace accessed through the web app. The shell is just a client. The data flows directly between the user's browser and the workspace's Worker. The only Ensemble-hosted service in the loop is the directory (`dir.ensemble.ai`), which resolves `~slug` to a URL — a DNS-like lookup that carries no workspace data.

---

## 22. The Ensemble Native App

### Why Tauri, Not Electron or Capacitor

Slack's history tells us what not to do. They started on MacGap v1 (a lightweight WebView wrapper), hit its limits, then rewrote in Electron — bundling an entire copy of Chromium + Node.js per app. Today, Slack's desktop app weighs 300MB+ and consumes 1-2GB of RAM when you're signed into multiple workspaces. Each workspace runs a separate Chromium renderer process. It works, but it's bloated.

Capacitor (from the Ionic team) is better for mobile but weaker on desktop — it doesn't produce true native macOS/Windows apps, just wrapped WebViews without deep OS integration.

**Tauri v2** is the right choice for Ensemble because it covers all five platforms from one codebase:

| Platform | WebView Used | Native Layer | App Size |
|---|---|---|---|
| **macOS** | WebKit (built into macOS) | Swift plugins | ~5-10MB |
| **Windows** | Edge WebView2 (built into Windows) | Rust | ~5-10MB |
| **Linux** | WebKitGTK | Rust | ~5-10MB |
| **iOS** | WKWebView (built into iOS) | Swift plugins | ~8-15MB |
| **Android** | Android WebView (Chromium-based) | Kotlin plugins | ~8-15MB |

The key difference from Electron: Tauri uses the operating system's **built-in** WebView instead of bundling its own copy of Chromium. This means the app is tiny, uses less memory, and gets security updates from the OS itself. The native shell is written in Rust (fast, safe, tiny binary) with Swift extensions for Apple platforms and Kotlin for Android.

### The Ensemble App Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ENSEMBLE NATIVE APP                           │
│                    (Tauri v2 — all platforms)                    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    NATIVE SHELL (Rust)                      │  │
│  │                                                             │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │  │
│  │  │ Workspace   │  │ Credential   │  │ Push             │  │  │
│  │  │ Manager     │  │ Store        │  │ Notifications    │  │  │
│  │  │             │  │              │  │                  │  │  │
│  │  │ Add/remove  │  │ macOS:       │  │ APNs (Apple)     │  │  │
│  │  │ workspaces  │  │  Keychain    │  │ FCM (Android)    │  │  │
│  │  │ Track state │  │ iOS:         │  │ Routes to correct│  │  │
│  │  │ Switch ctx  │  │  Keychain    │  │ workspace        │  │  │
│  │  │ Unread count│  │ Android:     │  │                  │  │  │
│  │  │             │  │  Keystore    │  │                  │  │  │
│  │  │             │  │ Windows:     │  │                  │  │  │
│  │  │             │  │  Credential  │  │                  │  │  │
│  │  │             │  │  Manager     │  │                  │  │  │
│  │  └─────────────┘  └──────────────┘  └──────────────────┘  │  │
│  │                                                             │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │  │
│  │  │ Biometric   │  │ Deep         │  │ Offline          │  │  │
│  │  │ Auth        │  │ Linking      │  │ Cache            │  │  │
│  │  │             │  │              │  │                  │  │  │
│  │  │ Touch ID    │  │ ensemble://  │  │ Nav config       │  │  │
│  │  │ Face ID     │  │ ~workspace/  │  │ Theme config     │  │  │
│  │  │ Fingerprint │  │ app/path     │  │ Recent data      │  │  │
│  │  │ Windows     │  │              │  │ Unread state     │  │  │
│  │  │ Hello       │  │              │  │                  │  │  │
│  │  └─────────────┘  └──────────────┘  └──────────────────┘  │  │
│  │                                                             │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │  │
│  │  │ System Tray │  │ Global       │  │ Auto-Update      │  │  │
│  │  │ / Menu Bar  │  │ Shortcuts    │  │                  │  │  │
│  │  │             │  │              │  │ Check for new    │  │  │
│  │  │ macOS: menu │  │ ⌘+Shift+E   │  │ versions from    │  │  │
│  │  │ bar icon    │  │ to toggle    │  │ ensemble.ai      │  │  │
│  │  │ w/ unread   │  │ Ensemble     │  │ registry         │  │  │
│  │  │ badge       │  │              │  │                  │  │  │
│  │  └─────────────┘  └──────────────┘  └──────────────────┘  │  │
│  │                                                             │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│                              ▼                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    PLATFORM PLUGINS                         │  │
│  │                                                             │  │
│  │  macOS/iOS (Swift)        Android (Kotlin)                  │  │
│  │  ─────────────────        ─────────────────                 │  │
│  │  Keychain access          Keystore access                   │  │
│  │  Touch ID / Face ID       Fingerprint/Face                  │  │
│  │  APNs registration        FCM registration                  │  │
│  │  Share extension           Share intent                      │  │
│  │  Spotlight indexing        App shortcuts                     │  │
│  │  Menu bar widget          Quick settings tile               │  │
│  │  Handoff support          —                                 │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│                              ▼                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    AIUX WEB SHELL                           │  │
│  │               (Same code as browser version)                │  │
│  │                                                             │  │
│  │  Preact + Tailwind + @ensemble-edge/sdk + @ensemble-edge/ui                  │  │
│  │  Loaded in native WebView                                   │  │
│  │  Communicates with Rust core via Tauri IPC                  │  │
│  │  Connects to workspace's Cloudflare Worker backend          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### The macOS Experience

The macOS app should feel native — not like a web page in a frame. Key behaviors:

**Menu Bar:**
- Ensemble icon in the macOS menu bar (top-right)
- Click to see workspace list with unread counts
- Quick switch between workspaces from the menu bar
- "Do Not Disturb" toggle per workspace
- Status indicator (online/away/busy)

**Dock:**
- Ensemble icon with badge count (total unreads across all workspaces)
- Right-click for workspace quick-switch
- Bounce on new notification (configurable)

**macOS Integration:**
- Full `⌘` keyboard shortcuts (`⌘+K` for command palette, `⌘+1-9` for workspace switch)
- Native macOS notifications (grouped by workspace)
- Touch ID for re-authentication
- Spotlight integration: search "Ensemble CRM contact Jane" → deep links into the workspace
- Handoff: start on Mac, continue on iPhone (same workspace, same context)
- Share extension: share files/links from any app directly into an Ensemble workspace
- Native window management: split view, full screen, Mission Control
- Frameless window with native traffic lights (close/minimize/maximize)

**Window Layout:**

```
┌─── Ensemble ─────────────────────────────────────────────────┐
│ ● ● ●                                                        │
│ ┌──┐ ┌───────────────────────────────────────────────────┐   │
│ │🟢│ │                                                   │   │
│ │  │ │        ┌─ The AIUX web shell renders here ────┐   │   │
│ │🔵│ │        │                                      │   │   │
│ │  │ │        │  (workspace switcher, sidebar,       │   │   │
│ │⚫│ │        │   toolbar, viewport, panels —        │   │   │
│ │  │ │        │   all rendered in WebView)            │   │   │
│ │🟡│ │        │                                      │   │   │
│ │  │ │        │                                      │   │   │
│ │  │ │        └──────────────────────────────────────┘   │   │
│ │[+]│ │                                                   │   │
│ └──┘ └───────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘

The narrow left strip is the native workspace switcher
(rendered by Tauri, not the WebView).
Everything else is the AIUX web shell.
```

The workspace switcher strip on the far left is rendered **natively** by the Tauri app, not by the WebView. This means it persists even if a workspace's web content is loading, and it can show unread badges from the push notification system without needing a WebSocket connection to every workspace simultaneously.

### The iOS Experience

```
┌─────────────────────────────┐
│ ● ●                    9:41 │
│ ┌─────────────────────────┐ │
│ │                         │ │
│ │    AIUX web shell       │ │
│ │    (workspace content)  │ │
│ │                         │ │
│ │    Sidebar → hamburger  │ │
│ │    Panels → sheets      │ │
│ │                         │ │
│ │                         │ │
│ │                         │ │
│ │                         │ │
│ └─────────────────────────┘ │
│                             │
│ ┌─ Bottom Tab Bar ────────┐ │
│ │ [🏠] [👥] [🤖] [📁] [⋯]│ │
│ │ Home  CRM   AI  Files More│ │
│ └─────────────────────────┘ │
│                             │
│ ┌─ Workspace Bar ─────────┐ │
│ │ [🟢 Ownly] [🔵 HO Cap]  │ │
│ │ [⚫ Circuit] [+ Add]     │ │
│ │ (swipe to switch)        │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

- Workspace bar at the very top or bottom (swipeable, like Slack's workspace switcher but cleaner)
- Bottom tab bar configured by the Navigation Hub core app's mobile config
- Panels (AI assistant, notifications) open as iOS sheets (swipe down to dismiss)
- Face ID / Touch ID for app unlock
- iOS Share extension to send content to any workspace
- Widget: unread count per workspace on the home screen
- Live Activities: show active tasks / ongoing AI conversations

### The Android Experience

Similar to iOS, adapted for Android conventions:
- Material You theming (pulls workspace brand colors into system accent)
- Notification channels per workspace
- App shortcuts for quick workspace access
- Back gesture navigation
- Quick Settings tile for Ensemble status

### The Connect Screen (First Launch)

When you download Ensemble and open it for the first time, you see the **Connect Screen**. This is where the addressing system matters.

```
┌─────────────────────────────────────────┐
│                                         │
│          ┌──────────────────┐           │
│          │   ◆ ensemble     │           │
│          └──────────────────┘           │
│                                         │
│     Connect to your workspace           │
│                                         │
│     ┌─────────────────────────────┐     │
│     │  ~                          │     │
│     └─────────────────────────────┘     │
│                                         │
│     ┌─────────────────────────────┐     │
│     │  Connect                    │     │
│     └─────────────────────────────┘     │
│                                         │
│     ─── or ───                          │
│                                         │
│     Scan QR code                        │
│     Paste invite link                   │
│     Browse ensemble.ai workspaces       │
│                                         │
│     ─────────────────────               │
│                                         │
│     New to Ensemble?                    │
│     Create a workspace →                │
│                                         │
└─────────────────────────────────────────┘
```

---


### The Ensemble Protocol (`ensemble://`)

### Custom URL Scheme

The Ensemble app registers a custom URL protocol handler. This enables deep linking from anywhere — web pages, emails, QR codes, other apps, Spotlight.

```
ensemble://~ownly
ensemble://~ownly/app/crm/contacts/123
ensemble://~circuit/app/_files/folders/board-docs
ensemble://connect/~ownly-portal?invite=ABC123
ensemble://switch/~ho-capital
```

### Protocol Syntax

```
ensemble://[action]/[~workspace]/[path]

Actions:
  (none)    → Open workspace (default)
  connect   → Connect to a new workspace
  switch    → Switch to an already-connected workspace
  invite    → Accept an invitation
```

### Universal Links (Web → App)

When someone clicks a link like `https://ownly.ensemble.ai/app/crm/contacts/123`:

1. If Ensemble app is installed → opens directly in the app via Universal Link (iOS) / App Link (Android) / registered protocol (macOS)
2. If not installed → opens in the browser, with a banner: "This workspace is better in the Ensemble app. [Download]"

The web version is always available as a fallback. The app is the premium experience.

---


### Multi-Workspace State Management

### The Rust Core's Role

The Tauri Rust core manages the state that lives across workspaces — things the web shell can't handle because it only sees one workspace at a time.

```rust
// Simplified workspace manager state
struct WorkspaceManager {
    // All connected workspaces
    workspaces: Vec<ConnectedWorkspace>,
    
    // Which workspace is currently active
    active_workspace: Option<String>,
    
    // Unread counts (updated via push notifications)
    unread_counts: HashMap<String, UnreadCount>,
    
    // Credential store (per-workspace JWT refresh tokens)
    credentials: SecureStore,
}

struct ConnectedWorkspace {
    slug: String,                    // "ownly"
    tilde_address: String,           // "~ownly"
    endpoint: String,                // "https://ownly.ensemble.ai"
    name: String,                    // "Ownly Group"
    logo_url: Option<String>,
    theme_primary_color: String,     // For native UI accent
    last_accessed: DateTime,
    position: u32,                   // Sort order in switcher
    notifications_enabled: bool,
    status: WorkspaceStatus,         // online, connecting, error
}

struct UnreadCount {
    total: u32,
    by_app: HashMap<String, u32>,    // "guest:crm" → 3, "bundled:notifications" → 12
    has_mentions: bool,              // Badge should be more prominent
}
```

### What the Rust Core Handles vs. the WebView

| Concern | Handled By | Why |
|---|---|---|
| Workspace list + switching | Rust (native UI) | Must persist across workspace loads |
| Unread counts | Rust (push notifications) | Must update without WebSocket to every workspace |
| Credentials | Rust (secure store) | Keychain/Keystore access requires native code |
| Biometric auth | Rust + Swift/Kotlin plugin | OS-level API |
| Deep link routing | Rust | Intercepts `ensemble://` before WebView loads |
| Auto-update | Rust (Tauri updater) | Background check against registry |
| App icon badge | Rust (native API) | Sum of all workspace unread counts |
| System tray / menu bar | Rust (native API) | Quick access outside the main window |
| Everything else | WebView (AIUX shell) | The full workspace experience |

The key insight: the Rust core is **thin**. It handles the multi-workspace chrome and OS integration. The actual workspace experience — sidebar, apps, content, panels — is 100% the web shell, exactly as it runs in the browser. One codebase for the UI. Rust just wraps it with native superpowers.

### Background Workspace Management

When you have 8-10 workspaces connected, the app doesn't keep WebView instances for all of them. That would be Slack's mistake. Instead:

1. **Active workspace:** Full WebView, live WebSocket connection
2. **Recently active (last 2-3):** WebView preserved in memory but suspended (no network activity)
3. **Inactive workspaces:** No WebView. Only push notification state in the Rust core.

When you switch to an inactive workspace:
1. Rust core activates the WebView for that workspace
2. If a suspended WebView exists → resume it (instant switch, < 100ms)
3. If not → create a new WebView, load the workspace (1-2 seconds, shows the cached theme immediately while loading)
4. The workspace you left → moves to "recently active" (preserved but suspended)

This keeps memory usage sane. 8 workspaces don't mean 8 Chromium processes like Slack. They mean 1 active + 2 suspended + 5 push-notification-only.

---

## 23. Project Structure

### The OSS Monorepo (Ensemble maintains)

```
ensemble-workspace/
├── packages/
│   ├── core/                       # @ensemble-edge/core (published to npm)
│   │   ├── src/
│   │   │   ├── create-workspace.ts # Main export: createWorkspace()
│   │   │   ├── middleware/
│   │   │   ├── routes/
│   │   │   ├── shell/              # Preact shell (SPA)
│   │   │   ├── locales/            # Shell i18n strings
│   │   │   │   ├── en.json         # English (ships with v1)
│   │   │   │   ├── es.json         # Spanish
│   │   │   │   └── ...             # Community-contributed
│   │   │   ├── apps/
│   │   │   │   ├── core/           # 8 core apps
│   │   │   │   └── bundled/        # Bundled apps
│   │   │   ├── services/
│   │   │   │   ├── theme.ts
│   │   │   │   ├── i18n.ts         # Locale resolver + t() function
│   │   │   │   ├── permissions.ts
│   │   │   │   ├── gateway.ts      # API gateway + guest app proxy
│   │   │   │   ├── app-registry.ts
│   │   │   │   ├── knowledge.ts
│   │   │   │   ├── event-bus.ts
│   │   │   │   └── notifications.ts
│   │   │   └── db/
│   │   └── package.json
│   │
│   ├── sdk/                        # @ensemble-edge/sdk (for code inside the Worker)
│   ├── ui/                         # @ensemble-edge/ui (themed components)
│   ├── cli/                        # @ensemble-edge/cli (developer tooling)
│   ├── agent-sdk/                  # @ensemble-edge/agent (for AI agents)
│   │
│   └── guest/                      # @ensemble-edge/guest (for guest app developers)
│       ├── core/                   # @ensemble-edge/guest — platform-agnostic core
│       │   ├── src/
│       │   │   ├── define-guest-app.ts
│       │   │   ├── context.ts
│       │   │   ├── auth.ts         # Capability token validation
│       │   │   ├── theme.ts        # Theme token helpers
│       │   │   ├── events.ts       # Event bus client
│       │   │   └── types.ts        # Manifest types, context types
│       │   └── package.json
│       │
│       ├── cloudflare/             # @ensemble-edge/guest-cloudflare
│       │   ├── src/
│       │   │   ├── adapter.ts      # CF Workers adapter
│       │   │   └── service-binding.ts
│       │   └── package.json
│       │
│       ├── vercel/                 # @ensemble-edge/guest-vercel
│       │   ├── src/
│       │   │   └── adapter.ts      # Vercel Functions adapter
│       │   └── package.json
│       │
│       ├── node/                   # @ensemble-edge/guest-node
│       │   ├── src/
│       │   │   └── adapter.ts      # Express/Fastify adapter
│       │   └── package.json
│       │
│       ├── deno/                   # @ensemble-edge/guest-deno
│       │   ├── src/
│       │   │   └── adapter.ts      # Deno adapter
│       │   └── package.json
│       │
│       └── aws/                    # @ensemble-edge/guest-aws
│           ├── src/
│           │   └── adapter.ts      # Lambda adapter
│           └── package.json
│
├── templates/                      # Used by `ensemble init`
│   ├── workspace/                  # Workspace project template
│   │   ├── worker.ts
│   │   ├── ensemble.config.ts
│   │   ├── package.json
│   │   └── wrangler.toml
│   └── guest-app/                  # Guest app template
│       ├── manifest.json
│       ├── src/
│       ├── package.json
│       └── wrangler.toml
│
├── apps/                           # Example guest apps
│   ├── crm/
│   ├── wiki/
│   └── support/
│
├── native/                         # Tauri native app
│   ├── src-tauri/
│   ├── src-swift/
│   ├── src-kotlin/
│   └── src/
│
├── web-app/                        # app.ensemble.ai
│   └── src/
│
├── directory/                      # dir.ensemble.ai
│   └── src/
│
└── website/                        # ensemble.ai
    └── src/
```

### What a Developer Creates (via `ensemble init`)

```
my-company-workspace/
├── worker.ts                       # Imports @ensemble-edge/core, ~20 lines
├── ensemble.config.ts                  # All configuration
├── package.json                    # @ensemble-edge/* as dependencies
├── wrangler.toml                   # CF config + service bindings to guest apps
├── extensions/                     # Custom middleware/routes/hooks
├── knowledge/                      # Company knowledge YAML/MD
│
└── apps/                           # Guest app Workers (each is its own deployment)
    ├── loan-tracker/
    │   ├── wrangler.toml           # Separate Worker
    │   ├── package.json            # @ensemble-edge/guest-cloudflare
    │   ├── manifest.json
    │   └── src/
    └── borrower-portal/
        ├── wrangler.toml
        ├── package.json
        └── src/
```

### SDK Package Summary

| Package | Who uses it | Where it runs | Purpose |
|---|---|---|---|
| `@ensemble-edge/core` | Workspace devs | In the workspace Worker | The engine: shell, core apps, gateway |
| `@ensemble-edge/sdk` | Extension devs | In the workspace Worker | Hooks for middleware, routes, app hooks |
| `@ensemble-edge/ui` | Any app dev | In any frontend | Themed component library |
| `@ensemble-edge/guest` | Guest app devs | On their infrastructure | Core SDK for building guest apps |
| `@ensemble-edge/guest-cloudflare` | CF guest app devs | CF Workers | Cloudflare-specific adapter |
| `@ensemble-edge/guest-vercel` | Vercel guest app devs | Vercel Functions | Vercel-specific adapter |
| `@ensemble-edge/guest-node` | Node.js guest app devs | Node/Express/Fastify | Node.js adapter |
| `@ensemble-edge/guest-deno` | Deno guest app devs | Deno Deploy | Deno adapter |
| `@ensemble-edge/guest-aws` | AWS guest app devs | Lambda | AWS Lambda adapter |
| `@ensemble-edge/guest-bun` | Bun guest app devs | Bun runtime | Bun adapter |
| `@ensemble-edge/agent` | AI agent devs | On their infrastructure | SDK for agents interacting with workspaces |
| `@ensemble-edge/cli` | All developers | Local machine | Init, dev, deploy, migrate, publish, install |

## 24. Database Schema — Complete

This is the consolidated schema across all core tables. App-specific tables are created via migrations.

```sql
-- ═══════════════════════════════════════════════════════════════
-- IDENTITY
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE users (
  id TEXT PRIMARY KEY,              -- usr_xxxxxxxxxxxx
  handle TEXT UNIQUE NOT NULL,      -- 'maycotte' (stored without @)
  email TEXT UNIQUE NOT NULL,
  email_verified INTEGER DEFAULT 0,
  name TEXT NOT NULL,
  avatar_key TEXT,                  -- R2 key
  mfa_secret TEXT,
  mfa_enabled INTEGER DEFAULT 0,
  handle_changed_at TEXT,           -- rate-limit handle changes
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE auth_methods (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,               -- 'password', 'oauth', 'saml', 'passkey'
  provider TEXT,                    -- 'google', 'github', 'microsoft', 'saml_ws_ownly'
  provider_user_id TEXT,
  credential TEXT,                  -- password hash, passkey credential, etc.
  email TEXT,                       -- email associated with this method
  metadata TEXT,                    -- JSON: tokens, device info, etc.
  last_used_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(type, provider, provider_user_id)
);

-- ═══════════════════════════════════════════════════════════════
-- WORKSPACES
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,              -- ws_xxxxxxxxxxxx
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'organization',
  template TEXT,
  custom_domain TEXT UNIQUE,
  logo_key TEXT,
  favicon_key TEXT,
  theme_config TEXT,                -- JSON: WorkspaceTheme
  settings TEXT,                    -- JSON: general settings
  knowledge_config TEXT,            -- JSON: knowledge graph settings
  agent_config TEXT,                -- JSON: agent access policies
  tilde_address TEXT UNIQUE,        -- 'ownly' (the ~slug, without ~)
  tilde_registered INTEGER DEFAULT 0, -- registered in Ensemble Directory?
  direct_url_enabled INTEGER DEFAULT 1, -- allow direct URL access?
  gateway_config TEXT,              -- JSON: API gateway settings
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE workspace_sso (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  protocol TEXT NOT NULL,           -- 'saml', 'oidc'
  provider_name TEXT,               -- 'Google Workspace', 'Okta', 'Azure AD'
  idp_entity_id TEXT,
  idp_sso_url TEXT,
  idp_certificate TEXT,
  oidc_issuer TEXT,
  oidc_client_id TEXT,
  oidc_client_secret_enc TEXT,
  email_domain TEXT,                -- 'ownly.com'
  auto_create_membership INTEGER DEFAULT 1,
  default_role TEXT DEFAULT 'member',
  enforce_sso INTEGER DEFAULT 0,
  group_mapping TEXT,               -- JSON: map IdP groups to AIUX roles
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE workspace_apps (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  app_id TEXT NOT NULL,
  tier TEXT NOT NULL,               -- 'core', 'bundled', 'guest'
  enabled INTEGER DEFAULT 1,
  settings TEXT,                    -- JSON: per-workspace app config
  visibility TEXT DEFAULT 'all_members',
  nav_order INTEGER,
  nav_section TEXT,
  installed_at TEXT DEFAULT (datetime('now')),
  installed_by TEXT,
  PRIMARY KEY (workspace_id, app_id)
);

-- ═══════════════════════════════════════════════════════════════
-- MEMBERSHIPS & PERMISSIONS
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE memberships (
  id TEXT PRIMARY KEY,              -- mem_xxxxxxxxxxxx
  user_id TEXT NOT NULL REFERENCES users(id),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  role TEXT NOT NULL DEFAULT 'member',
  display_name TEXT,
  app_access TEXT,                  -- JSON: ["ALL"] or ["bundled:files", "guest:loan-tracker"]
  permissions TEXT,                 -- JSON: granular permission flags
  status TEXT DEFAULT 'active',
  invited_by TEXT,
  joined_via TEXT,                  -- 'direct', 'invite', 'sso', 'domain-auto-join', 'magic-link'
  joined_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, workspace_id)
);

CREATE TABLE agent_keys (
  id TEXT PRIMARY KEY,              -- ak_xxxxxxxxxxxx
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  scopes TEXT NOT NULL,             -- JSON: permission scopes
  app_access TEXT,                  -- JSON: which apps the agent can interact with
  rate_limit INTEGER DEFAULT 1000,
  created_by TEXT NOT NULL REFERENCES users(id),
  last_used_at TEXT,
  expires_at TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE groups (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  permissions TEXT,
  app_access TEXT,
  UNIQUE(workspace_id, name)
);

CREATE TABLE group_members (
  group_id TEXT NOT NULL REFERENCES groups(id),
  membership_id TEXT NOT NULL REFERENCES memberships(id),
  PRIMARY KEY (group_id, membership_id)
);

CREATE TABLE invitations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  email TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  app_access TEXT,
  invited_by TEXT NOT NULL REFERENCES users(id),
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ═══════════════════════════════════════════════════════════════
-- KNOWLEDGE GRAPH
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE knowledge (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  domain TEXT NOT NULL,
  path TEXT NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'json',
  version INTEGER DEFAULT 1,
  updated_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(workspace_id, domain, path)
);

CREATE TABLE knowledge_versions (
  id TEXT PRIMARY KEY,
  knowledge_id TEXT NOT NULL REFERENCES knowledge(id),
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  change_note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ═══════════════════════════════════════════════════════════════
-- NAVIGATION
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE nav_config (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id),
  strategy TEXT DEFAULT 'sectioned',
  config TEXT NOT NULL,             -- JSON: full nav configuration
  mobile_config TEXT,               -- JSON: mobile-specific overrides
  updated_by TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE bookmarks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  scope TEXT NOT NULL,              -- 'workspace', 'group', 'personal'
  group_id TEXT,
  user_id TEXT,                     -- membership ID for personal bookmarks
  label TEXT NOT NULL,
  icon TEXT,
  target_type TEXT NOT NULL,        -- 'app-page', 'external', 'command'
  target_app_id TEXT,
  target_path TEXT,
  target_url TEXT,
  target_command_id TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ═══════════════════════════════════════════════════════════════
-- AUDIT LOG
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  actor_type TEXT NOT NULL,         -- 'user' or 'agent'
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  app_id TEXT,
  metadata TEXT,                    -- JSON
  ip_address TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

---

## 25. Product Architecture: ensemble.ai

### The Brand Hierarchy

```
ENSEMBLE (ensemble.ai)
│
├── Ensemble Workspace              — THE product. The workspace operating layer.
│   (ensemble.ai/workspace)          What people download, what companies run on.
│                                    "We run on Ensemble Workspace" or just "Ensemble."
│
├── Ensemble App                    — The native app (macOS, iOS, Android, Windows, Linux)
│   (what you download)              Tauri v2. The premium experience with OS integration.
│
├── Ensemble Web App                — The browser-based multi-workspace shell (app.ensemble.ai)
│   (zero download)                  Same shell, no install. Connects to any workspace's API.
│
├── Ensemble Cloud                  — Managed hosting (cloud.ensemble.ai)
│   (SaaS revenue)                   Sign up → workspace in seconds. No Cloudflare account needed.
│
├── Ensemble Edge                   — Infrastructure toolkit (not customer-facing)
│   (the platform layer)             Conductor (workflow orchestration), Edgit (component versioning).
│                                    Powers the workspace under the hood. OSS for developers
│                                    who want to go deeper.
│
├── Ensemble Spec Library           — OSS application blueprints (specs.ensemble.ai)
│   (developer gravity)              Curated specs that serve as guest app starting points.
│
├── Ensemble Directory              — Workspace discovery (dir.ensemble.ai)
│   (the registry)                   Tilde address resolution. App + agent marketplace.
│
├── Ensemble Services               — Professional services
│   (consulting)                     Enterprise deployment, custom app development.
│
└── Ensemble Community              — OSS ecosystem
    (the network)                    Developer community, forums, showcase.
```

### How the Pieces Relate

```
┌─ Developer deploys ──────────────────────────────────────────┐
│                                                               │
│  Option A: Self-Hosted                                        │
│  ──────────────────                                           │
│  git clone ensemble-ai/workspace                                 │
│  ensemble init my-company                                         │
│  ensemble deploy  → deploys to Cloudflare Workers                 │
│  ensemble register ~my-company → registers in Ensemble Directory  │
│                                                               │
│  Option B: Ensemble Cloud                                     │
│  ───────────────────────                                      │
│  Visit cloud.ensemble.ai → Sign up → Create workspace         │
│  Choose ~slug → Configure brand → Invite team                 │
│  Done. Running on Ensemble's Cloudflare infrastructure.       │
│                                                               │
└───────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─ Users connect ──────────────────────────────────────────────┐
│                                                               │
│  Download Ensemble app (macOS / iOS / Android / Windows)      │
│  Open app → Type ~my-company → Connect                        │
│  Or: Open browser → my-company.ensemble.ai                    │
│  Or: Scan QR code → Auto-connect                              │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### Revenue Model

| Revenue Stream | Description | Timing |
|---|---|---|
| **Ensemble Cloud** | Managed hosting. Free tier (1 workspace, 5 members, 3 guest apps). Paid tiers for more workspaces, members, storage, and premium features. | Phase 4 |
| **Ensemble Enterprise** | Dedicated infrastructure, SLA, SSO support, priority support, compliance features. | Phase 4+ |
| **App Marketplace** | Revenue share on paid guest apps in the registry (70/30 split, developer keeps 70%). | Phase 4+ |
| **Ensemble Services** | Custom development, migration, training, enterprise onboarding. | Anytime |
| **Premium Apps** | Ensemble-built advanced apps (BI dashboard, advanced CRM, etc.) available for purchase. | Phase 3+ |

### The ensemble.ai Website

The homepage leads with Ensemble Workspace. Everything else supports it.

```
ensemble.ai/
├── /                      "Ensemble Workspace — the programmable surface of a company"
│                          Hero: screenshot of workspace, download button, "Try in browser" link
│
├── /workspace             Product deep-dive: what Ensemble Workspace is, how it works,
│                          screenshots of different branded workspaces, the AI panel,
│                          the app/agent ecosystem, the tilde address system
│
├── /download              Native app downloads (macOS, iOS, Android, Windows, Linux)
├── /pricing               Cloud pricing tiers (Free, Team, Business, Enterprise)
├── /enterprise            Enterprise sales page
│
├── /developers            Developer landing: build guest apps, build agents, build connectors
├── /developers/docs       Full documentation (workspace setup, SDK reference, manifest schema)
├── /developers/apps       App + agent marketplace / registry browser
├── /developers/specs      → redirects to specs.ensemble.ai
│
├── /blog                  Engineering blog, product updates, case studies
├── /community             Forums, showcase, developer community
├── /services              Professional services
├── /about                 Company info
│
├── /connect/~slug         Web-based workspace connect (redirects or opens in-browser)
├── /join/~slug/CODE       Invite code landing page
│
└── Subdomains:
    app.ensemble.ai        Universal web shell (multi-workspace, zero download)
    cloud.ensemble.ai      Cloud management console
    dir.ensemble.ai        Directory API (tilde address resolution)
    registry.ensemble.ai   App + agent registry API
    specs.ensemble.ai      Ensemble Spec Library (browse, search, contribute)
    docs.ensemble.ai       Developer documentation
```

---

### Naming Convention

| Context | Name Used |
|---|---|
| The product | **Ensemble Workspace** (or just **Ensemble**) |
| The downloadable app | **Ensemble** |
| The marketing page | `ensemble.ai/workspace` |
| In conversation | "We run on Ensemble" |
| The OSS engine (codename) | **AIUX** |
| In code / packages | `@ensemble-edge/core`, `@ensemble-edge/sdk`, `@ensemble-edge/ui`, `@ensemble-edge/guest`, `@ensemble-edge/cli` |
| The cloud platform | **Ensemble Cloud** |
| The infrastructure layer | **Ensemble Edge** (Conductor, Edgit — powers workspace under the hood) |
| The workspace address | `~slug` |
| The company | **Ensemble** (ensemble.ai) |
| The GitHub org | `ensemble-edge` or `ensemble-ai` |
| The spec library | **Ensemble Spec Library** (`specs.ensemble.ai`) |

When people talk about it:
- "Download Ensemble"
- "Connect to ~ownly"
- "We built that on AIUX" (developers)
- "Our company runs on Ensemble" (non-technical)

---

## 26. Roadmap

### Phase 1 — Foundation (Weeks 1-8)

**Workspace Worker (`@ensemble-edge/core`):**
- [ ] Hono Worker entry + `createWorkspace()` factory
- [ ] Middleware pipeline (auth, workspace resolver, permissions, CORS, gateway)
- [ ] Preact shell (workspace switcher, sidebar, toolbar, viewport, panel manager)
- [ ] Theme engine (CSS variables injection from brand config)
- [ ] Shell i18n: `t()` function, locale resolver, `en.json` base locale file
- [ ] API gateway with guest app proxy (service bindings + HTTP fallback)
- [ ] Extension system (middleware, route, scheduled, event-handler, auth-provider, app-hook)
- [ ] Command palette (`⌘K`)
- [ ] D1 migration system

**Core Apps (8):**
- [ ] `core:admin` — workspace settings including locale/region config (base language, timezone, date format)
- [ ] `core:brand` — brand system with locale column on brand_tokens, `?locale=` on all delivery endpoints
- [ ] `core:people`, `core:auth`, `core:knowledge`, `core:apps`, `core:audit`, `core:nav`

**Bundled Apps:**
- [ ] `bundled:dashboard`, `bundled:notifications`
- [ ] `bundled:ai-assistant` — AI panel v1: chat interface, Workers AI default, workspace context assembly, guest app tool calling via gateway, action cards, confirmation cards, navigation links
- [ ] `bundled:status` — Health dashboard: polls guest app health endpoints + declared dependencies, uptime tracking, alert configuration, optional public status page

**Identity:**
- [ ] @handle system, multi-method auth, invite flows, magic link

**Guest App SDK (`@ensemble-edge/guest`):**
- [ ] Core package: manifest types, context parsing, auth validation, theme helpers
- [ ] `@ensemble-edge/guest-cloudflare` adapter (service bindings, D1 scoped storage)
- [ ] `.well-known/ensemble-manifest.json` convention
- [ ] Manifest `category` field (connector, tool, portal, agent, utility)
- [ ] Manifest `ai.tools` field — guest apps declare AI-callable API routes
- [ ] Manifest `ai.context_prompt` — per-app context for the AI panel
- [ ] Manifest `widgets` field — guest apps contribute dashboard widgets
- [ ] Manifest `search` field — guest apps contribute command palette results
- [ ] Manifest `notifications` field — guest apps declare event types
- [ ] Manifest `activity` field — guest apps declare activity feed events
- [ ] Manifest `quick_actions` field — guest apps declare pinnable shortcuts
- [ ] Manifest `docs` field — guest apps contribute documentation pages
- [ ] Manifest `health` field — guest apps declare health endpoint + external dependencies
- [ ] Manifest `settings.admin` field — guest apps declare admin-configurable fields surfaced in core:admin
- [ ] Workspace gateway proxy for guest apps

**Shell extension point stitching:**
- [ ] Dashboard widget compositor (reads all manifests, renders widget grid, per-user layout in D1)
- [ ] Federated command palette search (parallel queries to all app search endpoints, merged results)
- [ ] Unified docs browser (stitches all app docs into navigable tree by section)
- [ ] Notification aggregator (matches events to manifest display templates, user preferences)
- [ ] Activity feed compositor (merged chronological stream from all app events)
- [ ] Quick action registry (command palette shortcuts + bookmark bar pinning with live badges)
- [ ] Health aggregator (cron-powered polling of all app health endpoints + dependencies, results to D1/KV)
- [ ] Settings compositor (reads all app settings.admin manifests, renders in core:admin, encrypted secret storage, activation gating)

**Web App (`app.ensemble.ai`):**
- [ ] Universal shell with connect screen
- [ ] Tilde resolution, workspace switching, per-workspace tokens
- [ ] Theme-swap-on-connect, SSE notifications

**SDK & Tooling:**
- [ ] `@ensemble-edge/sdk` v1 with `broadcastAIContext()` for viewport→AI panel communication
- [ ] `@ensemble-edge/ui` (20+ components)
- [ ] `@ensemble-edge/cli`: `init`, `dev`, `deploy`, `migrate`, `app create`, `app publish`, `register`, `update`

### Phase 2 — Power Features (Weeks 9-16)

**AI Panel enhancements:**
- [ ] Configurable LLM provider per workspace (Anthropic, OpenAI, Workers AI)
- [ ] Per-user daily request limits
- [ ] Conversation history (per workspace, stored in D1)
- [ ] Knowledge graph integration (AI can answer "what are our brand standards?")
- [ ] Multi-step action chains (approve + email + update in one prompt)

**Bundled Apps:**
- [ ] `bundled:files`, `bundled:activity`

**First-party connectors:**
- [ ] `@ensemble-edge/stripe` — payments, customers, invoices
- [ ] `@ensemble-edge/google-drive` — file browser, search, sharing
- [ ] `@ensemble-edge/github` — repos, issues, PRs

**Agent Protocol:**
- [ ] Agent auth, discovery endpoint, knowledge context compiler
- [ ] `@ensemble-edge/agent` SDK, OpenAPI auto-generation

**Identity & Auth:**
- [ ] Enterprise SSO (SAML, OIDC), domain auto-join, group mapping

**Guest SDK Platform Adapters:**
- [ ] `@ensemble-edge/guest-vercel`
- [ ] `@ensemble-edge/guest-node`
- [ ] `@ensemble-edge/guest-deno`
- [ ] `@ensemble-edge/guest-aws`
- [ ] `@ensemble-edge/guest-bun`

**Platform:**
- [ ] Ensemble App Registry (registry.ensemble.ai) with category browsing
- [ ] Guest app addresses (@org/app-name)
- [ ] Custom domains, workspace templates
- [ ] Real-time features (Durable Objects)
- [ ] `@ensemble-edge/ui` expansion (30+ components)

**Multilingual:**
- [ ] AI-assisted "Add language" flow in Brand Manager (translate all text tokens with one click)
- [ ] Stale translation tracking (flag translations when source changes, offer re-translate)
- [ ] Community locale contributions: `es.json`, `pt.json`, `fr.json`, `de.json`, `ja.json`
- [ ] `?locale=` parameter on all brand delivery endpoints

### Phase 3 — Ecosystem (Weeks 17-24)

### Phase 3 — Ecosystem (Weeks 17-24)

- [ ] Public/restricted app visibility
- [ ] Guest access flow (portals)
- [ ] App marketplace with developer revenue share and category browsing
- [ ] Ensemble Directory (dir.ensemble.ai)
- [ ] QR codes, workspace registration
- [ ] PWA, responsive shell, Navigation Hub mobile config
- [ ] Knowledge validation (lint apps against standards)

**Additional first-party connectors:**
- [ ] `@ensemble-edge/google-calendar`, `@ensemble-edge/slack`, `@ensemble-edge/notion`
- [ ] `@ensemble-edge/linear`, `@ensemble-edge/quickbooks`, `@ensemble-edge/hubspot`
- [ ] `@ensemble-edge/intercom`

### Phase 4 — Native + Cloud

**Ensemble Native App (Tauri v2):**
- [ ] macOS, iOS, Android, Windows, Linux
- [ ] Touch ID, menu bar, push notifications, deep links
- [ ] Background workspace management

**Ensemble Cloud:**
- [ ] Managed infrastructure, sign-up flow
- [ ] Free/Team/Business/Enterprise tiers
- [ ] Auto-upgrades for Cloud workspaces
- [ ] Workspace-level LLM billing for AI panel (usage-based for Anthropic/OpenAI)

**Ecosystem:**
- [ ] ensemble.ai website, docs, download
- [ ] Federated identity (cross-instance @handles)
- [ ] White-label option
- [ ] Partner program for guest app and connector developers
- [ ] Connector developer kit (template + docs for wrapping third-party APIs)

---

## 27. Why This Matters

Every company is becoming a software company. AI accelerates that transition. But without a unifying layer, the result is chaos — dozens of disconnected tools, each a liability.

Ensemble Workspace is the operating layer that makes it sustainable. One deploy. One auth system. One brand. One permission model. One knowledge graph. One API gateway. One tilde address. Batteries included — with core apps that handle workspace management, brand identity, navigation, security, and knowledge out of the box.

Guest apps are the new website. Guest agents are the new employee. They're the same architecture — same manifest, same SDK, same gateway, same permissions, same audit trail. The only difference is that a tool waits for clicks and an agent subscribes to events. When Linear builds `@linear/sync` and Stripe builds `@stripe/billing`, they render inside the workspace shell with the company's brand. The workspace becomes the universal shell for all business software.

The core upgrades like a dependency, not a fork. `bun update @ensemble-edge/core` and you're current. No merge conflicts. No fear. Your apps, your agents, your extensions, your knowledge — untouched.

**For developers:** `ensemble init`, configure, deploy. Build guest apps and agents on any platform with `@ensemble-edge/guest`. Publish to the registry. Start from a spec. Upgrade without merge conflicts.

**For companies:** Every tool looks professional, is secure by default, is discoverable, and is auditable. Brand management propagates everywhere. Navigation is Slack-simple — apps, agents, people, docs, all in one sidebar. Your workspace has a real address: `~ownly`.

**For agents:** An agent is just an app that acts autonomously. Same manifest, same permissions, same audit trail. One API endpoint, one auth token, every capability. Subscribe to events, take actions, report results.

**For the ecosystem:** Build a guest app once, serve every workspace. `@ensemble-edge/guest-vercel` means Vercel shops can build Ensemble apps without touching Cloudflare. The spec library provides blueprints. The platform is open.

**For users:** Download Ensemble. Type `~ownly`. You're in. Or just open `app.ensemble.ai` — zero download, same experience. Switch workspaces with one click. The brand is always right. Open the AI panel and talk to your workspace — "approve those trials, draft a recharge email, show me this week's usage." It just works. Your agents are running in the background. Everything is audited.

The intranet is dead. SaaS sprawl is dying. The snowflake era is ending. Guest apps are the new website. Guest agents are the new employee. The AI panel is the new command line. What comes next is the workspace.

---

## 28. The Ensemble Spec Library

### What It Is

The Ensemble Spec Library is a curated, open-source collection of detailed application specifications written in markdown. Each spec describes a complete, production-ready feature or application — not code, not wireframes, but a comprehensive blueprint that any developer or AI coding tool can use to build a best-of-breed implementation.

**Repository:** `github.com/ensemble-labs/specs`
**License:** MIT
**Tagline:** *Don't start from scratch. Start from a spec.*

Think of it as a pattern library, but instead of UI components, it's product specifications. A spec for a contact form doesn't give you a React component — it gives you every field, every validation rule, every error state, every edge case, every accessibility requirement, every email deliverability consideration, and every security concern. You take that spec into Claude Code, Cursor, or your own IDE and build exactly what it describes, in whatever stack you prefer.

### Why This Exists

Every developer building a contact form makes the same mistakes. Every team building a login page forgets the same edge cases. Every startup building a CRM reinvents the same data model. The specs already exist in the heads of experienced product engineers — they've just never been written down in a reusable, portable format.

**For developers:** Skip the "what should I build?" phase and jump straight to building. Every spec represents hundreds of hours of product decisions already made well.

**For AI coding tools:** Specs are the missing layer between a vague prompt ("build me a login page") and a production-quality result. Feed a spec to Claude Code or Cursor and the output is dramatically better than prompting from scratch.

**For Ensemble:** Guest apps built on top of these specs integrate naturally with the workspace shell. The specs encode Ensemble's theming system and API patterns where relevant — but they're useful standalone, even if you never touch Ensemble.

### Spec Structure

Every spec follows a consistent template:

```
---
id: contact-form
title: Contact form
category: forms
complexity: low
estimated_build_time: 2-4 hours
version: 1.2.0
ensemble_compatible: true
---

# Contact form

## Overview
## User stories
## Data model
## UI specification (layout, components, states, responsive)
## Interaction specification (flows, validation, errors, loading)
## Business logic
## API specification
## Security considerations
## Accessibility requirements
## Performance targets
## Edge cases
## Testing checklist
## Ensemble integration notes (optional)
## Changelog
```

### Spec Categories

```
specs/categories/
├── forms/          — contact form, multi-step wizard, file upload, survey builder
├── auth/           — login, signup, password reset, magic link, OAuth, MFA
├── crm/            — contact list, contact detail, deal pipeline, activity timeline
├── dashboards/     — analytics overview, metric cards, data table, chart dashboard
├── communication/  — inbox, email composer, notification center, chat thread
├── content/        — blog editor, rich text, media gallery, knowledge base
├── ecommerce/      — product catalog, cart, checkout, order history, pricing table
├── settings/       — account settings, team management, billing, API keys
├── onboarding/     — welcome flow, setup wizard, empty states, feature tour
└── utilities/      — search, command palette, file browser, calendar, kanban
```

### Complexity Tiers

| Tier | Label | Build time | Description |
|---|---|---|---|
| 1 | Low | 1–4 hours | Single-page, self-contained. Contact form, login page, pricing table. |
| 2 | Medium | 4–16 hours | Multi-view or stateful. Signup flow, data table with filters, notification center. |
| 3 | High | 2–5 days | Multi-entity, complex logic. CRM module, checkout flow, team management. |
| 4 | System | 1–2 weeks | Full application pattern. Composed of multiple lower-tier specs. Simple CRM, help desk. |

### Quality Standards

- Every user-facing state is described (not just the happy path)
- Error messages are written out verbatim — not "show an error"
- Validation rules include exact regex patterns, min/max values, format descriptions
- Responsive behavior specified for 3+ breakpoints
- Accessibility is integrated into every component (keyboard, ARIA, focus order)
- Specs make decisions — they say "do A" and explain why, not "you could do A or B"
- Security and accessibility defaults are strict (CSRF, rate limiting, WCAG AA) — relaxing is opt-out
- No framework-specific language — portable to any stack
- Colors reference semantic tokens (primary button, muted text) not hex values

### Ensemble Integration Layer

Each spec can include an optional `Ensemble integration notes` section:

**Theming** — How the spec's semantic roles map to Ensemble's design tokens:
```
Primary button → brand.accent
Card background → shell.card.bg
Muted text → shell.text.muted
```

**Shell context** — Breadcrumb label, active sidebar item, AI panel context tags.

**AI actions** — What the AI assistant should be able to do with this app:
- Can the AI prefill form fields from workspace data?
- Can the AI draft content?
- Can the AI submit on behalf of the user (with confirmation)?

These are spec-level declarations that tell the developer what integration points to build.

### Spec Variants

If a contributor disagrees with a decision in an existing spec, they propose a **variant**:

```
specs/categories/auth/
├── login-page.md              ← primary (email + password)
├── login-page.passwordless.md ← variant (magic link only)
└── login-page.enterprise.md   ← variant (SSO + SAML)
```

Variants share the same structure but make different product decisions. The primary spec is the default best practice. Variants serve specific contexts.

### Roadmap

**Phase 1 (launch):** 15–20 specs across forms, auth, dashboards, CRM, and settings.

**Phase 2:** Grow to 40–50 specs. Add e-commerce, communication, content, onboarding. Open community contributions.

**Phase 3:** System-tier specs that compose lower-tier specs into full applications (Simple CRM, Customer Portal, Admin Dashboard, E-commerce Storefront, Help Desk).

**Phase 4:** Tooling — spec linter, spec diff viewer, spec search web interface, AI prompt generator (spec + target stack → optimized prompt).

### The Spec Library's Role in the Ecosystem

The Spec Library is a flywheel for Ensemble adoption:

1. Developers discover the spec library (it's useful even without Ensemble)
2. They use specs to build apps with AI coding tools
3. They notice the Ensemble integration notes
4. They realize their app would be better as a guest app inside a workspace
5. They install `@ensemble-edge/guest`, add the manifest, and publish to the registry
6. Every workspace on the platform gets access to a higher-quality app

The specs are the gravity. Ensemble is the orbit.

---

*Ensemble — The programmable surface of a company. Built at the edge. Open by default. Batteries included. Apps run anywhere. Start from a spec. Download the app. Connect to ~yours.*