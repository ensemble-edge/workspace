# `@ensemble-edge/connector-hello-sandboxed`

The reference **sandboxed** guest app — runs in a strict iframe, no shared origin or runtime with the workspace. Communicates with the host via typed postMessage.

For trusted apps that should look pixel-native, use [`hello-react`](../hello-react/) instead. For sandboxed apps you don't trust to share the workspace's React tree, use this pattern.

## How it differs from `hello-react`

| | hello-react (trusted) | hello-sandboxed |
|---|---|---|
| Iframe sandbox | `allow-same-origin` + scripts/forms/popups | `allow-scripts` only |
| Origin | Same as workspace | `null` |
| Loads workspace runtime | Yes (`window.Ensemble`) | No |
| UI library | `@ensemble-edge/ui` via runtime | Bring your own |
| Communication | Direct function calls | postMessage only |
| Visual consistency | Pixel-native by design | DIY (use workspace brand CSS optionally) |
| Bundle size | ~1 KB (runtime cached separately) | Whatever you ship |

## Install into a workspace

```bash
wrangler deploy
```

Then in your workspace's `wrangler.toml`:
```toml
[[services]]
binding = "HELLO_SANDBOXED"
service = "hello-sandboxed-connector"
```

Redeploy workspace, then register:
```bash
wrangler d1 execute <workspace-db> --remote --command "
  INSERT INTO guest_apps (
    workspace_id, id, name, icon, category,
    connection_type, binding_name, enabled, required_role, isolation
  ) VALUES (
    '<YOUR_WORKSPACE_ID>', 'hello-sandboxed', 'Hello, Sandboxed', 'lock', 'tool',
    'service_binding', 'HELLO_SANDBOXED', 1, 'member', 'sandboxed'
  );
"
```

The `isolation = 'sandboxed'` column tells the shell to use the strict sandbox attribute.

## Verify the sandbox is real

Open the iframe in browser DevTools → Application → check that:
- The iframe shows `origin: "null"` (not your workspace's origin)
- The iframe has `sandbox="allow-scripts"` — no `allow-same-origin`
- Trying `parent.document` from the iframe's console throws a security error
- Trying `window.parent.Ensemble` returns `undefined`

That's the isolation working as designed.

## protocol

See [`@ensemble-edge/workspace/guest-sandbox/protocol`](../../guest-sandbox/src/protocol.ts) for the message shapes. Within v1, additive changes only.
