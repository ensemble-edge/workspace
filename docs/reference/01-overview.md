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

