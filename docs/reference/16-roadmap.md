## 26. Roadmap

> **Documentation Reminder:** When completing any phase, update `/workspace/ensemble/workspace/docs/reference/18-documentation.md` to reflect what was built vs what's still planned.

### Phase 1 — Foundation (Weeks 1-8)

**Workspace Worker (`@ensemble-edge/core`):**
- [x] Hono Worker entry + `createWorkspace()` factory ✅
- [x] Middleware pipeline (auth, workspace resolver, permissions, CORS, bootstrap) ✅
- [x] Preact shell (workspace switcher, sidebar, toolbar, viewport, AI panel, bookmark bar) ✅
- [x] Theme engine (CSS variables injection from brand config) ✅
- [x] D1 migration system ✅
- [x] Bootstrap flow (first-time setup, owner creation) ✅
- [x] Auth system (login, logout, register, refresh, me) ✅
- [ ] Shell i18n: `t()` function, locale resolver, `en.json` base locale file
- [ ] API gateway with guest app proxy (service bindings + HTTP fallback)
- [ ] Extension system (middleware, route, scheduled, event-handler, auth-provider, app-hook)
- [ ] Command palette (`⌘K`)

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

