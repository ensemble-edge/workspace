# Phase 3: Extract Shell as Deployable Package

**Status:** Blocked by Phase 2 (core apps need to work first)
**Goal:** Extract the shell from `packages/core/src/shell/` into `@ensemble-edge/shell` — a standalone package that can be versioned, built, and deployed independently.

---

## Why Extract

Right now the shell lives inside `@ensemble-edge/core`. This means:
- Every project that uses Ensemble bundles the shell into their Worker
- Shell updates require rebuilding and redeploying every workspace Worker
- The shell JS+CSS is inlined as a 1.8MB string in `assets.generated.ts`

After extraction:
- `@ensemble-edge/shell` is a separate npm package
- Projects get shell updates by running `bun update`
- In cloud mode, the shell is deployed to R2 once and served globally
- The Worker stays small — just API routes

---

## Package Structure

```
packages/shell/
├── package.json           # @ensemble-edge/shell
├── tsconfig.json
├── vite.config.ts         # Build config for SPA bundle
├── src/
│   ├── index.tsx          # Shell entry point (createRoot + mount)
│   ├── Shell.tsx          # Main layout component
│   ├── components/
│   │   ├── AppSidebar.tsx
│   │   ├── Viewport.tsx
│   │   └── index.ts
│   ├── apps/
│   │   ├── registry.ts   # Page registry
│   │   └── core/          # Core app page components
│   │       ├── home/
│   │       ├── brand/
│   │       ├── people/
│   │       └── ...
│   ├── state/             # Preact Signals (workspace, user, theme, nav)
│   │   ├── workspace.ts
│   │   ├── user.ts
│   │   ├── theme.ts
│   │   ├── nav.ts
│   │   └── index.ts
│   └── lib/
│       └── icons.ts       # Icon mapping
├── dist/
│   ├── shell.js           # Built SPA bundle
│   └── shell.css          # Built CSS
```

---

## Build Pipeline

Replace the current `assets.generated.ts` approach:

1. **Development:** Wrangler compiles shell source directly (current approach via package.json `"main": "src/index.ts"`)
2. **Production build:** Vite builds the SPA into `dist/shell.js` + `dist/shell.css`
3. **Core integration:** `@ensemble-edge/core` imports the built assets:
   ```typescript
   // packages/core/src/shell-assets.ts
   import { readFileSync } from 'fs';
   export const SHELL_JS = readFileSync(
     require.resolve('@ensemble-edge/shell/dist/shell.js'), 'utf-8'
   );
   ```
4. **Cloud mode:** Built assets uploaded to R2 during CI/CD

---

## Migration Steps

1. Create `packages/shell/package.json` with proper dependencies
2. Move `packages/core/src/shell/` → `packages/shell/src/`
3. Move `packages/core/src/shell/state/` → `packages/shell/src/state/`
4. Update imports in shell components (relative paths change)
5. Add Vite build config
6. Update `@ensemble-edge/core` to import shell assets from new package
7. Delete `assets.generated.ts`
8. Test both standalone and cloud modes

---

## Versioning

- Shell version is independent of core version
- Shell follows semver: patch = bugfix, minor = new feature, major = breaking
- `@ensemble-edge/core` declares shell as a dependency with `^` range
- Cloud mode pins to specific shell versions (proxy fetches from R2 by version)

---

## Deliverables

- [ ] `@ensemble-edge/shell` package with its own build
- [ ] Vite config producing `shell.js` + `shell.css`
- [ ] `@ensemble-edge/core` imports built shell assets (not inline string)
- [ ] `assets.generated.ts` deleted
- [ ] Development workflow still works (wrangler dev compiles from source)
- [ ] Shell version tracked independently
