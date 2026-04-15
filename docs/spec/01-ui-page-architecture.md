# Workspace Page Architecture

**Status:** Spec
**Applies to:** `@ensemble-edge/core` shell, `@ensemble-edge/ui` components, guest app manifest
**Depends on:** workspace-styling.md (visual design system), workspace-bootstrap.md (auth)

---

## Overview

Every workspace screen is built from the same hierarchy: **apps contain pages, pages contain sections, sections contain cards.** The workspace shell renders the structural chrome (tabs, page headers, section labels) and the guest app fills in the content. A developer thinks in "my app has pages, each page has sections, each section has cards" — they never think about layout grids, responsive breakpoints, or scrolling behavior.

Pages can render as full viewport content OR as overlays (drawers, modals, dialogs) that float over the current page. A customer detail view slides in as a drawer over the customer list. A "new customer" form opens as a centered modal. A confirmation appears as a small dialog. The URL updates, the overlays stack predictably, and the user never loses context.

This spec defines the full hierarchy, the three viewport modes, the two navigation modes, the overlay system, the component API, routing, and permissions.

---

## The hierarchy

```
Workspace
└── App (nav item in sidebar)
    └── Page (a route within the app)
        └── Section (optional grouping within a page)
            └── Card (content surface)
                └── Content (whatever the app renders)
```

| Level | What it is | Who defines it | Where it appears |
|---|---|---|---|
| **App** | A logical unit of functionality — a guest app, core app, or bundled app | Manifest `id` + `nav` | Sidebar nav item |
| **Page** | A route within an app — a distinct screen with its own header | Manifest `nav.children` or app-internal routing | Tabs at top of viewport, or subnav items in sidebar |
| **Section** | An optional labeled grouping of cards within a page | App code using `<Section>` component | Section label on the canvas between card groups |
| **Card** | A floating content surface on the canvas | App code using `<Card>`, `<StatCard>`, etc. | Dark rounded panel on the warm canvas |
| **Widget** | A small card contributed to a dashboard page from any installed app | Manifest `widgets` field | On dashboard pages, managed by the dashboard grid |

---

## Apps

An app is a nav item. Every entry in the sidebar (except section labels) is an app. Core apps, bundled apps, and guest apps all follow the same rules.

### App identity in the manifest

```json
{
  "id": "nendo-customers",
  "name": "Customers",
  "version": "1.0.0",
  "category": "tool",

  "nav": {
    "label": "Customers",
    "icon": "users",
    "path": "/customers",
    "pages": "tabs",
    "viewport": "structured",
    "children": [
      { "label": "All customers", "path": "/customers", "default": true },
      { "label": "Trial queue", "path": "/trials", "badge_source": "trial_request.submitted" },
      { "label": "Usage analytics", "path": "/usage" }
    ]
  }
}
```

### App nav fields

| Field | Type | Default | Description |
|---|---|---|---|
| `label` | string | required | Display name in sidebar |
| `icon` | ManifestIcon | required | Icon in sidebar (lucide name, svg, or emoji) |
| `path` | string | required | Base path for this app in the viewport URL |
| `pages` | `'sidebar'` \| `'tabs'` \| `'none'` | `'none'` | How child pages are displayed |
| `viewport` | `'structured'` \| `'dashboard'` \| `'full'` | `'structured'` | Layout mode for this app's viewport area |
| `children` | PageChild[] | `[]` | Pages accessible via tabs or subnav |

---

## Pages

A page is a route within an app. Each page has its own title, subtitle, and content. Pages are declared in the manifest's `nav.children` array for shell-managed navigation, or handled entirely by the app's internal router for hidden routes.

### Two kinds of pages

**Navigable pages** — declared in `nav.children`. The shell renders them as tabs or sidebar subnav items. Users can jump directly to them from the nav.

```json
"children": [
  { "label": "All customers", "path": "/customers", "default": true },
  { "label": "Trial queue", "path": "/trials", "badge_source": "trial_request.submitted" },
  { "label": "Usage analytics", "path": "/usage" }
]
```

**Contextual pages** — not in `nav.children`. The user reaches them by clicking something within the app (a table row, a link, a button). Customer Detail (`/customers/cust_123`), New Customer (`/customers/new`), Edit Customer (`/customers/cust_123/edit`). These are just routes the app handles internally.

**The rule:** If a user would want to jump to it from anywhere in the workspace → navigable page. If they'd only go there from within the app's context → contextual page.

### Page child fields

| Field | Type | Default | Description |
|---|---|---|---|
| `label` | string | required | Display name in tab or subnav |
| `path` | string | required | Route path (relative to app's base path) |
| `default` | boolean | `false` | Is this the default page when the app is opened? |
| `icon` | ManifestIcon | — | Optional icon (only used in sidebar mode) |
| `badge_source` | string | — | Event name that drives a badge count |

### Navigation modes for pages

The `pages` field on the app nav controls how children appear:

**`pages: "sidebar"` — Hauser style**

Children appear as indented subnav items in the sidebar. Clicking the parent expands/collapses the children. The active child is highlighted.

```
Sidebar:
┌──────────────────┐
│ ▾ Customers      │ ← parent, click to collapse
│    All customers │
│  ► Trial queue [3]│ ← active, with badge
│    Usage         │
└──────────────────┘
```

Best for apps with distinct sections that users switch between frequently — CRM, due diligence tools, operations platforms. This is the Hauser pattern.

**`pages: "tabs"` — tabs at top of viewport**

Children appear as a horizontal tab bar at the top of the viewport, below the floating toolbar. The sidebar shows only the parent app with no expansion. Clicking a tab swaps the page content below.

```
Sidebar:          Viewport:
┌──────────┐      ┌──────────────────────────────────────┐
│◆ Customers│      │ [All customers] [Trial queue 3] [Usage]│
└──────────┘      │─────────────────────────────────────── │
                  │                                        │
                  │  (page content here)                   │
                  │                                        │
                  └────────────────────────────────────────┘
```

Best for apps where pages are closely related views of the same data — analytics dashboards, settings, profile pages. Keeps the sidebar clean.

**`pages: "none"` — app manages its own navigation**

No tabs, no subnav. The app handles all internal routing. Children in the manifest are only used for ⌘K search results and deep linking — they never appear in visible nav.

Best for apps with complex internal navigation — editors, kanban boards, maps, tools with their own sidebar.

### Tab bar component

When `pages: "tabs"`, the shell renders the tab bar:

```css
.app-tabs {
  display: flex;
  gap: 2px;
  padding: 0 24px;
  padding-right: 72px;            /* room for right strip */
  background: transparent;        /* sits on the canvas */
  margin-bottom: 8px;
}

.app-tab {
  padding: 10px 16px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary);
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  cursor: pointer;
  transition: color var(--transition-fast), background var(--transition-fast);
}

.app-tab:hover {
  color: var(--text-primary);
  background: var(--card-border);
}

.app-tab.active {
  color: var(--text-primary);
  background: var(--card);
  border: 1px solid var(--card-border);
  border-bottom-color: var(--card);  /* blends into content below */
}

.app-tab-badge {
  margin-left: 8px;
  font-size: 0.6875rem;
  font-weight: 700;
  background: var(--accent-dim);
  color: var(--accent);
  padding: 1px 6px;
  border-radius: 4px;
  min-width: 18px;
  text-align: center;
}
```

### Sidebar subnav component

When `pages: "sidebar"`, the shell renders indented children:

```css
.sidebar-subnav {
  overflow: hidden;
  transition: max-height 200ms ease-out;
}

.sidebar-subnav.collapsed {
  max-height: 0;
}

.sidebar-subnav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 16px 6px 42px;    /* indented — icon width (16px) + gap (10px) + parent padding (16px) */
  font-size: 0.8125rem;
  color: var(--text-tertiary);
  border-radius: 6px;
  margin: 1px 8px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.sidebar-subnav-item:hover {
  color: var(--text-secondary);
  background: rgba(255,255,255,0.04);
}

.sidebar-subnav-item.active {
  color: var(--text-primary);
  background: rgba(255,255,255,0.08);
}

.sidebar-parent-toggle {
  margin-left: auto;
  width: 16px;
  height: 16px;
  color: var(--text-tertiary);
  transition: transform 150ms ease-out;
}

.sidebar-parent-toggle.expanded {
  transform: rotate(90deg);
}
```

---

## Page header

Every structured page has a header. The header is per-page — each page in an app has its own title, subtitle, and actions.

### AppPage component

```tsx
interface AppPageProps {
  title: string                                    // page heading
  subtitle?: string                                // secondary text below title
  actions?: PageAction[]                           // buttons in the top-right
  backLink?: { label: string; path: string }       // optional back navigation
  children: preact.ComponentChildren               // sections + cards
}

interface PageAction {
  label: string
  icon?: string                                    // lucide icon name
  onClick: () => void
  variant?: 'default' | 'primary' | 'danger'
}
```

```tsx
<AppPage
  title="Trial Queue"
  subtitle="3 pending requests"
  actions={[
    { label: 'Export', icon: 'download', onClick: handleExport },
    { label: 'Approve all', icon: 'check', onClick: handleApproveAll, variant: 'primary' },
  ]}
>
  {/* sections and cards go here */}
</AppPage>
```

### Page header rendering

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Trial Queue                        [Export] [Approve all]  │
│  3 pending requests                                         │
│                                                             │
```

With back link (on detail/contextual pages):

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to customers                                        │
│                                                             │
│  Acme Corp                                    [Edit] [···]  │
│  Active · 1,240 credits remaining                           │
│                                                             │
```

```css
.page-header {
  padding: 0 4px;
  margin-bottom: 24px;
}

.page-back-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  color: var(--text-tertiary);
  margin-bottom: 12px;
  cursor: pointer;
}

.page-back-link:hover {
  color: var(--accent);
}

.page-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.page-subtitle {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-top: 4px;
}

.page-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
```

---

## Sections

Sections are optional labeled groupings within a page. They create visual separation between card groups using the uppercase tracked label from the design system.

### Section component

```tsx
interface SectionProps {
  title: string                                    // uppercase tracked label
  count?: number                                   // optional count badge
  action?: { label: string; onClick: () => void }  // optional action link on the right
  columns?: 1 | 2 | 3 | 4 | 'auto'               // grid columns for cards inside (default: 'auto')
  gap?: 'sm' | 'md' | 'lg'                        // card gap override (default: 'md')
  children: preact.ComponentChildren               // cards
}
```

```tsx
<Section title="Needs Review" count={3}>
  <Card>...</Card>
  <Card>...</Card>
  <Card>...</Card>
</Section>

<Section title="Usage Breakdown" columns={3} action={{ label: 'See all', onClick: viewAll }}>
  <StatCard value="12,400" label="API calls today" />
  <StatCard value="3.2ms" label="Avg latency" />
  <StatCard value="99.8%" label="Success rate" />
</Section>
```

### Section rendering

```
  N E E D S   R E V I E W  (3)                    See all →
  ┌─────────────────────────────────────────────────┐
  │ row                                             │
  ├─────────────────────────────────────────────────┤
  │ row                                             │
  ├─────────────────────────────────────────────────┤
  │ row                                             │
  └─────────────────────────────────────────────────┘
```

```css
.section {
  margin-top: 32px;
}

.section:first-child {
  margin-top: 0;
}

.section-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 16px;
  padding: 0 4px;
}

.section-label {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.section-count {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-tertiary);
  opacity: 0.6;
}

.section-action {
  margin-left: auto;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--accent);
  cursor: pointer;
}

.section-action:hover {
  text-decoration: underline;
}
```

The `Section` component wraps its children in a `CardGrid` automatically with the specified `columns` and `gap`. If the developer passes a single `<Card>`, it renders full-width. If they pass multiple cards or stat cards, they flow into the grid.

---

## Cards

Cards are the floating content surface. Everything visible on the canvas lives in a card. See workspace-styling.md §2 for the full card CSS. The key variants:

| Component | What it renders | Typical size |
|---|---|---|
| `Card` | Generic content container — tables, lists, forms, anything | Any |
| `StatCard` | Big number + label + optional delta | Small (1 grid column) |
| `PageCard` | Full-viewport-width card for detail views | Full width, no max-height |
| `DataCard` | Label/value pairs, progress bars, scores | Medium |

### Card with title

Cards can have their own header (distinct from the section label above them):

```tsx
<Card title="Recent Activity" action={{ label: 'View all', onClick: viewAll }}>
  <ActivityList items={activities} />
</Card>
```

```
  ┌─────────────────────────────────────────────────┐
  │  RECENT ACTIVITY                      View all →│  ← card title (uppercase tracked)
  │─────────────────────────────────────────────────│
  │  Matt approved trial for acme@corp.com    2m    │
  │  New signup: beta@startup.io              1h    │
  │  Credit alert: dev@agency.co              3h    │
  └─────────────────────────────────────────────────┘
```

The card title uses the same uppercase tracked style as section labels but at slightly smaller size and lighter weight — it's subordinate to the section label.

```css
.card-title {
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  opacity: 0.8;
}
```

---

## Three viewport modes

The `viewport` field on the app nav controls how the viewport area is structured.

### `viewport: "structured"` (default — 80% of apps)

The workspace shell provides the full page chrome: tabs (if `pages: "tabs"`), page header, section labels. The guest app composes content using `AppPage`, `Section`, `Card`, `CardGrid` from `@ensemble-edge/ui`.

```
Shell provides:              Guest app provides:
┌─────────────────────┐
│ [Tab 1] [Tab 2]     │     ← shell renders from manifest
├─────────────────────┤
│                     │
│  Page Title         │     ← shell renders from AppPage props
│  Subtitle           │
│                     │
│  S E C T I O N      │     ← shell renders from Section props
│  ┌─────┐ ┌─────┐   │
│  │card │ │card │   │     ← guest app content inside cards
│  └─────┘ └─────┘   │
│                     │
│  S E C T I O N      │     ← shell renders from Section props
│  ┌───────────────┐  │
│  │   card        │  │     ← guest app content inside cards
│  └───────────────┘  │
└─────────────────────┘
```

The developer gets Hauser-quality layout for free. They think in pages, sections, and cards. The workspace handles canvas, spacing, responsive behavior, scrolling, floating toolbar, glass bookmark bar.

### `viewport: "dashboard"` (home screens, ops dashboards)

The workspace renders a configurable widget grid. Widgets come from any installed app via the manifest `widgets` field. The workspace admin or user can add, remove, reorder, and resize widgets.

```
Shell provides:              Widget data from:
┌─────────────────────┐
│  Dashboard          │     ← page header (fixed: "Dashboard" or custom name)
│                     │
│  ┌─────┐┌─────┐┌──┐│
│  │widg ││widg ││wi││     ← @nendo/customers widgets
│  └─────┘└─────┘└──┘│
│  ┌───────────┐┌────┐│
│  │ widget    ││widg││     ← @nendo/usage widgets
│  └───────────┘└────┘│
│  ┌─────────────────┐│
│  │ full-width widg ││     ← @ensemble/stripe widget
│  └─────────────────┘│
└─────────────────────┘
```

Dashboard pages are the only layout where content comes from **multiple apps** on the same page. The widget grid is drag-and-drop configurable by the user. Widget sizes (small/medium/large/full) map to grid column spans.

The dashboard is managed by `bundled:dashboard` — a bundled app that reads widget declarations from all installed app manifests and renders them in a grid. Users personalize their dashboard by adding/removing/rearranging widgets.

### `viewport: "full"` (escape hatch — custom UIs)

The workspace provides only the canvas background and CSS variable injection. No tabs, no page header, no section chrome. The guest app renders everything.

```
Shell provides:              Guest app provides:
┌─────────────────────┐
│                     │
│  (canvas background)│     ← only this
│  (CSS variables)    │
│                     │
│  [entire UI is the  │     ← guest app controls everything
│   guest app's       │
│   responsibility]   │
│                     │
└─────────────────────┘
```

Best for apps with highly custom UIs that don't fit the card model: code editors, map views, design tools, rich media players, kanban boards with drag-and-drop.

The guest app still receives the full theme context (CSS variables, fonts, colors) and can use them for consistency. But it's not required to use `AppPage`, `Section`, or `Card`. The workspace respects that some apps need full creative control.

**Recommendation for guest app developers:** Start with `structured`. Only switch to `full` if the card model genuinely doesn't work for your UI. If you find yourself fighting the structure, `full` is there. But most apps — even complex ones — work great with structured + sections + cards.

---

## Routing

Every page in the workspace has a URL. Routing follows a predictable pattern.

### URL structure

```
/app/{app_id}/{page_path}
```

| Example URL | App | Page |
|---|---|---|
| `/app/customers` | Customers | All customers (default) |
| `/app/customers/trials` | Customers | Trial queue |
| `/app/customers/usage` | Customers | Usage analytics |
| `/app/customers/cust_123` | Customers | Customer detail (contextual) |
| `/app/_people` | People & Teams (core) | Members (default) |
| `/app/_people/teams` | People & Teams | Teams |
| `/app/_brand` | Brand Manager (core) | Overview (default) |
| `/app/_brand/colors` | Brand Manager | Colors |
| `/app/home` | Home (bundled) | Dashboard |

Core apps use the `_` prefix convention (`_people`, `_brand`, `_settings`, `_audit`) to distinguish them from guest apps. This is a convention, not enforced — it just prevents collisions.

### Client-side routing

The shell handles routing client-side (no full page reloads). Clicking a sidebar item, tab, or in-app link updates the URL and swaps the viewport content:

```typescript
// Shell router
navigate('/app/customers/trials')
// → Updates URL via History API
// → Shell identifies app: "customers"
// → Shell identifies page: "trials"
// → If pages="tabs": activates "Trial queue" tab
// → If pages="sidebar": highlights "Trial queue" subnav item
// → Viewport renders the TrialQueuePage component/route
```

### Deep linking

Every page is deep-linkable. Sharing `https://workspace.nendo.ai/app/customers/cust_123` takes you directly to that customer's detail page. The shell loads, authenticates, resolves the app and page, and renders it.

---

## Permissions

The app → page hierarchy maps cleanly to permissions.

### Permission strings

```
app:{app_id}                    — can access the app (see it in nav, open it)
app:{app_id}:read               — can read data in the app
app:{app_id}:write              — can write/modify data in the app
app:{app_id}:{page}             — can access a specific page
app:{app_id}:{page}:write       — can write on a specific page
```

### Examples

| Permission | What it grants |
|---|---|
| `app:customers` | Can see Customers in sidebar, open it |
| `app:customers:read` | Can view customer data |
| `app:customers:write` | Can edit customers, approve trials |
| `app:customers:trials` | Can access the Trial Queue page specifically |
| `app:_brand` | Can see Brand Manager in sidebar |
| `app:_brand:write` | Can edit brand tokens |
| `app:_settings` | Can see Settings (admin-only by default) |

### Role defaults

| Role | Default permissions |
|---|---|
| `owner` | `*` — everything |
| `admin` | All `app:*` + `app:*:read` + `app:*:write` + all core apps |
| `member` | All `app:*` (guest apps) + `app:*:read` + `app:*:write` — excludes core admin apps |
| `viewer` | All `app:*` + `app:*:read` only — no write access |
| `guest` | Only apps explicitly granted — no default access |

Guest apps declare required permissions in their manifest:

```json
"permissions": {
  "required": ["read", "write"],
  "optional": ["admin"]
}
```

The workspace admin grants these at install time. The gateway enforces them on every proxied request.

### Page-level permissions

If a guest app wants to restrict a specific page (e.g., only admins can see Usage Analytics), they declare it in the page child:

```json
"children": [
  { "label": "All customers", "path": "/customers" },
  { "label": "Trial queue", "path": "/trials" },
  { "label": "Usage analytics", "path": "/usage", "requires_role": "admin" }
]
```

Pages with `requires_role` are hidden from the nav (tabs or subnav) for users below that role. If they navigate directly via URL, the gateway returns 403.

---

## Overlay system — pages that float

Not every page navigates away from the current view. A customer detail page can slide in as a drawer OVER the customer list. A "new customer" form can open as a centered modal. A "revoke key" confirmation can appear as a small dialog. The user never loses their place.

This isn't a separate modal system bolted onto the page architecture — **overlays ARE pages.** They have URLs, they respect permissions, they're deep-linkable, and the shell manages them the same way it manages full pages. The only difference is how they render.

### Four display modes

Every page has a display mode. Navigable pages (in `children`) default to `page`. Contextual pages (in `routes`) declare their display mode explicitly.

| Display | Behavior | Use case |
|---|---|---|
| `page` | Replaces viewport content, full navigation | List views, analytics, settings |
| `drawer` | Slides in from right, 480px, current page stays visible underneath | Detail views — click a row, see the detail without losing the list |
| `modal` | Centered card over blurred/dimmed backdrop | Forms — create new, edit, multi-field input |
| `dialog` | Small centered card, auto-sized to content | Confirmations — "Revoke this key?", "Approve trial?" |

### The `routes` field

The manifest gets a new `routes` field alongside `children`. Children are navigable pages (tabs or subnav). Routes are contextual pages with a display mode.

```json
"nav": {
  "label": "Customers",
  "icon": "users",
  "path": "/customers",
  "pages": "sidebar",
  "viewport": "structured",
  "children": [
    { "label": "All customers", "path": "/customers", "default": true },
    { "label": "Trial queue", "path": "/trials", "badge_source": "trial_request.submitted" },
    { "label": "Usage analytics", "path": "/usage", "requires_role": "admin" }
  ],
  "routes": [
    { "path": "/:id", "display": "drawer", "width": 520 },
    { "path": "/new", "display": "modal" },
    { "path": "/:id/edit", "display": "modal" },
    { "path": "/:id/revoke", "display": "dialog" }
  ]
}
```

### Route fields

| Field | Type | Default | Description |
|---|---|---|---|
| `path` | string | required | Route pattern (supports `:id` params) |
| `display` | `'page'` \| `'drawer'` \| `'modal'` \| `'dialog'` | `'page'` | How this page renders |
| `width` | number | varies by type | Override width (drawer: 480px, modal: 560px, dialog: 400px) |
| `requires_role` | Role | — | Minimum role to access |

### The overlay stack

The shell manages six overlay layers. Guest apps never create their own overlay DOM — they request overlays through shell-provided components or manifest routes.

```
Layer 60: Toasts (always on top, non-blocking)
Layer 50: Command palette (⌘K, overlays everything)
Layer 40: Dialog (small confirmation, blocks below)
Layer 35: Modal (centered form, blocks below)
Layer 30: Drawer (right-side detail, semi-blocking)
Layer 15: Right strip panels (AI, activity — non-blocking)
Layer  0: Viewport (the canvas with cards)
```

**Stacking rules:**

- A dialog can open on top of a modal (confirm while creating)
- A dialog can open on top of a drawer (confirm while viewing detail)
- A modal can open on top of a drawer (edit form while viewing detail)
- Drawers don't stack — opening a new drawer replaces the current one
- Right strip panels and drawers share the same physical space. Opening one closes the other. They sit between the viewport content and the right strip icons.
- Command palette overlays everything. Selecting a result closes the palette and navigates (which may close drawers/modals if the route changes).
- Toasts float above everything, always.

### Backdrop behavior

| Layer | Backdrop | Click outside | Escape key |
|---|---|---|---|
| Drawer | Subtle dim (15% black, no blur — list stays visible) | Closes drawer | Closes drawer |
| Modal | Blur + dim (`backdrop-filter: blur(8px)` + 30% black) | Closes modal | Closes modal |
| Dialog | Blur + dim (same as modal) | Does NOT close (prevents accidental dismissal) | Closes dialog |
| Command palette | Light dim (10% black) | Closes palette | Closes palette |
| Right strip panels | No backdrop (they're shell chrome, not overlays) | N/A | Closes panel |

### Drawer + right strip spatial relationship

Drawers and right strip panels share the same physical space — the area between the viewport content and the right strip icons. Opening a drawer closes the active right strip panel, and vice versa.

```
Drawer open:
┌──────────────────────────────┬──────────┬───┐
│ Viewport (dimmed)            │ Drawer   │ R │
│                              │ 480px    │ S │
│ Customer list visible        │          │   │
│ behind the dim               │ Customer │   │
│                              │ detail   │   │
└──────────────────────────────┴──────────┴───┘

Right strip panel open (no drawer):
┌───────────────────────────────┬─────────┬───┐
│ Viewport (no dim)             │ AI      │ R │
│                               │ Panel   │ S │
│ Content not dimmed — panels   │ 360px   │   │
│ are chrome, not overlays      │         │   │
└───────────────────────────────┴─────────┴───┘
```

### URL behavior

Overlay pages update the URL. Every overlay state is deep-linkable:

```
/app/customers                         → customer list (full page)
/app/customers/cust_123                → customer list + drawer with detail
/app/customers/new                     → customer list + modal with create form
/app/customers/cust_123/edit           → customer list + drawer + modal with edit form
/app/customers/cust_123/revoke         → customer list + drawer + dialog
```

The URL encodes the full overlay stack. Back button pops the top overlay. Browser refresh restores the full state — the shell detects the route's `display` mode and opens the correct overlay over the correct base page.

### Animations

| Type | Enter | Exit |
|---|---|---|
| Drawer | Slide from right: `translateX(100%) → translateX(0)`, 200ms ease-out | Slide right, 150ms |
| Modal | Scale + fade: `scale(0.95) opacity(0) → scale(1) opacity(1)`, 200ms ease-out | Fade out, 150ms |
| Dialog | Same as modal but faster, 150ms | Fade out, 100ms |
| Bottom sheet (mobile drawer) | Slide from bottom: `translateY(100%) → translateY(0)`, 250ms with slight spring | Slide down, 200ms |

### Focus trapping

When any overlay is open, Tab key cycles within the overlay only. Focus returns to the triggering element when the overlay closes. The shell's overlay manager handles this automatically — guest apps don't implement focus trapping.

### Mobile behavior

| Desktop | Mobile (<640px) |
|---|---|
| Drawer: 480px from right | Bottom sheet: slides up to 90vh, drag handle to dismiss |
| Modal: centered, max-width 560px | Nearly full screen, 16px padding |
| Dialog: centered, max-width 400px | Centered, max-width 340px |
| Right strip panels: 360px from right | Full screen overlay with close button |

### The complete interaction flow

```
1. User is on Customer List (full page)

2. Clicks a customer row
   → Shell routes to /customers/cust_123
   → Manifest says display: "drawer"
   → Drawer slides in from right over the list
   → List is dimmed but visible behind
   → URL updates to /customers/cust_123

3. Inside the drawer, user clicks "Edit"
   → Shell routes to /customers/cust_123/edit
   → Manifest says display: "modal"
   → Modal opens centered, on top of the drawer
   → Backdrop blurs over the drawer
   → URL updates to /customers/cust_123/edit

4. User saves the edit
   → Modal closes
   → Drawer shows updated data (still open)
   → URL returns to /customers/cust_123

5. Inside the drawer, user clicks "Revoke key"
   → Shell routes to /customers/cust_123/revoke
   → Manifest says display: "dialog"
   → Dialog opens on top of the drawer
   → "Are you sure? This cannot be undone."
   → URL updates to /customers/cust_123/revoke

6. User confirms
   → Dialog closes → toast: "API key revoked"
   → Drawer shows key revoked
   → URL returns to /customers/cust_123

7. User clicks outside the drawer (or Escape)
   → Drawer closes
   → Back on customer list, scroll position preserved
   → URL returns to /customers
```

No page reloads. No losing context. The list is always there underneath.

### Overlay CSS

**Drawer:**

```css
.overlay-drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.15);
  z-index: 30;
}

.overlay-drawer {
  position: fixed;
  top: 0;
  right: 48px;                      /* sits to the left of the right strip */
  bottom: 0;
  width: 480px;
  background: var(--card);
  border-left: 1px solid var(--card-border);
  border-radius: var(--radius) 0 0 var(--radius);
  z-index: 30;
  overflow-y: auto;
  transform: translateX(100%);
  transition: transform 200ms ease-out;
}

.overlay-drawer.open {
  transform: translateX(0);
}

/* Drawer header */
.overlay-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--card-border);
  position: sticky;
  top: 0;
  background: var(--card);
  z-index: 1;
}

.overlay-drawer-close {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  cursor: pointer;
}

.overlay-drawer-close:hover {
  background: rgba(255,255,255,0.06);
  color: var(--text-secondary);
}

.overlay-drawer-body {
  padding: 24px;
}
```

**Modal:**

```css
.overlay-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 35;
  display: flex;
  align-items: center;
  justify-content: center;
}

.overlay-modal {
  background: var(--card);
  border: 1px solid var(--card-border);
  border-radius: var(--radius);
  width: 100%;
  max-width: 560px;
  max-height: 85vh;
  overflow-y: auto;
  z-index: 35;
  transform: scale(0.95);
  opacity: 0;
  transition: transform 200ms ease-out, opacity 200ms ease-out;
}

.overlay-modal.open {
  transform: scale(1);
  opacity: 1;
}

.overlay-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--card-border);
}

.overlay-modal-body {
  padding: 24px;
}

.overlay-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 24px;
  border-top: 1px solid var(--card-border);
}
```

**Dialog:**

```css
.overlay-dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
}

.overlay-dialog {
  background: var(--card);
  border: 1px solid var(--card-border);
  border-radius: var(--radius);
  width: 100%;
  max-width: 400px;
  z-index: 40;
  transform: scale(0.95);
  opacity: 0;
  transition: transform 150ms ease-out, opacity 150ms ease-out;
}

.overlay-dialog.open {
  transform: scale(1);
  opacity: 1;
}

.overlay-dialog-body {
  padding: 24px;
}

.overlay-dialog-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.overlay-dialog-text {
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.overlay-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 24px;
  border-top: 1px solid var(--card-border);
}
```

**Mobile bottom sheet (drawer on mobile):**

```css
@media (max-width: 639px) {
  .overlay-drawer {
    top: auto;
    right: 0;
    bottom: 0;
    left: 0;
    width: 100%;
    max-height: 90vh;
    border-radius: var(--radius) var(--radius) 0 0;
    transform: translateY(100%);
  }

  .overlay-drawer.open {
    transform: translateY(0);
  }

  .overlay-drawer-drag-handle {
    display: block;
    width: 36px;
    height: 4px;
    background: var(--text-tertiary);
    opacity: 0.3;
    border-radius: 2px;
    margin: 8px auto;
  }
}

@media (min-width: 640px) {
  .overlay-drawer-drag-handle {
    display: none;
  }
}
```

### Declarative components

Guest apps use these components for route-based overlays. The shell reads the manifest `routes` and renders them automatically when the URL matches.

```tsx
// Declarative — route-based (preferred)
// The shell handles this automatically from the manifest routes field.
// When the URL is /customers/cust_123, the shell opens the drawer
// and renders the guest app's component for that route inside it.

// For content inside the drawer/modal, the guest app just returns
// its normal page component — the shell wraps it in the overlay:
export function CustomerDetailPage({ params }) {
  return (
    <AppPage title={customer.name} subtitle={customer.status}>
      <Section title="Overview" columns={3}>
        <StatCard value={customer.credits} label="Credits" />
        <StatCard value={customer.calls} label="API calls" />
        <StatCard value={customer.lastActive} label="Last active" />
      </Section>
      <Section title="API Keys" columns={1}>
        {customer.keys.map(k => <Card><KeyRow key={k} /></Card>)}
      </Section>
    </AppPage>
  )
}
```

### Imperative API

For one-off confirmations and alerts that aren't tied to routes:

```tsx
import { useOverlay } from '@ensemble-edge/ui'

const overlay = useOverlay()

// Quick confirmation — returns a promise
const confirmed = await overlay.confirm({
  title: 'Revoke API key?',
  body: 'This cannot be undone. The customer will lose access immediately.',
  confirmLabel: 'Revoke',
  confirmVariant: 'danger',
})
if (confirmed) { await revokeKey(keyId) }

// Quick alert
await overlay.alert({
  title: 'Credit limit exceeded',
  body: 'This customer has exhausted their credits.',
})

// Open a custom component as a drawer (not tied to a route)
overlay.open({
  display: 'drawer',
  content: <CustomerDetail id={customerId} />,
  width: 560,
  onClose: () => { /* cleanup */ },
})

// Open a custom component as a modal
overlay.open({
  display: 'modal',
  content: <EditCustomerForm id={customerId} onSave={handleSave} />,
  maxWidth: 640,
})
```

---

## The complete picture

Here's how it all composes for the Nendo customer manager:

### Manifest

```json
{
  "id": "nendo-customers",
  "name": "Customers",
  "category": "tool",

  "nav": {
    "label": "Customers",
    "icon": "users",
    "path": "/customers",
    "pages": "sidebar",
    "viewport": "structured",
    "children": [
      { "label": "All customers", "path": "/customers", "default": true },
      { "label": "Trial queue", "path": "/trials", "badge_source": "trial_request.submitted" },
      { "label": "Usage analytics", "path": "/usage", "requires_role": "admin" }
    ],
    "routes": [
      { "path": "/:id", "display": "drawer", "width": 520 },
      { "path": "/new", "display": "modal" },
      { "path": "/:id/edit", "display": "modal" },
      { "path": "/:id/revoke", "display": "dialog" }
    ]
  }
}
```

### What the user sees

```
┌────┬───────────────┬─────────────────────────────────────────────┐
│    │ [Logo]        │ ·  · ·  · ·  · ·  ·  · ·  · ·  · ·  · · · │ ← floating glass toolbar
│    │ Nendo         │  Customers / Trial Queue      [Export] [⌘K] │
│ [N]│               │╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┬───│
│    │ A P P S       │                                        │[✦]│
│    │ ▾ Customers   │  Trial Queue                           │[≡]│
│    │    All        │  3 pending requests    [Approve all]   │[✓]│
│    │  ► Trial queue [3]│                                    │   │
│    │    Usage      │  O V E R V I E W                       │   │
│    │               │  ┌──────────┐ ┌──────────┐ ┌────────┐│   │
│    │ WORKSPACE     │  │ 3        │ │ 8        │ │ 2.4h   ││   │
│    │ ◇ People      │  │ Pending  │ │ Approved │ │ Avg    ││   │
│    │ ◇ Brand       │  └──────────┘ └──────────┘ └────────┘│   │
│    │ ◇ Settings    │                                        │   │
│    │               │  N E E D S   R E V I E W  (3)         │   │
│    │               │  ┌─────────────────────────────────┐  │   │
│    │               │  │ acme@corp.com · 2h ago [Approve]│  │   │
│    │               │  ├─────────────────────────────────┤  │   │
│    │               │  │ beta@startup · 5h ago  [Approve]│  │   │
│    │               │  └─────────────────────────────────┘  │   │
│    │───────────────│                                        │   │
│    │ [HO] @ho      │  R E C E N T L Y   A P P R O V E D   │   │
│[+] │               │  ┌─────────────────────────────────┐  │   │
│    │               │  │ john@acme.com · Active · 3h ago │  │   │
│    │               │  └─────────────────────────────────┘  │   │
│    │               │╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┴───│
├────┴───────────────┤ 🔖 Bookmarks                    ⌘K · ? │  │ ← floating glass bookmark bar
└────────────────────┴─────────────────────────────────────────────┘
```

### The code

```tsx
import { AppPage, Section, CardGrid, StatCard, Card } from '@ensemble-edge/ui'

export function TrialQueuePage({ trials, stats }) {
  return (
    <AppPage
      title="Trial Queue"
      subtitle={`${stats.pending} pending requests`}
      actions={[
        { label: 'Approve all', icon: 'check', onClick: approveAll, variant: 'primary' },
      ]}
    >
      <Section title="Overview" columns={3}>
        <StatCard value={stats.pending} label="Pending" />
        <StatCard value={stats.approved} label="Approved this week" />
        <StatCard value={stats.avgTime} label="Avg review time" />
      </Section>

      <Section title="Needs Review" count={stats.pending} columns={1}>
        {trials.pending.map(t => (
          <Card hover onClick={() => navigate(`/trials/${t.id}`)}>
            <TrialRow trial={t} />
          </Card>
        ))}
      </Section>

      <Section title="Recently Approved" columns={1}>
        {trials.approved.map(t => (
          <Card><TrialRow trial={t} /></Card>
        ))}
      </Section>
    </AppPage>
  )
}
```

That's it. No CSS grid code. No responsive breakpoints. No theme tokens. No scrolling logic. The developer thinks: "my page has 3 sections — stats, pending trials, approved trials." The workspace makes it look like Hauser.

---

## Future: structured mode templates

The `structured` viewport mode will expand over time with pre-built page templates that developers can use as starting points:

| Template | What it provides | Use case |
|---|---|---|
| `table-view` | Page header + filter bar + data table card + pagination | Most list views |
| `detail-view` | Back link + title + tabs inside a full-page card | Detail/edit pages |
| `analytics` | Stat row + chart cards + breakdown sections | Reporting pages |
| `settings-form` | Grouped form sections with save/cancel | Settings, config |
| `kanban` | Column-based drag-and-drop board | Pipeline, task boards |
| `timeline` | Chronological event list with date headers | Activity, audit, history |

Templates are just pre-composed arrangements of the same primitives (AppPage, Section, Card, CardGrid). They're convenience, not new abstractions. A developer can always compose their own layout from the base components.

---

## Component summary

Everything a guest app developer needs to build a Hauser-quality page:

| Component | Import | Purpose |
|---|---|---|
| `AppPage` | `@ensemble-edge/ui` | Page header with title, subtitle, actions, back link |
| `Section` | `@ensemble-edge/ui` | Labeled card group with uppercase tracked header |
| `Card` | `@ensemble-edge/ui` | Floating content surface (the base primitive) |
| `CardGrid` | `@ensemble-edge/ui` | Responsive grid for cards |
| `PageCard` | `@ensemble-edge/ui` | Full-width card for detail views |
| `SplitLayout` | `@ensemble-edge/ui` | Master/detail side-by-side |
| `StatCard` | `@ensemble-edge/ui` | Big number + label + delta |
| `DataCard` | `@ensemble-edge/ui` | Label/value pairs, progress bars |
| `Pill` | `@ensemble-edge/ui` | Status badges (critical, success, etc.) |
| `ProgressBar` | `@ensemble-edge/ui` | Horizontal bar with color coding |
| `DataRow` | `@ensemble-edge/ui` | Label + bar + value (score breakdown) |
| `useOverlay` | `@ensemble-edge/ui` | Imperative overlay API — confirm, alert, open drawer/modal |

All components consume workspace CSS variables automatically. All are responsive. All follow the floating-card-on-canvas design language. Overlay components (drawer, modal, dialog) are managed by the shell's overlay stack — guest apps never create their own overlay DOM.

The developer imports, composes, and ships — the workspace makes it beautiful.