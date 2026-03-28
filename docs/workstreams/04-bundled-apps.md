# Workstream 4: Bundled Apps

> Optional apps that ship with the workspace binary but can be enabled/disabled per workspace.

## Scope

Bundled apps provide common functionality most workspaces want:

| App | ID | Display | Purpose |
|-----|-----|---------|---------|
| **Dashboard** | `bundled:dashboard` | viewport | Customizable widget grid |
| **AI Assistant** | `bundled:ai-assistant` | panel | Workspace-aware AI with tool calling |
| **File Manager** | `bundled:files` | viewport/panel | R2-backed file storage |
| **Notifications** | `bundled:notifications` | panel | Aggregated notification center |
| **Activity Feed** | `bundled:activity` | viewport/panel | Real-time workspace activity |
| **Status** | `bundled:status` | viewport | Health dashboard for all apps |

## Reference Specs

| Spec | Sections |
|------|----------|
| [04-bundled-apps.md](../reference/04-bundled-apps.md) | All bundled apps |
| [05-guest-sdk.md](../reference/05-guest-sdk.md) | Manifest extension points (widgets, health, etc.) |

## Dependencies

**Blocked by:**
- Workstream 2 (Shell) — panel manager, viewport
- Workstream 3 (Core Apps) — People, Apps, Brand, Knowledge

**Blocks:**
- Nothing directly, but AI Assistant is critical for the product experience

## Deliverables

### Phase 4a: Dashboard
- [ ] Widget grid with drag-drop layout
- [ ] Built-in widget types (stat card, chart, list, quick actions)
- [ ] Widget registration from guest app manifests
- [ ] Per-user dashboard customization (stored in D1)
- [ ] Widget refresh intervals

### Phase 4b: AI Assistant (Critical Path)
- [ ] Panel UI with chat interface
- [ ] LLM configuration (Workers AI default, Anthropic/OpenAI optional)
- [ ] Context assembly (active app, user permissions, knowledge graph)
- [ ] Tool calling via API gateway
- [ ] Interactive response types (chat, action cards, confirmation cards, navigation)
- [ ] `ai.tools` manifest parsing from all installed apps

### Phase 4c: Files & Notifications
- [ ] `bundled:files` — R2 file storage, folder hierarchy, preview, sharing
- [ ] `bundled:notifications` — Aggregated feed, preferences, read state

### Phase 4d: Activity & Status
- [ ] `bundled:activity` — Event stream from all apps, filters, subscriptions
- [ ] `bundled:status` — Health polling, uptime tracking, alerts, public page option

## Acceptance Criteria

- [ ] Dashboard renders widgets from multiple apps
- [ ] AI panel can call guest app APIs and render results
- [ ] Files can be uploaded, organized, and shared
- [ ] Notifications aggregate across all apps with preferences
- [ ] Activity feed shows chronological stream from all sources
- [ ] Status dashboard shows health of all installed apps

## AI Assistant Deep Dive

The AI Assistant is the most complex bundled app. Key behaviors:

```
User prompt → Context assembly → Tool resolution → Gateway API call → Result rendering

Context includes:
- Active app (from viewport state)
- User permissions
- Installed app manifests (ai.tools)
- Knowledge graph entries
- Brand voice/tone

Tool calling:
- AI selects tool from manifest declarations
- Gateway proxies with user's auth
- Audit log records every call
- Results render as cards, not just text
```

## Open Questions

1. **Dashboard default layout**: What widgets show on first load? (Proposal: Activity widget + one stat card)
2. **AI rate limits**: Requests per user per day? (Proposal: 100 for free tier, unlimited for paid)
3. **File storage quota**: Per workspace limit? (Proposal: 5GB free, 100GB paid)

## Estimated Effort

**4-5 weeks** — AI Assistant alone is ~2 weeks due to complexity.
