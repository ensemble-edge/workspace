## 6. Core Apps — Deep Dive

Core apps are the "operating system" of a workspace. They handle the concerns that every workspace needs, regardless of what it's used for. They ship in the Worker binary and upgrade atomically with the shell.

### Core App: Workspace Admin

**ID:** `core:admin`
**Display:** viewport
**Nav:** Settings (sidebar, section: "workspace")

The master control panel for a workspace. Only visible to users with `admin` or `owner` role.

**Features:**

- **General Settings** — Workspace name, slug, description, type, custom domain configuration
- **Locale & Region** — Base language, supported languages, timezone, date format, number format (see §18.5 Multilingual Support)
- **Appearance** — Quick theme picker (delegates to Brand Manager for full control)
- **App Settings (extensible)** — Centralized configuration for all installed guest apps. Each app that declares `settings.admin` in its manifest gets a section here with grouped fields (API keys, toggles, thresholds, defaults). Admins configure all apps in one place. Required fields gate app activation. Secret fields encrypted at rest.
- **App Management** — Enable/disable core and bundled apps. Install/remove guest apps. Configure app settings per workspace. Reorder sidebar nav.
- **Integrations** — Webhook management, API key management, external service connections
- **Danger Zone** — Transfer ownership, archive workspace, delete workspace

**Workspace Settings Schema:**

```typescript
interface WorkspaceSettings {
  // General
  name: string
  slug: string
  description: string
  type: 'organization' | 'team' | 'project' | 'personal' | 'board'
  custom_domain?: string

  // Locale & region
  locale: {
    base_language: string           // ISO 639-1: 'en', 'es', 'pt', 'fr', etc.
    supported_languages: string[]   // Additional languages: ['es', 'pt']
    timezone: string                // IANA: 'America/Chicago'
    date_format: 'us' | 'eu' | 'iso'  // MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD
    number_format: 'us' | 'eu'     // 1,000.00 vs 1.000,00
  }

  // Appearance (delegates to Brand Manager for full control)
  appearance: {
    base_theme: 'warm' | 'cool' | 'neutral' | 'midnight' | 'stone'
    accent_color: string            // hex
  }
}
```

The `base_language` is the source of truth language — all content is authored in this language first. When the admin adds a supported language, the system offers to AI-translate existing brand messaging tokens into the new language (see Brand Manager multilingual support). Users can override their display language in personal settings; the shell renders in the user's preferred language if a translation exists, falling back to the workspace's base language.

**API Routes:**

```
GET    /_ensemble/admin/settings          — workspace settings (full)
PUT    /_ensemble/admin/settings          — update settings
PATCH  /_ensemble/admin/settings/locale   — update just locale settings
GET    /_ensemble/admin/apps              — list all apps + status
PUT    /_ensemble/admin/apps/:id          — toggle/configure an app
GET    /_ensemble/admin/integrations      — list integrations
POST   /_ensemble/admin/integrations      — create integration
GET    /_ensemble/admin/languages         — list base + supported languages
POST   /_ensemble/admin/languages         — add a supported language (triggers AI translation offer)
DELETE /_ensemble/admin/languages/:code   — remove a supported language
```

---

### Core App: Brand Manager — The Company Brand System

**ID:** `core:brand`
**Display:** viewport
**Nav:** Brand (sidebar, section: "workspace")

The Brand Manager is more than a theme picker. It's the **canonical source of truth for the company's entire brand identity** — visual, verbal, and structural. Change a color, a tagline, or a logo here and it propagates everywhere: the workspace shell, guest apps, the public website, email templates, AI agents writing copy, pitch decks, investor materials. This is what makes "the programmable surface of a company" literal.

#### Two Layers

**Layer 1: Workspace appearance** — The 4 constrained controls that theme the shell (documented in §18 Brand Theming). Accent color, logo mark, base theme, workspace name. These drive how the workspace looks internally.

**Layer 2: Company brand system** — A comprehensive set of tokens describing everything about the company's identity. Colors, typography, logos, messaging, tone, identity, plus extensible custom token groups. These drive how the company looks everywhere — the workspace is just one consumer.

Both layers are managed in the same Brand Manager app, on separate tabs.

#### Built-in Token Categories

Each category has a dedicated visual editor — not a form with text fields, but purpose-built UI appropriate to the content type.

**Colors:**
A visual color grid rendered as swatches — not a list of hex inputs. Click a swatch to edit. Built-in contrast checker shows which text colors work on which backgrounds. Dark mode variants auto-generated with manual override.

```yaml
colors:
  primary: "#1a1a2e"          # Headers, primary backgrounds
  secondary: "#2d2d4a"        # Secondary backgrounds, hover states
  accent: "#c8a951"           # CTAs, highlights, active states, buttons
  surface: "#fafaf8"          # Default page background
  surface_elevated: "#ffffff" # Cards, modals, elevated surfaces
  text_primary: "#1a1a1e"     # Headings, body text
  text_secondary: "#6b6b68"  # Secondary text, descriptions
  text_muted: "#9a9a96"      # Captions, placeholders, disabled
  border: "#e8e8e4"           # Default borders
  success: "#0d9e74"          # Success states, positive indicators
  warning: "#ef9f27"          # Warning states, attention needed
  error: "#e24b4a"            # Error states, destructive actions
  info: "#378add"             # Informational, links, neutral highlights
```

**Typography:**
Font picker with live preview. Type your heading in the heading font, body copy in the body font — see them side by side at various sizes. Google Fonts integration. Upload option for custom fonts (stored in R2).

```yaml
typography:
  heading_font: "Gloock"
  heading_weight: "600"
  body_font: "DM Sans"
  body_weight: "400"
  mono_font: "JetBrains Mono"
  font_urls:
    - "https://fonts.googleapis.com/css2?family=Gloock&family=DM+Sans:wght@300;400;500;600"
  scale:                       # Optional: type scale for consistency
    h1: "2.25rem"
    h2: "1.75rem"
    h3: "1.375rem"
    body: "1rem"
    small: "0.875rem"
    caption: "0.75rem"
```

**Logos:**
Drag-and-drop upload zones for each variant. Live preview showing how each logo renders at different sizes and on different backgrounds. Auto-generated favicon from the icon mark if none uploaded.

```yaml
logos:
  wordmark: "/brand/assets/wordmark.svg"          # Full wordmark (light bg)
  wordmark_dark: "/brand/assets/wordmark-dark.svg" # Full wordmark (dark bg)
  icon_mark: "/brand/assets/icon.svg"              # Square icon (light bg)
  icon_mark_dark: "/brand/assets/icon-dark.svg"    # Square icon (dark bg)
  favicon: "/brand/assets/favicon.ico"             # Auto-generated if absent
  social_avatar: "/brand/assets/social.png"        # Square, for social profiles
  og_image: "/brand/assets/og.png"                 # 1200x630 Open Graph image
```

All assets stored in R2, served via the brand assets API with proper cache headers.

**Messaging:**
Rich text editors with character count targets. A "messaging hierarchy" view showing all copy stacked vertically so you can see how it flows.

```yaml
messaging:
  tagline: "The intelligent capital platform"
  elevator_pitch: "Ownly connects borrowers with the right capital through AI-powered matching and streamlined deal management."
  mission: "To make capital accessible and transparent for every business."
  value_props:
    - headline: "AI-powered matching"
      description: "Our algorithms connect borrowers with optimal lending partners in seconds, not weeks."
    - headline: "Transparent process"
      description: "Track your application status in real-time. No black boxes."
    - headline: "One application"
      description: "Fill out one form. Get matched with dozens of lenders."
  boilerplate: "Ownly Group is an Austin-based fintech company building the intelligent capital platform. Founded in 2024, Ownly connects borrowers with optimal lending partners through AI-powered matching and streamlined deal management."
  legal_footer: "© {year} The Ownly Group, LLC. All rights reserved."
```

**Tone:**
Tag chips for descriptors, a dos/don'ts list, voice guidelines.

```yaml
tone:
  descriptors: ["confident", "clear", "approachable", "technical when needed"]
  avoid: ["jargon without explanation", "hype", "superlatives without evidence"]
  voice: "First person plural ('we'). Active voice. Short sentences. Lead with the benefit, follow with the proof."
```

**Identity:**
Simple fields that power legal footers, boilerplate generation, and "about" content.

```yaml
identity:
  legal_name: "The Ownly Group, LLC"
  display_name: "Ownly"
  founding_year: 2024
  headquarters: "Austin, TX"
  website: "https://ownly.com"
  industry: "Fintech"
```

**Spatial:**
Layout tokens for consistent UI across all surfaces.

```yaml
spatial:
  radius: "8px"
  radius_lg: "12px"
  spacing_unit: "8px"
```

#### Extensible Custom Token Groups

Below the built-in categories, admins can create custom token groups for brand elements that don't fit the standard schema. Every company is different — a PE firm needs fund branding, a biotech needs pipeline stage colors, a DTC brand needs packaging palette tokens.

An admin clicks "Add token group," names it (e.g., "Fund branding"), and adds named tokens with types:

```yaml
custom:
  fund_branding:
    fund_name:
      value: "Ownly Diversified Credit Fund I"
      type: text
      label: "Fund name"
    fund_vintage:
      value: "2026"
      type: text
      label: "Vintage year"
    fund_color:
      value: "#1a3d5c"
      type: color
      label: "Fund primary color"
    fund_target:
      value: "$50M"
      type: text
      label: "Fund target"
    fund_legal:
      value: "Ownly Diversified Credit Fund I, LP"
      type: text
      label: "Fund legal name"
```

Available token types:

| Type | Editor | Example |
|---|---|---|
| `text` | Single-line text input | Fund name, vintage year |
| `color` | Color picker with hex input | Fund primary color |
| `image` | Drag-and-drop upload (stored in R2) | Fund logo, partner headshot |
| `url` | URL input with validation | Fund data room link |
| `number` | Number input | Target raise amount |
| `rich_text` | Rich text editor | Fund description, disclosures |

Custom tokens get the same treatment as built-in tokens: stored in D1, cached in KV, served via API, included in generated CSS, written to the Knowledge Graph, and triggering webhooks on change. The API consumer doesn't care whether a token is built-in or custom — it's just a key with a value.

#### Storage Model

On the backend, all tokens — built-in and custom — are stored in a single flexible table:

```sql
CREATE TABLE brand_tokens (
  workspace_id TEXT NOT NULL,
  category     TEXT NOT NULL,       -- 'colors' | 'typography' | 'logos' | 'messaging' |
                                    -- 'tone' | 'identity' | 'spatial' | 'custom:{group_slug}'
  key          TEXT NOT NULL,       -- 'primary' | 'tagline' | 'fund_name' | etc.
  value        TEXT NOT NULL,       -- the value (text, hex, URL to R2 asset, JSON for structured)
  type         TEXT NOT NULL,       -- 'text' | 'color' | 'image' | 'url' | 'number' | 'rich_text'
  label        TEXT,                -- human-readable label for the UI
  description  TEXT,                -- usage guidance (included in machine context)
  locale       TEXT,                -- NULL = base language, 'es' = Spanish, etc.
  is_stale     BOOLEAN DEFAULT FALSE, -- TRUE when source language version changed after this translation
  sort_order   INTEGER DEFAULT 0,
  updated_at   TEXT NOT NULL,
  updated_by   TEXT NOT NULL,       -- user handle

  PRIMARY KEY (workspace_id, category, key, COALESCE(locale, ''))
);

CREATE TABLE brand_token_groups (
  workspace_id TEXT NOT NULL,
  slug         TEXT NOT NULL,       -- 'fund_branding'
  label        TEXT NOT NULL,       -- 'Fund branding'
  sort_order   INTEGER DEFAULT 0,

  PRIMARY KEY (workspace_id, slug)
);
```

#### Four Delivery Endpoints

One source of truth, four ways to consume it:

**1. Visual brand page** — for designers, contractors, new hires

```
GET ~acme/brand                     (public read-only URL)
GET /_ensemble/brand/page              (same content, API path)
```

A beautifully rendered HTML page showing the full brand identity: color swatches on a visual grid, typography specimens at various sizes, logos on light and dark backgrounds, the messaging hierarchy, tone guidelines, custom token groups. Always current. Send this link to anyone who needs to understand the brand.

The workspace admin controls whether this page is public (anyone with the URL can view) or restricted (workspace members only).

**2. Machine brand context** — for AI systems, claude.md, system prompts

```
GET /_ensemble/brand/context                        → markdown (default)
GET /_ensemble/brand/context?format=json             → structured JSON
GET /_ensemble/brand/context?format=yaml             → YAML
GET /_ensemble/brand/context?for=website             → scoped to website-relevant tokens
GET /_ensemble/brand/context?for=email               → scoped to email-relevant tokens
GET /_ensemble/brand/context?for=pitch-deck          → scoped to pitch-relevant tokens
GET /_ensemble/brand/context?for=ai                  → full compiled narrative (default)
```

The markdown format is a **compiled narrative** — not a raw dump of tokens, but prose with context that tells an AI system how to apply the brand:

```markdown
# Ownly — Brand context

## Identity
Ownly (legal: The Ownly Group, LLC) is an Austin-based fintech company
founded in 2024. Website: ownly.com

## Visual identity
Primary color: #1a1a2e (dark navy — use for headers, primary backgrounds)
Accent color: #c8a951 (gold — use for CTAs, highlights, active states)
Surface: #fafaf8 (warm off-white — default page background)
Error: #e24b4a, Warning: #ef9f27, Success: #0d9e74

Heading font: Gloock (serif, 600 weight — use for h1-h3, hero text)
Body font: DM Sans (sans-serif, 400 weight — use for all body copy)
Mono font: JetBrains Mono (code blocks, data, API references)

Border radius: 8px (buttons, cards, inputs)
The aesthetic is: premium, minimal, warm.

## Logos
Wordmark (light bg): https://acme.ensemble.ai/_ensemble/brand/assets/wordmark.svg
Icon mark (light bg): https://acme.ensemble.ai/_ensemble/brand/assets/icon.svg
Wordmark (dark bg): https://acme.ensemble.ai/_ensemble/brand/assets/wordmark-dark.svg

## Messaging
Tagline: "The intelligent capital platform"
Elevator pitch: "Ownly connects borrowers with the right capital through
AI-powered matching and streamlined deal management."
Mission: "To make capital accessible and transparent for every business."

Value propositions:
1. AI-powered matching — algorithms connect borrowers with optimal lenders
2. Transparent process — real-time application tracking, no black boxes
3. One application — fill out one form, get matched with dozens of lenders

Boilerplate: "Ownly Group is an Austin-based fintech company..."
Legal footer: © 2026 The Ownly Group, LLC. All rights reserved.

## Tone
Voice: confident, clear, approachable, technical when needed
Avoid: jargon without explanation, hype, superlatives without evidence
Style: first person plural ("we"), active voice, short sentences

## Custom: Fund branding
Fund name: Ownly Diversified Credit Fund I
Fund vintage: 2026
Fund target: $50M
Fund legal name: Ownly Diversified Credit Fund I, LP
```

The `description` field on each token powers the parenthetical guidance — `(dark navy — use for headers, primary backgrounds)`. Admins can add usage guidance to any token and it shows up in the machine context.

The `for` parameter controls scoping. Workspace admins configure which token categories are included in each scope via the Brand app settings. The `for=ai` scope (default) includes everything.

**3. Raw tokens API** — for build tools, programmatic consumption

```
GET /_ensemble/brand/tokens                          → full token set (JSON)
GET /_ensemble/brand/tokens/colors                   → just colors
GET /_ensemble/brand/tokens/typography               → just typography
GET /_ensemble/brand/tokens/messaging                → just messaging
GET /_ensemble/brand/tokens/identity                 → just identity
GET /_ensemble/brand/tokens/custom/fund_branding     → just the fund branding group
```

Returns structured JSON with `etag` for cache validation and `last_modified` timestamp:

```json
{
  "last_modified": "2026-03-26T14:30:00Z",
  "etag": "abc123",
  "tokens": {
    "colors": {
      "primary": { "value": "#1a1a2e", "type": "color", "label": "Primary", "description": "Headers, primary backgrounds" },
      "accent": { "value": "#c8a951", "type": "color", "label": "Accent", "description": "CTAs, highlights, active states" }
    },
    "messaging": {
      "tagline": { "value": "The intelligent capital platform", "type": "text", "label": "Tagline" }
    },
    "custom": {
      "fund_branding": {
        "fund_name": { "value": "Ownly Diversified Credit Fund I", "type": "text", "label": "Fund name" }
      }
    }
  }
}
```

**4. Generated CSS** — for websites and apps

```
GET /_ensemble/brand/css
```

Returns a CSS file that any website can include with a single `<link>` tag:

```html
<link rel="stylesheet" href="https://acme.ensemble.ai/_ensemble/brand/css">
```

The generated CSS:

```css
/* Ensemble Brand Tokens — Ownly */
/* Generated: 2026-03-26T14:30:00Z */
/* Source: https://acme.ensemble.ai/_ensemble/brand */

@import url('https://fonts.googleapis.com/css2?family=Gloock&family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500');

:root {
  /* Colors */
  --brand-primary: #1a1a2e;
  --brand-secondary: #2d2d4a;
  --brand-accent: #c8a951;
  --brand-surface: #fafaf8;
  --brand-surface-elevated: #ffffff;
  --brand-text-primary: #1a1a1e;
  --brand-text-secondary: #6b6b68;
  --brand-text-muted: #9a9a96;
  --brand-border: #e8e8e4;
  --brand-success: #0d9e74;
  --brand-warning: #ef9f27;
  --brand-error: #e24b4a;
  --brand-info: #378add;

  /* Typography */
  --brand-font-heading: 'Gloock', serif;
  --brand-font-body: 'DM Sans', sans-serif;
  --brand-font-mono: 'JetBrains Mono', monospace;

  /* Spatial */
  --brand-radius: 8px;
  --brand-radius-lg: 12px;
  --brand-spacing: 8px;

  /* Custom: Fund branding */
  --brand-custom-fund-color: #1a3d5c;
}
```

Cached in KV, regenerated on token change. Short cache TTL (5 minutes) so changes propagate quickly.

#### Webhooks

When any brand or messaging token changes, the workspace can fire webhooks to configured URLs:

```json
{
  "event": "brand.tokens.updated",
  "workspace": "~acme",
  "timestamp": "2026-03-26T14:30:00Z",
  "changed_categories": ["colors", "messaging"],
  "changed_keys": ["accent", "tagline"],
  "actor": "@hawkins",
  "endpoints": {
    "tokens": "https://acme.ensemble.ai/_ensemble/brand/tokens",
    "css": "https://acme.ensemble.ai/_ensemble/brand/css",
    "context": "https://acme.ensemble.ai/_ensemble/brand/context"
  }
}
```

Use case: the webhook hits your CI/CD pipeline → your static site generator pulls the new tokens from `/_ensemble/brand/tokens` → your website deploys with the updated brand. Change the tagline in Ensemble at 2pm, your website reflects it by 2:05pm. No manual deploy.

#### Knowledge Graph Integration

All messaging and tone tokens are automatically written to the Knowledge Graph at `brand.*`. This means:

- The AI panel can answer "what's our tagline?" or "write an email using our value props"
- Guest agents writing content pull from the canonical source
- The `claude.md` context endpoint includes brand context
- Knowledge validation can check whether guest apps' content aligns with the brand voice

When tokens change, the Knowledge Graph updates in the same transaction.

#### The Visual Layer

The Brand Manager UI should feel like a **brand studio**, not a settings page. This is the app where the CEO or brand manager lives.

- **Brand preview card** — a live-rendered mockup showing how the brand looks in context (email header, website hero section, social post, business card). Updates in real-time as tokens change.
- **Each category is a collapsible section** with a visual editor appropriate to the content type. No raw JSON. No code unless you want it.
- **Export panel** — shows all the ways to consume the brand: the CSS link tag, the API URLs, the context endpoint for claude.md, the webhook config. One-click copy for each.
- **Change log** — who changed what, when. Pulled from the audit trail. "Sara changed the tagline from X to Y on March 15."
- **Share button** — generates the read-only brand page URL (`~acme/brand`). Your brand guidelines as a live URL that never goes stale.
- **Custom token groups** — "Add token group" button at the bottom. Create, name, add typed tokens, reorder.

**API Routes:**

```
Public (no auth required by default, configurable):
GET    /_ensemble/brand/page              — visual brand page (HTML)
GET    /_ensemble/brand/context           — compiled brand context (MD/JSON/YAML)
GET    /_ensemble/brand/tokens            — full token set (JSON)
GET    /_ensemble/brand/tokens/{category} — tokens for a specific category
GET    /_ensemble/brand/css               — generated CSS custom properties
GET    /_ensemble/brand/assets/{filename} — logo/image assets (R2)

Authenticated (workspace members):
PUT    /_ensemble/brand/tokens            — update tokens (batch)
PUT    /_ensemble/brand/tokens/{category}/{key} — update a single token
POST   /_ensemble/brand/assets            — upload brand asset
DELETE /_ensemble/brand/assets/{filename} — delete brand asset
POST   /_ensemble/brand/groups            — create custom token group
PUT    /_ensemble/brand/groups/{slug}     — update group metadata
DELETE /_ensemble/brand/groups/{slug}     — delete group (and its tokens)
GET    /_ensemble/brand/changelog         — recent changes with actor + timestamp
POST   /_ensemble/brand/webhooks          — configure webhook URLs
GET    /_ensemble/brand/webhooks          — list configured webhooks
```

#### How It All Connects

```
Admin updates tagline in Brand Manager
        │
        ├──→ D1: token updated in brand_tokens table
        ├──→ KV: cache key busted, new value written
        ├──→ Knowledge Graph: brand.messaging.tagline updated
        ├──→ Audit log: "admin changed tagline from X to Y"
        ├──→ Event bus: brand.tokens.updated emitted
        │         │
        │         ├──→ Shell re-reads theme (if visual token changed)
        │         ├──→ AI panel context refreshed
        │         └──→ Webhooks fired to configured URLs
        │                   │
        │                   └──→ CI/CD rebuilds ownly.com with new tagline
        │
        └──→ All delivery endpoints serve updated data:
              /_ensemble/brand/tokens   → new tagline in JSON
              /_ensemble/brand/context  → new tagline in narrative
              /_ensemble/brand/css      → regenerated (if visual token)
              ~acme/brand            → visual page shows new tagline
```

One change. Everywhere. Immediately.

---

### Core App: People & Teams

**ID:** `core:people`
**Display:** viewport
**Nav:** 👥 People (sidebar, section: "workspace")

User and team management for the workspace.

**Features:**

- **Member Directory** — Searchable, filterable list of all workspace members. Shows role, teams, last active, app access.
- **Invite Flow** — Generate invite links or email invites. Set role, app access, and expiry. Bulk invite via CSV.
- **Role Management** — Built-in roles (owner, admin, member, viewer, guest). Custom roles with granular permission checkboxes. Role templates for common patterns (e.g., "Board Member" = viewer + data-room access).
- **Teams / Groups** — Create groups that inherit permission sets. Assign members to groups. Groups can be used for app access control (e.g., "Engineering" team gets access to the deployment dashboard).
- **Profile Management** — Each member has a workspace-specific profile (display name, title, avatar, contact info). Distinct from their global AIUX identity.
- **Deactivation** — Suspend or remove members. Suspended members can't access the workspace but their data/audit trail is preserved.
- **Agent Management** — Create and manage API keys for agents. Set scopes, rate limits, expiry. View agent activity.

**API Routes:**

```
GET    /_ensemble/people                  — list members
POST   /_ensemble/people/invite           — create invitation
GET    /_ensemble/people/:id              — member profile
PUT    /_ensemble/people/:id              — update member
DELETE /_ensemble/people/:id              — remove member
GET    /_ensemble/people/teams            — list teams
POST   /_ensemble/people/teams            — create team
PUT    /_ensemble/people/teams/:id        — update team
GET    /_ensemble/people/roles            — list roles
POST   /_ensemble/people/roles            — create custom role
GET    /_ensemble/people/agents           — list agent keys
POST   /_ensemble/people/agents           — create agent key
```

---

### Core App: Auth & Security

**ID:** `core:auth`
**Display:** viewport
**Nav:** 🔒 Security (sidebar, section: "settings")

Workspace-level authentication and security policies.

**Features:**

- **Auth Policies** — Require MFA for all members. Set session duration. Enforce password complexity. Allow/block specific OAuth providers.
- **SSO / Federation** — Configure SAML 2.0 or OIDC for enterprise SSO. Map IdP groups to workspace roles.
- **Domain Verification** — Verify email domains for auto-join (e.g., anyone with `@acme.com` can join the Acme workspace automatically).
- **Session Management** — View active sessions across all members. Force logout for specific users or all users. IP allowlisting.
- **API Security** — Global rate limiting. CORS configuration. Allowed origins for iframe embedding.
- **Login Page Customization** — Custom welcome message, background image, OAuth button visibility. Brand Manager theme applies automatically.

**API Routes:**

```
GET    /_ensemble/auth/policies           — auth policy config
PUT    /_ensemble/auth/policies           — update policies
GET    /_ensemble/auth/sso                — SSO configuration
PUT    /_ensemble/auth/sso                — update SSO
GET    /_ensemble/auth/sessions           — list active sessions
DELETE /_ensemble/auth/sessions/:id       — revoke session
GET    /_ensemble/auth/domains            — verified domains
POST   /_ensemble/auth/domains            — add domain for verification
```

---

### Core App: Knowledge Editor

**ID:** `core:knowledge`
**Display:** viewport
**Nav:** 📚 Knowledge (sidebar, section: "workspace")

The structured knowledge graph for the company — brand guidelines, messaging architecture, engineering standards, org structure, and custom domains.

**Features:**

- **Domain Browser** — Tree view of all knowledge domains and entries. Brand, messaging, engineering, org, custom.
- **Rich Editor** — Markdown editor with live preview for long-form entries (code style guides, messaging playbooks). JSON/YAML editor for structured entries (color palettes, terminology lists).
- **Messaging Architecture** — Dedicated UI for managing audience definitions, tone guidelines, preferred/forbidden terminology, boilerplate (signatures, disclaimers, legal footers), message templates.
- **Engineering Standards** — The "company claude.md." Code style, API conventions, component patterns, testing requirements, git workflow, CI/CD expectations. This is what agents receive when they build apps.
- **Org Structure** — Visual org chart builder. Define departments, teams, reporting lines, key contacts.
- **Version History** — Every knowledge entry is versioned. Diff viewer to compare changes. Rollback to any previous version.
- **Import / Export** — Import from YAML/JSON/Markdown files. Export the full knowledge graph. CLI support: `ensemble knowledge push` / `ensemble knowledge pull`.
- **Validation** — Lint installed apps against knowledge (e.g., check if an app uses the correct brand colors, follows naming conventions).

**The Knowledge-Agent Loop:**

```
1. Admin writes engineering standards in Knowledge Editor
2. Standards saved to knowledge graph (D1 + KV cache)
3. Agent requests context: GET /_ensemble/knowledge/context?for=app-development
4. Agent receives compiled standards document
5. Agent builds app following those standards
6. Knowledge Editor can lint the result against the standards
7. Admin refines standards based on what agents produce
```

**API Routes:**

```
GET    /_ensemble/knowledge                        — list domains
GET    /_ensemble/knowledge/:domain                 — list entries in domain
GET    /_ensemble/knowledge/:domain/:path           — get entry
PUT    /_ensemble/knowledge/:domain/:path           — upsert entry
DELETE /_ensemble/knowledge/:domain/:path           — delete entry
GET    /_ensemble/knowledge/:domain/:path/history   — version history
GET    /_ensemble/knowledge/context?for=:purpose    — compiled context document
GET    /_ensemble/knowledge/search?q=:query         — semantic search
POST   /_ensemble/knowledge/validate                — lint an app against standards
```

---

### Core App: App Manager

**ID:** `core:apps`
**Display:** viewport (also embedded in Workspace Admin)
**Nav:** 🧩 Apps (sidebar, section: "settings")

The app registry and lifecycle manager.

**Features:**

- **Installed Apps** — Grid/list of all apps in this workspace. Toggle enabled/disabled. Configure per-workspace settings.
- **App Details** — Manifest info, version, permissions requested, storage usage, API routes, event subscriptions.
- **App Store** — Browse available guest apps from the registry. One-click install. Preview before installing.
- **Ordering** — Drag-and-drop to reorder sidebar navigation. Organize apps into sections.
- **Per-Role Access** — Configure which roles/groups can see which apps. E.g., "only Engineering team sees the Deploy app."
- **App Health** — Error rates, response times, storage usage per app. Alert on anomalies.
- **Agent-Built Apps** — Review apps that agents have created. Approve/reject before they go live (if human-in-the-loop is enabled).

**API Routes:**

```
GET    /_ensemble/apps                    — list all apps (installed + available)
GET    /_ensemble/apps/:id                — app details
POST   /_ensemble/apps/:id/install        — install guest app
DELETE /_ensemble/apps/:id/uninstall      — uninstall guest app
PUT    /_ensemble/apps/:id/settings       — update app settings
PUT    /_ensemble/apps/:id/access         — update app access rules
POST   /_ensemble/apps                    — deploy new guest app (agent API)
```

---

### Core App: Audit Log

**ID:** `core:audit`
**Display:** viewport
**Nav:** 📋 Audit Log (sidebar, section: "settings")

Every action in the workspace — by humans and agents — is logged and browsable.

**Features:**

- **Event Stream** — Real-time feed of all workspace events. Filterable by actor, app, action type, date range.
- **Actor Filter** — Filter by humans vs. agents. See exactly what an agent did and when.
- **Export** — Export audit log as CSV/JSON for compliance.
- **Retention** — Configure log retention period per workspace.
- **Alerting** — Set up alerts for specific events (e.g., "notify me when any admin role is granted").

**API Routes:**

```
GET    /_ensemble/audit                   — query audit log
GET    /_ensemble/audit/export            — export audit log
GET    /_ensemble/audit/stats             — audit summary statistics
```


---

---

### Core App: Navigation Hub

**ID:** `core:nav`
**Display:** viewport (admin config UI) + background (renders the actual nav)
**Nav:** 🧭 Navigation (sidebar, section: "workspace")

This is one of AIUX's most important core apps because it controls the single most visible thing in the platform: **how people move around.** The Navigation Hub is a unified configuration surface for the sidebar, toolbar, bookmark bar, quick links, and mobile nav — with deep role-awareness and multiple layout strategies.

### The Problem It Solves

In most internal tool platforms, navigation is an afterthought — a flat list of app names in a sidebar. For a 5-app workspace, that's fine. For a 25-app workspace with 8 different roles, it's chaos. Different people need different views. Some apps should be grouped. Some should be pinned. Some should be hidden behind a "More" menu. External links need to live alongside internal apps. And it all needs to adapt to mobile.

### Navigation Zones (What the Hub Configures)

The Navigation Hub manages **six configurable zones**:

```
┌─────────────────────────────────────────────────────────────────┐
│  ❶ WORKSPACE HEADER                                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ [Logo] Ownly Group          [▾ Quick Switcher]             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ❷ PRIMARY NAV (sidebar)                                       │
│  ┌──────────────┐  ┌──────────────────────────────────────────┐ │
│  │ ── Main ──── │  │                                          │ │
│  │ 📊 Dashboard │  │  ❹ TOOLBAR                               │ │
│  │ 👥 CRM      │  │  ┌──────────────────────────────────────┐ │ │
│  │ 📝 Wiki     │  │  │ Breadcrumb │ [⌘K] [🔔] [🤖] [👤]   │ │ │
│  │ 🎫 Support  │  │  └──────────────────────────────────────┘ │ │
│  │              │  │                                          │ │
│  │ ── Finance ──│  │                                          │ │
│  │ 💰 Pipeline │  │           App Viewport                    │ │
│  │ 📄 Invoices │  │                                          │ │
│  │              │  │                                          │ │
│  │ ── Links ─── │  │                                          │ │
│  │ 🔗 Notion ↗ │  │                                          │ │
│  │ 🔗 GitHub ↗ │  │                                          │ │
│  │              │  │                                          │ │
│  │ ── Admin ─── │  │  ❺ BOOKMARK BAR                          │ │
│  │ ⚙️ Settings │  │  ┌──────────────────────────────────────┐ │ │
│  │              │  │  │ [Q3 Report] [Deal Tracker] [+ Add]   │ │ │
│  │ ❸ DOCK      │  │  └──────────────────────────────────────┘ │ │
│  │ ┌──────────┐│  │                                          │ │
│  │ │ 📌 Pinned ││  │                                          │ │
│  │ │ [+] Quick ││  │                                          │ │
│  │ └──────────┘│  │                                          │ │
│  └──────────────┘  └──────────────────────────────────────────┘ │
│                                                                 │
│  ❻ MOBILE NAV (responsive override)                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ [🏠 Home] [👥 CRM] [🤖 AI] [📁 Files] [⋯ More]          │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### ❶ Workspace Header

The top of the sidebar. Configurable elements:

- Workspace logo (from Brand Manager) or custom mark
- Workspace name display (full name, abbreviated, or hidden)
- Quick switcher dropdown (search + recent workspaces)
- Optional: custom subtitle, status indicator, or workspace-level banner

### ❷ Primary Nav (Sidebar)

This is the most complex zone. The admin has multiple layout strategies:

**Layout Strategies:**

| Strategy | Description | Best For |
|---|---|---|
| **Flat** | Simple vertical list of apps | Small workspaces (< 8 apps) |
| **Sectioned** | Apps grouped under collapsible section headers | Medium workspaces (8-20 apps) |
| **Categorized** | Multi-level with categories, subcategories, and dividers | Large workspaces (20+ apps) |
| **Role-Driven** | Different nav layouts per role | Complex orgs with diverse audiences |

**Sidebar Item Types:**

```typescript
type NavItem =
  | { type: 'app'; appId: string }                          // Installed app (any tier)
  | { type: 'app-page'; appId: string; path: string; label: string; icon?: string }  // Deep link into an app
  | { type: 'link'; url: string; label: string; icon?: string; external: boolean }    // External URL
  | { type: 'section'; label: string; collapsible: boolean; defaultOpen: boolean }    // Section header
  | { type: 'divider' }                                     // Visual separator
  | { type: 'spacer' }                                      // Push remaining items to bottom
  | { type: 'custom'; component: string; props?: any }      // Custom rendered item

interface NavSection {
  id: string
  label: string
  icon?: string
  collapsible: boolean
  defaultOpen: boolean
  items: NavItem[]
  visibility: NavVisibility
}

interface NavVisibility {
  roles?: string[]         // ["admin", "member"] — only these roles see it
  groups?: string[]        // ["engineering", "finance"] — only these groups
  apps?: string[]          // Show only if these apps are enabled
  condition?: 'all' | 'any' // Must match all or any of the above
}
```

**Example: Ownly Group Sidebar Configuration**

```json
{
  "strategy": "sectioned",
  "sections": [
    {
      "id": "main",
      "label": "Main",
      "collapsible": false,
      "items": [
        { "type": "app", "appId": "bundled:dashboard" },
        { "type": "app", "appId": "bundled:activity" }
      ],
      "visibility": { "roles": ["owner", "admin", "member"] }
    },
    {
      "id": "lending",
      "label": "Lending",
      "collapsible": true,
      "defaultOpen": true,
      "items": [
        { "type": "app", "appId": "guest:loan-pipeline" },
        { "type": "app", "appId": "guest:borrower-tracker" },
        { "type": "app-page", "appId": "bundled:files", "path": "/folders/loan-docs", "label": "Loan Documents", "icon": "folder" }
      ],
      "visibility": { "groups": ["lending-team"] }
    },
    {
      "id": "external",
      "label": "Quick Links",
      "collapsible": true,
      "defaultOpen": false,
      "items": [
        { "type": "link", "url": "https://notion.so/ownly", "label": "Notion", "icon": "external-link", "external": true },
        { "type": "link", "url": "https://github.com/ensemble-edge", "label": "GitHub", "icon": "github", "external": true },
        { "type": "link", "url": "https://app.attio.com", "label": "Attio CRM", "icon": "external-link", "external": true }
      ],
      "visibility": { "roles": ["owner", "admin", "member"] }
    },
    {
      "id": "workspace",
      "label": "Workspace",
      "items": [
        { "type": "app", "appId": "core:people" },
        { "type": "app", "appId": "core:knowledge" },
        { "type": "app", "appId": "core:brand" }
      ],
      "visibility": { "roles": ["owner", "admin"] }
    },
    {
      "id": "admin",
      "label": "Admin",
      "items": [
        { "type": "app", "appId": "core:admin" },
        { "type": "app", "appId": "core:apps" },
        { "type": "app", "appId": "core:auth" },
        { "type": "app", "appId": "core:audit" },
        { "type": "app", "appId": "core:nav" }
      ],
      "visibility": { "roles": ["owner", "admin"] }
    }
  ]
}
```

**Per-Role Overrides:**

Beyond section visibility, the admin can define entirely different nav layouts per role:

```json
{
  "strategy": "role-driven",
  "layouts": {
    "default": { "sections": [ ... ] },
    "guest": {
      "sections": [
        {
          "id": "portal",
          "label": null,
          "items": [
            { "type": "app", "appId": "guest:loan-tracker" },
            { "type": "app", "appId": "guest:support" },
            { "type": "app", "appId": "bundled:files" }
          ]
        }
      ]
    },
    "viewer": {
      "sections": [
        {
          "id": "dataroom",
          "label": null,
          "items": [
            { "type": "app", "appId": "bundled:files" }
          ]
        }
      ]
    }
  }
}
```

A board member with `viewer` role at Circuit Holdings sees a single-item nav: just the file manager (data room). Clean, uncluttered, obvious.

### ❸ Dock (Sidebar Footer)

The bottom of the sidebar. Persists across sections. Configurable:

- Pinned items (admin-set or user-customizable)
- Quick-add button (context-sensitive: "New Contact" in CRM section, "New Page" in Wiki section)
- User avatar + status
- Collapse/expand sidebar toggle

### ❹ Toolbar

The horizontal bar above the viewport. Configurable:

- Breadcrumb display (auto-generated from routing, or custom per app)
- Toolbar actions: which panel toggle buttons appear, in what order
- Search trigger style: icon only, icon + shortcut hint, or full search bar
- Custom toolbar items (apps can register toolbar actions via manifest)
- Optional: workspace-wide announcement banner (dismissable)

### ❺ Bookmark Bar

A horizontal bar of quick links below the toolbar (optional, can be toggled per workspace).

**Three layers of bookmarks:**

| Layer | Who Sets It | Who Sees It |
|---|---|---|
| **Workspace bookmarks** | Admin via Navigation Hub | Everyone (or per-role) |
| **Group bookmarks** | Group admin | Group members |
| **Personal bookmarks** | Individual user | Only them |

They render in order: workspace → group → personal, with visual separators.

```typescript
interface Bookmark {
  id: string
  label: string
  icon?: string              // Lucide icon or emoji
  target:
    | { type: 'app-page'; appId: string; path: string }
    | { type: 'external'; url: string }
    | { type: 'command'; commandId: string }  // Triggers a command palette action
  scope: 'workspace' | 'group' | 'personal'
  groupId?: string           // For group bookmarks
  userId?: string            // For personal bookmarks
  order: number
}
```

### ❻ Mobile Nav

On screens below the responsive breakpoint, the sidebar collapses and the mobile nav activates. The admin configures:

- **Bottom tab bar** — 3-5 primary items shown as bottom tabs
- **"More" menu** — Everything else, organized by section
- **Gesture nav** — Swipe right for sidebar overlay, swipe left for panels

```json
{
  "mobile": {
    "strategy": "bottom-tabs",
    "tabs": [
      { "type": "app", "appId": "bundled:dashboard", "label": "Home" },
      { "type": "app", "appId": "guest:crm", "label": "CRM" },
      { "type": "panel", "panelId": "bundled:ai-assistant", "label": "AI" },
      { "type": "app", "appId": "bundled:files", "label": "Files" },
      { "type": "more", "label": "More" }
    ],
    "swipeToSidebar": true,
    "swipeToPanels": true
  }
}
```

### Navigation Hub Admin UI

The admin interface for the Navigation Hub is a drag-and-drop builder:

- Left panel: available items (all enabled apps, link creator, section creator, divider)
- Center: preview of the sidebar as it will appear for the selected role
- Right panel: item configuration (icon, label, visibility rules, order)
- Role switcher at the top to preview how each role sees the nav
- Mobile preview toggle
- Live preview — changes reflect in real-time (not saved until confirmed)

### API Routes

```
GET    /_ensemble/nav                     — full nav config for current user (resolved by role)
GET    /_ensemble/nav/config              — raw nav configuration (admin)
PUT    /_ensemble/nav/config              — update nav configuration (admin)
GET    /_ensemble/nav/bookmarks           — user's bookmarks (all layers merged)
POST   /_ensemble/nav/bookmarks           — create personal bookmark
PUT    /_ensemble/nav/bookmarks/:id       — update bookmark
DELETE /_ensemble/nav/bookmarks/:id       — delete bookmark
GET    /_ensemble/nav/mobile              — mobile nav config
PUT    /_ensemble/nav/mobile              — update mobile nav config
```

### How the Shell Consumes It

At page load, the shell calls `GET /_ensemble/nav` which returns the pre-resolved navigation for the current user. The nav service:

1. Loads the workspace nav config from D1 (cached in KV)
2. Determines the user's role and groups
3. Selects the appropriate layout (default or role-specific override)
4. Filters sections and items by visibility rules
5. Merges bookmark layers (workspace → group → personal)
6. Returns a ready-to-render nav structure

The shell renders it directly — no client-side filtering needed. This means the nav respects permissions server-side: a `viewer` literally cannot discover that admin apps exist by inspecting the DOM.

---
---

