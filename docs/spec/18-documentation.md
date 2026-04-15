# @ensemble-edge/core — Documentation Notes

**Status:** Living document for building official docs later
**Last updated:** 2026-03-28

This file captures implementation details, API contracts, and architectural decisions for the `@ensemble-edge/core` package. Use this as source material when writing user-facing documentation.

---

## Workstream Reminder

**IMPORTANT:** When completing any workstream or implementation phase, update this document:

1. Mark completed sections from ⬜ to ✅ in the outline
2. Fill in the actual implementation details
3. Update the "Last updated" date
4. Add any new tables, routes, or APIs that were created
5. Note any deviations from the original plan

This keeps documentation accurate and reduces drift between code and docs.

---

## Document outline

This is the full map of what this document will cover. Sections marked ✅ have content below. Sections marked ⬜ are stubs to fill in as we build.

```
1.  Package overview                                    ✅
2.  Core concepts                                       ✅ (partial)
    2.1  Workspace                                      ✅
    2.2  Bootstrap flow                                 ✅
    2.3  Middleware pipeline                             ✅
    2.4  The thin Worker principle                       ⬜
    2.5  Core apps vs bundled apps vs guest apps         ⬜
    2.6  Everything is the manifest                      ⬜
3.  Configuration                                       ✅
    3.1  WorkspaceConfig (ensemble.config.ts)            ✅
    3.2  Environment bindings (wrangler.toml)            ✅
    3.3  Worker entry point (worker.ts)                  ⬜
    3.4  Extension registration                         ⬜
4.  Database                                            ✅ (partial)
    4.1  Schema overview + tables                       ✅
    4.2  Key fields reference                           ✅
    4.3  Migration system                               ⬜
    4.4  Seed data patterns                             ⬜
    4.5  D1 query patterns + performance notes          ⬜
5.  Authentication                                      ✅
    5.1  Password hashing (PBKDF2)                      ✅
    5.2  JWT tokens (access + refresh)                  ✅
    5.3  Cookies                                        ✅
    5.4  Magic link flow                                ⬜ (Phase 2)
    5.5  SSO / OIDC / SAML                              ⬜ (Phase 3)
    5.6  Invite flow                                    ⬜
    5.7  Password reset flow                            ⬜
    5.8  Rate limiting                                  ⬜
    5.9  Session blacklisting                           ⬜
6.  API routes                                          ✅ (partial)
    6.1  Public routes                                  ✅
    6.2  Auth routes                                    ✅
    6.3  Brand routes                                   ⬜
    6.4  Navigation routes                              ⬜
    6.5  People routes                                  ⬜
    6.6  Admin routes                                   ⬜
    6.7  Knowledge routes                               ⬜
    6.8  Audit log routes                               ⬜
    6.9  Guest app proxy (gateway)                      ⬜
    6.10 Request/response examples                      ✅ (partial)
    6.11 Error response format                          ⬜
7.  Middleware                                          ✅ (partial)
    7.1  auth()                                         ✅
    7.2  requireRole()                                  ✅
    7.3  requirePermission()                            ✅
    7.4  cors()                                         ⬜
    7.5  bootstrapCheck()                               ⬜
    7.6  workspaceResolver()                            ⬜
    7.7  Custom middleware via extensions                ⬜
8.  Shell SPA                                           ✅ (partial)
    8.1  Architecture (6 zones)                         ✅
    8.2  State signals                                  ✅
    8.3  Actions                                        ✅
    8.4  Mounting                                       ✅
    8.5  Client-side routing                            ⬜
    8.6  Shell i18n (t() function, locale files)        ⬜
    8.7  Viewport rendering + guest app loading         ⬜
    8.8  AI panel (placeholder → full)                  ⬜
    8.9  Command palette (⌘K)                           ⬜
    8.10 Workspace switcher                             ⬜
    8.11 Bookmark bar                                   ⬜
9.  Theme system                                        ✅
    9.1  CSS variables                                  ✅
    9.2  Theme JSON structure                           ✅
    9.3  Base themes (Warm/Cool/Neutral/Midnight/Stone) ⬜
    9.4  Dark mode toggling                             ⬜
    9.5  Accent color contrast validation               ⬜
    9.6  Theme caching (KV)                             ⬜
10. Brand system                                        ⬜
    10.1 Brand tokens table + CRUD                      ⬜
    10.2 Built-in categories (colors, typography, logos,
         messaging, tone, identity, spatial)             ⬜
    10.3 Custom token groups                            ⬜
    10.4 Delivery endpoints (theme, tokens, css, context,
         page)                                          ⬜
    10.5 Machine brand context (for claude.md / AI)     ⬜
    10.6 Visual brand page (~acme/brand)                ⬜
    10.7 Generated CSS endpoint                         ⬜
    10.8 Webhooks on token change                       ⬜
    10.9 Multilingual brand tokens (locale column)      ⬜
    10.10 Knowledge Graph integration                   ⬜
11. Navigation                                          ⬜
    11.1 Sidebar sections (Apps, Agents, People, Docs,
         Quick Links, Workspace)                        ⬜
    11.2 Nav config schema                              ⬜
    11.3 Role-based visibility                          ⬜
    11.4 GET /_ensemble/nav endpoint                    ⬜
    11.5 Navigation Hub core app                        ⬜
12. Core apps                                           ⬜
    12.1 Admin (workspace settings, locale, app settings
         compositor)                                    ⬜
    12.2 Brand Manager (see §10)                        ⬜
    12.3 People & Teams                                 ⬜
    12.4 Auth (see §5)                                  ⬜
    12.5 Knowledge Graph                                ⬜
    12.6 App Manager                                    ⬜
    12.7 Audit Log                                      ⬜
    12.8 Navigation Hub (see §11)                       ⬜
13. Bundled apps                                        ⬜
    13.1 Dashboard (widget grid, manifest stitching)    ⬜
    13.2 AI Assistant (panel, tool calling, LLM config) ⬜
    13.3 Files (R2 storage)                             ⬜
    13.4 Notifications (aggregated from manifests)      ⬜
    13.5 Activity Feed (merged event stream)            ⬜
    13.6 Status (health polling, uptime)                ⬜
14. API Gateway                                         ⬜
    14.1 Guest app proxy (service binding + HTTP)       ⬜
    14.2 Capability token minting                       ⬜
    14.3 Context injection (headers)                    ⬜
    14.4 Audit logging per request                      ⬜
    14.5 Rate limiting (per user, per app)              ⬜
    14.6 Service binding detection + fallback           ⬜
15. Guest app manifest                                  ⬜
    15.1 Manifest schema (full reference)               ⬜
    15.2 Categories (connector, tool, portal, agent,
         utility)                                       ⬜
    15.3 Extension points overview                      ⬜
    15.4 widgets                                        ⬜
    15.5 search                                         ⬜
    15.6 docs                                           ⬜
    15.7 notifications                                  ⬜
    15.8 activity                                       ⬜
    15.9 quick_actions                                  ⬜
    15.10 health                                        ⬜
    15.11 settings.admin                                ⬜
    15.12 ai.tools + ai.context_prompt                  ⬜
    15.13 Manifest validation                           ⬜
    15.14 .well-known/ensemble-manifest.json convention ⬜
16. Extension system                                    ⬜
    16.1 defineExtension() API                          ⬜
    16.2 Extension types: middleware, route, scheduled,
         event-handler, auth-provider, app-hook         ⬜
    16.3 Extension registration in worker.ts            ⬜
    16.4 Extension lifecycle                            ⬜
17. Event bus                                           ⬜
    17.1 Emit / subscribe patterns                      ⬜
    17.2 Built-in events (brand.updated, app.installed,
         user.created, etc.)                            ⬜
    17.3 Guest app events                               ⬜
    17.4 Agent event subscriptions                      ⬜
18. Caching strategy                                    ⬜
    18.1 KV: theme, nav, session, membership            ⬜
    18.2 Cache API: permission checks, gateway responses ⬜
    18.3 R2 + CDN: static assets                        ⬜
    18.4 Cache invalidation patterns                    ⬜
    18.5 Durable Objects: real-time state               ⬜
19. Role & permission model                             ✅ (partial)
    19.1 Role hierarchy                                 ✅
    19.2 Permission strings                             ⬜
    19.3 Role-to-permission mapping                     ⬜
    19.4 Guest app permission declarations              ⬜
    19.5 Install-time permission grant                  ⬜
20. Security                                            ✅ (partial)
    20.1 Overview                                       ✅
    20.2 Capability tokens for guest apps               ⬜
    20.3 Scoped storage isolation                       ⬜
    20.4 iframe sandboxing (remote guest apps)          ⬜
    20.5 CORS configuration                             ⬜
    20.6 Input validation / XSS prevention              ⬜
    20.7 Rate limiting implementation                   ⬜
    20.8 Audit trail completeness                       ⬜
21. Files reference                                     ✅
22. Testing                                             ✅ (partial)
    22.1 Running tests                                  ✅
    22.2 Mock environment                               ✅
    22.3 Integration test patterns (Miniflare)          ⬜
    22.4 Testing guest app proxy                        ⬜
    22.5 Testing auth flows end-to-end                  ⬜
23. Deployment                                          ⬜
    23.1 wrangler deploy                                ⬜
    23.2 D1 migration in production                     ⬜
    23.3 Seed data for production                       ⬜
    23.4 Custom domain configuration                    ⬜
    23.5 Secrets management                             ⬜
    23.6 Monitoring + logging                           ⬜
24. Upgrade path                                        ⬜
    24.1 bun update @ensemble-edge/core                 ⬜
    24.2 Migration runner on upgrade                    ⬜
    24.3 What developers own vs what Ensemble owns      ⬜
    24.4 Breaking change policy                         ⬜
25. Future work                                         ✅
```

---

## 1. Package overview

**Package:** `@ensemble-edge/core`
**Purpose:** Ensemble Workspace engine — shell, gateway, and services
**Runtime:** Cloudflare Workers (edge)
**Dependencies:** Hono, jose, Preact, @preact/signals

```typescript
import { createWorkspace } from '@ensemble-edge/core';

export default createWorkspace({
  workspace: { name: 'Acme', slug: 'acme' },
  brand: { accent: '#3B82F6' },
});
```

---

## 2. Core concepts

### 2.1 Workspace

A workspace is a self-contained tenant deployed as a Cloudflare Worker. Each workspace has:
- Its own D1 database (SQLite)
- Its own KV namespace (cache, sessions)
- Its own R2 bucket (assets, uploads)
- Its own brand identity (colors, typography, logo)
- Its own users and roles

### 2.2 Bootstrap flow

Fresh workspaces have no users. The bootstrap flow handles first-time setup:

1. Any request → `bootstrapCheck` middleware runs
2. If `COUNT(*) FROM users = 0` → redirect to `/_ensemble/bootstrap`
3. Setup form collects: workspace name, owner name, email, handle, password
4. On submit: creates workspace, user (owner), membership, brand tokens, nav config
5. Sets JWT cookies, redirects to `/` — owner sees the shell

After bootstrap, the KV flag `ensemble:bootstrap_complete` skips the DB check.

### 2.3 Middleware pipeline

Order matters. The pipeline runs on every request:

```
1. cors              — CORS headers for cross-origin API calls
2. migrations        — Run D1 migrations if needed (first request)
3. bootstrapCheck    — Redirect to setup if no users exist
4. workspaceResolver — Attach workspace to context from hostname/path
5. auth (API only)   — Validate JWT, attach user to context
6. permissions       — Check role-based access
```

### 2.4 The thin Worker principle

⬜ *Document: the workspace Worker is thin — only @ensemble-edge/core (shell, core apps, bundled apps, gateway). Guest apps are always separate Workers. Even your own apps are separate deployments. The gateway proxies to them via service bindings (0ms) or HTTP.*

### 2.5 Core apps vs bundled apps vs guest apps

⬜ *Document: the three-tier app architecture. Core = operating system (compiled in, always on). Bundled = optional features (compiled in, toggleable). Guest = separate services (your apps, community apps, connectors, agents). Same manifest, same SDK, different deployment.*

### 2.6 Everything is the manifest

⬜ *Document: the manifest is the contract. Guest apps declare what they contribute — widgets, search, docs, notifications, activity, quick actions, health, settings, AI tools. The shell reads all manifests and stitches them together. No app knows about any other app.*

---

## 3. Configuration

### 3.1 WorkspaceConfig

```typescript
interface WorkspaceConfig {
  workspace: {
    name: string;           // Display name
    slug: string;           // URL slug (subdomain or path)
    type?: 'organization' | 'personal' | 'team';
  };
  brand?: {
    accent?: string;        // Primary accent color (hex)
    baseTheme?: 'warm' | 'cool' | 'neutral' | 'midnight' | 'stone';
    name?: string;          // Brand name (defaults to workspace name)
  };
  locale?: {
    baseLanguage?: string;  // Default: 'en'
    supportedLanguages?: string[];
    timezone?: string;      // Default: 'UTC'
    dateFormat?: 'us' | 'eu' | 'iso';
    numberFormat?: 'us' | 'eu';
  };
  auth?: {
    providers?: ('email' | 'google' | 'github' | 'microsoft' | 'saml')[];
  };
  cors?: {
    brandOrigins?: string[]; // Additional allowed origins
  };
}
```

### 3.2 Environment bindings (wrangler.toml)

```toml
[[d1_databases]]
binding = "DB"
database_name = "workspace-db"
database_id = "..."

[[kv_namespaces]]
binding = "KV"
id = "..."

[[r2_buckets]]
binding = "R2"
bucket_name = "workspace-assets"

[vars]
ENVIRONMENT = "production"

# Secrets (via `wrangler secret put`)
# JWT_SECRET = "..."
```

### 3.3 Worker entry point (worker.ts)

⬜ *Document: the ~20 line entry point. Import createWorkspace, import config, optionally import extensions. Export default app. This file rarely changes.*

### 3.4 Extension registration

⬜ *Document: how to register middleware, routes, scheduled tasks, event handlers, auth providers, and app hooks via the extensions array in createWorkspace().*

---

## 4. Database

### 4.1 Schema overview

| Table | Purpose | Status |
|-------|---------|--------|
| `workspaces` | Workspace identity and settings | ✅ Built |
| `users` | User accounts (email, password hash, handle) | ✅ Built |
| `memberships` | User ↔ Workspace with role | ✅ Built |
| `sessions` | Refresh token tracking | ✅ Built |
| `brand_tokens` | Theme values (colors, typography, identity) | ✅ Built |
| `nav_config` | Sidebar navigation structure | ✅ Built |
| `audit_log` | Action history for compliance | ✅ Built |
| `installed_apps` | Guest apps installed in workspace | ✅ Built |
| `_migrations` | Migration tracking | ✅ Built |
| `brand_token_groups` | Custom brand token groups | ⬜ Phase 2 |
| `magic_tokens` | Magic link tokens | ⬜ Phase 2 |
| `invite_tokens` | User invite tokens | ⬜ Phase 2 |

### 4.2 Key fields

**users:**
- `id` TEXT PRIMARY KEY (format: `user_xxxx`)
- `email` TEXT UNIQUE NOT NULL
- `password_hash` TEXT (PBKDF2, 100k iterations)
- `handle` TEXT UNIQUE (3-30 chars, lowercase, alphanumeric + hyphens)
- `display_name` TEXT
- `avatar_url` TEXT
- `locale` TEXT DEFAULT 'en'
- `created_at` TEXT (ISO datetime)

**memberships:**
- `user_id` + `workspace_id` = composite primary key
- `role` TEXT: 'owner' | 'admin' | 'member' | 'viewer' | 'guest'
- `created_at` TEXT (ISO datetime)

**brand_tokens:**
- `workspace_id` + `category` + `key` + `locale` = composite key
- `category`: 'colors' | 'typography' | 'identity' | 'spatial' | 'messaging' | 'custom'
- `type`: 'color' | 'text' | 'number' | 'url' | 'font'
- `locale`: NULL = base language, 'es' = Spanish, etc.
- `is_stale`: INTEGER (1 when source language changed after this translation)
- `sort_order`: INTEGER (for UI ordering)
- `description`: TEXT (optional help text)

**Note:** Additional types (`secret`, `rich_text`, `image`) and categories (`tone`, `custom:{group_slug}`) are planned for Phase 2.

### 4.3 Migration system

Migrations are TypeScript files in `src/db/migrations/` that export a `Migration` object:

```typescript
// src/db/migrations/001_initial.ts
import type { Migration } from '../migrate';

export const migration: Migration = {
  name: '001_initial',
  sql: `CREATE TABLE IF NOT EXISTS ...`,
};
```

**How it works:**
1. On first request, the migrations middleware checks `_migrations` table
2. Any migrations not in `_migrations` are executed in order
3. Each migration's `name` is recorded in `_migrations` with `applied_at` timestamp
4. Subsequent requests skip already-applied migrations

The migration runner uses `db.exec()` for DDL statements (CREATE, ALTER) and ensures idempotency with `IF NOT EXISTS`.

### 4.4 Seed data patterns

⬜ *Document: how to seed data — via bootstrap (creates workspace + owner), via migration SQL files (for dev/test), via the CLI (ensemble seed).*

### 4.5 D1 query patterns

⬜ *Document: D1 usage patterns, parameter binding, transaction usage, performance considerations (D1 is SQLite — no JOINs across Workers, no concurrent writes).*

---

## 5. Authentication

### 5.1 Password hashing

- **Algorithm:** PBKDF2-SHA256 via Web Crypto API
- **Iterations:** 100,000 (OWASP recommended minimum)
- **Salt:** 16 bytes (128 bits), cryptographically random
- **Hash:** 32 bytes (256 bits)
- **Format:** `$pbkdf2-sha256$iterations$salt$hash` (base64url encoded)

```typescript
import { hashPassword, verifyPassword } from '@ensemble-edge/core';

const hash = await hashPassword('mysecretpassword');
const valid = await verifyPassword('mysecretpassword', hash);
```

### 5.2 JWT tokens

- **Library:** jose (pure JS, Workers-compatible)
- **Algorithm:** HS256 (HMAC-SHA256)
- **Access token:** 15-minute expiry, contains user ID, workspace ID, role
- **Refresh token:** 7-day expiry, contains session ID only

```typescript
interface JWTPayload {
  sub: string;        // User ID
  wid: string;        // Workspace ID
  email: string;
  handle: string | null;
  role: Role;
  iat: number;
  exp: number;
}
```

### 5.3 Cookies

| Cookie | Purpose | Options |
|--------|---------|---------|
| `ensemble_access` | Access JWT | httpOnly, Secure, SameSite=Lax, 15min |
| `ensemble_refresh` | Refresh JWT | httpOnly, Secure, SameSite=Lax, path=/_ensemble/auth, 7days |
| `ensemble_workspace` | Last workspace | NOT httpOnly (JS readable), 30days |

### 5.4 Magic link flow

⬜ *Phase 2. Document: email entry → token generated + hashed in D1 → email sent via Resend → user clicks → token validated → JWT set. Token: single-use, IP-bound, 15-minute expiry. Rate limit: 3 per email per 15 minutes.*

### 5.5 SSO / OIDC / SAML

⬜ *Phase 3. Document: Google Workspace, generic OIDC, SAML. Domain auto-join. Group-to-role mapping. Registered via auth-provider extensions.*

### 5.6 Invite flow

⬜ *Document: admin invites by email → invite token created → email sent → invitee clicks → set password (Phase 1) or magic link (Phase 2) → account created with invited role.*

### 5.7 Password reset flow

⬜ *Document: similar to magic link — request reset → token emailed → click → new password form → hash updated.*

### 5.8 Rate limiting

⬜ *Document: KV-based counters. Login: 5 attempts per email per 15 min. Magic link: 3 requests per email per 15 min. Bootstrap: 3 attempts per IP per 15 min.*

### 5.9 Session blacklisting

⬜ *Document: on logout, optionally store token ID in KV with TTL = remaining token lifetime. Auth middleware checks blacklist before accepting token.*

---

## 6. API routes

### 6.1 Public routes (no auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check, returns `{ status: 'ok' }` |
| GET | `/` | Shell HTML (SPA entry point) |
| GET | `/login` | Login page (themed) |
| GET | `/_ensemble/bootstrap` | Setup form (only when zero users) |
| POST | `/_ensemble/bootstrap` | Create workspace + owner |
| GET | `/_ensemble/brand/theme` | Theme as JSON |
| GET | `/_ensemble/brand/css` | Theme as CSS variables |
| GET | `/_ensemble/workspace` | Workspace info |

### 6.2 Auth routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/_ensemble/auth/login` | No | Email + password login |
| POST | `/_ensemble/auth/logout` | Yes | Clear session |
| POST | `/_ensemble/auth/register` | No | Create new account |
| POST | `/_ensemble/auth/refresh` | Cookie | Refresh access token |
| GET | `/_ensemble/auth/me` | Yes | Current user + membership |

### 6.3 Brand routes

⬜ *Document: GET /_ensemble/brand/tokens, GET /_ensemble/brand/tokens/{category}, GET /_ensemble/brand/context, GET /_ensemble/brand/css, GET /_ensemble/brand/assets/{filename}, PUT /_ensemble/brand/tokens, POST /_ensemble/brand/assets, POST /_ensemble/brand/groups, POST /_ensemble/brand/webhooks*

### 6.4 Navigation routes

⬜ *Document: GET /_ensemble/nav (role-filtered), GET /_ensemble/nav/config (admin), PUT /_ensemble/nav/config (admin), GET /_ensemble/nav/bookmarks, POST /_ensemble/nav/bookmarks*

### 6.5 People routes

⬜ *Document: GET /_ensemble/people, GET /_ensemble/people/:id, PATCH /_ensemble/people/me, POST /_ensemble/people/invite*

### 6.6 Admin routes

⬜ *Document: GET /_ensemble/admin/settings, PATCH /_ensemble/admin/settings, GET /_ensemble/admin/apps, GET /_ensemble/admin/apps/:id/settings, PUT /_ensemble/admin/apps/:id/settings, POST /_ensemble/admin/languages*

### 6.7 Knowledge routes

⬜ *Document: GET /_ensemble/knowledge, GET /_ensemble/knowledge/{path}, PUT /_ensemble/knowledge/{path}, GET /_ensemble/knowledge/search?q=*

### 6.8 Audit log routes

⬜ *Document: GET /_ensemble/audit (paginated, filterable by actor, app, action, date range)*

### 6.9 Guest app proxy (gateway)

⬜ *Document: ALL /app/:app_id/* — resolves app, checks permissions, mints capability token, proxies via service binding or HTTP, logs to audit*

### 6.10 Request/response examples

**Login:**
```http
POST /_ensemble/auth/login
Content-Type: application/json

{ "email": "user@example.com", "password": "secret123" }
```

```json
{
  "user": { "id": "user_...", "email": "user@example.com", "handle": "jdoe" },
  "membership": { "role": "member", "workspaceId": "ws_..." }
}
```

**Bootstrap:**
```http
POST /_ensemble/bootstrap
Content-Type: application/x-www-form-urlencoded

workspaceName=Acme&displayName=John&email=john@acme.com&handle=john&password=secret&confirmPassword=secret
```

### 6.11 Error response format

⬜ *Document: standard error shape — { error: string, message: string, status: number }. Every API error follows this. Include examples for 400, 401, 403, 404, 409, 429, 500.*

---

## 7. Middleware

### 7.1 auth()

Validates JWT and attaches user to context.

```typescript
import { auth, requireRole } from '@ensemble-edge/core';

app.use('/_ensemble/admin/*', auth());
app.use('/_ensemble/public/*', auth({ required: false }));
```

### 7.2 requireRole(minimumRole)

Checks user has sufficient role. Hierarchy: owner > admin > member > viewer > guest.

```typescript
app.use('/_ensemble/admin/*', auth(), requireRole('admin'));
```

### 7.3 requirePermission(permission)

Checks specific permission.

```typescript
app.post('/users', auth(), requirePermission('users:write'), handler);
```

### 7.4 cors()

⬜ *Document: CORS configuration — allowed origins from config, brand endpoint origins (public), guest app origins. Preflight handling.*

### 7.5 bootstrapCheck()

⬜ *Document: checks user count, redirects to setup if zero, uses KV flag after first bootstrap to skip DB query.*

### 7.6 workspaceResolver()

⬜ *Document: resolves workspace from hostname or path, attaches workspace config to Hono context.*

### 7.7 Custom middleware via extensions

⬜ *Document: defineExtension({ type: 'middleware' }) with position (before-auth, after-auth, before-route).*

---

## 8. Shell SPA

### 8.1 Architecture (6 zones)

```
┌────────┬──────────┬─────────────────────────┬──────────┐
│        │          │       Toolbar (44px)    │          │
│   WS   │ Sidebar  ├─────────────────────────┤ AI Panel │
│ Strip  │ (220px)  │                         │ (340px)  │
│ (52px) │          │       Viewport          │          │
│        │          │                         │          │
├────────┴──────────┴─────────────────────────┴──────────┤
│                  Bookmark Bar (34px)                    │
└─────────────────────────────────────────────────────────┘
```

### 8.2 State signals

| Signal | Type | Description |
|--------|------|-------------|
| `workspace` | `Workspace \| null` | Current workspace data |
| `user` | `User \| null` | Authenticated user |
| `membership` | `Membership \| null` | User's role in workspace |
| `theme` | `Theme \| null` | Current theme config |
| `currentPath` | `string` | Current route path |
| `aiPanelOpen` | `boolean` | AI panel visibility |
| `sidebarCollapsed` | `boolean` | Sidebar collapsed state |
| `darkMode` | `boolean` | Dark mode preference |

### 8.3 Actions

```typescript
import {
  login, logout, register,
  navigate, toggleAIPanel, toggleSidebar, toggleDarkMode,
  fetchWorkspace, fetchUser, fetchTheme, fetchNav
} from '@ensemble-edge/core/shell';

await login('user@example.com', 'password');
navigate('/settings');
toggleAIPanel();
toggleSidebar();
```

### 8.4 Mounting

```typescript
import { mountShell, unmountShell } from '@ensemble-edge/core';

mountShell();
mountShell('#my-container');
unmountShell();
```

### 8.5 Client-side routing

⬜ *Document: URL-based routing, history API, how sidebar clicks update the viewport without full page reload, deep linking to /app/:id/path.*

### 8.6 Shell i18n

⬜ *Document: t() function, locale resolver (user pref → browser → workspace default), locale JSON files, how to add a new language.*

### 8.7 Viewport rendering + guest app loading

⬜ *Document: how the viewport loads guest app content — same-zone apps render inline, remote apps in sandboxed iframe. Theme token injection via postMessage for iframes.*

### 8.8 AI panel

⬜ *Document: placeholder state (hello world) → full implementation. Chat interface, tool calling via gateway, action cards, confirmation cards, navigation links, context tags, LLM configuration hierarchy (Workers AI → workspace config → guest app tools).*

### 8.9 Command palette (⌘K)

⬜ *Document: keyboard shortcut, federated search across all app search endpoints, quick actions from manifests, workspace switching, navigation.*

### 8.10 Workspace switcher

⬜ *Document: left strip (52px, always dark), workspace icons, active indicator, notification badges, add button. In hello world: visual only (single workspace).*

### 8.11 Bookmark bar

⬜ *Document: bottom bar (34px), quick action pins from manifests, external link bookmarks, add button.*

---

## 9. Theme system

### 9.1 CSS variables

```css
:root {
  --color-accent: #3B82F6;
  --color-primary: #1a1a2e;
  --color-surface: #ffffff;
  --color-background: #fafafa;
  --color-foreground: #000000;
  --color-muted: #6b7280;
  --color-border: #e5e7eb;
  --font-heading: 'Inter', sans-serif;
  --font-body: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --radius: 8px;
}
```

### 9.2 Theme JSON structure

```typescript
interface Theme {
  colors: {
    accent: string;
    primary: string;
    surface: string;
    background: string;
    foreground: string;
    muted: string;
    border: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    monoFont: string;
  };
  spatial: {
    radius: string;
    density: 'compact' | 'normal' | 'comfortable';
  };
  identity: {
    name: string;
    logoUrl: string | null;
    faviconUrl: string | null;
  };
}
```

### 9.3 Base themes

⬜ *Document: the 5 base themes — Warm, Cool, Neutral, Midnight, Stone. Each with light and dark variants. Full token derivation from base theme + accent color.*

### 9.4 Dark mode

⬜ *Document: user-level preference (not workspace-level). System → manual toggle. Everything switches together. Derived from base theme.*

### 9.5 Accent color contrast validation

⬜ *Document: auto-generates safe variant if accent is too dark/saturated for use on colored surfaces. WCAG contrast checking.*

### 9.6 Theme caching

⬜ *Document: theme tokens cached in KV. Cache busted on brand update. Shell reads from KV (<1ms) on every page load.*

---

## 10–25. Remaining sections

⬜ *See outline above. Fill in as features are built.*

---

## 19. Role & permission model

### 19.1 Role hierarchy

| Role | Level | Capabilities |
|------|-------|--------------|
| `owner` | 5 | Full control, can delete workspace |
| `admin` | 4 | Manage users, brand, settings |
| `member` | 3 | Standard access, read/write data |
| `viewer` | 2 | Read-only access |
| `guest` | 1 | Limited access (public brand only) |

### 19.2–19.5

⬜ *See outline above.*

---

## 20. Security

### 20.1 Overview

| Concern | Implementation |
|---------|----------------|
| Password storage | PBKDF2 hash (100k iterations), never plaintext |
| JWT secret | Worker secret (`JWT_SECRET`), never in code |
| Cookies | httpOnly, Secure, SameSite=Lax |
| Bootstrap exposure | Only accessible when zero users |
| Race conditions | D1 transactions, unique constraints |
| Timing attacks | Constant-time password comparison |
| XSS | HTML escaping in all rendered content |

### 20.2–20.8

⬜ *See outline above.*

---

## 21. Files reference

```
packages/core/src/
├── create-workspace.ts    # Main factory function
├── types.ts               # All TypeScript types
├── index.ts               # Package exports
├── middleware/
│   ├── cors.ts            # CORS headers
│   ├── bootstrap.ts       # Bootstrap check
│   ├── workspace-resolver.ts  # Resolve workspace from request
│   └── auth.ts            # JWT validation, role checks
├── routes/
│   ├── auth.ts            # Login, logout, register, refresh, me
│   └── bootstrap.ts       # Setup form and handler
├── services/
│   └── auth.ts            # AuthService class
├── utils/
│   ├── jwt.ts             # JWT sign/verify
│   ├── password.ts        # PBKDF2 hash/verify
│   └── cookies.ts         # Cookie helpers
├── db/
│   ├── migrate.ts         # Migration runner
│   └── migrations/        # SQL migrations
└── shell/
    ├── index.tsx          # Shell entry point
    ├── state/             # Preact Signals
    └── components/        # Shell UI components
```

---

## 22. Testing

### 22.1 Running tests

```bash
cd workspace/packages/core
npm run build
npx bun test
```

### 22.2 Mock environment

```typescript
function createMockEnv(userCount: number = 1) {
  return {
    DB: createMockD1(userCount),
    KV: createMockKV(),
    R2: {},
    JWT_SECRET: 'test-secret',
  };
}
```

### 22.3–22.5

⬜ *See outline above.*

---

## 25. Future work (not yet implemented)

- [ ] Magic link authentication (Phase 2)
- [ ] SSO providers (Google, OIDC, SAML) (Phase 3)
- [ ] Invite flow with email
- [ ] Password reset flow
- [ ] Rate limiting on login
- [ ] Session blacklisting on logout
- [ ] Full brand token CRUD from D1
- [ ] Custom brand token groups
- [ ] Brand delivery endpoints (context, css, page, webhooks)
- [ ] Navigation config from D1
- [ ] Navigation Hub core app (visual sidebar builder)
- [ ] Full Preact shell hydration
- [ ] Client-side routing
- [ ] AI panel (Workers AI, tool calling, action cards)
- [ ] Command palette (⌘K, federated search)
- [ ] Dashboard with widget grid
- [ ] Guest app gateway proxy (service bindings + HTTP)
- [ ] Manifest validation + extension point stitching
- [ ] Status app (health polling)
- [ ] Files app (R2 storage)
- [ ] Activity feed (merged event stream)
- [ ] Notification aggregation
- [ ] Extension system (defineExtension)
- [ ] Event bus
- [ ] Knowledge graph
- [ ] Audit log viewer
- [ ] i18n (shell strings + brand token translations)
- [ ] Tauri native app wrapper