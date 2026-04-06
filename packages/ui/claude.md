# AI Coding Agent Guidance for @ensemble-edge/ui

This document provides context for AI coding agents working on the @ensemble-edge/ui package.

## Package Purpose

@ensemble-edge/ui is the themed component library for Ensemble Workspace:
- Built on **shadcn/ui** (React + Radix UI + Tailwind CSS)
- Contains shadcn/ui components that can be updated via CLI
- Contains Ensemble-specific custom components
- Used by the shell, connectors (guest apps), and any workspace UI

## Directory Structure

```
packages/ui/
├── src/
│   ├── components/
│   │   ├── ui/              # shadcn/ui components (from CLI)
│   │   │   ├── button.tsx
│   │   │   ├── dialog.tsx
│   │   │   └── ...
│   │   └── ensemble/        # Our custom components
│   │       ├── stat-card.tsx
│   │       └── ...
│   ├── lib/
│   │   └── utils.ts         # cn() helper
│   ├── hooks/               # Shared React hooks
│   ├── globals.css          # Tailwind + CSS variables
│   └── index.ts             # Main exports
├── components.json          # shadcn/ui CLI config
├── tailwind.config.ts       # Shared tailwind config
└── README.md                # Usage + update workflow
```

## Key Concepts

### 1. shadcn/ui Components

Components in `src/components/ui/` come directly from shadcn/ui CLI:
- **Do not modify** unless intentionally customizing
- Use `pnpm ui:diff` to check for upstream updates
- Use `pnpm ui:update` to pull latest versions (overwrites files)

### 2. Ensemble Components

Components in `src/components/ensemble/` are our custom additions:
- Follow shadcn patterns (React, cn(), forwardRef)
- Safe to modify — CLI won't touch these
- Export from `src/index.ts`

### 3. CSS Variables

All theming uses HSL CSS variables (shadcn/ui pattern):

```css
:root {
  --primary: 240 5.9% 10%;        /* H S% L% without hsl() */
  --primary-foreground: 0 0% 98%;
  --radius: 0.5rem;
}
```

Usage in Tailwind: `bg-primary`, `text-primary-foreground`

### 4. cn() Utility

The `cn()` function from `@/lib/utils` combines classes:

```tsx
import { cn } from "@/lib/utils"

<div className={cn("base-classes", isActive && "active-class", className)} />
```

It uses `clsx` for conditionals + `tailwind-merge` for deduplication.

## Component Patterns

### Creating a New Ensemble Component

```tsx
import * as React from "react"
import { cn } from "@/lib/utils"

interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  value: string | number
  trend?: "up" | "down" | "neutral"
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ className, title, value, trend, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg border bg-card p-4 text-card-foreground shadow-sm",
          className
        )}
        {...props}
      >
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
        {trend && (
          <span className={cn(
            "text-xs",
            trend === "up" && "text-green-600",
            trend === "down" && "text-red-600"
          )}>
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}
          </span>
        )}
      </div>
    )
  }
)
StatCard.displayName = "StatCard"

export { StatCard }
export type { StatCardProps }
```

### Using CVA for Variants

For components with multiple variants, use `class-variance-authority`:

```tsx
import { cva, type VariantProps } from "class-variance-authority"

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        destructive: "bg-destructive text-destructive-foreground",
        outline: "border border-input bg-background",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}
```

## Important Notes

1. **React, not Preact** — This package uses React (required for Radix UI)
2. **No RSC** — `rsc: false` in components.json (Cloudflare Workers don't support RSC)
3. **Guest apps can import** — Connectors can use `@ensemble-edge/ui` directly
4. **Update workflow** — See README.md for how to sync with shadcn/ui upstream

## Common Tasks

### Add a shadcn component
```bash
npx shadcn@latest add accordion
# Then export in src/index.ts
```

### Check for upstream updates
```bash
pnpm ui:diff
```

### Update all shadcn components
```bash
pnpm ui:update
```

### Run type checking
```bash
pnpm typecheck
```
