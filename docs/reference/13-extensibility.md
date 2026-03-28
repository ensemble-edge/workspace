## 20. Upgrade Strategy & Extensibility

### Core as a Dependency, Not a Template

The AIUX core is published as npm packages. A workspace project installs them as dependencies. The developer's Worker entry point is a thin file that imports core, configures it, and optionally registers extensions. **The developer never edits core code. Upgrades never cause merge conflicts.**

This is the Next.js / Remix / SvelteKit model: you `bun add @ensemble-edge/core`, you configure it, you extend it. You never clone or fork the framework.

### What the Developer's Project Looks Like

```
my-company-workspace/
├── package.json              # Dependencies: @ensemble-edge/core, @ensemble-edge/sdk, @ensemble-edge/ui
├── ensemble.config.ts            # All configuration lives here
├── wrangler.toml             # Cloudflare Worker config (workspace + service bindings)
├── bun.lockb
│
├── apps/                     # Guest app Workers (separate deployments)
│   ├── loan-tracker/
│   │   ├── wrangler.toml     # Its own Worker config
│   │   ├── package.json      # Depends on @ensemble-edge/guest-cloudflare
│   │   ├── manifest.json
│   │   ├── src/
│   │   └── migrations/
│   └── borrower-portal/
│       ├── wrangler.toml
│       ├── package.json
│       ├── manifest.json
│       └── src/
│
├── extensions/               # Custom middleware, routes, hooks (run IN the workspace Worker)
│   ├── stripe-webhook.ts
│   └── weekly-report.ts
│
├── knowledge/                # Company knowledge files
│   ├── brand.yaml
│   ├── messaging.yaml
│   └── engineering.md
│
└── worker.ts                 # ★ THE ENTRY POINT (~20 lines, rarely changes)
```

### The Worker Entry Point

```typescript
// worker.ts
import { createWorkspace } from '@ensemble-edge/core'
import config from './ensemble.config'

// Import custom extensions (optional, these run IN the workspace Worker)
import { stripeWebhook } from './extensions/stripe-webhook'
import { weeklyReport } from './extensions/weekly-report'

// Create the workspace Worker
const app = createWorkspace({
  config,
  extensions: [stripeWebhook, weeklyReport],
  // Guest apps are NOT imported here — they're separate Workers
  // connected via service bindings or HTTP
})

export default app
```

Guest apps are NOT compiled into the workspace Worker. They're separate Workers declared in `wrangler.toml` via service bindings, or remote services configured in the App Manager.

### The Configuration File

```typescript
// ensemble.config.ts
import { defineConfig } from '@ensemble-edge/core'

export default defineConfig({
  workspace: {
    name: 'Ownly Group',
    slug: 'ownly',
    type: 'organization',
    tildeAddress: 'ownly',
  },

  brand: {
    colors: { primary: '#1a1a2e', accent: '#c8a951' },
    fonts: { heading: 'Gloock', body: 'DM Sans', mono: 'JetBrains Mono' },
    radius: 'md',
    density: 'comfortable',
  },

  bundledApps: {
    dashboard: true,
    aiAssistant: true,
    files: true,
    notifications: true,
    activity: true,
  },

  auth: {
    providers: ['email', 'google'],
    sso: { provider: 'google-workspace', domain: 'ownly.com', defaultRole: 'member' },
  },

  gateway: {
    cors: { allowedOrigins: ['https://app.ensemble.ai', 'https://ownly.com'] },
    rateLimit: { perKey: 1000, perUser: 500 },
  },

  knowledge: { importFrom: './knowledge/' },
})
```

### The Extension System

Extensions are for code that needs to run inside the workspace Worker itself — middleware, custom routes, auth providers, scheduled tasks, and event handlers. They're the escape hatch for things that don't fit the guest app model.

```typescript
import { defineExtension } from '@ensemble-edge/core'

// Middleware — runs on every request
export const requestLogger = defineExtension({
  type: 'middleware',
  name: 'request-logger',
  position: 'after-auth',
  handler: async (c, next) => {
    const start = Date.now()
    await next()
    console.log(`${c.req.method} ${c.req.path} — ${Date.now() - start}ms`)
  },
})

// Route — custom API endpoint
export const stripeWebhook = defineExtension({
  type: 'route',
  name: 'stripe-webhook',
  routes: (app) => {
    app.post('/_ensemble/webhooks/stripe', async (c) => {
      const body = await c.req.text()
      await c.get('storage').prepare('INSERT INTO payments ...').run()
      return c.json({ received: true })
    })
  },
})

// Scheduled — runs on cron
export const weeklyReport = defineExtension({
  type: 'scheduled',
  name: 'weekly-digest',
  cron: '0 9 * * MON',
  handler: async (env) => { /* send digest emails */ },
})

// Event handler — reacts to workspace events
export const slackNotifier = defineExtension({
  type: 'event-handler',
  name: 'deal-closed-slack',
  events: ['crm:deal.closed'],
  handler: async (event) => {
    await fetch('https://hooks.slack.com/...', {
      method: 'POST',
      body: JSON.stringify({ text: `Deal closed: ${event.data.name}` }),
    })
  },
})

// Auth provider — custom SSO
export const corporateSSO = defineExtension({
  type: 'auth-provider',
  name: 'corporate-okta',
  provider: {
    id: 'corporate-okta',
    label: 'Sign in with Corporate SSO',
    initiateLogin: async (c) => { /* redirect to IdP */ },
    handleCallback: async (c) => { /* validate, return user */ },
  },
})

// App hook — extend a core app's behavior
export const customBrandExport = defineExtension({
  type: 'app-hook',
  name: 'brand-export-pdf',
  app: 'core:brand',
  hook: 'after-export',
  handler: async (exportData, c) => {
    return { ...exportData, pdfUrl: await generatePDF(exportData) }
  },
})
```

### The Upgrade Flow

```bash
# Check for updates
ensemble update --check
# → @ensemble-edge/core: 1.4.2 → 1.5.0 (minor)
# → 2 migrations pending
# → Your extensions: compatible
# → Your guest apps: unaffected (they're separate Workers)

# Apply
bun update @ensemble-edge/core @ensemble-edge/sdk @ensemble-edge/ui
ensemble migrate
ensemble deploy
```

No merge conflicts. Ever. The developer's code (config, extensions, knowledge files) is never touched by an upgrade. Guest apps are completely independent — they upgrade on their own schedule.

### What Ensemble Owns vs. What the Developer Owns

```
ENSEMBLE OWNS (upgradeable via bun update):
  @ensemble-edge/core — shell, core apps, bundled apps, gateway, auth, migration runner
  @ensemble-edge/sdk — hooks for code inside the Worker
  @ensemble-edge/ui — themed component library
  @ensemble-edge/cli — developer tooling
  @ensemble-edge/guest — guest app SDK (core + platform adapters)

DEVELOPER OWNS (never touched by upgrades):
  worker.ts — entry point (~20 lines)
  ensemble.config.ts — all configuration
  extensions/ — custom middleware, routes, hooks
  knowledge/ — company knowledge files
  apps/ — guest app Workers (separate deployments)
  wrangler.toml — Cloudflare config + service bindings
```

### Ensemble Cloud: Zero-Friction Upgrades

For Cloud customers, upgrades are invisible. Ensemble deploys new core versions automatically. Custom code (extensions, knowledge) is merged at deploy time. Guest apps are unaffected — they're separate services.

