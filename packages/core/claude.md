# AI Coding Agent Guidance for @ensemble-edge/core

This document provides context for AI coding agents (Claude Code, Cursor, etc.) working on the @ensemble-edge/core package.

## Package Purpose

@ensemble-edge/core is the heart of Ensemble Workspace — it provides:
- `createWorkspace()` — the main export that creates a Cloudflare Worker
- Shell SPA — the Preact-based UI (sidebar, toolbar, viewport, AI panel)
- Gateway API — the backend for auth, permissions, events, and data access
- Services — singleton services for theme, i18n, permissions, etc.
- Core Apps — 8 built-in apps (Home, Settings, etc.)
- Bundled Apps — 7 additional apps shipped with the core

## Architecture Principles

1. **Single Worker** — Everything runs in one Cloudflare Worker
2. **Shell + Gateway** — Shell is a Preact SPA, gateway is a Hono API
3. **Guest App Isolation** — Guest apps run in iframes, communicate via postMessage
4. **Services as Singletons** — Services are created once per workspace instance
5. **Signals for State** — Use Preact Signals for reactive state management

## File Structure

```
src/
├── create-workspace.ts   # Main export
├── middleware/           # Hono middleware (auth, tenant, etc.)
├── routes/               # API route handlers
├── shell/                # Preact shell components
├── locales/              # i18n strings
├── apps/
│   ├── core/             # 8 core apps
│   └── bundled/          # 7 bundled apps
├── services/             # Singleton services
└── db/migrations/        # D1 schema migrations
```

## Key Patterns

### Creating a Service

```typescript
// services/theme.ts
import { signal } from '@preact/signals';

export interface ThemeConfig {
  primaryColor: string;
  mode: 'light' | 'dark' | 'system';
}

const theme = signal<ThemeConfig>({
  primaryColor: '#3B82F6',
  mode: 'system',
});

export function getTheme() {
  return theme.value;
}

export function setTheme(config: Partial<ThemeConfig>) {
  theme.value = { ...theme.value, ...config };
}
```

### Adding a Route

```typescript
// routes/apps.ts
import { Hono } from 'hono';

const apps = new Hono();

apps.get('/', async (c) => {
  // List installed apps
});

apps.post('/:id/install', async (c) => {
  // Install an app
});

export { apps };
```

## Testing

- Use Bun's built-in test runner
- Mock Cloudflare bindings in tests
- Test services in isolation
- Integration tests for routes
