# Workstream 1: Foundation

> Core infrastructure that everything else depends on.

> **⚠️ Architecture Update (March 2026):** This workstream has been significantly revised. Auth is now handled by Ensemble's edge layer (`app.ensemble.ai` + proxy), not by the workspace Worker. The shell is edge-served from R2/KV. Workspace Workers are pure JSON APIs. See [`02-shell-shift.md`](../reference/02-shell-shift.md) for the authoritative architecture.

## Scope

This workstream establishes the fundamental workspace **API** infrastructure:

- Hono Worker entry point with `createWorkspace()` factory
- Middleware pipeline (workspace resolver, request logging — **NOT auth**)
- D1 database schema and migration system
- Theme/brand API endpoints (JSON delivery — CSS injection happens at edge)
- Workspace config API (`/_ensemble/workspace`)

## Reference Specs

| Spec | Sections |
|------|----------|
| [01-overview.md](../reference/01-overview.md) | Tech stack, architecture overview |
| [06-workspace-model.md](../reference/06-workspace-model.md) | Workspace types, templates, resolution |
| [07-identity-auth.md](../reference/07-identity-auth.md) | Identity model, auth methods, sessions |
| [15-project-structure.md](../reference/15-project-structure.md) | Monorepo layout, database schema |

## Dependencies

**Blocked by:** Nothing — this is the foundation

**Blocks:**
- Workstream 2 (Shell & Navigation)
- Workstream 3 (Core Apps)
- All other workstreams

## Deliverables

### Phase 1a: Worker Infrastructure
- [ ] `@ensemble-edge/core` package structure
- [ ] `createWorkspace()` factory function
- [ ] Hono middleware pipeline
- [ ] Workspace resolution (subdomain, custom domain, path prefix)
- [ ] D1 migration runner

### Phase 1b: Auth Integration (Edge-Handled)
> **Note:** Auth is implemented in `app.ensemble.ai` and the edge proxy, NOT in the workspace Worker. This phase covers workspace-side integration only.

- [ ] Accept pre-authenticated requests with `X-Ensemble-User` headers from edge proxy
- [ ] User lookup from header-provided user ID
- [ ] Membership model (user ↔ workspace) — local D1 tables
- [ ] Auth confirmation endpoint for `app.ensemble.ai` to call on successful login

### Phase 1c: Theme Infrastructure
- [ ] CSS custom properties injection
- [ ] Brand token schema
- [ ] Theme delivery endpoints (`/_ensemble/brand/theme`, `/_ensemble/brand/css`)

## Acceptance Criteria

- [ ] Fresh workspace deployment responds to `/_ensemble/workspace` with config JSON
- [ ] Edge proxy can serve shell and route API calls to workspace Worker
- [ ] Workspace accepts pre-authenticated requests with user headers
- [ ] Workspace theme data returned via API (edge injects as CSS)
- [ ] D1 migrations run on deploy
- [ ] `ensemble init` creates working project scaffold

## Open Questions

1. **Default workspace template**: Which bundled apps enabled by default?
2. **User header format**: Exact shape of `X-Ensemble-User`, `X-Ensemble-Roles` headers?

## Estimated Effort

**2-3 weeks** for a working foundation that can boot a branded workspace with auth.
