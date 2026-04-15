# shadcn/ui Integration Plan

**Status:** Planning
**Package:** `@ensemble-edge/ui`
**Approach:** Workspace package built on shadcn/ui with clear update workflow

---

## Executive Summary

Create `@ensemble-edge/ui` as a proper workspace package that:

1. Contains shadcn/ui components (pulled via CLI)
2. Adds Ensemble-specific components
3. Exports everything for use across the monorepo
4. Has a documented workflow for pulling upstream updates

---

## Package Structure

```
packages/ui/
├── README.md                      # Usage + update workflow (critical!)
├── package.json                   # @ensemble-edge/ui
├── tsconfig.json
├── tailwind.config.ts             # Shared tailwind config
├── postcss.config.js
├── components.json                # shadcn/ui CLI config
├── src/
│   ├── index.ts                   # Main exports
│   ├── globals.css                # Tailwind + CSS variables
│   ├── lib/
│   │   └── utils.ts               # cn() helper
│   ├── components/
│   │   ├── ui/                    # shadcn/ui components (from CLI)
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── dialog.tsx
│   │   │   └── ...
│   │   └── ensemble/              # Our custom components
│   │       ├── stat-card.tsx
│   │       ├── nav-item.tsx
│   │       ├── page-header.tsx
│   │       └── ...
│   └── hooks/                     # Shared hooks
│       └── use-mobile.tsx
└── SHADCN_COMPONENTS.md           # Tracks which components are from shadcn
```

---

## Package README.md

This is the most important file — it documents how to manage the package:

```markdown
# @ensemble-edge/ui

Ensemble's UI component library built on [shadcn/ui](https://ui.shadcn.com).

## Installation

This is a workspace package. It's automatically available to other packages:

\`\`\`tsx
import { Button, Dialog, StatCard } from '@ensemble-edge/ui'
\`\`\`

## Component Types

### 1. shadcn/ui Components (`src/components/ui/`)

These come directly from shadcn/ui via CLI. **Do not modify these files** unless
you're intentionally customizing them.

Current components:
- button, input, textarea, label
- select, checkbox, radio-group, switch
- dialog, sheet, alert-dialog, popover
- dropdown-menu, tooltip, tabs
- card, table, avatar, badge, skeleton
- sonner (toasts), command (⌘K)

### 2. Ensemble Components (`src/components/ensemble/`)

Our custom components. Modify freely:
- stat-card, data-row, page-header
- nav-item, filter-bar, empty-state
- app-card

---

## Updating shadcn/ui Components

### Check for Updates

\`\`\`bash
# See what's changed upstream
cd packages/ui
npx shadcn@latest diff
\`\`\`

### Update a Single Component

\`\`\`bash
# Preview changes first
npx shadcn@latest diff button

# Apply update (overwrites local file)
npx shadcn@latest add button --overwrite
\`\`\`

### Update All Components

\`\`\`bash
# Update everything from shadcn/ui
npx shadcn@latest add --all --overwrite
\`\`\`

### Add a New Component

\`\`\`bash
# Add a component you don't have yet
npx shadcn@latest add accordion

# Then export it in src/index.ts
\`\`\`

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
\`\`\`tsx
// Instead of modifying ui/button.tsx, create:
// ensemble/action-button.tsx — your customized version
\`\`\`

---

## CSS Variables

Brand customization flows through CSS variables in `globals.css`:

\`\`\`css
:root {
  --primary: 220.9 39.3% 51%;      /* Brand accent — customizable */
  --radius: 0.75rem;                /* Corner radius — customizable */
  /* ... other tokens */
}
\`\`\`

These are set by the Workspace Brand module at runtime via
`/_ensemble/brand/css`.

---

## Adding a New Ensemble Component

1. Create the file:
   \`\`\`bash
   touch src/components/ensemble/my-component.tsx
   \`\`\`

2. Follow shadcn patterns:
   \`\`\`tsx
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
   \`\`\`

3. Export in `src/index.ts`:
   \`\`\`tsx
   export { MyComponent } from './components/ensemble/my-component'
   \`\`\`

---

## Troubleshooting

### "Component looks different after update"

shadcn/ui may have changed styling. Check the diff:
\`\`\`bash
npx shadcn@latest diff button
\`\`\`

### "I customized a component and lost changes"

You ran `--overwrite` on a customized component. Recover from git:
\`\`\`bash
git checkout -- src/components/ui/button.tsx
\`\`\`

Next time, copy to `ensemble/` before customizing.

### "New shadcn component needs a dependency"

The CLI will tell you. Install it:
\`\`\`bash
pnpm add @radix-ui/react-whatever
\`\`\`
```

---

## SHADCN_COMPONENTS.md

Track which components come from shadcn/ui:

```markdown
# shadcn/ui Component Inventory

Last synced: 2026-04-06
shadcn/ui version: latest

## Installed Components

| Component | Status | Customized? | Notes |
|-----------|--------|-------------|-------|
| button | ✅ | No | |
| input | ✅ | No | |
| textarea | ✅ | No | |
| label | ✅ | No | |
| select | ✅ | No | |
| checkbox | ✅ | No | |
| radio-group | ✅ | No | |
| switch | ✅ | No | |
| dialog | ✅ | No | |
| sheet | ✅ | No | Used for AIPanel drawer |
| alert-dialog | ✅ | No | |
| dropdown-menu | ✅ | No | |
| popover | ✅ | No | |
| tooltip | ✅ | No | |
| tabs | ✅ | No | |
| card | ✅ | No | |
| table | ✅ | No | |
| avatar | ✅ | No | |
| badge | ✅ | No | |
| skeleton | ✅ | No | |
| separator | ✅ | No | |
| scroll-area | ✅ | No | |
| sonner | ✅ | No | Toast notifications |
| command | ✅ | No | ⌘K palette |

## Not Installed (available)

- accordion
- alert
- aspect-ratio
- breadcrumb
- calendar
- carousel
- chart
- collapsible
- context-menu
- drawer
- form
- hover-card
- menubar
- navigation-menu
- pagination
- progress
- resizable
- slider
- toggle
- toggle-group

## Update Log

| Date | Components | Notes |
|------|------------|-------|
| 2026-04-06 | Initial | First install of all components |
```

---

## Package Configuration

### package.json

```json
{
  "name": "@ensemble-edge/ui",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./globals.css": "./src/globals.css",
    "./tailwind.config": "./tailwind.config.ts"
  },
  "scripts": {
    "ui:add": "npx shadcn@latest add",
    "ui:diff": "npx shadcn@latest diff",
    "ui:update": "npx shadcn@latest add --all --overwrite",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@radix-ui/react-checkbox": "^1.1.0",
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-dropdown-menu": "^2.1.0",
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-popover": "^1.1.0",
    "@radix-ui/react-radio-group": "^1.2.0",
    "@radix-ui/react-select": "^2.1.0",
    "@radix-ui/react-separator": "^1.1.0",
    "@radix-ui/react-slot": "^1.1.0",
    "@radix-ui/react-switch": "^1.1.0",
    "@radix-ui/react-tabs": "^1.1.0",
    "@radix-ui/react-tooltip": "^1.1.0",
    "@radix-ui/react-scroll-area": "^1.1.0",
    "@radix-ui/react-alert-dialog": "^1.1.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.3.0",
    "lucide-react": "^0.378.0",
    "sonner": "^1.4.0",
    "vaul": "^0.9.0",
    "cmdk": "^1.0.0"
  },
  "devDependencies": {
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.38",
    "autoprefixer": "^10.4.19",
    "tailwindcss-animate": "^1.0.7",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.4.0"
  },
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  }
}
```

### components.json (shadcn CLI config)

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/globals.css",
    "baseColor": "zinc",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

---

## Workspace Brand Customization

### Customizable Tokens

| Token | UI Control | Default |
|-------|-----------|---------|
| `--primary` | Color picker | `220.9 39.3% 51%` (blue) |
| `--radius` | Slider (0-1.5rem) | `0.75rem` |
| `--font-sans` | Font selector | System default |
| Logo mark | Image upload | None |
| Logo full | Image upload | None |
| Favicon | Image upload | None |

### Fixed Tokens (not customizable)

| Token | Value | Reason |
|-------|-------|--------|
| `--destructive` | Red | Danger must always be red |
| `--background` | Theme default | Accessibility |
| `--foreground` | Theme default | Accessibility |

### Brand Token Storage

```sql
CREATE TABLE brand_tokens (
  workspace_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (workspace_id, key)
);
```

---

## Implementation Phases

### Phase 1: Create Package ✅ COMPLETE

```
├── [x] Create packages/ui directory
├── [x] Set up package.json, tsconfig, tailwind config
├── [x] Configure components.json for shadcn CLI
├── [x] Install core components (button, input, card, dialog)
├── [x] Create src/index.ts with exports
├── [x] Write README.md and SHADCN_COMPONENTS.md
```

### Phase 2: Install All Components ✅ COMPLETE

```
├── [x] Install all needed shadcn components (24 components)
├── [x] Update SHADCN_COMPONENTS.md inventory
├── [x] Verify all exports work (typecheck passes)
```

### Phase 3: Custom Components ✅ PARTIAL

```
├── [x] stat-card
├── [ ] nav-item
├── [x] page-header
├── [x] data-row
├── [ ] filter-bar
├── [x] empty-state
├── [ ] app-card
```

### Phase 4: Shell Migration (TODO)

```
├── [ ] Migrate Preact → React in packages/core
├── [ ] Replace current components with @ensemble-edge/ui
├── [ ] Update shell components to use new UI
├── [ ] Test full shell rendering
```

### Phase 5: Brand Settings (TODO)

```
├── [ ] Color picker for --primary
├── [ ] Radius slider
├── [ ] Font selector
├── [ ] Logo uploader
├── [ ] Live preview
```

---

## Usage Example

After setup, using components is simple:

```tsx
// In any package that depends on @ensemble-edge/ui
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  StatCard,  // Ensemble custom
} from '@ensemble-edge/ui'

export function MyFeature() {
  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Something</DialogTitle>
        </DialogHeader>
        <Input placeholder="Name..." />
        <Button>Save</Button>
      </DialogContent>
    </Dialog>
  )
}
```

---

## Success Criteria

- [ ] `@ensemble-edge/ui` package created and working
- [ ] All shadcn components installable via CLI
- [ ] `pnpm ui:diff` shows update status
- [ ] `pnpm ui:update` pulls latest without breaking custom components
- [ ] README clearly documents update workflow
- [ ] Shell renders using new UI package
- [ ] Brand customization works

---

## References

- [shadcn/ui Docs](https://ui.shadcn.com/docs)
- [shadcn/ui CLI](https://ui.shadcn.com/docs/cli)
- [Radix UI](https://www.radix-ui.com/)
- [Tailwind CSS](https://tailwindcss.com/docs)
