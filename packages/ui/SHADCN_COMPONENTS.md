# shadcn/ui Component Inventory

Last synced: 2026-04-06
shadcn/ui version: latest (via `npx shadcn@latest`)

## Installed Components

| Component | Status | Customized? | Notes |
|-----------|--------|-------------|-------|
| alert-dialog | ✅ | No | Accessible confirmation dialogs |
| avatar | ✅ | No | User/entity avatars with fallback |
| badge | ✅ | No | Status indicators, tags |
| button | ✅ | No | Primary action component |
| card | ✅ | No | Content containers |
| checkbox | ✅ | No | Toggle selections |
| command | ✅ | No | ⌘K command palette |
| dialog | ✅ | No | Modal dialogs |
| dropdown-menu | ✅ | No | Context menus, action menus |
| input | ✅ | No | Text input fields |
| label | ✅ | No | Form labels |
| popover | ✅ | No | Floating content |
| radio-group | ✅ | No | Single-select options |
| scroll-area | ✅ | No | Custom scrollbars |
| select | ✅ | No | Dropdown select |
| separator | ✅ | No | Visual dividers |
| sheet | ✅ | No | Slide-over panels (used for AIPanel) |
| skeleton | ✅ | No | Loading placeholders |
| sonner | ✅ | No | Toast notifications |
| switch | ✅ | No | Toggle switches |
| table | ✅ | No | Data tables |
| tabs | ✅ | No | Tabbed navigation |
| textarea | ✅ | No | Multi-line text input |
| tooltip | ✅ | No | Hover tooltips |

## Not Installed (available from shadcn/ui)

These components can be added with `npx shadcn@latest add [component]`:

- accordion — Collapsible content sections
- alert — Callout messages
- aspect-ratio — Fixed aspect ratio containers
- breadcrumb — Navigation breadcrumbs
- calendar — Date picker calendar
- carousel — Image/content carousels
- chart — Data visualization (Recharts)
- collapsible — Collapsible sections
- context-menu — Right-click menus
- drawer — Bottom sheet (mobile)
- form — React Hook Form integration
- hover-card — Hover-triggered cards
- menubar — Application menu bar
- navigation-menu — Site navigation
- pagination — Page navigation
- progress — Progress indicators
- resizable — Resizable panels
- slider — Range slider
- toggle — Toggle buttons
- toggle-group — Button groups

## Update Log

| Date | Components | Notes |
|------|------------|-------|
| 2026-04-06 | Initial | First install of 24 core components |

## How to Update

1. **Check for updates:**
   ```bash
   pnpm ui:diff
   ```

2. **Update specific component:**
   ```bash
   npx shadcn@latest add button --overwrite
   ```

3. **Update all components:**
   ```bash
   pnpm ui:update
   ```

4. **Update this file** after any changes to track what was modified.
