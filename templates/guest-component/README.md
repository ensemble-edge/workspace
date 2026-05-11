# {{APP_NAME}}

A **component-tier** guest app for Ensemble Workspace. Renders directly in the host's React tree — no iframe, no design-token propagation, no visual seams.

## Quick start

```bash
pnpm install
pnpm run build
pnpm run dev      # wrangler dev on :8789
```

## Deploy

```bash
pnpm run deploy
```

## Install into a workspace

1. Workspace `wrangler.toml`:
   ```toml
   [[services]]
   binding = "{{BINDING_NAME}}"
   service = "{{WORKER_NAME}}"
   ```
2. Redeploy workspace.
3. Insert the `guest_apps` row with `tier = 'component'`:
   ```bash
   wrangler d1 execute <workspace-db> --remote --command "
     INSERT INTO guest_apps (
       workspace_id, id, name, icon, category,
       connection_type, binding_name, enabled, required_role, tier
     ) VALUES (
       '<YOUR_WORKSPACE_ID>', '{{APP_ID}}', '{{APP_NAME}}', '{{ICON}}', 'tool',
       'service_binding', '{{BINDING_NAME}}', 1, 'member', 'component'
     );
   "
   ```

## Editing this app

- `src/component.tsx` — your React UI. Pull components from `Ensemble` (typed via `@ensemble-edge/workspace/guest-runtime`).
- `src/index.ts` — worker entry. Add API routes here.

## Reference

Canonical reference: `packages/connectors/hello-component/` in the workspace repo. The guide is at [building-a-guest-worker.md](https://github.com/ensemble-edge/workspace/blob/v0.1.9/docs/guides/building-a-guest-worker.md).
