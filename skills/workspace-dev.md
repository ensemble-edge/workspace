# Workspace Development Skill

> Patterns and conventions for developing Ensemble workspace packages.

## Package Structure

All packages follow this structure:
```
packages/<name>/
├── package.json      # @ensemble-edge/<name>
├── tsconfig.json     # Extends root tsconfig
├── src/
│   ├── index.ts      # Public API exports
│   ├── index.test.ts # Main tests
│   └── ...
└── dist/             # Build output (gitignored)
```

## Creating a New Package

1. Create directory: `mkdir packages/<name>`
2. Create `package.json`:
```json
{
  "name": "@ensemble-edge/<name>",
  "version": "0.0.1",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run"
  },
  "dependencies": {},
  "devDependencies": {
    "typescript": "^5.9.0",
    "vitest": "^4.0.0"
  }
}
```

3. Create `tsconfig.json`:
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

4. Run `npm install` from root to link

## Import Conventions

```typescript
// External packages
import { Hono } from 'hono'

// Internal workspace packages
import { Button } from '@ensemble-edge/ui'
import type { User } from '@ensemble-edge/core'

// Relative imports
import { helper } from './utils'
import type { Config } from './types'
```

## Testing

- Use Vitest for all tests
- Co-locate tests with source: `foo.ts` → `foo.test.ts`
- Prefer real data over mocks
- Test behavior, not implementation

```typescript
import { describe, it, expect } from 'vitest'

describe('featureName', () => {
  it('does expected thing', () => {
    const result = feature(input)
    expect(result).toBe(expected)
  })
})
```

## Before Committing

1. `npm run lint:quick` — Fix lint errors
2. `npm run typecheck` — Ensure types are correct
3. `npm run test` — Run tests
4. `npm run knip` — Check for dead code (optional)
