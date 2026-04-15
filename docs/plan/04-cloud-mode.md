# Phase 4: Edge Proxy + Cloud Mode

**Status:** Blocked by Phase 3 (shell must be extractable first)
**Goal:** Build the Ensemble edge proxy that serves the shell from R2 and handles auth, enabling the "upgrade once, every project benefits" model.

---

## Why This Matters

This is the whole reason Ensemble exists as a platform:

- You deploy the proxy once
- Shell assets go to R2 once
- Every workspace on the planet gets the update instantly
- Workspace Workers are pure JSON APIs — small, fast, single-purpose
- Your other projects just point their CNAME at `proxy.ensemble.ai`

---

## Proxy Worker

A Cloudflare Worker at `proxy.ensemble.ai` that:

1. **Serves shell** — HTML/JS/CSS from R2, edge-cached via KV
2. **Handles auth** — Magic link + SSO flows via `app.ensemble.ai`
3. **Validates sessions** — JWT cookies on the workspace domain
4. **Injects headers** — `X-Ensemble-User-*` headers on API requests
5. **Proxies API** — Forwards `/_ensemble/*` requests to workspace Worker

### Request Flow

```
Browser → hub.acme.com (CNAME → proxy.ensemble.ai)
  │
  ├─ GET / (or any non-API path)
  │  → Serve shell HTML from R2 (inject workspace domain)
  │  → Shell loads, calls /_ensemble/workspace for config
  │
  ├─ GET /_ensemble/shell/shell.js
  │  → Serve from R2 (immutable cache)
  │
  ├─ GET /_ensemble/*  (API routes)
  │  → Validate session cookie
  │  → Inject X-Ensemble-User-Id, X-Ensemble-User-Email, X-Ensemble-User-Role
  │  → Proxy to workspace Worker
  │  → Return JSON response
  │
  └─ POST /_ensemble/auth/* (auth routes)
     → Handle locally (magic link, SSO callback, token refresh)
     → Set/clear session cookies on workspace domain
```

---

## Shell Deployment to R2

```bash
# CI/CD pipeline (runs on shell package release)
1. Build shell: cd packages/shell && bun run build
2. Upload to R2:
   - shell/{version}/shell.js
   - shell/{version}/shell.css
   - shell/{version}/shell.html (template)
3. Update KV: shell:latest → {version}
4. Edge cache invalidation (automatic via KV)
```

The proxy reads `shell:latest` from KV to know which version to serve. Enterprise workspaces can pin to a specific version.

---

## Workspace Worker in Cloud Mode

Already implemented in `create-workspace-v2.ts`:
- No shell serving
- No auth routes (except `/me`)
- Cloud auth middleware reads `X-Ensemble-*` headers
- Pure JSON API

The workspace developer's code looks like:

```typescript
import { createWorkspaceV2, defineConfig } from '@ensemble-edge/core';

export default createWorkspaceV2(defineConfig({
  mode: 'cloud',
  workspace: { name: 'Acme', slug: 'acme' },
  proxySecret: env.ENSEMBLE_PROXY_SECRET,
}));
```

---

## Implementation Scope

This phase is about building the **proxy Worker** — a new package:

```
packages/proxy/               # Or a separate repo: ensemble-edge/proxy
├── package.json
├── wrangler.toml
├── src/
│   ├── index.ts             # Worker entry
│   ├── shell.ts             # Shell serving from R2
│   ├── auth.ts              # Auth flows (magic link, SSO)
│   ├── session.ts           # JWT session management
│   ├── proxy.ts             # API request proxying
│   └── workspace-resolver.ts # Map domain → workspace Worker
└── r2/                       # Shell asset upload scripts
```

---

## Deliverables

- [ ] Proxy Worker that serves shell from R2
- [ ] Session management (JWT cookies per workspace domain)
- [ ] API proxying with header injection
- [ ] Shell upload pipeline (build → R2)
- [ ] Workspace domain → Worker mapping (KV or D1)
- [ ] Existing standalone mode still works unchanged
- [ ] At least one project running in cloud mode as proof
