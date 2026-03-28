# AI Coding Agent Guidance for @ensemble-edge/ui

This document provides context for AI coding agents working on the @ensemble-edge/ui package.

## Package Purpose

@ensemble-edge/ui is the themed component library for Ensemble Workspace:
- Preact components that respect workspace theming
- Tailwind CSS v4 for styling
- Accessible by default (ARIA, keyboard navigation)
- Consistent design language across all workspace apps

## Component Categories

1. **Layout** — Container, Stack, Grid, Divider
2. **Input** — Button, Input, Select, Checkbox, Radio, Toggle
3. **Display** — Card, Badge, Avatar, Icon, Table
4. **Feedback** — Toast, Modal, Spinner, Progress, Alert
5. **Navigation** — Tabs, Breadcrumb, Menu, Pagination

## Design Principles

1. **Theme-aware** — All colors reference CSS variables from the theme
2. **Composable** — Components are building blocks, not monoliths
3. **Accessible** — WCAG 2.1 AA compliance
4. **Responsive** — Mobile-first, works on all screen sizes

## Naming Convention

- Component names: PascalCase (Button, Card)
- CSS classes: `ens-{component}` and `ens-{component}--{modifier}`
- Props: camelCase with JSDoc comments

## Adding a New Component

1. Create `src/components/ComponentName.tsx`
2. Export from `src/index.ts`
3. Add CSS to theme (or use Tailwind utilities)
4. Add Storybook story (when available)
5. Add tests

## CSS Variables

Components should use these CSS variables:

```css
--ens-color-primary
--ens-color-secondary
--ens-color-background
--ens-color-surface
--ens-color-text
--ens-color-text-muted
--ens-color-border
--ens-color-success
--ens-color-warning
--ens-color-error
--ens-radius-sm
--ens-radius-md
--ens-radius-lg
--ens-shadow-sm
--ens-shadow-md
--ens-shadow-lg
```
