# Phase 2: Build the 8 Core Apps

**Status:** Blocked by Phase 1 (app contract)
**Goal:** Implement all 8 core apps against the contract defined in Phase 1.

---

## Build Order

Ordered by dependency and existing code to leverage:

### Wave 1: Already Have Partial UI

| App | ID | What Exists | What to Build |
|-----|-----|-------------|---------------|
| **Brand Manager** | `core:brand` | BrandTab + WorkspaceTab UI, brand token CRUD endpoints | Extract to proper app, add logo upload, preview, token history |
| **Workspace Admin** | `core:admin` | SettingsPage placeholder, workspace info endpoint | Settings UI (name, locale, timezone), danger zone (delete workspace) |

### Wave 2: Auth System Exists

| App | ID | What Exists | What to Build |
|-----|-----|-------------|---------------|
| **People & Teams** | `core:people` | PeoplePage placeholder, user/membership DB tables | Member directory, invite flow, role management, team CRUD |
| **Auth & Security** | `core:auth` | Full auth middleware, login/register routes | SSO config UI, auth policy management, session viewer |

### Wave 3: Infrastructure Exists

| App | ID | What Exists | What to Build |
|-----|-----|-------------|---------------|
| **App Manager** | `core:apps` | AppsPage + AppViewPage, guest gateway | App install/uninstall UI, settings compositor, health display |
| **Navigation Hub** | `core:nav` | `/_ensemble/nav` endpoint, sidebar rendering | Drag-drop nav builder, role-based visibility config |

### Wave 4: New Ground

| App | ID | What Exists | What to Build |
|-----|-----|-------------|---------------|
| **Audit Log** | `core:audit` | Nothing | New migration, event capture middleware, log viewer with filters |
| **Knowledge Editor** | `core:knowledge` | Empty `knowledge/` domain dir | Knowledge entry CRUD, rich editor, version history, search |

---

## Per-App Structure

Each core app follows the same pattern:

```
packages/core/src/apps/core/{app-name}/
├── manifest.ts        # CoreAppManifest metadata
├── routes.ts          # Hono API routes (registerRoutes)
├── index.ts           # Exports CoreAppDefinition
└── migrations/        # Optional D1 migrations

packages/core/src/shell/apps/core/{app-name}/
├── index.ts           # registerPage() calls
├── {App}Page.tsx      # Main page component
└── components/        # App-specific UI components
```

---

## Database Migrations Needed

| App | Migration | Tables |
|-----|-----------|--------|
| `core:people` | 003_teams.ts | `teams`, `team_members` |
| `core:audit` | 004_audit_log.ts | `audit_events` |
| `core:knowledge` | 005_knowledge.ts | `knowledge_entries`, `knowledge_versions` |
| `core:nav` | 006_nav_config.ts | `nav_configs` (per-role layouts) |

The existing tables (`users`, `memberships`, `workspaces`, `brand_tokens`, `guest_apps`) cover the other apps.

---

## Acceptance Criteria

- [ ] All 8 core apps registered via `CoreAppDefinition`
- [ ] Each app has working API routes under `/_ensemble/core/{id}/*`
- [ ] Each app has at least one page component in the shell
- [ ] Nav sections built dynamically from registered app manifests
- [ ] Brand changes propagate to shell in real-time
- [ ] Members can be invited and roles assigned
- [ ] Audit log captures workspace activity
