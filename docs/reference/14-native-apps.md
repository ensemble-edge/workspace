## 22. The Ensemble Native App

### Why Tauri, Not Electron or Capacitor

Slack's history tells us what not to do. They started on MacGap v1 (a lightweight WebView wrapper), hit its limits, then rewrote in Electron — bundling an entire copy of Chromium + Node.js per app. Today, Slack's desktop app weighs 300MB+ and consumes 1-2GB of RAM when you're signed into multiple workspaces. Each workspace runs a separate Chromium renderer process. It works, but it's bloated.

Capacitor (from the Ionic team) is better for mobile but weaker on desktop — it doesn't produce true native macOS/Windows apps, just wrapped WebViews without deep OS integration.

**Tauri v2** is the right choice for Ensemble because it covers all five platforms from one codebase:

| Platform | WebView Used | Native Layer | App Size |
|---|---|---|---|
| **macOS** | WebKit (built into macOS) | Swift plugins | ~5-10MB |
| **Windows** | Edge WebView2 (built into Windows) | Rust | ~5-10MB |
| **Linux** | WebKitGTK | Rust | ~5-10MB |
| **iOS** | WKWebView (built into iOS) | Swift plugins | ~8-15MB |
| **Android** | Android WebView (Chromium-based) | Kotlin plugins | ~8-15MB |

The key difference from Electron: Tauri uses the operating system's **built-in** WebView instead of bundling its own copy of Chromium. This means the app is tiny, uses less memory, and gets security updates from the OS itself. The native shell is written in Rust (fast, safe, tiny binary) with Swift extensions for Apple platforms and Kotlin for Android.

### The Ensemble App Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ENSEMBLE NATIVE APP                           │
│                    (Tauri v2 — all platforms)                    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    NATIVE SHELL (Rust)                      │  │
│  │                                                             │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │  │
│  │  │ Workspace   │  │ Credential   │  │ Push             │  │  │
│  │  │ Manager     │  │ Store        │  │ Notifications    │  │  │
│  │  │             │  │              │  │                  │  │  │
│  │  │ Add/remove  │  │ macOS:       │  │ APNs (Apple)     │  │  │
│  │  │ workspaces  │  │  Keychain    │  │ FCM (Android)    │  │  │
│  │  │ Track state │  │ iOS:         │  │ Routes to correct│  │  │
│  │  │ Switch ctx  │  │  Keychain    │  │ workspace        │  │  │
│  │  │ Unread count│  │ Android:     │  │                  │  │  │
│  │  │             │  │  Keystore    │  │                  │  │  │
│  │  │             │  │ Windows:     │  │                  │  │  │
│  │  │             │  │  Credential  │  │                  │  │  │
│  │  │             │  │  Manager     │  │                  │  │  │
│  │  └─────────────┘  └──────────────┘  └──────────────────┘  │  │
│  │                                                             │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │  │
│  │  │ Biometric   │  │ Deep         │  │ Offline          │  │  │
│  │  │ Auth        │  │ Linking      │  │ Cache            │  │  │
│  │  │             │  │              │  │                  │  │  │
│  │  │ Touch ID    │  │ ensemble://  │  │ Nav config       │  │  │
│  │  │ Face ID     │  │ ~workspace/  │  │ Theme config     │  │  │
│  │  │ Fingerprint │  │ app/path     │  │ Recent data      │  │  │
│  │  │ Windows     │  │              │  │ Unread state     │  │  │
│  │  │ Hello       │  │              │  │                  │  │  │
│  │  └─────────────┘  └──────────────┘  └──────────────────┘  │  │
│  │                                                             │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │  │
│  │  │ System Tray │  │ Global       │  │ Auto-Update      │  │  │
│  │  │ / Menu Bar  │  │ Shortcuts    │  │                  │  │  │
│  │  │             │  │              │  │ Check for new    │  │  │
│  │  │ macOS: menu │  │ ⌘+Shift+E   │  │ versions from    │  │  │
│  │  │ bar icon    │  │ to toggle    │  │ ensemble.ai      │  │  │
│  │  │ w/ unread   │  │ Ensemble     │  │ registry         │  │  │
│  │  │ badge       │  │              │  │                  │  │  │
│  │  └─────────────┘  └──────────────┘  └──────────────────┘  │  │
│  │                                                             │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│                              ▼                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    PLATFORM PLUGINS                         │  │
│  │                                                             │  │
│  │  macOS/iOS (Swift)        Android (Kotlin)                  │  │
│  │  ─────────────────        ─────────────────                 │  │
│  │  Keychain access          Keystore access                   │  │
│  │  Touch ID / Face ID       Fingerprint/Face                  │  │
│  │  APNs registration        FCM registration                  │  │
│  │  Share extension           Share intent                      │  │
│  │  Spotlight indexing        App shortcuts                     │  │
│  │  Menu bar widget          Quick settings tile               │  │
│  │  Handoff support          —                                 │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│                              ▼                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    AIUX WEB SHELL                           │  │
│  │               (Same code as browser version)                │  │
│  │                                                             │  │
│  │  Preact + Tailwind + @ensemble-edge/sdk + @ensemble-edge/ui                  │  │
│  │  Loaded in native WebView                                   │  │
│  │  Communicates with Rust core via Tauri IPC                  │  │
│  │  Connects to workspace's Cloudflare Worker backend          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### The macOS Experience

The macOS app should feel native — not like a web page in a frame. Key behaviors:

**Menu Bar:**
- Ensemble icon in the macOS menu bar (top-right)
- Click to see workspace list with unread counts
- Quick switch between workspaces from the menu bar
- "Do Not Disturb" toggle per workspace
- Status indicator (online/away/busy)

**Dock:**
- Ensemble icon with badge count (total unreads across all workspaces)
- Right-click for workspace quick-switch
- Bounce on new notification (configurable)

**macOS Integration:**
- Full `⌘` keyboard shortcuts (`⌘+K` for command palette, `⌘+1-9` for workspace switch)
- Native macOS notifications (grouped by workspace)
- Touch ID for re-authentication
- Spotlight integration: search "Ensemble CRM contact Jane" → deep links into the workspace
- Handoff: start on Mac, continue on iPhone (same workspace, same context)
- Share extension: share files/links from any app directly into an Ensemble workspace
- Native window management: split view, full screen, Mission Control
- Frameless window with native traffic lights (close/minimize/maximize)

**Window Layout:**

```
┌─── Ensemble ─────────────────────────────────────────────────┐
│ ● ● ●                                                        │
│ ┌──┐ ┌───────────────────────────────────────────────────┐   │
│ │🟢│ │                                                   │   │
│ │  │ │        ┌─ The AIUX web shell renders here ────┐   │   │
│ │🔵│ │        │                                      │   │   │
│ │  │ │        │  (workspace switcher, sidebar,       │   │   │
│ │⚫│ │        │   toolbar, viewport, panels —        │   │   │
│ │  │ │        │   all rendered in WebView)            │   │   │
│ │🟡│ │        │                                      │   │   │
│ │  │ │        │                                      │   │   │
│ │  │ │        └──────────────────────────────────────┘   │   │
│ │[+]│ │                                                   │   │
│ └──┘ └───────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘

The narrow left strip is the native workspace switcher
(rendered by Tauri, not the WebView).
Everything else is the AIUX web shell.
```

The workspace switcher strip on the far left is rendered **natively** by the Tauri app, not by the WebView. This means it persists even if a workspace's web content is loading, and it can show unread badges from the push notification system without needing a WebSocket connection to every workspace simultaneously.

### The iOS Experience

```
┌─────────────────────────────┐
│ ● ●                    9:41 │
│ ┌─────────────────────────┐ │
│ │                         │ │
│ │    AIUX web shell       │ │
│ │    (workspace content)  │ │
│ │                         │ │
│ │    Sidebar → hamburger  │ │
│ │    Panels → sheets      │ │
│ │                         │ │
│ │                         │ │
│ │                         │ │
│ │                         │ │
│ └─────────────────────────┘ │
│                             │
│ ┌─ Bottom Tab Bar ────────┐ │
│ │ [🏠] [👥] [🤖] [📁] [⋯]│ │
│ │ Home  CRM   AI  Files More│ │
│ └─────────────────────────┘ │
│                             │
│ ┌─ Workspace Bar ─────────┐ │
│ │ [🟢 Ownly] [🔵 HO Cap]  │ │
│ │ [⚫ Circuit] [+ Add]     │ │
│ │ (swipe to switch)        │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

- Workspace bar at the very top or bottom (swipeable, like Slack's workspace switcher but cleaner)
- Bottom tab bar configured by the Navigation Hub core app's mobile config
- Panels (AI assistant, notifications) open as iOS sheets (swipe down to dismiss)
- Face ID / Touch ID for app unlock
- iOS Share extension to send content to any workspace
- Widget: unread count per workspace on the home screen
- Live Activities: show active tasks / ongoing AI conversations

### The Android Experience

Similar to iOS, adapted for Android conventions:
- Material You theming (pulls workspace brand colors into system accent)
- Notification channels per workspace
- App shortcuts for quick workspace access
- Back gesture navigation
- Quick Settings tile for Ensemble status

### The Connect Screen (First Launch)

When you download Ensemble and open it for the first time, you see the **Connect Screen**. This is where the addressing system matters.

```
┌─────────────────────────────────────────┐
│                                         │
│          ┌──────────────────┐           │
│          │   ◆ ensemble     │           │
│          └──────────────────┘           │
│                                         │
│     Connect to your workspace           │
│                                         │
│     ┌─────────────────────────────┐     │
│     │  ~                          │     │
│     └─────────────────────────────┘     │
│                                         │
│     ┌─────────────────────────────┐     │
│     │  Connect                    │     │
│     └─────────────────────────────┘     │
│                                         │
│     ─── or ───                          │
│                                         │
│     Scan QR code                        │
│     Paste invite link                   │
│     Browse ensemble.ai workspaces       │
│                                         │
│     ─────────────────────               │
│                                         │
│     New to Ensemble?                    │
│     Create a workspace →                │
│                                         │
└─────────────────────────────────────────┘
```

---


### The Ensemble Protocol (`ensemble://`)

### Custom URL Scheme

The Ensemble app registers a custom URL protocol handler. This enables deep linking from anywhere — web pages, emails, QR codes, other apps, Spotlight.

```
ensemble://~ownly
ensemble://~ownly/app/crm/contacts/123
ensemble://~circuit/app/_files/folders/board-docs
ensemble://connect/~ownly-portal?invite=ABC123
ensemble://switch/~ho-capital
```

### Protocol Syntax

```
ensemble://[action]/[~workspace]/[path]

Actions:
  (none)    → Open workspace (default)
  connect   → Connect to a new workspace
  switch    → Switch to an already-connected workspace
  invite    → Accept an invitation
```

### Universal Links (Web → App)

When someone clicks a link like `https://ownly.ensemble.ai/app/crm/contacts/123`:

1. If Ensemble app is installed → opens directly in the app via Universal Link (iOS) / App Link (Android) / registered protocol (macOS)
2. If not installed → opens in the browser, with a banner: "This workspace is better in the Ensemble app. [Download]"

The web version is always available as a fallback. The app is the premium experience.

---


### Multi-Workspace State Management

### The Rust Core's Role

The Tauri Rust core manages the state that lives across workspaces — things the web shell can't handle because it only sees one workspace at a time.

```rust
// Simplified workspace manager state
struct WorkspaceManager {
    // All connected workspaces
    workspaces: Vec<ConnectedWorkspace>,
    
    // Which workspace is currently active
    active_workspace: Option<String>,
    
    // Unread counts (updated via push notifications)
    unread_counts: HashMap<String, UnreadCount>,
    
    // Credential store (per-workspace JWT refresh tokens)
    credentials: SecureStore,
}

struct ConnectedWorkspace {
    slug: String,                    // "ownly"
    tilde_address: String,           // "~ownly"
    endpoint: String,                // "https://ownly.ensemble.ai"
    name: String,                    // "Ownly Group"
    logo_url: Option<String>,
    theme_primary_color: String,     // For native UI accent
    last_accessed: DateTime,
    position: u32,                   // Sort order in switcher
    notifications_enabled: bool,
    status: WorkspaceStatus,         // online, connecting, error
}

struct UnreadCount {
    total: u32,
    by_app: HashMap<String, u32>,    // "guest:crm" → 3, "bundled:notifications" → 12
    has_mentions: bool,              // Badge should be more prominent
}
```

### What the Rust Core Handles vs. the WebView

| Concern | Handled By | Why |
|---|---|---|
| Workspace list + switching | Rust (native UI) | Must persist across workspace loads |
| Unread counts | Rust (push notifications) | Must update without WebSocket to every workspace |
| Credentials | Rust (secure store) | Keychain/Keystore access requires native code |
| Biometric auth | Rust + Swift/Kotlin plugin | OS-level API |
| Deep link routing | Rust | Intercepts `ensemble://` before WebView loads |
| Auto-update | Rust (Tauri updater) | Background check against registry |
| App icon badge | Rust (native API) | Sum of all workspace unread counts |
| System tray / menu bar | Rust (native API) | Quick access outside the main window |
| Everything else | WebView (AIUX shell) | The full workspace experience |

The key insight: the Rust core is **thin**. It handles the multi-workspace chrome and OS integration. The actual workspace experience — sidebar, apps, content, panels — is 100% the web shell, exactly as it runs in the browser. One codebase for the UI. Rust just wraps it with native superpowers.

### Background Workspace Management

When you have 8-10 workspaces connected, the app doesn't keep WebView instances for all of them. That would be Slack's mistake. Instead:

1. **Active workspace:** Full WebView, live WebSocket connection
2. **Recently active (last 2-3):** WebView preserved in memory but suspended (no network activity)
3. **Inactive workspaces:** No WebView. Only push notification state in the Rust core.

When you switch to an inactive workspace:
1. Rust core activates the WebView for that workspace
2. If a suspended WebView exists → resume it (instant switch, < 100ms)
3. If not → create a new WebView, load the workspace (1-2 seconds, shows the cached theme immediately while loading)
4. The workspace you left → moves to "recently active" (preserved but suspended)

This keeps memory usage sane. 8 workspaces don't mean 8 Chromium processes like Slack. They mean 1 active + 2 suspended + 5 push-notification-only.

---

