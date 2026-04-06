# Deployment Modes Skill

> Understanding and implementing Standalone vs Ensemble Cloud modes.

## Overview

Ensemble supports two deployment modes:

| Mode | Shell | Auth | Switcher |
|------|-------|------|----------|
| **Standalone** | Bundled in Worker | Worker handles | ❌ No |
| **Ensemble Cloud** | Served by proxy | `app.ensemble.ai` handles | ✅ Yes |

## Configuration

```typescript
// ensemble.config.ts
import { defineConfig } from '@ensemble-edge/core'

export default defineConfig({
  mode: 'standalone',  // or 'cloud'

  // Only needed for standalone mode
  standalone: {
    auth: {
      provider: 'magic-link',  // 'magic-link' | 'password' | 'oidc'
      email: {
        provider: 'resend',
        from: 'auth@myworkspace.com',
      },
    },
    session: {
      secret: process.env.JWT_SECRET,
      lifetime: '7d',
    },
  },

  workspace: {
    name: 'My Workspace',
    slug: 'myworkspace',
  },
})
```

## Mode Detection

```typescript
import { isStandalone, isCloud } from '@ensemble-edge/core/mode'

if (isStandalone(config)) {
  // Worker bundles shell, handles auth
}

if (isCloud(config)) {
  // Worker is pure JSON API
}
```

## Auth Middleware Behavior

### Standalone Mode

```typescript
// Middleware parses JWT from cookie
const token = c.req.cookie('ensemble_session')
const payload = await verifyJwt(token, config.session.secret)
c.set('user', {
  id: payload.sub,
  email: payload.email,
  roles: payload.roles,
})
```

### Cloud Mode

```typescript
// Middleware reads header injected by proxy
const userHeader = c.req.header('X-Ensemble-User')
const user = JSON.parse(atob(userHeader))
c.set('user', user)
```

## App Code Is Identical

Your route handlers work the same in both modes:

```typescript
app.get('/_ensemble/apps/crm/deals', (c) => {
  const user = c.get('user')  // Same API!
  const deals = await getDeals(user.id)
  return c.json({ deals })
})
```

## When to Use Each Mode

### Use Standalone When:

- Developing locally
- Running in air-gapped environments
- Want zero external dependencies
- Building a single-workspace product

### Use Ensemble Cloud When:

- Want automatic shell upgrades
- Need workspace switching
- Want managed auth (SSO, magic links)
- Building multi-workspace experiences

## Switching Modes

### Standalone → Cloud

1. Change `mode: 'standalone'` → `mode: 'cloud'`
2. Add DNS CNAME to `proxy.ensemble.ai`
3. Add DNS TXT for verification
4. Redeploy Worker
5. Users re-authenticate via `app.ensemble.ai`

### Cloud → Standalone

1. Change `mode: 'cloud'` → `mode: 'standalone'`
2. Add standalone auth config
3. Point DNS directly at Worker
4. Redeploy Worker
5. Users re-authenticate locally

## Testing Modes

```typescript
// In tests, you can mock the mode
import { describe, it, expect, vi } from 'vitest'

describe('standalone mode', () => {
  it('parses JWT from cookie', async () => {
    const config = { mode: 'standalone', ... }
    const middleware = standaloneAuthMiddleware(config)
    // Test cookie parsing
  })
})

describe('cloud mode', () => {
  it('reads user from header', async () => {
    const middleware = cloudAuthMiddleware()
    // Test header parsing
  })
})
```
