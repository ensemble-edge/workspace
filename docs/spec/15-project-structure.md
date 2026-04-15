## 23. Project Structure

### The OSS Monorepo (Ensemble maintains)

```
ensemble-workspace/
├── packages/
│   ├── core/                       # @ensemble-edge/core (published to npm)
│   │   ├── src/
│   │   │   ├── create-workspace.ts # Main export: createWorkspace()
│   │   │   ├── middleware/
│   │   │   ├── routes/
│   │   │   ├── shell/              # Preact shell (SPA)
│   │   │   ├── locales/            # Shell i18n strings
│   │   │   │   ├── en.json         # English (ships with v1)
│   │   │   │   ├── es.json         # Spanish
│   │   │   │   └── ...             # Community-contributed
│   │   │   ├── apps/
│   │   │   │   ├── core/           # 8 core apps
│   │   │   │   └── bundled/        # Bundled apps
│   │   │   ├── services/
│   │   │   │   ├── theme.ts
│   │   │   │   ├── i18n.ts         # Locale resolver + t() function
│   │   │   │   ├── permissions.ts
│   │   │   │   ├── gateway.ts      # API gateway + guest app proxy
│   │   │   │   ├── app-registry.ts
│   │   │   │   ├── knowledge.ts
│   │   │   │   ├── event-bus.ts
│   │   │   │   └── notifications.ts
│   │   │   └── db/
│   │   └── package.json
│   │
│   ├── sdk/                        # @ensemble-edge/sdk (for code inside the Worker)
│   ├── ui/                         # @ensemble-edge/ui (themed components)
│   ├── cli/                        # @ensemble-edge/cli (developer tooling)
│   ├── agent-sdk/                  # @ensemble-edge/agent (for AI agents)
│   │
│   └── guest/                      # @ensemble-edge/guest (for guest app developers)
│       ├── core/                   # @ensemble-edge/guest — platform-agnostic core
│       │   ├── src/
│       │   │   ├── define-guest-app.ts
│       │   │   ├── context.ts
│       │   │   ├── auth.ts         # Capability token validation
│       │   │   ├── theme.ts        # Theme token helpers
│       │   │   ├── events.ts       # Event bus client
│       │   │   └── types.ts        # Manifest types, context types
│       │   └── package.json
│       │
│       ├── cloudflare/             # @ensemble-edge/guest-cloudflare
│       │   ├── src/
│       │   │   ├── adapter.ts      # CF Workers adapter
│       │   │   └── service-binding.ts
│       │   └── package.json
│       │
│       ├── vercel/                 # @ensemble-edge/guest-vercel
│       │   ├── src/
│       │   │   └── adapter.ts      # Vercel Functions adapter
│       │   └── package.json
│       │
│       ├── node/                   # @ensemble-edge/guest-node
│       │   ├── src/
│       │   │   └── adapter.ts      # Express/Fastify adapter
│       │   └── package.json
│       │
│       ├── deno/                   # @ensemble-edge/guest-deno
│       │   ├── src/
│       │   │   └── adapter.ts      # Deno adapter
│       │   └── package.json
│       │
│       └── aws/                    # @ensemble-edge/guest-aws
│           ├── src/
│           │   └── adapter.ts      # Lambda adapter
│           └── package.json
│
├── templates/                      # Used by `ensemble init`
│   ├── workspace/                  # Workspace project template
│   │   ├── worker.ts
│   │   ├── ensemble.config.ts
│   │   ├── package.json
│   │   └── wrangler.toml
│   └── guest-app/                  # Guest app template
│       ├── manifest.json
│       ├── src/
│       ├── package.json
│       └── wrangler.toml
│
├── apps/                           # Example guest apps
│   ├── crm/
│   ├── wiki/
│   └── support/
│
├── native/                         # Tauri native app
│   ├── src-tauri/
│   ├── src-swift/
│   ├── src-kotlin/
│   └── src/
│
├── web-app/                        # app.ensemble.ai
│   └── src/
│
├── directory/                      # dir.ensemble.ai
│   └── src/
│
└── website/                        # ensemble.ai
    └── src/
```

### What a Developer Creates (via `ensemble init`)

```
my-company-workspace/
├── worker.ts                       # Imports @ensemble-edge/core, ~20 lines
├── ensemble.config.ts                  # All configuration
├── package.json                    # @ensemble-edge/* as dependencies
├── wrangler.toml                   # CF config + service bindings to guest apps
├── extensions/                     # Custom middleware/routes/hooks
├── knowledge/                      # Company knowledge YAML/MD
│
└── apps/                           # Guest app Workers (each is its own deployment)
    ├── loan-tracker/
    │   ├── wrangler.toml           # Separate Worker
    │   ├── package.json            # @ensemble-edge/guest-cloudflare
    │   ├── manifest.json
    │   └── src/
    └── borrower-portal/
        ├── wrangler.toml
        ├── package.json
        └── src/
```

### SDK Package Summary

| Package | Who uses it | Where it runs | Purpose |
|---|---|---|---|
| `@ensemble-edge/core` | Workspace devs | In the workspace Worker | The engine: shell, core apps, gateway |
| `@ensemble-edge/sdk` | Extension devs | In the workspace Worker | Hooks for middleware, routes, app hooks |
| `@ensemble-edge/ui` | Any app dev | In any frontend | Themed component library |
| `@ensemble-edge/guest` | Guest app devs | On their infrastructure | Core SDK for building guest apps |
| `@ensemble-edge/guest-cloudflare` | CF guest app devs | CF Workers | Cloudflare-specific adapter |
| `@ensemble-edge/guest-vercel` | Vercel guest app devs | Vercel Functions | Vercel-specific adapter |
| `@ensemble-edge/guest-node` | Node.js guest app devs | Node/Express/Fastify | Node.js adapter |
| `@ensemble-edge/guest-deno` | Deno guest app devs | Deno Deploy | Deno adapter |
| `@ensemble-edge/guest-aws` | AWS guest app devs | Lambda | AWS Lambda adapter |
| `@ensemble-edge/guest-bun` | Bun guest app devs | Bun runtime | Bun adapter |
| `@ensemble-edge/agent` | AI agent devs | On their infrastructure | SDK for agents interacting with workspaces |
| `@ensemble-edge/cli` | All developers | Local machine | Init, dev, deploy, migrate, publish, install |

## 24. Database Schema — Complete

This is the consolidated schema across all core tables. App-specific tables are created via migrations.

```sql
-- ═══════════════════════════════════════════════════════════════
-- IDENTITY
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE users (
  id TEXT PRIMARY KEY,              -- usr_xxxxxxxxxxxx
  handle TEXT UNIQUE NOT NULL,      -- 'maycotte' (stored without @)
  email TEXT UNIQUE NOT NULL,
  email_verified INTEGER DEFAULT 0,
  name TEXT NOT NULL,
  avatar_key TEXT,                  -- R2 key
  mfa_secret TEXT,
  mfa_enabled INTEGER DEFAULT 0,
  handle_changed_at TEXT,           -- rate-limit handle changes
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE auth_methods (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,               -- 'password', 'oauth', 'saml', 'passkey'
  provider TEXT,                    -- 'google', 'github', 'microsoft', 'saml_ws_ownly'
  provider_user_id TEXT,
  credential TEXT,                  -- password hash, passkey credential, etc.
  email TEXT,                       -- email associated with this method
  metadata TEXT,                    -- JSON: tokens, device info, etc.
  last_used_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(type, provider, provider_user_id)
);

-- ═══════════════════════════════════════════════════════════════
-- WORKSPACES
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,              -- ws_xxxxxxxxxxxx
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'organization',
  template TEXT,
  custom_domain TEXT UNIQUE,
  logo_key TEXT,
  favicon_key TEXT,
  theme_config TEXT,                -- JSON: WorkspaceTheme
  settings TEXT,                    -- JSON: general settings
  knowledge_config TEXT,            -- JSON: knowledge graph settings
  agent_config TEXT,                -- JSON: agent access policies
  tilde_address TEXT UNIQUE,        -- 'ownly' (the ~slug, without ~)
  tilde_registered INTEGER DEFAULT 0, -- registered in Ensemble Directory?
  direct_url_enabled INTEGER DEFAULT 1, -- allow direct URL access?
  gateway_config TEXT,              -- JSON: API gateway settings
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE workspace_sso (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  protocol TEXT NOT NULL,           -- 'saml', 'oidc'
  provider_name TEXT,               -- 'Google Workspace', 'Okta', 'Azure AD'
  idp_entity_id TEXT,
  idp_sso_url TEXT,
  idp_certificate TEXT,
  oidc_issuer TEXT,
  oidc_client_id TEXT,
  oidc_client_secret_enc TEXT,
  email_domain TEXT,                -- 'ownly.com'
  auto_create_membership INTEGER DEFAULT 1,
  default_role TEXT DEFAULT 'member',
  enforce_sso INTEGER DEFAULT 0,
  group_mapping TEXT,               -- JSON: map IdP groups to AIUX roles
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE workspace_apps (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  app_id TEXT NOT NULL,
  tier TEXT NOT NULL,               -- 'core', 'bundled', 'guest'
  enabled INTEGER DEFAULT 1,
  settings TEXT,                    -- JSON: per-workspace app config
  visibility TEXT DEFAULT 'all_members',
  nav_order INTEGER,
  nav_section TEXT,
  installed_at TEXT DEFAULT (datetime('now')),
  installed_by TEXT,
  PRIMARY KEY (workspace_id, app_id)
);

-- ═══════════════════════════════════════════════════════════════
-- MEMBERSHIPS & PERMISSIONS
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE memberships (
  id TEXT PRIMARY KEY,              -- mem_xxxxxxxxxxxx
  user_id TEXT NOT NULL REFERENCES users(id),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  role TEXT NOT NULL DEFAULT 'member',
  display_name TEXT,
  app_access TEXT,                  -- JSON: ["ALL"] or ["bundled:files", "guest:loan-tracker"]
  permissions TEXT,                 -- JSON: granular permission flags
  status TEXT DEFAULT 'active',
  invited_by TEXT,
  joined_via TEXT,                  -- 'direct', 'invite', 'sso', 'domain-auto-join', 'magic-link'
  joined_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, workspace_id)
);

CREATE TABLE agent_keys (
  id TEXT PRIMARY KEY,              -- ak_xxxxxxxxxxxx
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  scopes TEXT NOT NULL,             -- JSON: permission scopes
  app_access TEXT,                  -- JSON: which apps the agent can interact with
  rate_limit INTEGER DEFAULT 1000,
  created_by TEXT NOT NULL REFERENCES users(id),
  last_used_at TEXT,
  expires_at TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE groups (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  permissions TEXT,
  app_access TEXT,
  UNIQUE(workspace_id, name)
);

CREATE TABLE group_members (
  group_id TEXT NOT NULL REFERENCES groups(id),
  membership_id TEXT NOT NULL REFERENCES memberships(id),
  PRIMARY KEY (group_id, membership_id)
);

CREATE TABLE invitations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  email TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  app_access TEXT,
  invited_by TEXT NOT NULL REFERENCES users(id),
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ═══════════════════════════════════════════════════════════════
-- KNOWLEDGE GRAPH
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE knowledge (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  domain TEXT NOT NULL,
  path TEXT NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'json',
  version INTEGER DEFAULT 1,
  updated_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(workspace_id, domain, path)
);

CREATE TABLE knowledge_versions (
  id TEXT PRIMARY KEY,
  knowledge_id TEXT NOT NULL REFERENCES knowledge(id),
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  change_note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ═══════════════════════════════════════════════════════════════
-- NAVIGATION
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE nav_config (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id),
  strategy TEXT DEFAULT 'sectioned',
  config TEXT NOT NULL,             -- JSON: full nav configuration
  mobile_config TEXT,               -- JSON: mobile-specific overrides
  updated_by TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE bookmarks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  scope TEXT NOT NULL,              -- 'workspace', 'group', 'personal'
  group_id TEXT,
  user_id TEXT,                     -- membership ID for personal bookmarks
  label TEXT NOT NULL,
  icon TEXT,
  target_type TEXT NOT NULL,        -- 'app-page', 'external', 'command'
  target_app_id TEXT,
  target_path TEXT,
  target_url TEXT,
  target_command_id TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ═══════════════════════════════════════════════════════════════
-- AUDIT LOG
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  actor_type TEXT NOT NULL,         -- 'user' or 'agent'
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  app_id TEXT,
  metadata TEXT,                    -- JSON
  ip_address TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

---

