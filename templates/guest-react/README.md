# {{APP_NAME}}

A guest app for Ensemble Workspace. Renders inside the workspace shell using `@ensemble-edge/workspace/ui` components.

## Quick start

```bash
pnpm install
pnpm run build
pnpm run dev   # wrangler dev on :8789
```

A bare GET returns `HTTP 400 MISSING_CONTEXT` — that's correct. The worker rejects requests without gateway-injected headers.

## Deploy

```bash
pnpm run deploy
```

## Install into a workspace

Add to your **workspace** worker's `wrangler.toml`:

```toml
[[services]]
binding = "{{BINDING_NAME}}"
service = "{{WORKER_NAME}}"
```

Redeploy the workspace worker, then insert a `guest_apps` row:

```bash
wrangler d1 execute <workspace-db> --remote --command "
  INSERT INTO guest_apps (
    workspace_id, id, name, icon, category,
    connection_type, binding_name, enabled, required_role
  ) VALUES (
    '<YOUR_WORKSPACE_ID>', '{{APP_ID}}', '{{APP_NAME}}', '{{ICON}}', 'tool',
    'service_binding', '{{BINDING_NAME}}', 1, 'member'
  );
"
```

The sidebar entry appears immediately.

## Editing this app

- `src/app.tsx` — the React app rendered inside the iframe. Import from `@ensemble-edge/workspace/ui` for native-looking components.
- `src/index.ts` — the worker entry. Usually doesn't need changes; routing lives in `app.tsx`.
- `src/styles.css` — Tailwind v4 entry. First line MUST be the `@import` of workspace's globals.

## Reference

The canonical reference implementation lives in workspace's repo at `packages/connectors/hello-react/`. If something stops working, compare against that.

For full architecture and debug guidance, see [building-a-guest-worker.md](https://github.com/ensemble-edge/workspace/blob/v0.1.3/docs/guides/building-a-guest-worker.md).
