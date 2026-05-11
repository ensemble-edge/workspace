# {{APP_NAME}}

A **sandboxed** guest app for Ensemble Workspace. Runs in a strict iframe with no shared origin or runtime — communicates with the host via typed postMessage.

Use this template for:
- Third-party apps you don't fully trust
- Customer-installed widgets
- Agent-generated apps
- Apps that need a framework workspace doesn't ship (Vue, Svelte, Streamlit, etc.)

For first-party trusted apps that should look pixel-native to the workspace shell, use the `guest-react` template instead.

## Quick start

```bash
pnpm install
pnpm run build
pnpm run dev      # wrangler dev on :8789
```

## Install into a workspace

1. Add to your workspace's `wrangler.toml`:
   ```toml
   [[services]]
   binding = "{{BINDING_NAME}}"
   service = "{{WORKER_NAME}}"
   ```
2. Redeploy workspace.
3. Insert into the workspace's D1, with `isolation = 'sandboxed'`:
   ```bash
   wrangler d1 execute <workspace-db> --remote --command "
     INSERT INTO guest_apps (
       workspace_id, id, name, icon, category,
       connection_type, binding_name, enabled, required_role, isolation
     ) VALUES (
       '<YOUR_WORKSPACE_ID>', '{{APP_ID}}', '{{APP_NAME}}', '{{ICON}}', 'tool',
       'service_binding', '{{BINDING_NAME}}', 1, 'member', 'sandboxed'
     );
   "
   ```

## What you can do

| Capability | Available? |
|---|---|
| Render any HTML / JS / CSS inside the iframe | Yes |
| Use any framework (Vue, Svelte, your own React) | Yes |
| Make network requests (within iframe permissions) | Yes |
| postMessage to the host | Yes — via `connectToHost()` |
| Read workspace's brand CSS | Yes — fetch `/_ensemble/brand/css` (cross-origin-friendly) |
| Read workspace's cookies / auth | No (sandboxed) |
| Access `window.parent.Ensemble` | No (sandboxed) |
| Navigate the parent workspace | Only via `host.navigate(path)` |
