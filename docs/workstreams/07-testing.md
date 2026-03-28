# Workstream 7: Testing Infrastructure

> Comprehensive testing strategy for workspace, cloud, and guest apps.

## Scope

This workstream completes the testing infrastructure that was scaffolded:

- Vitest setup for all packages
- Miniflare for Workers integration testing
- Mock fixtures for workspace context
- CI/CD workflows
- Test utilities in `@ensemble-edge/guest/testing`

## Reference Specs

| Spec | Sections |
|------|----------|
| [17-testing.md](../reference/17-testing.md) | Full testing specification |
| [specs/ensemble/testing.md](../../../specs/categories/ensemble/testing.md) | Testing spec from spec library |

## Dependencies

**Blocked by:**
- Workstream 1 (Foundation) — need code to test
- Workstream 5 (Guest Platform) — testing helpers in SDK

**Blocks:**
- Nothing directly, but enables confidence in all other workstreams

## Current State

Testing infrastructure is **scaffolded** in both repos:

```
workspace/
├── vitest.config.ts          ✅ Created
├── packages/*/src/*.test.ts  ✅ Smoke tests created
└── .github/workflows/ci.yml  ✅ CI workflow created

cloud/
├── vitest.config.ts          ✅ Created
├── packages/*/src/*.test.ts  ✅ Smoke tests created
└── .github/workflows/ci.yml  ✅ CI workflow created
```

## Deliverables

### Phase 7a: Unit Test Coverage
- [ ] Core app unit tests (handlers, validators, transformers)
- [ ] Bundled app unit tests
- [ ] SDK utility tests
- [ ] Guest SDK adapter tests

### Phase 7b: Integration Tests (Miniflare)
- [ ] Workspace Worker integration tests
- [ ] API gateway proxy tests
- [ ] Service binding simulation
- [ ] D1 scoped storage isolation tests

### Phase 7c: Guest App Testing Utilities
- [ ] `@ensemble-edge/guest/testing` exports:
  - `createMockGateway()` — simulates workspace gateway
  - `createMockContext()` — provides `GuestAppContext`
  - `createTestToken()` — generates capability tokens
  - `mockWorkspaceConfig`, `mockMemberUser`, `mockAdminUser`

### Phase 7d: E2E Tests
- [ ] Shell renders with all zones
- [ ] Authentication flows (login, logout, refresh)
- [ ] App navigation and routing
- [ ] AI panel tool calling
- [ ] Guest app lifecycle (install, configure, uninstall)

### Phase 7e: CI/CD Hardening
- [ ] Parallel test execution
- [ ] Coverage reporting
- [ ] PR status checks
- [ ] Auto-labeling based on test results

## Testing Patterns

### Unit Testing (Vitest)
```typescript
import { describe, it, expect } from 'vitest'
import { validateManifest } from '../manifest'

describe('validateManifest', () => {
  it('rejects manifest without id', () => {
    const result = validateManifest({ name: 'My App' })
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual({
      field: 'id',
      message: 'id is required'
    })
  })
})
```

### Integration Testing (Miniflare)
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'miniflare',
    environmentOptions: {
      modules: true,
      d1Databases: ['DB'],
      kvNamespaces: ['KV'],
    },
  },
})
```

### Guest App Testing
```typescript
import { createMockGateway, mockMemberUser } from '@ensemble-edge/guest/testing'

describe('my guest app', () => {
  const gateway = createMockGateway({
    app: myApp,
    user: mockMemberUser,
  })

  it('returns orders for authenticated user', async () => {
    const response = await gateway.fetch('/api/orders')
    expect(response.status).toBe(200)
  })
})
```

## Test Categories

| Category | Location | Runner | Purpose |
|----------|----------|--------|---------|
| Unit | `*.test.ts` | Vitest | Pure functions, validators |
| Integration | `*.integration.test.ts` | Vitest + Miniflare | Workers with bindings |
| E2E | `e2e/*.test.ts` | Playwright | Full browser flows |
| Smoke | `*.test.ts` | Vitest | Basic imports work |

## Acceptance Criteria

- [ ] All packages have >80% unit test coverage
- [ ] Integration tests pass with Miniflare
- [ ] CI runs tests on every PR
- [ ] `@ensemble-edge/guest/testing` published with helpers
- [ ] Guest app developers can test locally without deploying

## Open Questions

1. **Coverage threshold**: 80% or higher? (Proposal: 80% lines, enforce on CI)
2. **E2E browser**: Playwright or Cypress? (Proposal: Playwright — better Workers support)
3. **Test database**: Fresh D1 per test or shared? (Proposal: fresh per test file)

## Estimated Effort

**2-3 weeks** to complete testing infrastructure and achieve baseline coverage.
