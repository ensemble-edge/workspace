# Phase 1: Core App Contract + Viewport Refactor

**Status:** Next up
**Goal:** Define the contract that core apps implement, then refactor the Viewport from hardcoded pages to a dynamic app router.

---

## Why This First

The Viewport currently has ~400 lines of inline page components (HomePage, BrandPage, PeoplePage, etc.) and a hardcoded `routes[]` array. Before building 8 core apps, we need:

1. A type contract that every core app implements
2. A server-side route registration pattern (Hono API routes)
3. A client-side component registry (React page components)
4. A dynamic Viewport router that reads from the registry

This is the keystone — once apps can register dynamically, everything else is incremental.

---

## 1. Core App Definition (Server-Side)

**File:** `packages/core/src/apps/types.ts`

```typescript
import type { Hono } from 'hono';
import type { Env, ContextVariables } from '../types';

/**
 * Every core/bundled app implements this interface.
 * It provides both API routes (for the Worker) and metadata (for the shell).
 */
export interface CoreAppDefinition {
  /** App manifest — metadata, nav config, display info */
  manifest: CoreAppManifest;

  /**
   * Register Hono API routes for this app.
   * Routes are mounted under /_ensemble/core/{app-id}/*
   */
  registerRoutes: (
    app: Hono<{ Bindings: Env; Variables: ContextVariables }>
  ) => void;
}

export interface CoreAppManifest {
  /** Unique ID: "core:brand", "core:people", etc. */
  id: string;

  /** Display name */
  name: string;

  /** Lucide icon name */
  icon: string;

  /** Short description */
  description: string;

  /** App tier */
  tier: 'core' | 'bundled';

  /** Navigation configuration */
  nav: {
    label: string;
    icon: string;
    section: 'apps' | 'workspace';
    path: string;
    children?: { label: string; path: string; icon?: string }[];
  };
}
```

---

## 2. App Registration (Server-Side)

**File:** `packages/core/src/apps/core/index.ts`

Each core app exports a `CoreAppDefinition`. The index registers them all:

```typescript
import { brandApp } from './brand';
import { adminApp } from './admin';
import { peopleApp } from './people';
// ... etc.

export const coreApps: CoreAppDefinition[] = [
  brandApp,
  adminApp,
  peopleApp,
  // ...
];

export function registerCoreApps(app: Hono) {
  for (const coreApp of coreApps) {
    coreApp.registerRoutes(app);
  }
}
```

Called from `createWorkspace()` / `createWorkspaceV2()`:

```typescript
// After middleware pipeline, before catch-all
registerCoreApps(app);
```

---

## 3. Client-Side Page Registry

**File:** `packages/core/src/shell/apps/registry.ts`

```typescript
import type { ComponentType } from 'react';

export interface AppPageRegistration {
  /** App ID this page belongs to */
  appId: string;
  /** Route path (exact match or pattern) */
  path: string | RegExp;
  /** React component to render */
  component: ComponentType;
  /** Optional: page title for breadcrumb */
  title?: string;
}

const pages: AppPageRegistration[] = [];

export function registerPage(registration: AppPageRegistration) {
  pages.push(registration);
}

export function getPages(): readonly AppPageRegistration[] {
  return pages;
}

export function findPage(path: string): AppPageRegistration | undefined {
  return pages.find((p) => {
    if (typeof p.path === 'string') return p.path === path;
    return p.path.test(path);
  });
}
```

Each core app's UI registers its pages on module load:

```typescript
// shell/apps/core/brand/index.ts
import { registerPage } from '../../registry';
import { BrandPage } from './BrandPage';

registerPage({
  appId: 'core:brand',
  path: '/brand',
  component: BrandPage,
  title: 'Brand',
});
```

---

## 4. Viewport Refactor

Replace the hardcoded routes in Viewport.tsx:

```typescript
// Before (hardcoded)
const routes: Route[] = [
  { path: '/', component: HomePage },
  { path: '/brand', component: BrandPage },
  // ...
];

// After (dynamic)
import { findPage } from '../apps/registry';

// Import all core app registrations (side-effect imports)
import '../apps/core/home';
import '../apps/core/brand';
import '../apps/core/people';
import '../apps/core/admin';
import '../apps/core/apps';

export function Viewport() {
  const path = currentPath.value;
  const page = findPage(path);
  const Component = page?.component ?? NotFoundPage;
  return <Component />;
}
```

---

## 5. Extract Existing Pages

Move the inline page components out of Viewport.tsx into their own files:

```
shell/apps/
├── registry.ts              # Page registry
├── NotFoundPage.tsx         # 404 page
└── core/
    ├── home/
    │   ├── index.ts         # registerPage() call
    │   └── HomePage.tsx     # Extracted from Viewport
    ├── brand/
    │   ├── index.ts
    │   ├── BrandPage.tsx    # Extracted from Viewport
    │   ├── BrandTab.tsx     # Extracted from Viewport
    │   └── WorkspaceTab.tsx # Extracted from Viewport
    ├── people/
    │   ├── index.ts
    │   └── PeoplePage.tsx
    ├── admin/
    │   ├── index.ts
    │   └── AdminPage.tsx    # Renamed from SettingsPage
    ├── apps/
    │   ├── index.ts
    │   ├── AppsPage.tsx
    │   └── AppViewPage.tsx
    └── nav/
        ├── index.ts
        └── NavPage.tsx      # New — sidebar config admin
```

---

## 6. Server-Side Route Pattern

Each core app gets its own API namespace:

| App | API Prefix | Example Routes |
|-----|-----------|----------------|
| `core:brand` | `/_ensemble/core/brand/*` | `GET /tokens`, `PUT /tokens`, `GET /css` |
| `core:admin` | `/_ensemble/core/admin/*` | `GET /settings`, `PUT /settings` |
| `core:people` | `/_ensemble/core/people/*` | `GET /members`, `POST /invite` |
| `core:apps` | `/_ensemble/core/apps/*` | `GET /installed`, `POST /install` |
| `core:auth` | `/_ensemble/core/auth/*` | `GET /policies`, `PUT /sso` |
| `core:audit` | `/_ensemble/core/audit/*` | `GET /events` |
| `core:nav` | `/_ensemble/core/nav/*` | `GET /config`, `PUT /config` |
| `core:knowledge` | `/_ensemble/core/knowledge/*` | `GET /entries`, `POST /entries` |

The existing brand endpoints (`/_ensemble/brand/*`) stay for backwards compatibility — they're the public-facing brand delivery API. The core app routes under `/_ensemble/core/brand/*` are the admin CRUD.

---

## Deliverables

- [ ] `CoreAppDefinition` and `CoreAppManifest` types
- [ ] Client-side page registry (`registerPage`, `findPage`)
- [ ] Extract HomePage, BrandPage (with BrandTab + WorkspaceTab), PeoplePage, SettingsPage, AppsPage, AppViewPage into separate files
- [ ] Dynamic Viewport routing via registry
- [ ] `registerCoreApps()` server-side hook in createWorkspace
- [ ] `core:brand` as the first fully-registered core app (manifest + routes + pages)
- [ ] Verify everything still works in the browser

---

## Notes

- The existing `/_ensemble/nav` endpoint already returns nav sections. Once core apps have manifests with nav config, this endpoint should build sections from registered app manifests instead of hardcoding them.
- Guest apps already have `/_ensemble/apps/*` routes via the gateway. Core apps use `/_ensemble/core/*` to avoid collision.
- The page registry is intentionally simple (no lazy loading, no code splitting yet). We can add that when the shell is extracted as a separate package with a proper build pipeline.
