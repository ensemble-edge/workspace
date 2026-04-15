# Ensemble Workspace — Testing Specification

**Repo:** `workspace/`
**Test runner:** Bun (built-in test runner, Vitest-compatible API)
**Integration runtime:** Miniflare (local Cloudflare Workers simulator)
**Convention:** `*.test.ts` for unit tests, `*.integration.test.ts` for integration tests
**Location:** Tests live alongside source in each package

---

## Test Infrastructure

### Runner and Tools

| Tool | Purpose |
|---|---|
| `bun test` | Test runner for all packages |
| Miniflare | Local CF Workers runtime for integration tests (D1, KV, R2, service bindings) |
| `@cloudflare/vitest-pool-workers` | Vitest pool for running tests inside the Workers runtime |

### Commands

```bash
# Run all tests across all packages
bun test

# Run tests for a specific package
bun test --filter=@ensemble-edge/core

# Run only unit tests
bun test --pattern="*.test.ts"

# Run only integration tests
bun test --pattern="*.integration.test.ts"

# Run with coverage
bun test --coverage
```

### CI Pipeline (`.github/workflows/ci.yml`)

Runs on every PR and push to main:

1. `bun install` — install dependencies
2. `bun run lint` — ESLint across all packages
3. `bun run typecheck` — TypeScript strict mode, all packages
4. `bun test` — all unit + integration tests
5. Fail the PR if any step fails

---

## Package: `@ensemble-edge/core`

The largest test surface. Covers the workspace engine: shell rendering, middleware pipeline, gateway proxy, theme engine, i18n, manifest parsing, and all core/bundled apps.

### Unit Tests

**Middleware pipeline:**

| Test | What it verifies |
|---|---|
| Auth middleware extracts JWT from header | Bearer token parsed, validated, user injected into context |
| Auth middleware rejects expired JWT | Returns 401 with appropriate error |
| Auth middleware skips public routes | `/_ensemble/brand/tokens` passes without auth |
| Workspace resolver middleware | Resolves workspace from hostname, injects workspace config |
| Permissions middleware | Checks user role against route requirements, returns 403 on failure |
| CORS middleware | Correct headers for allowed origins, rejects disallowed |
| Rate limit middleware | Tracks request count per key, returns 429 when exceeded |
| Middleware ordering | Middleware runs in correct sequence (auth before permissions before gateway) |

**Gateway proxy:**

| Test | What it verifies |
|---|---|
| Route resolution: app path → guest app | `/app/crm/contacts` resolves to the CRM guest app |
| Route resolution: core app path | `/app/_brand` resolves to `core:brand` |
| Route resolution: bundled app path | `/app/dashboard` resolves to `bundled:dashboard` |
| Route resolution: unknown app → 404 | `/app/nonexistent` returns 404 |
| Context injection | Proxied request includes workspace, user, settings, theme, locale in headers |
| Capability token generation | Short-lived token generated per request, validated by guest app |
| Service binding detection | Uses service binding when available, falls back to HTTP |
| HTTP proxy with auth | Remote guest app receives capability token + context headers |
| Rate limiting per app | Separate rate limits per guest app per user |
| Audit log writing | Every proxied request creates an audit log entry with actor, app, action, timestamp |

**Theme engine:**

| Test | What it verifies |
|---|---|
| Token generation from brand config | Accent color → full token set (shell.sidebar.active, brand.accent.dim, etc.) |
| Base theme: Warm light | Correct background, text, border tokens for Warm + light mode |
| Base theme: Warm dark | Correct tokens for Warm + dark mode |
| Base theme: Cool light/dark | Correct tokens for Cool theme |
| Base theme: Neutral light/dark | Correct tokens for Neutral theme |
| Base theme: Midnight (dark only) | Correct tokens, light mode falls back to Neutral |
| Base theme: Stone light/dark | Correct tokens for Stone theme |
| Accent contrast validation | Too-dark accent auto-generates safe variant |
| CSS variable generation | Token set renders as valid CSS `:root` block |
| Brand CSS endpoint | `/_ensemble/brand/css` returns valid CSS with @import for fonts |
| Brand tokens endpoint | `/_ensemble/brand/tokens` returns full JSON with etag |
| Brand context endpoint | `/_ensemble/brand/context` returns compiled markdown narrative |
| Brand context with locale | `?locale=es` returns Spanish messaging tokens |
| Brand context scoping | `?for=website` excludes internal-only tokens |
| KV cache behavior | First call writes to KV, second call reads from KV, brand update busts cache |

**i18n:**

| Test | What it verifies |
|---|---|
| `t()` returns English string | `t('nav.section.apps')` → `"Apps"` |
| `t()` returns translated string | With `es.json` loaded, `t('nav.section.apps')` → `"Aplicaciones"` |
| `t()` with interpolation | `t('dashboard.greeting', { name: 'Matt' })` → `"Good morning, Matt"` |
| `t()` falls back to base language | Missing key in `es.json` → returns English |
| `t()` with missing key | Key not in any locale → returns key itself as fallback |
| Locale resolver: user pref | User preference `es` → Spanish |
| Locale resolver: browser header | No user pref, `Accept-Language: pt` → Portuguese |
| Locale resolver: workspace default | No user pref, no header → workspace base language |

**Manifest parsing:**

| Test | What it verifies |
|---|---|
| Valid manifest parses | Full manifest with all extension points parses without error |
| Minimal manifest parses | Manifest with only id, name, nav, api parses |
| Missing required fields → error | No `id` → validation error |
| Invalid category → error | `category: "invalid"` → validation error |
| Widget schema validation | Widget missing `api_route` → error |
| Search schema validation | Search missing `endpoint` → error |
| Settings.admin field types | All 9 field types validate correctly |
| AI tools schema | Tool missing `api_route` → error |
| Health endpoint schema | Health missing `endpoint` → error |
| Manifest extension point extraction | Given N manifests, correctly extracts all widgets, search endpoints, docs, notifications, activity events, quick actions, health endpoints, and admin settings |

**Navigation:**

| Test | What it verifies |
|---|---|
| Nav resolution for admin user | All sections visible including workspace admin |
| Nav resolution for member user | Workspace section hidden or filtered |
| Nav resolution with collapsed defaults | Docs section defaults to collapsed |
| App section auto-populated | Installed apps with category tool/connector appear in Apps section |
| Agent section auto-populated | Installed apps with category agent appear in Agents section |
| Docs section stitched from manifests | Docs from 3 apps merge into unified tree by section |
| Badge counts on nav items | Notification events create badges on corresponding nav items |
| People section with presence | Shows online/away/offline members |

**Brand system:**

| Test | What it verifies |
|---|---|
| Brand token CRUD | Create, read, update, delete tokens across all categories |
| Custom token group creation | Create group, add typed tokens, retrieve |
| Secret token encryption | Secret value encrypted at rest in D1, decrypted in API response |
| Brand change → KV bust | Update token → KV cache key deleted → next read from D1 |
| Brand change → knowledge graph | Messaging token update writes to knowledge graph |
| Brand change → event bus | Token update emits `brand.tokens.updated` event |
| Brand change → webhook | Configured webhook URL receives POST with changed categories |
| Stale translation tracking | Update English tagline → Spanish tagline marked is_stale |
| Token locale resolution | `?locale=es` → Spanish, `?locale=xx` → falls back to base |

### Integration Tests

Run against a full workspace Worker in Miniflare with D1, KV, R2 bindings.

| Test | What it verifies |
|---|---|
| **Full startup** | Worker starts, shell HTML serves, theme tokens injected |
| **Guest app proxy (service binding)** | Request to `/app/crm/contacts` → proxied to mock CRM Worker → response returned with audit log |
| **Guest app proxy (HTTP)** | Request to remote guest app → HTTP proxy → capability token validated → response returned |
| **Auth flow: magic link** | Request login → token stored in D1 → click link → JWT issued → session cookie set → authenticated requests work |
| **Permission enforcement** | Member cannot access admin routes. Admin can. Viewer cannot access write endpoints. |
| **Manifest install flow** | Install guest app from manifest URL → manifest cached → nav updated → widgets available → search endpoint registered |
| **Manifest uninstall flow** | Uninstall → routes removed → nav cleaned → widgets gone → scoped storage optionally purged |
| **Dashboard widget rendering** | Install 2 apps with widgets → dashboard shows all widgets → each widget calls its API route → data renders |
| **Command palette search** | Type query → federated search across 3 apps → results merged and ranked |
| **Docs stitching** | Install 2 apps with docs → unified docs tree has both → uninstall one → its docs disappear |
| **Notification aggregation** | App emits event → notification rendered with correct display template → click navigates to app |
| **Activity feed** | Multiple apps emit events → activity feed shows merged chronological stream |
| **Settings compositor** | Install app with settings.admin → fields appear in core:admin → fill required fields → app activates |
| **Activation gating** | Install app with required secret → app shows "Needs configuration" → fill secret → app becomes active |
| **Health polling** | Install app with health endpoint → status app polls → healthy response → green status |
| **Brand CSS generation** | Set brand tokens → GET /_ensemble/brand/css → valid CSS with correct variables |
| **Brand context generation** | Set brand + messaging → GET /_ensemble/brand/context → markdown with narrative descriptions |
| **Brand webhook** | Update brand token → webhook fires to configured URL with correct payload |
| **Event bus end-to-end** | Guest app emits event → notification created → activity feed updated → webhook fired |
| **AI panel tool calling** | Mock AI panel calls guest app tool via gateway → permission checked → response returned |

---

## Package: `@ensemble-edge/sdk`

### Unit Tests

| Test | What it verifies |
|---|---|
| `defineExtension()` middleware | Extension registers and runs in correct pipeline position |
| `defineExtension()` route | Extension adds custom route, callable via API |
| `defineExtension()` scheduled | Extension registers cron handler |
| `defineExtension()` event-handler | Extension subscribes to event, handler fires on emit |
| `defineExtension()` auth-provider | Extension registers custom auth provider |
| `defineExtension()` app-hook | Extension hooks into core app lifecycle |
| `broadcastAIContext()` | Broadcasts viewport state to AI panel context |
| `useAppContext()` | Returns correct workspace, user, and settings |

---

## Package: `@ensemble-edge/ui`

### Unit Tests

| Test | What it verifies |
|---|---|
| Components render without error | Every exported component renders with default props |
| Components consume theme tokens | Components use CSS variables, not hardcoded colors |
| Button variants | Primary uses brand.accent, secondary uses shell.card.bg, destructive uses error |
| Input states | Default, focused, error, disabled states render correctly |
| Table component | Renders headers, rows, sort indicators, empty state |
| Stat card | Renders label, value, delta with correct color (up=green, down=red) |
| Status pill | Renders correct color for each status (active, trial, exhausted, paused) |
| Badge component | Renders count, hides when count is 0 |
| Action card (AI panel) | Renders title, description, action buttons |
| Confirmation card | Renders with confirm/cancel buttons, fires callbacks |
| Responsive behavior | Components stack correctly below 768px breakpoint |

---

## Package: `@ensemble-edge/cli`

### Unit Tests

| Test | What it verifies |
|---|---|
| `ensemble init` scaffolds workspace | Creates worker.ts, ensemble.config.ts, package.json, wrangler.toml |
| `ensemble init` uses correct templates | Generated files match templates/ content |
| `ensemble app create` scaffolds guest app | Creates manifest.json, src/index.ts, package.json, wrangler.toml in apps/ |
| Config parsing | Reads ensemble.config.ts, validates schema, returns typed config |
| Invalid config → error | Missing required fields produce helpful error messages |

### Integration Tests

| Test | What it verifies |
|---|---|
| `ensemble init` → `ensemble dev` | Scaffold a project, start dev server, shell serves on localhost |
| `ensemble app create` → `ensemble app dev` | Scaffold a guest app, start dev, manifest serves at .well-known |

---

## Package: `@ensemble-edge/guest`

### Unit Tests

| Test | What it verifies |
|---|---|
| `defineGuestApp()` creates valid app | Returns handler that processes requests |
| Context parsing | Extracts workspace, user, settings, theme, locale from request headers |
| Auth token validation | Valid capability token → request proceeds. Expired → 401. Invalid → 401. |
| Theme helper | `context.theme.colors.accent` returns correct value from headers |
| Event emitter | `context.events.emit()` sends event to workspace event bus |
| Manifest serving | `GET /.well-known/ensemble-manifest.json` returns valid manifest |
| Manifest schema validation | Invalid manifest at startup → clear error message |
| Settings access | `context.settings` returns merged admin + internal settings |
| Locale access | `context.user.locale` returns resolved locale |
| Workspace locale | `context.workspace.locale` returns base language and supported languages |
| Health endpoint | Default health handler returns `{ status: "healthy" }` |
| Error helper | `context.error(404, 'Not found')` returns correct JSON shape |

---

## Package: `@ensemble-edge/guest-cloudflare`

### Unit Tests

| Test | What it verifies |
|---|---|
| Cloudflare adapter wraps handler | `cloudflareAdapter()` returns valid CF Worker export |
| Service binding detection | Detects when running via service binding vs HTTP |
| D1 scoped storage | `context.storage.query()` prefixes table names with app namespace |
| R2 asset serving | Static assets served from R2 with correct content types |
| Wrangler.toml bindings | Adapter reads D1, KV, R2 bindings from env |

### Integration Tests (Miniflare)

| Test | What it verifies |
|---|---|
| Guest app serves in Miniflare | Worker starts, manifest serves, API routes respond |
| Guest app with D1 | CRUD operations on scoped D1 tables work |
| Guest app with KV | Read/write to namespaced KV works |
| Service binding from workspace | Mock workspace Worker calls guest app via binding → response correct |

---

## Test Data and Mocking

### Mock Workspace Config

```typescript
export const mockWorkspaceConfig = {
  workspace: { id: 'ws_test', slug: 'test', name: 'Test Workspace' },
  brand: { accent: '#d85a30', base_theme: 'warm', logo: null, name: 'Test' },
  locale: { base_language: 'en', supported_languages: ['en', 'es'], timezone: 'America/Chicago' },
}
```

### Mock User

```typescript
export const mockAdminUser = {
  id: 'user_admin', handle: 'admin', name: 'Admin User',
  role: 'admin', email: 'admin@test.com', locale: 'en',
}

export const mockMemberUser = {
  id: 'user_member', handle: 'member', name: 'Member User',
  role: 'member', email: 'member@test.com', locale: 'en',
}

export const mockViewerUser = {
  id: 'user_viewer', handle: 'viewer', name: 'Viewer User',
  role: 'viewer', email: 'viewer@test.com', locale: 'es',
}
```

### Mock Guest App Manifest

```typescript
export const mockGuestAppManifest = {
  id: 'test-app',
  name: 'Test App',
  version: '1.0.0',
  category: 'tool',
  nav: { label: 'Test', icon: 'box', position: 'sidebar' },
  api: { backend: 'https://test-app.workers.dev', routes: [
    { method: 'GET', path: '/items', description: 'List items' },
    { method: 'POST', path: '/items', description: 'Create item' },
  ]},
  widgets: [{ id: 'test-widget', name: 'Test Widget', size: 'small', api_route: 'GET /widgets/test' }],
  search: { endpoint: 'GET /search', debounce_ms: 200, result_types: [
    { type: 'item', icon: 'box', display: '{name}', action: 'navigate', path: '/items/{id}' },
  ]},
  docs: [{ title: 'Test doc', path: '/docs/test', section: 'Testing', order: 1 }],
  notifications: [{ event: 'item.created', display: 'New item: {name}', icon: 'plus', priority: 'normal' }],
  activity: [{ event: 'item.created', template: '{actor} created {name}', icon: 'plus' }],
  quick_actions: [{ id: 'new-item', label: 'New item', icon: 'plus', action: 'navigate', path: '/items/new', pinnable: true }],
  health: { endpoint: 'GET /health', interval: 60, timeout: 5000, display_name: 'Test App' },
  settings: {
    admin: [{ group: 'Config', fields: [
      { key: 'api_key', type: 'secret', label: 'API key', required: true },
      { key: 'enabled', type: 'toggle', label: 'Enabled', default: true },
    ]}],
  },
  ai: { tools: [
    { name: 'list_items', description: 'List items', api_route: 'GET /items' },
    { name: 'create_item', description: 'Create item', api_route: 'POST /items', requires_confirmation: true },
  ], context_prompt: 'Test app manages items.' },
}
```

### Mock Guest App Worker (for integration tests)

A minimal CF Worker that implements the mock manifest's API routes, serves the manifest at `/.well-known/ensemble-manifest.json`, and validates capability tokens. Used as a service binding target in workspace integration tests.

---

## Coverage Targets

| Package | Target | Notes |
|---|---|---|
| `@ensemble-edge/core` | 80% | Gateway proxy and middleware pipeline are critical paths |
| `@ensemble-edge/sdk` | 90% | Small surface, high importance |
| `@ensemble-edge/ui` | 70% | Component rendering + theme consumption |
| `@ensemble-edge/cli` | 75% | Scaffold generation + config parsing |
| `@ensemble-edge/guest` | 90% | Small surface, public contract, must be rock solid |
| `@ensemble-edge/guest-cloudflare` | 80% | Adapter layer + storage scoping |

---

## Testing Conventions

- Tests live next to source: `src/gateway.ts` → `src/gateway.test.ts`
- Integration tests in a dedicated `__tests__/` directory per package or alongside with `.integration.test.ts` suffix
- No test should depend on network access — all external calls mocked
- Integration tests use Miniflare for CF bindings (D1, KV, R2, service bindings)
- Test data uses `test_` prefixes for identifiers
- Each test is independent — no shared mutable state between tests
- Prefer `describe` / `it` blocks with clear naming: `describe('gateway proxy') → it('routes /app/crm/* to CRM guest app')`
- Secrets in tests use obviously fake values: `sk_test_fake_12345`
- Clean up D1/KV data in `afterEach` or use ephemeral Miniflare instances