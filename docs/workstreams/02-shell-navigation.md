# Workstream 2: Shell & Navigation

> The visual chrome that wraps everything — workspace switcher, sidebar, toolbar, viewport, panels.

## Scope

This workstream builds the Preact shell that provides consistent navigation:

- Workspace switcher (left edge, always dark)
- Sidebar with Slack-inspired sections (Apps, Agents, People, Docs, Quick Links, Workspace)
- Toolbar (breadcrumbs, search trigger, profile)
- Viewport (where apps render)
- Panel manager (AI panel, notifications)
- Command palette (⌘K)
- Bookmark bar

## Reference Specs

| Spec | Sections |
|------|----------|
| [10-shell-navigation.md](../reference/10-shell-navigation.md) | Shell anatomy, navigation zones, nav config |
| [01-overview.md](../reference/01-overview.md) | §4 Architecture diagrams |

## Dependencies

**Blocked by:** Workstream 1 (Foundation) — needs theme engine, auth

**Blocks:**
- Workstream 3 (Core Apps) — apps render in the viewport
- Workstream 4 (Bundled Apps) — panels need shell integration
- Workstream 5 (Guest Platform) — guest apps render in viewport

## Deliverables

### Phase 2a: Shell Structure
- [ ] Preact shell SPA entry point
- [ ] Workspace switcher component (left edge)
- [ ] Sidebar component with section rendering
- [ ] Toolbar component with breadcrumbs
- [ ] Viewport component (app render target)
- [ ] Panel manager (right side panels)

### Phase 2b: Navigation System
- [ ] Nav config API (`GET /_ensemble/nav`)
- [ ] Section types: auto (apps), people, docs, links, manual
- [ ] Role-based visibility filtering
- [ ] Sidebar collapse/expand state persistence

### Phase 2c: Command Palette
- [ ] `⌘K` trigger and modal
- [ ] Federated search (parallel queries to app search endpoints)
- [ ] Quick actions from all apps
- [ ] Recent items tracking
- [ ] Navigation shortcuts

### Phase 2d: Responsive & Mobile
- [ ] Sidebar collapse at narrow viewports
- [ ] Mobile bottom tab bar
- [ ] Panel sheets (slide up) on mobile
- [ ] Gesture navigation (swipe for sidebar/panels)

## Acceptance Criteria

- [ ] Shell renders with all zones visible
- [ ] Sidebar navigation works for all section types
- [ ] Command palette opens and searches correctly
- [ ] Panels toggle smoothly (AI panel, notifications)
- [ ] Keyboard navigation reaches all elements
- [ ] Responsive layouts work at all breakpoints

## Open Questions

1. **Sidebar width**: 200px or 240px? (Proposal: 220px, collapsible to 52px icons)
2. **Panel default state**: AI panel open or closed by default? (Proposal: closed, remembers last state)
3. **Mobile breakpoint**: 640px or 768px? (Proposal: 640px)

## Estimated Effort

**2-3 weeks** for full shell with navigation, command palette, and responsive behavior.
