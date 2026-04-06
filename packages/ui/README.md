# @ensemble-edge/ui

Ensemble's UI component library built on [shadcn/ui](https://ui.shadcn.com).

## Installation

This is a workspace package. It's automatically available to other packages in the monorepo:

```tsx
import { Button, Dialog, StatCard } from '@ensemble-edge/ui'
```

For guest apps (connectors), add it as a dependency:

```bash
pnpm add @ensemble-edge/ui
```

## Component Types

### 1. shadcn/ui Components (`src/components/ui/`)

These come directly from shadcn/ui via CLI. **Do not modify these files** unless you're intentionally customizing them.

Current components:
- button, input, textarea, label
- select, checkbox, radio-group, switch
- dialog, sheet, alert-dialog, popover
- dropdown-menu, tooltip, tabs
- card, table, avatar, badge, skeleton
- separator, scroll-area
- sonner (toasts), command (⌘K palette)

### 2. Ensemble Components (`src/components/ensemble/`)

Our custom components. Modify freely:
- stat-card, data-row, page-header
- nav-item, filter-bar, empty-state
- app-card

---

## Updating shadcn/ui Components

### Check for Updates

```bash
# See what's changed upstream
cd packages/ui
pnpm ui:diff
```

### Update a Single Component

```bash
# Preview changes first
npx shadcn@latest diff button

# Apply update (overwrites local file)
npx shadcn@latest add button --overwrite
```

### Update All Components

```bash
# Update everything from shadcn/ui
pnpm ui:update
```

### Add a New Component

```bash
# Add a component you don't have yet
npx shadcn@latest add accordion

# Then export it in src/index.ts
```

---

## Customization Strategy

### Safe to Customize

These files are OURS — shadcn CLI won't touch them:
- `src/components/ensemble/*` — all custom components
- `src/globals.css` — CSS variables and base styles
- `src/index.ts` — exports
- `tailwind.config.ts` — extend freely

### Careful with Customization

These come from shadcn/ui — customizations may be lost on update:
- `src/components/ui/*` — shadcn components
- `src/lib/utils.ts` — the cn() helper

**If you need to customize a shadcn component:**
1. Copy it to `src/components/ensemble/` with a new name
2. Modify the copy, not the original
3. Export your version instead

Example:
```tsx
// Instead of modifying ui/button.tsx, create:
// ensemble/action-button.tsx — your customized version
```

---

## CSS Variables

Brand customization flows through CSS variables in `globals.css`:

```css
:root {
  --primary: 240 5.9% 10%;       /* Brand accent — customizable */
  --radius: 0.5rem;              /* Corner radius — customizable */
  /* ... other tokens */
}
```

These can be set dynamically by the Workspace Brand module at runtime via `/_ensemble/brand/css`.

---

## Adding a New Ensemble Component

1. Create the file:
   ```bash
   touch src/components/ensemble/my-component.tsx
   ```

2. Follow shadcn patterns:
   ```tsx
   import * as React from 'react'
   import { cn } from '@/lib/utils'

   interface MyComponentProps {
     // ...
   }

   export function MyComponent({ className, ...props }: MyComponentProps) {
     return (
       <div className={cn('...', className)} {...props}>
         {/* ... */}
       </div>
     )
   }
   ```

3. Export in `src/index.ts`:
   ```tsx
   export { MyComponent } from './components/ensemble/my-component'
   ```

---

## NPM Scripts

| Command | Description |
|---------|-------------|
| `pnpm ui:add [component]` | Add a new shadcn/ui component |
| `pnpm ui:diff` | Check for upstream updates |
| `pnpm ui:update` | Update all shadcn/ui components |
| `pnpm typecheck` | Run TypeScript type checking |

---

## Troubleshooting

### "Component looks different after update"

shadcn/ui may have changed styling. Check the diff:
```bash
npx shadcn@latest diff button
```

### "I customized a component and lost changes"

You ran `--overwrite` on a customized component. Recover from git:
```bash
git checkout -- src/components/ui/button.tsx
```

Next time, copy to `ensemble/` before customizing.

### "New shadcn component needs a dependency"

The CLI will tell you. Install it:
```bash
pnpm add @radix-ui/react-whatever
```

---

## References

- [shadcn/ui Docs](https://ui.shadcn.com/docs)
- [shadcn/ui CLI](https://ui.shadcn.com/docs/cli)
- [Radix UI](https://www.radix-ui.com/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [CVA (Class Variance Authority)](https://cva.style/docs)
