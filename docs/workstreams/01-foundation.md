# Workstream 1: Foundation

> Core infrastructure that everything else depends on.

## Scope

This workstream establishes the fundamental workspace infrastructure:

- Hono Worker entry point with `createWorkspace()` factory
- Middleware pipeline (auth, workspace resolver, permissions, CORS)
- D1 database schema and migration system
- Theme engine (CSS variables injection)
- Shell i18n system

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

### Phase 1b: Auth Infrastructure
- [ ] JWT session management (stateless + KV refresh tokens)
- [ ] Multi-method auth support (password, OAuth, magic link)
- [ ] @handle system for user identity
- [ ] Membership model (user ↔ workspace)

### Phase 1c: Theme Infrastructure
- [ ] CSS custom properties injection
- [ ] Brand token schema
- [ ] Theme delivery endpoints (`/_ensemble/brand/theme`, `/_ensemble/brand/css`)

## Acceptance Criteria

- [ ] Fresh workspace deployment boots and serves shell
- [ ] User can authenticate via email/password
- [ ] Workspace theme applies on load
- [ ] D1 migrations run on deploy
- [ ] `ensemble init` creates working project scaffold

## Open Questions

1. **Session duration**: What's the default JWT expiry? (Proposal: 15 minutes access, 7 days refresh)
2. **Password requirements**: Enforce complexity? (Proposal: Min 8 chars, no complexity rules)
3. **Default workspace template**: Which bundled apps enabled by default?

## Estimated Effort

**2-3 weeks** for a working foundation that can boot a branded workspace with auth.
