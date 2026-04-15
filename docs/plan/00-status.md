# Project Status

**Last updated:** 2026-04-15

---

## What's Built

### Foundation (Complete)
- `createWorkspace()` + `createWorkspaceV2()` factory functions (Hono)
- Middleware pipeline: CORS, workspace resolver, bootstrap check, auth
- D1 migration system (2 migrations: initial schema + guest_apps)
- Auth system: email+password login, JWT sessions, cookie auth
- Bootstrap flow: first-time setup screen, owner account creation
- Standalone + cloud mode configs (`packages/core/src/mode/`)
- `createWorkspaceV2` handles both modes (standalone serves shell + auth, cloud is pure JSON API)

### UI System (Complete)
- `@ensemble-edge/ui` package: 28 shadcn/ui components + 4 custom ensemble components
- React 18.3.1 with `@preact/signals-react` for state management
- Tailwind CSS with dark mode, CSS variable theming
- Line variant tabs (cva + React Context)
- Alert-styled toast notifications (Sonner)

### Shell Chrome (Complete)
- SidebarProvider layout (AppSidebar + SidebarInset)
- Responsive sidebar with collapse states
- Toolbar with breadcrumbs
- Viewport with client-side routing
- Dynamic navigation from `/_ensemble/nav` endpoint
- User dropdown with logout

### Brand System (Partial)
- `/_ensemble/brand/theme` — JSON theme endpoint
- `/_ensemble/brand/css` — CSS custom properties endpoint
- `PUT /_ensemble/brand/tokens` — Save brand tokens to D1
- Brand tab + Workspace tab UI in Viewport (hardcoded, not yet a proper core app)

### Guest App Gateway (Scaffolded)
- `/_ensemble/apps/*` routes with proxy logic
- Service binding + HTTP connection types
- Role-based access, capability tokens, audit logging

### Login Page (Complete)
- Custom styled validation (no browser tooltips)
- shadcn/ui design system
- JSON form submission

---

## What's NOT Built

| Area | Notes |
|------|-------|
| **Core app contract** | No registration system — pages are hardcoded in Viewport |
| **Core apps (0 of 8)** | `apps/core/` directory is empty |
| **App routing** | Viewport has hardcoded `routes[]` array |
| **Shell extraction** | Shell lives in `core/src/shell/`, not its own package |
| **Edge proxy** | Cloud mode Worker exists, but no proxy to serve shell from R2 |
| **Command palette** | Component installed, not wired up |
| **i18n** | Not started |
| **Testing** | Only smoke test exists |
| **Bundled apps** | Not started |
| **Guest SDK** | Stubs only |
| **Connectors** | Not started |
| **Native apps** | Not started |

---

## Active Plan

See the `plan/` directory for current implementation phases:

1. [01-app-contract.md](./01-app-contract.md) — Core app contract + Viewport refactor
2. [02-core-apps.md](./02-core-apps.md) — Build the 8 core apps
3. [03-shell-extract.md](./03-shell-extract.md) — Extract shell as deployable `@ensemble-edge/shell`
4. [04-cloud-mode.md](./04-cloud-mode.md) — Edge proxy + cloud mode deployment

---

## Git History

| Commit | Description |
|--------|-------------|
| `3f521f4` | Initial commit: Ensemble Workspace engine and documentation |
| `86d880f` | feat: Complete shell rebuild with shadcn/ui components |
| `6b303b6` | fix: Replace browser native validation with custom styled validation |
