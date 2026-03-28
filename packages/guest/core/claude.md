# AI Coding Agent Guidance for @ensemble-edge/guest

This document provides context for AI coding agents working on the @ensemble-edge/guest package.

## Package Purpose

@ensemble-edge/guest is the platform-agnostic SDK for building guest apps:
- Zero runtime dependencies (works anywhere)
- postMessage-based communication with workspace
- Type-safe API for context, auth, theme, and events
- Works in browsers, workers, and any JS runtime

## Key Concepts

1. **Guest apps are isolated** — They run in iframes and can't access workspace DOM
2. **postMessage is the bridge** — All communication goes through window.postMessage
3. **Permissions are explicit** — Apps declare what they need in manifest.permissions
4. **Theme sync is automatic** — Apps receive theme updates from workspace

## API Surface

```typescript
// Define your app
defineGuestApp({ manifest, onInit, onActivate, onDeactivate })

// Get workspace context
getContext() → { workspaceId, workspaceName, userId, userEmail }

// Auth
getAuth() → { token, expiresAt } | null
requestPermission(permission) → boolean

// Theme
getTheme() → { primaryColor, mode }
onThemeChange(callback) → unsubscribe

// Events
events.on(type, handler) → unsubscribe
events.emit(type, payload)
```

## Platform Adapters

This package is platform-agnostic. Platform-specific adapters:
- `@ensemble-edge/guest-cloudflare` — For Cloudflare Workers
- `@ensemble-edge/guest-react` — For React apps (future)
- `@ensemble-edge/guest-vue` — For Vue apps (future)

## Testing Guest Apps

Guest apps can be tested in isolation:
1. Mock the workspace context
2. Simulate postMessage events
3. Test business logic independently
