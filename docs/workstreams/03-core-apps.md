# Workstream 3: Core Apps

> The 8 essential apps that ship with every workspace and handle "operating system" concerns.

## Scope

Core apps are compiled into the Worker binary and cannot be uninstalled. They handle workspace management, identity, and platform concerns:

| App | ID | Purpose |
|-----|-----|---------|
| **Workspace Admin** | `core:admin` | General settings, locale, danger zone |
| **Brand Manager** | `core:brand` | Visual identity, messaging, brand tokens |
| **People & Teams** | `core:people` | Members, roles, teams, invites, agents |
| **Auth & Security** | `core:auth` | Auth policies, SSO, sessions, API security |
| **Knowledge Editor** | `core:knowledge` | Company knowledge graph |
| **App Manager** | `core:apps` | App registry, install/uninstall, settings |
| **Audit Log** | `core:audit` | Activity logging, compliance, export |
| **Navigation Hub** | `core:nav` | Sidebar config, bookmarks, mobile nav |

## Reference Specs

| Spec | Sections |
|------|----------|
| [03-core-apps.md](../reference/03-core-apps.md) | Full deep-dive on all 8 core apps |
| [08-knowledge-graph.md](../reference/08-knowledge-graph.md) | Knowledge domains, knowledge-agent loop |

## Dependencies

**Blocked by:**
- Workstream 1 (Foundation) — auth, database
- Workstream 2 (Shell) — viewport rendering

**Blocks:**
- Workstream 4 (Bundled Apps) — depends on People, Apps, Brand
- Workstream 5 (Guest Platform) — Apps Manager enables guest apps

## Deliverables

### Phase 3a: Admin & Brand
- [ ] `core:admin` — Workspace settings, locale/region, danger zone
- [ ] `core:brand` — Brand token schema, 4 shell controls, CSS generation
- [ ] Brand delivery endpoints: `/brand`, `/brand/context`, `/brand/tokens`, `/brand/css`

### Phase 3b: People & Auth
- [ ] `core:people` — Member directory, invite flow, role management, teams
- [ ] `core:auth` — Auth policies, SSO/SAML config, session management
- [ ] Agent key management (API keys with scopes)

### Phase 3c: Knowledge & Apps
- [ ] `core:knowledge` — Domain browser, rich editor, version history
- [ ] `core:apps` — Installed apps grid, app details, settings compositor
- [ ] Settings stitching from guest app manifests

### Phase 3d: Audit & Nav
- [ ] `core:audit` — Event stream, filters, export
- [ ] `core:nav` — Drag-drop nav builder, role-based layouts, mobile config
- [ ] Bookmark management (workspace, group, personal layers)

## Acceptance Criteria

- [ ] All 8 core apps render in viewport
- [ ] Brand changes propagate to shell immediately
- [ ] Members can be invited and roles assigned
- [ ] Knowledge entries are versioned with rollback
- [ ] Apps can be installed/uninstalled via App Manager
- [ ] Audit log captures all workspace activity
- [ ] Nav config persists and respects roles

## Open Questions

1. **Brand token history**: How many versions to retain? (Proposal: 100 versions)
2. **Audit log retention**: Default retention period? (Proposal: 90 days, configurable)
3. **Knowledge export format**: YAML, JSON, or both? (Proposal: both)

## Estimated Effort

**4-6 weeks** for all 8 core apps with full functionality.
