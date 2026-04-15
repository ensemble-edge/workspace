# Workstream 6: Native Apps

> Tauri v2 native apps for macOS, iOS, Android, Windows, and Linux.

## Scope

This workstream builds the Ensemble native app using Tauri v2:

- Rust core for multi-workspace management
- Platform-specific plugins (Swift for Apple, Kotlin for Android)
- OS integration (Keychain, biometrics, push notifications, deep links)
- Native workspace switcher (outside WebView)
- Background workspace management

## Reference Specs

| Spec | Sections |
|------|----------|
| [14-native-apps.md](../reference/14-native-apps.md) | Full Tauri architecture, platform experiences |
| [01-overview.md](../reference/01-overview.md) | §3 Native app tech stack |

## Dependencies

**Blocked by:**
- Workstream 2 (Shell) — the WebView renders the same shell
- Workstream 1 (Foundation) — auth tokens, workspace resolution

**Blocks:**
- Nothing directly, but completes the product experience

## Why Tauri v2, Not Electron

| Factor | Electron | Tauri v2 |
|--------|----------|----------|
| App size | 300MB+ (bundles Chromium) | 5-15MB (uses OS WebView) |
| Memory | 1-2GB for multiple workspaces | ~100MB for same |
| Platforms | macOS, Windows, Linux only | + iOS, Android |
| Native code | Node.js | Rust + Swift/Kotlin plugins |
| Updates | App updates Chromium | OS updates WebView |

## Deliverables

### Phase 6a: Rust Core
- [ ] `WorkspaceManager` — add/remove workspaces, track state
- [ ] `CredentialStore` — per-platform secure storage (Keychain, Keystore, Credential Manager)
- [ ] Push notification routing (APNs/FCM → correct workspace)
- [ ] Deep link handling (`ensemble://~workspace/path`)
- [ ] Auto-updater (check registry, background download)

### Phase 6b: macOS App
- [ ] Menu bar icon with workspace list and unread counts
- [ ] Dock badge (total unreads)
- [ ] Touch ID integration
- [ ] Native window with traffic lights
- [ ] Spotlight indexing (search workspace content)
- [ ] Handoff support (continue on iPhone)
- [ ] Share extension

### Phase 6c: iOS App
- [ ] Bottom workspace bar (swipeable)
- [ ] Bottom tab bar from Navigation Hub config
- [ ] Face ID / Touch ID
- [ ] iOS Share extension
- [ ] Home screen widget (unread counts)
- [ ] Live Activities for ongoing tasks

### Phase 6d: Android App
- [ ] Material You theming (workspace brand → system accent)
- [ ] Notification channels per workspace
- [ ] App shortcuts for quick access
- [ ] Fingerprint/Face unlock
- [ ] Quick Settings tile

### Phase 6e: Windows & Linux
- [ ] System tray icon
- [ ] Windows Hello integration
- [ ] Global shortcuts

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ENSEMBLE NATIVE APP                           │
│                    (Tauri v2 — all platforms)                    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    NATIVE SHELL (Rust)                      │  │
│  │  WorkspaceManager │ CredentialStore │ PushNotifications    │  │
│  │  BiometricAuth │ DeepLinking │ OfflineCache │ AutoUpdate  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    PLATFORM PLUGINS                         │  │
│  │  macOS/iOS (Swift)              Android (Kotlin)            │  │
│  │  Keychain, Touch/Face ID        Keystore, Biometrics       │  │
│  │  APNs, Spotlight, Handoff       FCM, App Shortcuts         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    AIUX WEB SHELL                           │  │
│  │               (Same code as browser version)                │  │
│  │  Loaded in native WebView, talks to Rust via Tauri IPC     │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Background Workspace Management

With 8-10 connected workspaces:

| State | WebView | Network |
|-------|---------|---------|
| **Active** | Full WebView, live | WebSocket/SSE connection |
| **Recent (2-3)** | Preserved, suspended | No network |
| **Inactive** | No WebView | Push notifications only |

Switching to inactive workspace: ~1-2s (create WebView, load cached theme, fetch fresh data).

## Acceptance Criteria

- [ ] macOS app builds and runs from single codebase
- [ ] iOS app builds and runs from same codebase
- [ ] Credentials stored securely per platform
- [ ] Push notifications route to correct workspace
- [ ] Deep links open correct workspace/app/page
- [ ] Biometric auth works on all platforms
- [ ] Memory stays reasonable with 8+ workspaces

## Open Questions

1. **Menu bar vs dock-only**: Should macOS be menu bar app or dock app? (Proposal: both — menu bar for quick access, dock for full window)
2. **Offline mode**: Cache how much data? (Proposal: nav config, theme, recent 50 items per app)
3. **Auto-update frequency**: Check interval? (Proposal: daily, user can force check)

## Estimated Effort

**8-10 weeks** — native development is slower, plus 5 platforms.

**Suggested phasing:**
1. macOS first (2-3 weeks) — primary developer platform
2. iOS second (2 weeks) — shares Swift plugins with macOS
3. Android third (2-3 weeks) — Kotlin plugins
4. Windows/Linux last (1-2 weeks) — simpler, fewer native features
