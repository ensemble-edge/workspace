## 15. Navigation Architecture

### Design Reference: Slack-Inspired Sidebar

The navigation draws from Slack's proven sidebar model — dedicated sections that organize different types of workspace content, with clear visual hierarchy and collapsible groups. But where Slack organizes by channels and DMs, Ensemble organizes by apps, agents, people, and docs.

### Shell Navigation Zones

```
┌── Workspace Switcher (left edge, 52-56px) ──────┐
│ Fixed vertical bar, always dark (#0f172a)         │
│ Workspace logos/initials (34-36px rounded squares)│
│ Active workspace has ring/border                  │
│ ⌘+[number] to jump                              │
│ Drag to reorder                                   │
│ Badge: red notification dot per workspace          │
│ [+] at bottom to add workspace                    │
└───────────────────────────────────────────────────┘

┌── Sidebar (200-240px, themed to workspace brand) ────────┐
│                                                           │
│  [Logo] Workspace Name               [compose ✎] [▾]    │
│                                                           │
│  ── APPS ──                           (collapsible)       │
│  ◆ Dashboard          (bundled)       — active: accent bg │
│  ◆ Customers          (guest: tool)   — badge: 2          │
│  ◆ Usage              (guest: tool)                       │
│  ◆ Reconciliation     (guest: tool)                       │
│  ◆ Stripe             (guest: connector)                  │
│  ◆ Google Drive       (guest: connector)                  │
│  + Add app                                                │
│                                                           │
│  ── AGENTS ──                         (collapsible)       │
│  ⚡ Auto-recharge      (guest: agent)  — status: green dot│
│  ⚡ Churn predictor     (guest: agent)  — status: green dot│
│  ⚡ Trial approver      (guest: agent)  — status: yellow   │
│  + Add agent                                              │
│                                                           │
│  ── PEOPLE ──                         (collapsible)       │
│  ○ Matt Hawkins        @hawkins       — online (green)    │
│  ○ Sara Park           @spark         — away (yellow)     │
│  ○ Tucker Sulzberger   @tucker        — offline (gray)    │
│  → View all people                                        │
│                                                           │
│  ── DOCS ──                           (collapsible)       │
│  ▸ Operations                         — folder            │
│    ▪ Managing customers               (from @nendo/crm)   │
│    ▪ Trial workflow                   (from @nendo/crm)   │
│  ▸ Billing                            — folder            │
│    ▪ Credit system                    (from @nendo/crm)   │
│    ▪ Stripe integration               (from @ensemble-edge/stripe) │
│  ▸ Platform                           — folder            │
│    ▪ Getting started                  (from core:admin)   │
│  + Add doc page                                           │
│                                                           │
│  ── QUICK LINKS ──                    (collapsible)       │
│  ↗ nendo.com                                              │
│  ↗ Stripe dashboard                                       │
│  ↗ iq.ensemble.ai                                         │
│  + Add link                                               │
│                                                           │
│  ── WORKSPACE ──                      (admin only)        │
│  ◇ Brand                              (core:brand)        │
│  ◇ Apps & agents                      (core:apps)         │
│  ◇ People & teams                     (core:people)       │
│  ◇ Knowledge                          (core:knowledge)    │
│  ◇ Navigation                         (core:nav)          │
│  ◇ Security                           (core:auth)         │
│  ◇ Audit log                          (core:audit)        │
│  ◇ Status                             (bundled:status)    │
│  ◇ Settings                           (core:admin)        │
│                                                           │
│  ─────────────────────────────────────────                │
│  [○ MH] Matt Hawkins  @hawkins         (user footer)      │
└───────────────────────────────────────────────────────────┘

┌── Toolbar (top of main area, 40-44px) ────────────────────┐
│ Breadcrumb: Section / Page    │   [⌘K Search...]   │ [AI] │
└───────────────────────────────────────────────────────────┘

┌── Bookmark Bar (bottom, 34px, optional) ──────────────────┐
│ [Quick action 1] [Quick action 2] [Quick action 3] [+]    │
└───────────────────────────────────────────────────────────┘
```

### Key Differences from Slack's Navigation

| Concept | Slack | Ensemble |
|---|---|---|
| Primary content | Channels + DMs | Apps + Agents |
| People section | DM list with presence | Team directory with presence + roles |
| Content section | N/A | Docs (stitched from all apps) |
| External links | N/A | Quick links section |
| Admin section | Workspace settings (separate page) | Inline workspace admin apps |
| Status indicators | User presence (online/away) | User presence + agent health (green/yellow/red) |
| Add actions | Create channel | Add app, add agent, add doc, add link |
| Badges | Unread message count | App-specific badges (pending trials, low credits, etc.) |

### Section Behavior

**Apps section** — Shows all installed guest apps (tools, connectors, portals, utilities) and enabled bundled apps. Ordered by the Navigation Hub config (admin-set default, users can reorder). Each item shows its manifest icon and label. Badges come from the app's `notifications` manifest field. Clicking opens the app in the viewport.

**Agents section** — Shows all installed guest apps with `category: "agent"`. Each shows a live health status dot (green = healthy, yellow = degraded, red = down, gray = disabled) pulled from the status app's data. Clicking opens the agent's monitoring/config UI in the viewport (if it has `nav`), or shows a summary panel.

**People section** — Shows workspace members with presence status. Pulled from the People core app's API. Shows online/away/offline indicators. "View all people" opens the full People directory in the viewport. Clicking a person could open their profile or start a DM (if a communication app is installed).

**Docs section** — Shows the unified docs tree stitched from all installed apps' `docs` manifest fields, organized by section. Collapsible folders. Each doc page shows which app contributed it. Clicking opens the doc in the viewport via the docs bundled app.

**Quick links section** — External URLs bookmarked by the workspace admin or user. Opens in a new tab. Configured via the Navigation Hub core app.

**Workspace section** — Core management apps. Visible only to admins (or partially visible based on role — e.g., members might see People and Knowledge but not Security or Audit). This section is always at the bottom.

### Section Visibility and Customization

The Navigation Hub core app (`core:nav`) controls which sections are visible, their order, their default collapsed/expanded state, and role-based visibility rules. The full configuration:

```typescript
// nav config in core:nav
{
  sections: [
    {
      id: 'apps',
      label: 'Apps',
      type: 'auto',           // auto-populated from installed apps
      filter: { category: ['tool', 'connector', 'portal', 'utility'] },
      collapsible: true,
      defaultExpanded: true,
      addAction: 'install-app',
      visibility: 'all',      // everyone sees this
    },
    {
      id: 'agents',
      label: 'Agents',
      type: 'auto',
      filter: { category: ['agent'] },
      collapsible: true,
      defaultExpanded: true,
      addAction: 'install-agent',
      showHealthStatus: true,
      visibility: 'all',
    },
    {
      id: 'people',
      label: 'People',
      type: 'people',         // special type: pulls from People core app
      showPresence: true,
      maxVisible: 8,          // show top 8, "View all" link for rest
      collapsible: true,
      defaultExpanded: true,
      visibility: 'all',
    },
    {
      id: 'docs',
      label: 'Docs',
      type: 'docs',           // special type: stitches from all app manifests
      collapsible: true,
      defaultExpanded: false,  // collapsed by default (can be many pages)
      addAction: 'create-doc',
      visibility: 'all',
    },
    {
      id: 'quick-links',
      label: 'Quick links',
      type: 'links',
      collapsible: true,
      defaultExpanded: true,
      addAction: 'add-link',
      visibility: 'all',
    },
    {
      id: 'workspace',
      label: 'Workspace',
      type: 'manual',         // manually configured list of core apps
      items: ['core:brand', 'core:apps', 'core:people', 'core:knowledge',
              'core:nav', 'core:auth', 'core:audit', 'bundled:status', 'core:admin'],
      collapsible: true,
      defaultExpanded: false,
      visibility: 'admin',    // admin-only (or role-specific)
    },
  ]
}
```

Workspace admins can add custom sections, reorder sections, rename them, change visibility rules, and set collapsed/expanded defaults — all via the Navigation Hub's visual builder.

### Routing

```
URL structure:
https://acme.ensemble.ai/app/crm/contacts/123

Breakdown:
  acme.ensemble.ai  → workspace: acme
  /app/crm          → app: guest:crm (the tier prefix is implied)
  /contacts/123     → app-internal route

Core/bundled apps use the same pattern:
  /app/_brand       → core:brand     (_ prefix for core)
  /app/_people      → core:people
  /app/dashboard    → bundled:dashboard
  /app/status       → bundled:status
```

### Command Palette (`⌘K`)

Global search and command execution across all installed apps and agents:

- Federated search across all apps' search endpoints (results stream in parallel)
- Navigate to any page, any app, any doc, any person
- Execute quick actions from all apps' `quick_actions` manifest fields
- Switch workspaces
- Open/close AI panel
- Knowledge graph search ("what are our brand colors?")
- Agent commands ("check recharge status," "run churn prediction")

---

## 18. Brand Theming

The theming system is intentionally constrained: a small number of high-impact levers that are guaranteed to look good in every combination, rather than a sprawling set of options that create QA nightmares and amateur results.

The guiding principle: **the shell is Ensemble's territory, the viewport is theirs.** The workspace shell (sidebar, toolbar, AI panel, workspace switcher) uses Ensemble's design system with brand accents applied systematically. Guest apps, customer portals, and embedded content inside the viewport can use the full brand kit.

### Brand Configuration — Four Controls

The workspace brand settings panel exposes exactly four controls:

#### 1. Accent color

A single hex color that serves as the workspace's primary brand expression. Applied systematically across the shell:

- Active workspace icon in the switcher (fill color)
- Sidebar active nav item highlight
- Badges and notification dots
- Buttons (primary actions)
- User message bubbles in the AI panel
- AI send button
- Link and action text
- Filter/tab active states
- User avatar background

Validated for minimum contrast ratio against both light and dark backgrounds to ensure accessibility. If a customer's accent is too dark or too saturated for legible use in user message bubbles, the system generates a "safe" variant automatically (slightly lightened or desaturated) rather than exposing a secondary color config.

#### 2. Logo mark

A small image (rendered at 24–28px in the sidebar header, 34–36px in the workspace switcher). Automatically cropped to a rounded square. Used in:

- Workspace switcher strip (one icon per workspace)
- Sidebar header (next to workspace name)

Should be a square mark or icon — not a full wordmark. Admins upload a square image; the system handles rounding and sizing.

#### 3. Base theme

A curated palette preset that controls all background, surface, border, and text colors across the shell:

| Theme | Description | Modes |
|---|---|---|
| **Warm** | Chocolate/espresso darks, cream/linen lights. Claude-inspired undertones. Premium, approachable, editorial. | Light + Dark |
| **Cool** | Slate/blue-gray undertones. Linear/GitHub energy. Technical, precise, developer-friendly. | Light + Dark |
| **Neutral** | True grays, no color cast. Corporate, universal. Disappears completely — lets the accent do all the work. | Light + Dark |
| **Midnight** | Deep navy/indigo undertones. Premium, financial, serious. | Dark only |
| **Stone** | Olive/green-gray undertones. Earthy, organic, natural. | Light + Dark |

Each base theme defines a complete set of derived tokens. All tokens are pre-tested against every accent color range to ensure legibility and harmony. New base themes can be shipped over time as feature drops.

#### 4. Workspace name

A text string displayed in the sidebar header and window title bar. Truncated with ellipsis if it exceeds the sidebar width.

### Light/Dark Mode

Light and dark mode is a single global toggle — set by the user's system preference or a manual toggle. When the mode switches, **everything switches together**: sidebar, viewport, toolbar, AI panel, cards. There is no independent sidebar mode.

What "dark" and "light" look like depends on the base theme. Dark Warm (chocolate browns) and Dark Cool (slate grays) are very different rooms, but both are internally coherent and paired with the workspace's accent color.

Light/dark mode is a **user-level** preference, not a workspace-level setting. Every user in the workspace can independently choose light or dark, and the selected base theme adapts accordingly.

### What the Shell Does NOT Pick Up From Brand Config

These are deliberate exclusions to protect the integrity of the shell:

- **No custom fonts in the shell.** The shell uses Ensemble's system typeface everywhere — nav labels, toolbar, AI panel, badges, table headers. Brand fonts apply only inside the viewport (guest apps, portals, customer-facing content). Custom fonts in nav items break spacing, readability, and visual consistency.

- **No custom sidebar background color.** The sidebar background is derived from the base theme + light/dark mode. This prevents clashing combinations and ensures text contrast is always correct.

- **No custom border radius, density, or spacing.** Fixed by Ensemble's design system. Not meaningful brand expression — implementation details that create infinite QA permutations for zero user benefit.

- **No custom text colors.** All text colors (primary, secondary, muted, dim) are derived from the base theme. The accent color is the only custom color in the system.

- **No secondary or tertiary brand colors in the shell.** One accent color is sufficient. Additional colors create visual noise and competing hierarchies.

### Design Token Reference

For each base theme + mode combination, the system generates:

```
Shell tokens (derived from base theme + mode):
  shell.switcher.bg          — workspace switcher strip background
  shell.sidebar.bg           — sidebar background
  shell.sidebar.text         — primary sidebar text
  shell.sidebar.muted        — secondary sidebar text
  shell.sidebar.dim          — tertiary/section label text
  shell.sidebar.hover        — nav item hover background
  shell.sidebar.active       — nav item active background (accent-derived)
  shell.main.bg              — viewport background
  shell.card.bg              — card/surface background
  shell.border               — default border color
  shell.toolbar.bg           — toolbar background
  shell.input.bg             — input field background
  shell.text.primary         — primary content text
  shell.text.soft            — secondary content text
  shell.text.muted           — tertiary content text
  shell.text.dim             — quaternary/disabled text

Brand tokens (from admin config):
  brand.accent               — the workspace accent color
  brand.accent.dim           — accent at ~12% opacity (backgrounds, badges)
  brand.accent.safe          — contrast-validated variant for colored surfaces
  brand.logo                 — logo mark image URL
  brand.name                 — workspace name string
```

### How Theming Works (Lifecycle)

1. Admin configures brand in the Brand Manager core app (4 controls)
2. Brand Manager writes to `workspaces.theme_config` in D1 + updates KV cache
3. Shell reads theme config (from KV, <1ms) and computes all derived tokens based on base theme + mode
4. Shell injects CSS custom properties into `:root` — all `@ensemble-edge/ui` components consume these variables
5. Guest app frontends in sandboxed iframes receive brand tokens via `postMessage` — they can use the accent color, base theme, and mode to match the shell
6. The AI panel, command palette, notifications, status page — everything in the shell responds to the same token set
7. Result: Every surface — shell and guest apps alike — is branded from one set of 4 controls

### Multilingual Support

Ensemble supports three layers of internationalization, designed to be implemented from day one at minimal cost.

#### Layer 1: Shell i18n

All shell UI strings are wrapped in a `t()` function from the very first build. No string is ever hardcoded in English.

```typescript
// Every shell string goes through t()
<span>{t('nav.section.apps')}</span>           // "Apps" / "Aplicaciones" / "Aplicativos"
<span>{t('toolbar.search.placeholder')}</span>  // "Search or jump to..." / "Buscar o ir a..."
<span>{t('ai.panel.title')}</span>              // "Ensemble AI" (unchanged across locales)
```

Translations live in JSON locale files:

```
packages/core/src/locales/
├── en.json        ← ships with v1.0
├── es.json        ← community or AI-translated
├── pt.json
├── fr.json
├── de.json
└── ja.json
```

Example locale file (~200-300 strings total for the entire shell):

```json
{
  "nav.section.apps": "Apps",
  "nav.section.agents": "Agents",
  "nav.section.people": "People",
  "nav.section.docs": "Docs",
  "nav.section.quick_links": "Quick links",
  "nav.section.workspace": "Workspace",
  "toolbar.search.placeholder": "Search or jump to...",
  "toolbar.search.shortcut": "⌘K",
  "ai.panel.title": "Ensemble AI",
  "ai.panel.subtitle": "workspace-aware",
  "ai.panel.input.placeholder": "Ask about your workspace...",
  "ai.panel.context.active": "Active",
  "status.healthy": "Healthy",
  "status.degraded": "Degraded",
  "status.down": "Down",
  "dashboard.greeting": "Good morning, {name}",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.confirm": "Confirm",
  "common.delete": "Delete"
}
```

The locale resolver checks in order: user preference (from personal settings) → browser `Accept-Language` header → workspace base language (from workspace settings). The shell renders in the first match that has a translation file.

Adding a new language is a single JSON file — no code changes. Community PRs for new languages are low-effort to review and merge. AI-assisted translation of the base English file provides a draft that native speakers refine.

#### Layer 2: Guest App Locale

Guest apps receive the user's resolved locale and the workspace's locale config via the `GuestAppContext` (see §8). Two fields:

- `workspace.locale` — the workspace's base language, supported languages, timezone, date/number formats
- `user.locale` — the current user's preferred language (resolved by the shell)

Guest apps use this or ignore it. A guest app that supports Spanish checks `user.locale === 'es'` and renders accordingly. A guest app that's English-only ignores the field. The workspace doesn't enforce guest app localization — it just provides the information.

#### Layer 3: Brand Token Translations

This is where multilingual support becomes genuinely powerful. All `text` and `rich_text` brand tokens (messaging, tone, identity, custom groups) can have per-locale translations.

**The storage model** adds an optional `locale` column to `brand_tokens`:

```sql
-- Base token (source of truth, in the workspace's base language)
INSERT INTO brand_tokens (workspace_id, category, key, value, type, locale)
VALUES ('ws_acme', 'messaging', 'tagline', 'The intelligent capital platform', 'text', NULL);

-- Spanish translation
INSERT INTO brand_tokens (workspace_id, category, key, value, type, locale)
VALUES ('ws_acme', 'messaging', 'tagline', 'La plataforma de capital inteligente', 'text', 'es');

-- Portuguese translation
INSERT INTO brand_tokens (workspace_id, category, key, value, type, locale)
VALUES ('ws_acme', 'messaging', 'tagline', 'A plataforma de capital inteligente', 'text', 'pt');
```

`locale = NULL` means the base language version (source of truth). Non-null locale values are translations. Visual tokens (colors, images, spatial) never have locale variants — they're universal.

**The "Add language" flow in the Brand Manager:**

1. Admin clicks "Add language" → selects from supported languages (or types a language code)
2. The system identifies all `text` and `rich_text` tokens that need translation
3. The AI panel's LLM translates all tokens into the new language automatically, using the brand's tone guidelines for style consistency
4. Translations appear in a review panel — side by side with the source language
5. Admin reviews, tweaks, and saves
6. The new language is now active — all delivery endpoints respect `?locale=es`

**Stale translation tracking:**

When the source language version of a token changes, all translations of that token are marked as stale:

```sql
ALTER TABLE brand_tokens ADD COLUMN source_updated_at TEXT;
ALTER TABLE brand_tokens ADD COLUMN is_stale BOOLEAN DEFAULT FALSE;
```

When the English tagline changes, the Spanish and Portuguese versions are flagged `is_stale = TRUE`. The Brand Manager shows a "Translations need updating" indicator. The admin can click "Re-translate" to have the AI update the stale translations, or manually edit them.

**API behavior with locale:**

All brand delivery endpoints accept a `?locale=` parameter:

```
GET /_ensemble/brand/tokens?locale=es            → Spanish text tokens + universal visual tokens
GET /_ensemble/brand/context?locale=es           → Compiled narrative in Spanish
GET /_ensemble/brand/css                          → No change (visual tokens are universal)
GET ~acme/brand?locale=es                      → Visual brand page in Spanish
```

Resolution order: requested locale → workspace base language → raw value. If a Spanish translation doesn't exist for a token, the base language version is returned. The response includes a `locale` field indicating which language was served and a `translations_available` array listing all available locales.

**The generated CSS endpoint is locale-agnostic** — colors, fonts, radii, and spacing don't change per language. The context and tokens endpoints are locale-aware — messaging, tone, and text-based custom tokens resolve to the requested language.

---
