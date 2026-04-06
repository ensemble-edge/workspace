# Ensemble Workspace — Visual Design System

**Status:** Design spec for transforming the workspace shell from functional to exceptional
**Inspiration:** Hauser (real estate due diligence platform) — floating dark cards on warm canvas, overlay panels, typographic confidence, color-coded data density
**Applies to:** `@ensemble-edge/core` shell, `@ensemble-edge/ui` components

---

## Design philosophy

The workspace should feel like a physical desk — a warm, tactile surface with dark instrument panels floating on it. Not a flat app. Not a spreadsheet. A workspace you want to sit at.

Three principles:

1. **Cards float on canvas.** Content lives in dark, rounded cards. The warm canvas behind them creates depth without shadows. Every screen is a composition of floating panels.
2. **Panels overlay, never push.** The AI panel, context panels, and tool drawers slide over the viewport. The viewport never reflows. The user's work is never disrupted by opening a side panel.
3. **Typography does the heavy lifting.** Large confident numbers, uppercase tracked section labels, generous whitespace inside cards. The hierarchy is so clear you don't need borders or dividers.

---

## 1. The canvas

The canvas is the background behind everything. It's warm, not white, not gray. It's the desk surface.

```css
/* Light mode canvas */
--canvas: #d4cdc4;              /* warm stone — the desk surface */
--canvas-subtle: #cac3ba;       /* slightly darker for hover states on canvas */

/* Dark mode canvas */
--canvas-dark: #1a1816;         /* warm charcoal, not cool gray */
--canvas-dark-subtle: #232120;
```

The canvas shows through between cards, in the gaps, in the margins. It's never covered completely. The gaps between cards ARE the design — they create the "floating" feeling.

**Current state → target:**
Your viewport background is probably `#0a0a0a` or `#ffffff`. Change it to `--canvas`. That single change will transform the feel immediately.

---

## 2. Cards

Every piece of content lives in a card. Cards are the primary UI surface.

```css
/* Card surfaces */
--card: #1e1e22;                /* dark surface — the instrument panel */
--card-hover: #252529;          /* subtle lift on hover */
--card-elevated: #2a2a2e;       /* for cards inside cards, modals, dropdowns */
--card-border: rgba(255,255,255,0.06);  /* barely visible, for separation when cards touch */

/* Light mode cards (inverted — light cards on warm canvas) */
--card-light: #ffffff;
--card-light-hover: #f8f7f5;
--card-light-elevated: #ffffff;
--card-light-border: rgba(0,0,0,0.06);
```

**Card anatomy:**

```css
.card {
  background: var(--card);
  border-radius: 16px;          /* generous — this is the Hauser signature */
  padding: 24px;                /* breathe */
  border: 1px solid var(--card-border);  /* barely there */
  /* NO box-shadow — the canvas contrast creates depth */
}

.card-sm { padding: 16px; border-radius: 12px; }
.card-lg { padding: 32px; border-radius: 20px; }
```

**Card spacing:**

```css
/* Gap between cards on the canvas */
--card-gap: 16px;              /* the warm canvas shows through these gaps */

/* Cards in a grid */
.card-grid {
  display: grid;
  gap: var(--card-gap);
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
}
```

**The key insight:** In Hauser, the entire viewport is a scrollable canvas with cards floating on it. The cards don't touch the edges. There's always canvas visible around them. This creates the feeling of a physical workspace with instruments laid out on a desk.

```css
.viewport-content {
  padding: 24px;               /* canvas visible on all edges */
  max-width: 1400px;           /* don't stretch cards on ultra-wide */
  margin: 0 auto;
}
```

---

## 3. Color system

### Accent color

The workspace accent comes from brand tokens. For Nendo with coral (`#d85a30`), the palette:

```css
--accent: #d85a30;              /* brand accent — buttons, active states, links */
--accent-dim: #d85a3033;        /* 20% opacity — backgrounds, highlights */
--accent-hover: #e06838;        /* slightly lighter for hover */
--accent-text: #ffffff;         /* text on accent backgrounds */
```

### Semantic colors

These are fixed across all workspace themes. They don't change with the brand accent.

```css
/* Status colors — always these, never themed */
--success: #34d399;             /* green — confirmed, healthy, active */
--warning: #fbbf24;             /* amber — caution, pending, degraded */
--error: #f87171;               /* red — critical, failed, danger */
--info: #60a5fa;                /* blue — informational, neutral */

/* Severity scale (from Hauser's inspection report) */
--severity-critical: #ef4444;   /* red */
--severity-urgent: #f97316;     /* orange */
--severity-moderate: #eab308;   /* yellow */
--severity-low: #22c55e;        /* green */
--severity-monitor: #06b6d4;    /* cyan */
```

### Text colors

```css
/* On dark cards */
--text-primary: #f0ede8;        /* warm white, not pure #fff */
--text-secondary: #9a938a;      /* warm muted */
--text-tertiary: #6b655c;       /* barely visible, for timestamps, metadata */

/* On canvas (light mode) */
--text-on-canvas: #2c2824;      /* warm dark */
--text-on-canvas-muted: #8a8078;
```

### The warm palette

Everything is warm. No blue-grays. No cool neutrals. The gray scale leans brown/tan:

```
#f5f0eb  ← lightest warm
#d4cdc4  ← canvas
#9a938a  ← muted text
#6b655c  ← tertiary text
#3a3632  ← elevated card
#2a2a2e  ← card
#1e1e22  ← card
#141316  ← sidebar
#0c0b0e  ← workspace strip
```

---

## 4. Typography

### Font stack

```css
--font-heading: 'DM Sans', system-ui, sans-serif;
--font-body: 'DM Sans', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

DM Sans is excellent — it has the warmth and roundness that matches the card system. Don't use Inter (too clinical).

### Type scale

```css
/* Large display numbers (scores, prices, stats) */
.text-display {
  font-size: 3rem;             /* 48px */
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.02em;     /* tight tracking for large numbers */
}

/* Page headings */
.text-heading-1 {
  font-size: 1.75rem;          /* 28px */
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.01em;
}

/* Card headings */
.text-heading-2 {
  font-size: 1.25rem;          /* 20px */
  font-weight: 600;
  line-height: 1.3;
}

/* Card subheadings */
.text-heading-3 {
  font-size: 1rem;             /* 16px */
  font-weight: 600;
  line-height: 1.4;
}

/* Body text */
.text-body {
  font-size: 0.875rem;         /* 14px */
  font-weight: 400;
  line-height: 1.5;
  color: var(--text-secondary);
}

/* Small / metadata */
.text-small {
  font-size: 0.75rem;          /* 12px */
  font-weight: 400;
  line-height: 1.5;
  color: var(--text-tertiary);
}

/* SECTION LABELS — the Hauser signature */
.text-section {
  font-size: 0.6875rem;        /* 11px */
  font-weight: 600;
  letter-spacing: 0.12em;      /* wide tracking */
  text-transform: uppercase;
  color: var(--text-tertiary);
}
```

**The section label treatment is critical.** In Hauser, every sidebar section and every card header group uses uppercase tracked labels: `M A N A G E`, `D U E  D I L I G E N C E`, `E N V I R O N M E N T`. This is what makes the navigation feel architectural instead of just a list.

In the current Ensemble shell, the sidebar has `APPS` and `WORKSPACE` — that's already the right pattern. Make sure the tracking is wide (`0.12em`), the size is small (`11px`), the weight is `600`, and the color is tertiary (subdued).

---

## 5. Shell layout revisions

### Current layout (push model)

```
┌────┬──────────┬─────────────────────┬──────────┐
│ WS │ Sidebar  │    Viewport         │ AI Panel │
│52px│  220px   │   (shrinks when     │  340px   │
│    │          │    panel opens)      │          │
└────┴──────────┴─────────────────────┴──────────┘
```

### Target layout (overlay model)

```
┌────┬──────────┬────────────────────────────────────┐
│    │          │  Toolbar (44px)                     │
│ WS │ Sidebar  ├────────────────────────────────┬───┤
│strip│ (220px) │                                │ R │
│52px│          │    Viewport (canvas)           │ I │
│    │          │    ┌────────┐ ┌────────┐       │ G │
│    │          │    │ card   │ │ card   │       │ H │
│    │          │    └────────┘ └────────┘       │ T │
│    │          │    ┌─────────────────┐         │   │
│    │          │    │    card         │   ┌─────┤ S │
│    │          │    └─────────────────┘   │PANEL│ T │
│    │          │                          │(ovr)│ R │
│    │          │                          │     │ I │
│    │          │                          └─────┤ P │
├────┴──────────┴────────────────────────────────┴───┤
│  Bookmark bar (34px)                                │
└─────────────────────────────────────────────────────┘
```

### The right strip

Inspired by Hauser's floating icon strip on the right edge. This is the counterpart to the workspace switcher strip on the left. It holds expandable panels:

```css
.right-strip {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 48px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 12px;
  gap: 4px;
  z-index: 20;               /* above viewport, below overlay panels */
}

.right-strip-button {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--card);
  border: 1px solid var(--card-border);
  cursor: pointer;
  transition: background 150ms;
}

.right-strip-button:hover {
  background: var(--card-hover);
}

.right-strip-button.active {
  background: var(--accent);
  color: var(--accent-text);
}
```

**Right strip items (top to bottom):**

| Icon | Panel | What it opens |
|------|-------|---------------|
| AI sparkle icon | AI Assistant | Chat panel with tool calling, context-aware |
| Activity icon | Activity feed | Recent events from all apps |
| Checklist icon | Quick actions | Pinned actions, pending approvals |

The active panel slides in from the right, 360px wide, overlay:

```css
.right-panel {
  position: absolute;
  right: 48px;                 /* sits to the left of the right strip */
  top: 0;
  bottom: 0;
  width: 360px;
  background: var(--card);
  border-left: 1px solid var(--card-border);
  border-radius: 16px 0 0 16px;  /* rounded on the left edge only */
  transform: translateX(100%);
  transition: transform 200ms ease-out;
  z-index: 15;
  overflow-y: auto;
}

.right-panel.open {
  transform: translateX(0);
}
```

### Viewport scrolling

The viewport is now a scrollable canvas. Cards float on it. The canvas has padding so cards never touch the edges:

```css
.viewport {
  position: relative;          /* for absolute-positioned panels */
  flex: 1;
  overflow-y: auto;
  background: var(--canvas);
}

.viewport-content {
  padding: 24px;
  padding-right: 72px;        /* room for right strip (48px + 24px gap) */
  max-width: 1400px;
}
```

---

## 6. Sidebar refinements

The sidebar is already good — dark background, section labels, nav items. Refinements to match the Hauser level:

```css
.sidebar {
  background: var(--sidebar-bg);  /* #141316 — slightly lighter than WS strip */
  border-right: 1px solid var(--card-border);
  width: 220px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

/* Workspace identity at top */
.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid var(--card-border);
}

.sidebar-workspace-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
}

/* Section labels */
.sidebar-section-label {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  padding: 24px 16px 8px;     /* generous top padding between sections */
}

/* Nav items */
.sidebar-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  border-radius: 8px;
  margin: 1px 8px;            /* inset from sidebar edges */
  font-size: 0.875rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 120ms;
}

.sidebar-item:hover {
  background: rgba(255,255,255,0.05);
  color: var(--text-primary);
}

.sidebar-item.active {
  background: var(--accent);
  color: var(--accent-text);
}

/* Nav item icons */
.sidebar-item-icon {
  width: 18px;
  height: 18px;
  opacity: 0.6;
}

.sidebar-item.active .sidebar-item-icon {
  opacity: 1;
}

/* Lock icons for premium/gated features (like Hauser's lock icons) */
.sidebar-item-lock {
  margin-left: auto;
  width: 14px;
  height: 14px;
  color: var(--text-tertiary);
}

/* User profile at bottom */
.sidebar-footer {
  margin-top: auto;
  padding: 12px 16px;
  border-top: 1px solid var(--card-border);
  display: flex;
  align-items: center;
  gap: 10px;
}

.sidebar-avatar {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--accent);
  color: var(--accent-text);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
}
```

### Sidebar scrolling with sections

When there are many apps installed, the sidebar scrolls. The section labels should feel like sticky headers:

```css
.sidebar-section-label {
  position: sticky;
  top: 0;
  background: var(--sidebar-bg);
  z-index: 1;
}
```

---

## 7. Floating toolbar and bookmark bar

The toolbar and bookmark bar float over the canvas as glass shelves. Content scrolls behind them with a blur effect. They're part of the viewport scroll context, not separate fixed bands.

### Toolbar (top, floating)

```css
.toolbar {
  position: sticky;
  top: 0;
  z-index: 10;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  padding-right: 72px;          /* room for right strip */
  background: transparent;
  border-bottom: none;
  transition: background var(--transition-fast), backdrop-filter var(--transition-fast);
}

/* When content scrolls behind it — glass effect activates */
.toolbar.scrolled {
  background: var(--canvas-glass);
  backdrop-filter: blur(16px) saturate(1.2);
  -webkit-backdrop-filter: blur(16px) saturate(1.2);
  border-bottom: 1px solid var(--card-border);
}
```

```css
/* Glass tokens */
--canvas-glass: rgba(212, 205, 196, 0.7);          /* light mode */
--canvas-glass-dark: rgba(26, 24, 22, 0.75);       /* dark mode */
```

Detect scroll position with a simple signal:

```typescript
// In shell state
const viewportScrolled = signal(false)

// In viewport component
onScroll={(e) => { viewportScrolled.value = e.target.scrollTop > 8 }}
```

When at the top (no scroll), the toolbar is fully transparent — the canvas shows clean through. The moment you scroll, the glass kicks in and content blurs behind it. This creates a subtle layering effect without a hard border.

### Bookmark bar (bottom, floating)

```css
.bookmark-bar {
  position: sticky;
  bottom: 0;
  z-index: 10;
  height: 34px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  padding-right: 72px;          /* room for right strip */
  background: var(--canvas-glass);
  backdrop-filter: blur(16px) saturate(1.2);
  -webkit-backdrop-filter: blur(16px) saturate(1.2);
  border-top: 1px solid var(--card-border);
  font-size: 0.75rem;
  color: var(--text-tertiary);
}
```

The bookmark bar is always glass (unlike the toolbar which starts transparent). Content scrolls behind it too. On mobile (< 640px), the bookmark bar hides on scroll-down and reappears on scroll-up — the iOS Safari pattern:

```css
@media (max-width: 639px) {
  .bookmark-bar {
    transition: transform 200ms ease-out;
  }
  .bookmark-bar.hidden {
    transform: translateY(100%);
  }
}
```

### Breadcrumb

```css
.toolbar-breadcrumb {
  font-size: 0.8125rem;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.toolbar-breadcrumb-current {
  color: var(--text-primary);
  font-weight: 500;
}
```

### Toolbar actions

```css
.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-button {
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  background: var(--card);
  border: 1px solid var(--card-border);
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

/* Search trigger — more prominent */
.toolbar-search {
  background: var(--card);
  border: 1px solid var(--card-border);
  padding: 0 16px;
  min-width: 200px;
  color: var(--text-tertiary);
}

.toolbar-search kbd {
  margin-left: auto;
  font-size: 0.6875rem;
  color: var(--text-tertiary);
  background: rgba(255,255,255,0.06);
  padding: 2px 6px;
  border-radius: 4px;
}
```

### The complete viewport scroll structure

```
┌─────────────────────────────────────────────────┐
│  Toolbar (sticky top, glass on scroll)          │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │  ← cards on canvas
│  │          │  │          │  │          │      │
│  └──────────┘  └──────────┘  └──────────┘      │
│                                                  │
│  ┌─────────────────────┐  ┌──────────────┐      │  ← more cards
│  │                     │  │              │      │
│  └─────────────────────┘  └──────────────┘      │
│                                                  │  ← scrollable
│  ┌──────────────────────────────────────┐       │
│  │                                      │       │
│  └──────────────────────────────────────┘       │
│                                                  │
├─────────────────────────────────────────────────┤
│  Bookmark bar (sticky bottom, always glass)     │
└─────────────────────────────────────────────────┘
       ↑ content scrolls, bars float above it
```

---

## 8. Component library (`@ensemble-edge/ui`)

### Status pills

Hauser's severity badges are a signature element. Build these as a core component:

```css
.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* Variants */
.pill-critical { background: var(--severity-critical); color: white; }
.pill-urgent   { background: var(--severity-urgent);   color: white; }
.pill-moderate { background: var(--severity-moderate);  color: #1a1a1e; }
.pill-low      { background: var(--severity-low);      color: #1a1a1e; }
.pill-monitor  { background: var(--severity-monitor);  color: white; }

/* Outlined variants (subtler) */
.pill-outline {
  background: transparent;
  border: 1px solid currentColor;
}
```

### Stat cards

Big numbers on dark cards — used in dashboards and widgets:

```css
.stat-card {
  background: var(--card);
  border-radius: 16px;
  padding: 20px 24px;
}

.stat-value {
  font-size: 2.5rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.02em;
  color: var(--text-primary);
}

.stat-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-tertiary);
  margin-top: 4px;
}

.stat-delta {
  font-size: 0.75rem;
  font-weight: 600;
  margin-top: 8px;
}

.stat-delta.up   { color: var(--success); }
.stat-delta.down { color: var(--error); }
```

### Score displays

Hauser's ConditionScore / ContextScore pattern — a score out of 100 with a letter grade:

```css
.score-display {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.score-number {
  font-size: 3rem;
  font-weight: 700;
  line-height: 1;
  color: var(--text-primary);
}

.score-suffix {
  font-size: 1rem;
  color: var(--text-tertiary);
}

.score-grade {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 700;
  color: white;
}

/* Grade colors */
.grade-a { background: var(--success); }
.grade-b { background: #60a5fa; }
.grade-c { background: var(--warning); }
.grade-d { background: var(--severity-urgent); }
.grade-f { background: var(--error); }
```

### Progress bars

Hauser's horizontal bars with category colors:

```css
.progress-bar {
  height: 6px;
  border-radius: 3px;
  background: rgba(255,255,255,0.08);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 500ms ease-out;
}

/* Color by score range */
.progress-fill.excellent { background: var(--success); }      /* 80-100 */
.progress-fill.good      { background: #60a5fa; }             /* 60-79 */
.progress-fill.moderate   { background: var(--warning); }      /* 40-59 */
.progress-fill.poor       { background: var(--severity-urgent); } /* 20-39 */
.progress-fill.critical   { background: var(--error); }        /* 0-19 */

/* Special: colored accent bars (like Hauser's environment section) */
.progress-fill.cyan    { background: #22d3ee; }
.progress-fill.orange  { background: #fb923c; }
.progress-fill.pink    { background: #f472b6; }
.progress-fill.yellow  { background: #facc15; }
.progress-fill.lime    { background: #a3e635; }
```

### Data rows

The pattern Hauser uses for score breakdowns — label, bar, value:

```css
.data-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 0;
}

.data-row-label {
  flex: 0 0 160px;
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.data-row-bar {
  flex: 1;
}

.data-row-value {
  flex: 0 0 50px;
  text-align: right;
  font-size: 0.875rem;
  font-weight: 600;
}
```

### Card carousel

Hauser's inspection report uses a card carousel with navigation arrows and a colorful bar chart below. For the workspace, this pattern works for any list of items with detail views:

```css
.carousel {
  position: relative;
  overflow: hidden;
}

.carousel-track {
  display: flex;
  gap: 16px;
  transition: transform 300ms ease-out;
}

.carousel-card {
  flex: 0 0 320px;
  background: var(--card-elevated);
  border-radius: 12px;
  padding: 20px;
}

.carousel-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px 0;
}

.carousel-arrow {
  width: 64px;
  height: 32px;
  border-radius: 16px;
  background: var(--card);
  border: 1px solid var(--card-border);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.carousel-counter {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  min-width: 40px;
  text-align: center;
}
```

---

## 9. Responsive behavior

### Breakpoints

```css
/* Mobile first */
--bp-sm: 640px;    /* phone landscape → sidebar collapses to overlay */
--bp-md: 768px;    /* tablet → cards stack 1 column */
--bp-lg: 1024px;   /* laptop → 2 column cards, sidebar visible */
--bp-xl: 1280px;   /* desktop → full layout, right strip visible */
--bp-2xl: 1536px;  /* ultrawide → max-width kicks in, centered */
```

### Layout behavior by breakpoint

**< 640px (mobile):**
- Workspace strip hidden
- Sidebar becomes a sheet that slides over from left (hamburger menu)
- Right strip hidden, panels accessible via toolbar buttons
- Cards stack single column, full width
- Toolbar condensed: logo + hamburger + search icon + overflow menu
- Bookmark bar hidden

**640–1023px (tablet):**
- Workspace strip visible (40px, narrower)
- Sidebar collapsible — starts collapsed, icon-only mode (56px)
- Right strip hidden, AI accessible via toolbar button
- Cards 1–2 columns
- Bookmark bar visible

**1024–1279px (laptop):**
- Full layout: workspace strip + sidebar + viewport
- Sidebar open by default (200px, slightly narrower)
- Right strip visible with 2 icons (AI + activity)
- Cards 2 columns
- Overlay panels are 320px

**≥ 1280px (desktop):**
- Full layout with generous spacing
- Sidebar 220px
- Right strip visible with all icons
- Cards 2–3 columns
- Overlay panels are 360px
- max-width on viewport content: 1400px, centered

**≥ 1536px (ultrawide):**
- Same as desktop but viewport content centered
- Extra canvas visible on sides (the warm canvas wraps around)

### Sidebar responsive

```css
/* Icon-only mode for tablets */
@media (min-width: 640px) and (max-width: 1023px) {
  .sidebar {
    width: 56px;
    overflow: visible;
  }
  .sidebar-item span { display: none; }
  .sidebar-section-label { display: none; }
  .sidebar-item {
    justify-content: center;
    padding: 10px;
    margin: 1px 4px;
  }
  /* Tooltip on hover showing the label */
  .sidebar-item:hover::after {
    content: attr(data-label);
    position: absolute;
    left: 60px;
    background: var(--card-elevated);
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 0.8125rem;
    white-space: nowrap;
    z-index: 50;
  }
}

/* Mobile overlay mode */
@media (max-width: 639px) {
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    width: 280px;
    z-index: 100;
    transform: translateX(-100%);
    transition: transform 200ms ease-out;
  }
  .sidebar.open {
    transform: translateX(0);
  }
  .sidebar-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 99;
  }
}
```

### Card grid responsive

```css
.card-grid {
  display: grid;
  gap: var(--card-gap);
}

@media (max-width: 639px)  { .card-grid { grid-template-columns: 1fr; } }
@media (min-width: 640px)  { .card-grid { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); } }
@media (min-width: 1280px) { .card-grid { grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); } }
```

---

## 10. Animation and transitions

Keep it minimal. The workspace should feel instant, not bouncy.

```css
/* Standard transitions */
--transition-fast: 120ms ease-out;     /* hover states, color changes */
--transition-normal: 200ms ease-out;   /* panel slides, card reveals */
--transition-slow: 300ms ease-out;     /* page transitions, complex layout changes */

/* Panel slide */
.right-panel {
  transition: transform var(--transition-normal);
}

/* Card hover — very subtle */
.card {
  transition: background var(--transition-fast);
}
.card:hover {
  background: var(--card-hover);
}

/* Sidebar item hover */
.sidebar-item {
  transition: background var(--transition-fast), color var(--transition-fast);
}

/* Page content fade-in */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.viewport-content {
  animation: fadeIn var(--transition-normal);
}
```

---

## 11. Dark mode vs light mode

Hauser is dark-first. The workspace should support both, with dark as default.

**Dark mode (default):**
- Canvas: warm dark charcoal (`#1a1816`)
- Cards: dark surfaces (`#1e1e22`)
- Text: warm whites and grays
- The sidebar and workspace strip are always dark in both modes

**Light mode:**
- Canvas: warm stone (`#d4cdc4`)
- Cards: white (`#ffffff`)
- Text: warm darks
- Status colors stay the same (semantic colors never change)
- Accent color stays the same

**The workspace strip and sidebar are ALWAYS dark.** This is the Slack convention — the chrome is dark, the content area adapts. In Hauser, the sidebar is always dark. In Ensemble, the workspace strip + sidebar are always dark. Only the viewport and panels switch.

```css
/* Light mode overrides — only the viewport area */
[data-theme="light"] .viewport {
  --canvas: #d4cdc4;
  --card: #ffffff;
  --card-hover: #f8f7f5;
  --card-elevated: #ffffff;
  --card-border: rgba(0,0,0,0.08);
  --text-primary: #1a1816;
  --text-secondary: #6b655c;
  --text-tertiary: #9a938a;
}
```

---

## 12. Putting it all together — the home screen

Here's what the home screen should look like after these changes:

```
┌────┬──────────┬─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐
│    │ [Logo]   │  Apps / Home           [⌘K Search] [⚙]  │ ← toolbar: transparent,
│    │ Nendo    │╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┬───│   glass on scroll
│ [N]│          │                                    │[✦]│
│    │ A P P S  │  ┌─────────────────────────────┐   │[≡]│
│    │ ◆ Home   │  │  Welcome to Nendo            │   │[✓]│
│    │          │  │  Your workspace is ready.    │   │   │
│    │ WORKSPACE│  └─────────────────────────────┘   │   │
│    │ ◇ People │                                    │   │  ← canvas shows between
│    │ ◇ Brand  │  ┌──────────┐ ┌────────┐ ┌──────┐│   │    every card
│    │ ◇ Settings│ │ 12       │ │ 3      │ │$4.2K ││   │
│    │          │  │ Customers│ │ Pending │ │ MRR  ││   │
│    │          │  │ ↑ 4 new  │ │ trials  │ │↑ 12% ││   │
│    │          │  └──────────┘ └────────┘ └──────┘│   │
│    │          │                                    │   │
│    │          │  ┌───────────────┐ ┌────────────┐ │   │
│    │──────────│  │ Recent        │ │ Quick      │ │   │
│    │ [HO]    │  │ activity      │ │ actions    │ │   │
│[+] │ @ho     │  └───────────────┘ └────────────┘ │   │
│    │          │╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┴───│
├────┴──────────┤ 🔖 Bookmarks              ⌘K · ? Help  │ ← bookmark bar: glass,
└───────────────┴─────────────────────────────────────────┘   always translucent

Dotted lines = glass/translucent floating bars
Canvas (warm stone or dark charcoal) shows through between
every card AND behind the floating bars. Cards float. Right
strip has 3 panel triggers. Everything breathes.
```

---

## 13. Implementation plan

### Phase 1: Canvas + cards + floating bars (do this first — biggest impact)

1. Change viewport background to `--canvas`
2. Wrap all content sections in `.card` with 16px radius and 24px padding
3. Add `--card-gap` between cards
4. Add `viewport-content` with padding and max-width
5. Make toolbar sticky with glass effect on scroll
6. Make bookmark bar sticky with permanent glass effect
7. Update text colors to warm palette
8. Verify dark and light mode work

**This alone will transform the feel. Do this before anything else.**

### Phase 2: Right strip + overlay panels

1. Add `.right-strip` with 3 icon buttons
2. Convert AI panel from flex column to absolute overlay
3. Add slide animation
4. Add activity and quick actions as stub panels
5. Update toolbar to remove AI button (it's in the right strip now)

### Phase 3: Typography + icons + section labels

1. Apply `.text-section` to all sidebar section labels
2. Apply `.text-display` to all stat numbers
3. Integrate Lucide Icons (1.5px stroke, `--text-tertiary` color as default)
4. Implement three icon sources in manifest parsing (lucide, svg, emoji)
5. Add status pills component to `@ensemble-edge/ui`
6. Add stat card component
7. Add score display component
8. Refine sidebar spacing and hover states
9. Add icon override in Settings → Navigation

### Phase 4: Responsive

1. Add sidebar icon-only mode for tablets
2. Add sidebar overlay for mobile
3. Add right strip hiding for smaller screens
4. Test card grid at all breakpoints
5. Test overlay panels on tablet and mobile

### Phase 5: Canvas layout system + refinement

1. Build `Card`, `PageCard`, `CardGrid`, `SplitLayout` in `@ensemble-edge/ui`
2. Build widget renderers (stat, list, chart, table, custom)
3. Build dashboard grid with widget size mapping (small/medium/large/full)
4. Progress bars with color coding
5. Data row component
6. Card carousel component
7. Transition polish
8. Focus states and keyboard navigation
9. Toast notifications (already specd)

### Phase 6: Appearance customization tiers

1. Build Tier 2 admin UI in Settings → Appearance
2. Implement "Default / Brand token / Custom" selector for each surface
3. Wire brand token overrides to CSS variable generation
4. Add font loading for brand fonts (Google Fonts / Bunny Fonts / R2)
5. Build the shell font vs brand font split (chrome vs content)
6. Add density control (compact / comfortable / spacious)
7. Add Tier 3 custom CSS textarea with warning
8. Test that guest apps receive computed tokens via gateway

---

## 14. What NOT to change

- **Workspace switcher strip on the left** — keep it, it's correct. Just make sure it's always dark.
- **Shell i18n / t() pattern** — not a visual concern, don't touch.
- **The /_ensemble/ API prefix** — backend, not visual.
- **Guest app manifest system** — architecture, not visual.
- **Sidebar is always dark** — regardless of light/dark mode, the sidebar and workspace strip are always dark. This is the Slack convention and it works.

---

## 15. Design tokens → base themes

The 5 base themes should each produce a different warm palette:

| Theme | Canvas (light) | Canvas (dark) | Card (light) | Card (dark) | Vibe |
|-------|---------------|--------------|-------------|------------|------|
| Warm | `#d4cdc4` | `#1a1816` | `#ffffff` | `#1e1e22` | Hauser (the reference) |
| Cool | `#c8cdd4` | `#161819` | `#ffffff` | `#1e2024` | Slate blue undertone |
| Neutral | `#d0d0d0` | `#181818` | `#ffffff` | `#222222` | Pure gray, no temperature |
| Midnight | N/A (dark only) | `#0c0e14` | N/A | `#161820` | Deep navy |
| Stone | `#d8d4cc` | `#1c1a16` | `#f8f6f2` | `#24221e` | Sandstone, earthiest |

Every base theme follows the same card-on-canvas pattern. The difference is color temperature and mood. The Warm theme is the Hauser look. Stone is even earthier. Cool is for tech companies. Midnight is for those who want deep dark. Neutral is the safe default.

---

## 16. Three tiers of workspace appearance

Companies should feel like the workspace IS their product, not a tool they use. The appearance system has three tiers of increasing control. Most workspaces only need Tier 1. Power users go deeper.

### Tier 1: The 4 brand controls (default, every workspace)

This is what `ensemble.config.ts` sets. It's the foundation:

| Control | What it affects |
|---|---|
| **Accent color** | Buttons, active sidebar item, links, accent backgrounds |
| **Logo mark** | Workspace switcher icon, sidebar header, login screen |
| **Base theme** | Warm/Cool/Neutral/Midnight/Stone — determines canvas, card, and text colors |
| **Workspace name** | Sidebar header, login screen, browser tab title |

These 4 controls derive the entire visual palette — canvas color, card color, text colors, glass tint, all of it. The base theme + accent color is enough to make every workspace feel distinct. This tier requires zero design skills.

### Tier 2: Shell appearance settings (workspace admin, optional)

The workspace admin can override specific surfaces in the Admin → Appearance section. Each setting shows three options:

- **Default** — derived from the base theme (what Tier 1 gives you)
- **Brand token** — pulls from the brand token system (e.g., use your brand's `colors.primary` for the sidebar)
- **Custom** — pick any value manually

| Setting | Default source | What it overrides |
|---|---|---|
| Canvas color | Base theme | Viewport background |
| Card surface | Base theme | Card backgrounds |
| Sidebar background | Base theme (always dark) | Sidebar fill color |
| Toolbar style | Glass | Glass / Solid / Transparent |
| Bookmark bar style | Glass | Glass / Solid / Hidden |
| Heading font | DM Sans | Shell heading typeface (see §17 for font strategy) |
| Body font | DM Sans | Shell body typeface |
| Card radius | 16px | Border radius on all cards |
| Card gap | 16px | Spacing between cards on canvas |
| Density | Comfortable | Compact / Comfortable / Spacious — adjusts padding throughout |

**The "brand token" option is the key.** If a company has set `typography.heading_font` to "Playfair Display" in their brand tokens, they can tell the shell to use it for headings too. They're not typing a font name twice — they're pointing the shell at their existing brand data. Same for colors: if they've defined `colors.navy` as a custom brand token, they can set the sidebar background to use that token.

This creates a feedback loop: the better you fill out your brand tokens, the more expressive your workspace becomes.

### Tier 3: Custom CSS injection (power users, escape hatch)

A raw CSS textarea in Admin → Appearance → Advanced. Injects into the shell after all other styles.

```css
/* Example: a company wants their sidebar gradient */
.sidebar {
  background: linear-gradient(180deg, #1a0a2e 0%, #0a0a1e 100%) !important;
}
```

With a clear warning:

> ⚠️ Custom CSS may break with workspace updates. Ensemble can't guarantee visual consistency when custom styles are applied. Use at your own risk.

This is the "we trust you" escape hatch. 95% of workspaces never touch it. The 5% that do are power users who know CSS and want full control.

### How the tiers compose

```
Tier 1: Base theme + accent → derives everything
  ↓
Tier 2: Admin overrides specific surfaces → brand tokens or custom values
  ↓
Tier 3: Raw CSS → overrides anything
  ↓
Final rendered shell
```

Each tier only overrides what it explicitly sets. Tier 2 doesn't replace Tier 1 — it patches specific values. Tier 3 is raw CSS specificity, so it wins over everything.

### Admin UI for Tier 2

The Appearance section in workspace admin:

```
Appearance
├── Brand basics                      (Tier 1)
│   ├── Accent color: [coral swatch] [#d85a30]
│   ├── Logo mark: [upload]
│   ├── Base theme: [Warm ▼]
│   └── Workspace name: [Nendo]
│
├── Shell surfaces                    (Tier 2)
│   ├── Canvas:        [Default ▼] [Brand: colors.surface ▼] [Custom: #___]
│   ├── Card surface:  [Default ▼] [Brand: colors.primary ▼] [Custom: #___]
│   ├── Sidebar:       [Default ▼] [Brand: colors.navy ▼]    [Custom: #___]
│   ├── Toolbar style: [Glass ▼]
│   └── Bookmark bar:  [Glass ▼]
│
├── Typography                        (Tier 2)
│   ├── Heading font:  [Default (DM Sans) ▼] [Brand: typography.heading ▼] [Custom ▼]
│   ├── Body font:     [Default (DM Sans) ▼] [Brand: typography.body ▼]    [Custom ▼]
│   └── Mono font:     [Default (JetBrains Mono) ▼]
│
├── Spacing                           (Tier 2)
│   ├── Card radius:   [16px ▼] (8 / 12 / 16 / 20 / 24)
│   ├── Card gap:      [16px ▼] (8 / 12 / 16 / 20)
│   └── Density:       [Comfortable ▼]
│
└── Advanced                          (Tier 3)
    └── Custom CSS:    [textarea]
        ⚠️ May break with workspace updates.
```

---

## 17. Font strategy

Fonts are the hardest customization because they affect layout, readability, load time, and the feel of every pixel on screen. Here's how we handle them.

### Two zones, two font stacks

The workspace has two visual zones with different font rules:

**Shell chrome** (sidebar, toolbar, workspace switcher, bookmark bar, right strip):
- Always uses the **shell font** — DM Sans by default
- Can be overridden via Tier 2 appearance settings
- Must be a UI font — readable at small sizes, works for navigation labels, section headers, metadata

**Viewport content** (where guest apps render, the home screen, the login page, the brand page):
- Uses the **brand fonts** from brand tokens by default
- Guest apps receive the fonts via the theme context and can use them or ignore them
- Can be display fonts, editorial fonts, decorative fonts — they're not constrained to UI use

Why the split: a company picks Playfair Display as their heading font. Gorgeous on their brand page and login screen. But Playfair Display at 11px in the sidebar section labels? It breaks. Display fonts aren't designed for UI chrome. By defaulting the chrome to DM Sans, we protect the shell's usability while letting brand expression flow into content.

BUT — Tier 2 lets admins override this. If they set the heading font to their brand font and it looks great in the sidebar, more power to them. It's their workspace.

### Font loading

```css
/* Shell font — always loaded, bundled with @ensemble-edge/core */
@font-face {
  font-family: 'DM Sans';
  font-display: swap;
  src: url('/assets/fonts/dm-sans-variable.woff2') format('woff2');
}

/* Brand fonts — loaded on demand from CDN */
/* Injected into <head> based on brand tokens */
```

Font loading strategy:

1. DM Sans ships with the workspace (bundled in core, ~50KB woff2 variable). It's always available instantly.
2. Brand fonts load from Google Fonts, Bunny Fonts, or R2 (self-hosted). The `<link>` tag is injected into `<head>` based on brand tokens.
3. Use `font-display: swap` — the shell renders immediately with DM Sans, brand fonts swap in when loaded (typically <200ms from CDN).
4. If a brand font fails to load, the shell falls back to DM Sans → system-ui → sans-serif. Never broken.

### Font choices that work well in the chrome

If admins want to use a brand font in the shell chrome, recommend these categories:

**Safe for shell chrome** (designed for UI):
- DM Sans, Inter, Geist, Satoshi, Plus Jakarta Sans, General Sans, Switzer, Cabinet Grotesk, Outfit, Urbanist

**Use with caution in chrome** (beautiful but may be tight at small sizes):
- Playfair Display, Fraunces, Lora, Source Serif, Merriweather

**Don't use in chrome** (display/decorative only):
- Abril Fatface, Lobster, Pacifico, Bebas Neue, Impact

The Appearance settings UI could show a small preview of the sidebar with the selected font before applying.

### What guest apps receive

The theme context includes both the shell fonts and the brand fonts:

```typescript
context.theme.typography = {
  // Shell fonts (what the chrome uses)
  shellHeadingFont: 'DM Sans',
  shellBodyFont: 'DM Sans',
  
  // Brand fonts (from brand tokens — for content)
  headingFont: 'Playfair Display',
  bodyFont: 'Source Sans Pro',
  monoFont: 'JetBrains Mono',
}
```

Guest apps can use either. `@ensemble-edge/ui` components use the shell fonts by default but can be configured to use brand fonts for content-heavy components like article views or customer-facing portals.

---

## 18. Guest app theme inheritance

Guest apps don't style themselves from scratch. They inherit the workspace's visual system through the theme context.

### How it works

When the gateway proxies a request to a guest app, it injects the complete theme as headers:

```
X-Ensemble-Theme: { colors: {...}, typography: {...}, spatial: {...} }
```

The guest SDK (`@ensemble-edge/guest`) parses this and makes it available:

```typescript
// Inside a guest app
import { defineGuestApp } from '@ensemble-edge/guest-cloudflare'

export default defineGuestApp({
  fetch(request, context) {
    // Full theme available
    const accent = context.theme.colors.accent        // '#d85a30'
    const canvas = context.theme.colors.canvas         // '#d4cdc4'
    const cardBg = context.theme.colors.card           // '#1e1e22'
    const radius = context.theme.spatial.radius        // '16px'
    const font   = context.theme.typography.bodyFont   // 'DM Sans'
    
    // Use in your HTML/CSS
  }
})
```

### CSS variable injection

For guest apps that render HTML (which is most of them), the workspace injects CSS variables into the rendering context. The guest app's HTML gets a `<style>` block with all workspace tokens:

```css
/* Injected by the workspace into guest app rendering context */
:root {
  /* Canvas */
  --canvas: #d4cdc4;
  --canvas-glass: rgba(212, 205, 196, 0.7);
  
  /* Cards */
  --card: #1e1e22;
  --card-hover: #252529;
  --card-elevated: #2a2a2e;
  --card-border: rgba(255,255,255,0.06);
  
  /* Text */
  --text-primary: #f0ede8;
  --text-secondary: #9a938a;
  --text-tertiary: #6b655c;
  
  /* Accent */
  --accent: #d85a30;
  --accent-dim: rgba(216, 90, 48, 0.2);
  --accent-hover: #e06838;
  --accent-text: #ffffff;
  
  /* Semantic */
  --success: #34d399;
  --warning: #fbbf24;
  --error: #f87171;
  --info: #60a5fa;
  
  /* Typography */
  --font-heading: 'DM Sans', system-ui, sans-serif;
  --font-body: 'DM Sans', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  
  /* Spatial */
  --radius: 16px;
  --radius-sm: 8px;
  --radius-lg: 20px;
  --card-gap: 16px;
}
```

### The @ensemble-edge/ui component library

Guest apps that use `@ensemble-edge/ui` get workspace-native components for free:

```tsx
import { Card, StatCard, Pill, ProgressBar, DataRow } from '@ensemble-edge/ui'

// These automatically use the workspace's tokens
<Card>
  <StatCard value="12" label="Customers" delta="+4" deltaDirection="up" />
</Card>

<Pill variant="critical">CRITICAL: 4</Pill>

<ProgressBar value={82} max={100} color="cyan" label="Flood Risk" />
```

Every `@ensemble-edge/ui` component uses `var(--color-*)`, `var(--font-*)`, `var(--radius)` internally. The guest app developer never hardcodes colors. When the workspace admin changes the accent color or switches base themes, every guest app updates automatically.

### What happens when a guest app ignores the tokens

It looks out of place. The cards have different corners, the text is a different font, the accent color doesn't match. The workspace shell is Hauser-beautiful and the guest app looks like an embedded iframe from 2015.

This is by design — it's the incentive for guest app developers to use `@ensemble-edge/ui` and follow the theme tokens. The marketplace can eventually show a "Theme compliance" badge for apps that properly consume all tokens.

### The cascade: what flows from workspace to guest app

```
Workspace admin configures:
  Accent = #d85a30, base theme = Warm, heading font = Playfair Display
                    ↓
Tier 1 derives:
  Canvas, card, text colors from Warm theme
                    ↓
Tier 2 overrides (if set):
  Sidebar = brand:colors.navy, toolbar = Glass, heading font = brand:typography.heading
                    ↓
Shell renders with final computed tokens
                    ↓
Gateway proxies to guest app, injects complete token set as:
  - HTTP headers (X-Ensemble-Theme JSON)
  - CSS variables (injected into rendering context)
  - Context object (context.theme in the SDK)
                    ↓
Guest app renders using workspace tokens:
  - @ensemble-edge/ui components → automatic, zero config
  - Raw HTML/CSS → use var(--accent), var(--card), etc.
  - Custom framework → read from context.theme object
                    ↓
Result: guest app looks native to the workspace
```

### Remote guest apps (iframe)

Guest apps connected via HTTP (not service binding) render in a sandboxed iframe. The workspace passes theme tokens via `postMessage`:

```typescript
// Shell sends to iframe
iframe.contentWindow.postMessage({
  type: 'ensemble:theme',
  theme: computedThemeTokens
}, guestAppOrigin)

// Guest app receives
window.addEventListener('message', (event) => {
  if (event.data.type === 'ensemble:theme') {
    applyTheme(event.data.theme)  // inject CSS variables into :root
  }
})
```

When the user toggles dark mode or the admin changes a brand token, the shell sends an updated `ensemble:theme` message. The iframe updates without a reload.

---

## 19. Icon system

The sidebar icons should disappear into the typography, not compete with it. The Hauser approach: thin single-stroke outlines that match the muted text color exactly. The icon is a visual anchor — the label carries the meaning. The icon system supports three sources, and guest apps choose which to use in their manifest.

### Three icon sources

**Source 1: Lucide Icons (default)**

Ship Lucide as the built-in icon set. 1,500+ icons, tree-shakeable, consistent 24x24 grid. The critical styling: thin strokes and muted color that blends with the text.

```json
"icon": "users"                                    // shorthand, uses Lucide
"icon": { "type": "lucide", "name": "users" }     // explicit
```

The styling is what makes it work — not the icon set:

```css
/* Base icon styling — thin, muted, quiet */
.sidebar-item-icon {
  width: 16px;
  height: 16px;
  stroke-width: 1.5px;              /* thinner than Lucide's default 2px */
  color: var(--text-tertiary);      /* quieter than the label text */
  flex-shrink: 0;
}

/* Active state — icon brightens with the active item */
.sidebar-item.active .sidebar-item-icon {
  color: var(--accent-text);
  stroke-width: 1.5px;              /* stays thin even when active */
}

/* Hover — subtle lift, match the label */
.sidebar-item:hover .sidebar-item-icon {
  color: var(--text-secondary);
}
```

**Why this works:** The icons at `--text-tertiary` are deliberately quieter than the label at `--text-secondary`. Your eye reads the label first, the icon is peripheral confirmation. This is the opposite of most SaaS apps where the icon is the loudest element in the row. Hauser gets this right — the icons are almost invisible until you need them.

**stroke-width: 1.5px is the key.** Lucide defaults to 2px, which looks chunky at 16px. At 1.5px the strokes feel refined and editorial. This single CSS change transforms generic Lucide into something that looks custom.

**Source 2: Custom SVG**

Guest apps provide their own icon — either inline in the manifest or served from a URL. This is how apps get a unique identity. A Stripe connector has the Stripe icon. A Slack connector has the Slack icon. A custom internal tool has whatever the developer draws.

```json
"icon": { "type": "svg", "url": "/assets/icon.svg" }
"icon": { "type": "svg", "inline": "<svg viewBox='0 0 24 24'>...</svg>" }
```

**Constraints for custom SVGs:**
- Must be 24x24 viewBox
- Should use `currentColor` for strokes/fills so the shell controls tinting
- Stroke-based SVGs preferred (matches the Lucide aesthetic), but filled SVGs are fine
- Max 4KB (keeps manifests lean)
- Sanitized on ingestion (strip scripts, external references)

```css
/* Shell controls the color, SVG uses currentColor */
.sidebar-item .custom-icon svg {
  width: 16px;
  height: 16px;
  color: var(--text-tertiary);       /* matches built-in icons */
}

.sidebar-item:hover .custom-icon svg {
  color: var(--text-secondary);
}

.sidebar-item.active .custom-icon svg {
  color: var(--accent-text);
}
```

Custom SVGs that use `currentColor` blend seamlessly with the Lucide icons — same size, same color, same weight feel. Custom SVGs with their own colors (like the Stripe purple or Slack multi-color logo) won't tint, which is fine — they stand out as branded third-party connectors, and that distinction is useful.

**Source 3: Emoji**

Simple, distinctive, zero design skill needed. Surprisingly effective in a sidebar.

```json
"icon": { "type": "emoji", "value": "👥" }
"icon": { "type": "emoji", "value": "🔥" }
"icon": { "type": "emoji", "value": "📊" }
```

```css
.sidebar-item .emoji-icon {
  font-size: 14px;                   /* slightly smaller than you'd think — matches 16px icon weight */
  line-height: 1;
  width: 16px;
  text-align: center;
  flex-shrink: 0;
}
```

Emoji icons don't tint with hover or active states (they're already colored). They just get a slight opacity shift:

```css
.sidebar-item .emoji-icon {
  opacity: 0.6;                      /* muted to match --text-tertiary feel */
}

.sidebar-item:hover .emoji-icon {
  opacity: 0.8;
}

.sidebar-item.active .emoji-icon {
  opacity: 1;
}
```

### Manifest icon field (expanded)

The full icon schema in the guest app manifest:

```typescript
type ManifestIcon =
  | string                                          // shorthand: "users" → Lucide
  | { type: 'lucide'; name: string }                // explicit Lucide
  | { type: 'svg'; url: string }                    // served from guest app
  | { type: 'svg'; inline: string }                 // embedded in manifest
  | { type: 'emoji'; value: string }                // single emoji character
```

### Core and bundled app icons

Core apps use Lucide by default — thin, muted, consistent:

| Core app | Default icon | Lucide name |
|---|---|---|
| Admin / Settings | Gear outline | `settings` |
| Brand Manager | Palette outline | `palette` |
| People & Teams | Users outline | `users` |
| Auth | Lock outline | `lock` |
| Knowledge Graph | Book outline | `book-open` |
| App Manager | Grid outline | `layout-grid` |
| Audit Log | Scroll outline | `scroll-text` |
| Navigation Hub | Compass outline | `compass` |

The workspace admin can override any icon in Settings → Navigation — switch to a custom SVG or emoji per app. This lets companies replace the generic "settings gear" with something on-brand without touching code.

### Icon in the workspace switcher

The workspace switcher strip shows a small icon per workspace — this comes from the logo mark brand token (Tier 1). If no logo is set, it shows the first letter of the workspace name in accent color on a dark rounded square. This is already in the spec and works well.

### Icons everywhere else

The same styling principles apply outside the sidebar:

| Context | Size | Stroke | Color |
|---|---|---|---|
| Sidebar nav items | 16px | 1.5px | `--text-tertiary` |
| Toolbar buttons | 16px | 1.5px | `--text-secondary` |
| Right strip buttons | 18px | 1.5px | `--text-secondary` |
| Card headers | 16px | 1.5px | `--text-tertiary` |
| Status pills / badges | 14px | 1.5px | inherit from pill color |
| Stat card icons | 20px | 1.5px | `--text-tertiary` |
| Command palette results | 16px | 1.5px | `--text-tertiary` |
| Empty states | 48px | 1px | `--text-tertiary` at 40% opacity |

Notice: stroke-width stays 1.5px at every size except empty states (where 1px looks better at 48px). The consistency is what makes it feel like a system.

---

## 20. Canvas layout system — cards, pages, and widgets

The viewport is a scrollable canvas. Guest apps render ON that canvas. But not every screen looks the same — a dashboard has many small cards, a detail view is one big card, a settings page is a form inside a card. The layout system gives guest apps three patterns that all look great with zero effort.

### Three layout modes

**Mode 1: Multi-card layout** (default)

Multiple cards floating on the canvas in a responsive grid. This is the dashboard / overview pattern. The canvas is visible between cards. Each card is independent.

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│ stat     │  │ stat     │  │ stat     │
│ card     │  │ card     │  │ card     │
└──────────┘  └──────────┘  └──────────┘

┌─────────────────────┐  ┌──────────────┐
│ table card          │  │ chart card   │
│                     │  │              │
│                     │  │              │
└─────────────────────┘  └──────────────┘
```

The guest app returns HTML/components and wraps each section in `<Card>` from `@ensemble-edge/ui`. The cards automatically get the workspace's radius, padding, background, and border. The grid is responsive.

```tsx
import { Card, CardGrid, StatCard } from '@ensemble-edge/ui'

<CardGrid>
  <StatCard value="12" label="Customers" delta="+4" direction="up" />
  <StatCard value="3" label="Pending trials" />
  <StatCard value="$4.2K" label="MRR" delta="+12%" direction="up" />
</CardGrid>

<CardGrid columns={2}>
  <Card title="Recent activity" size="lg">
    <ActivityList items={activities} />
  </Card>
  <Card title="Quick actions">
    <ActionList items={actions} />
  </Card>
</CardGrid>
```

**Mode 2: Full-page card**

One card that fills the entire viewport canvas. Used for detail views, forms, editors, settings pages — anything where you want the user focused on a single context. The canvas still shows as a thin border around the card (the card doesn't touch the viewport edges).

```
┌──────────────────────────────────────┐
│                                      │
│  Customer: Acme Corp                 │
│                                      │
│  Status: Active                      │
│  Credits: 1,240 remaining            │
│  ...                                 │
│                                      │
│                                      │
│                                      │
└──────────────────────────────────────┘
```

```tsx
import { PageCard } from '@ensemble-edge/ui'

<PageCard title="Customer: Acme Corp" backLink="/customers">
  <CustomerDetail customer={customer} />
</PageCard>
```

`PageCard` fills the viewport width (minus canvas padding), has no max-height (scrolls with the page), and includes a back navigation link at the top.

**Mode 3: Split layout**

A master-detail pattern — a narrow list card on the left, a wider detail card on the right. Used for email-style views, CRM contact lists, document browsers. Both cards float on the canvas.

```
┌──────────────┐  ┌────────────────────────┐
│ Contact list │  │ Contact: Jane Doe      │
│              │  │                        │
│ > Jane Doe   │  │ Email: jane@acme.com   │
│   John Smith │  │ Credits: 500           │
│   Acme Corp  │  │ Last active: 2h ago    │
│              │  │                        │
│              │  │                        │
└──────────────┘  └────────────────────────┘
```

```tsx
import { SplitLayout, Card } from '@ensemble-edge/ui'

<SplitLayout
  master={<ContactList contacts={contacts} onSelect={setSelected} />}
  masterWidth="320px"
  detail={<ContactDetail contact={selected} />}
/>
```

On mobile (< 768px), the split collapses — master fills the screen, tapping an item navigates to the detail card (full page). Back button returns to the list.

### How the manifest declares layout preference

The manifest doesn't explicitly declare layout mode. Instead, the guest app's own HTML uses the `@ensemble-edge/ui` layout components, and they handle the responsive behavior. The workspace shell provides the canvas, padding, and right-strip offset. The guest app composes cards on that canvas.

This means the guest app developer has full control over their layout while the workspace ensures visual consistency through the card and grid primitives.

### Widgets vs cards vs pages — the naming

Let's be precise about terminology so it's never confusing:

| Term | What it is | Where it lives | Who controls layout |
|---|---|---|---|
| **Card** | A dark rounded surface that holds content | On the canvas inside the viewport | The guest app composes cards using `@ensemble-edge/ui` |
| **Widget** | A small card contributed to the dashboard via the manifest's `widgets` field | On the dashboard (managed by `bundled:dashboard`) | The dashboard grid manages placement, the guest app provides data |
| **Page** | A full-screen card (or multi-card composition) that fills the viewport | The viewport, when the user navigates to the guest app | The guest app owns the layout, shell provides the canvas |

**Cards** are the primitive. Everything is built from cards. A widget is a small card. A page is a big card (or many cards). A detail view is a full-page card. A dashboard is a grid of widget cards. The user doesn't need to know the word "card" — they just see content that floats on their workspace canvas with consistent rounded corners, padding, and colors.

### The CardGrid component

The responsive grid that holds cards:

```tsx
interface CardGridProps {
  columns?: 1 | 2 | 3 | 4 | 'auto'  // 'auto' = auto-fit based on viewport width (default)
  gap?: 'sm' | 'md' | 'lg'           // maps to --card-gap variants (default: 'md')
  children: preact.ComponentChildren
}
```

```css
.card-grid {
  display: grid;
  gap: var(--card-gap);
}

.card-grid[data-columns="auto"] {
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
}

.card-grid[data-columns="1"] { grid-template-columns: 1fr; }
.card-grid[data-columns="2"] { grid-template-columns: repeat(2, 1fr); }
.card-grid[data-columns="3"] { grid-template-columns: repeat(3, 1fr); }
.card-grid[data-columns="4"] { grid-template-columns: repeat(4, 1fr); }

/* Responsive collapse */
@media (max-width: 768px) {
  .card-grid[data-columns="2"],
  .card-grid[data-columns="3"],
  .card-grid[data-columns="4"] {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 769px) and (max-width: 1024px) {
  .card-grid[data-columns="3"],
  .card-grid[data-columns="4"] {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

### The Card component

The base card with variants:

```tsx
interface CardProps {
  title?: string                      // optional header with section label styling
  subtitle?: string                   // optional secondary text below title
  action?: { label: string; onClick: () => void }  // optional action button in header
  padding?: 'none' | 'sm' | 'md' | 'lg'           // default: 'md' (24px)
  hover?: boolean                     // show hover state (default: false)
  onClick?: () => void                // make entire card clickable
  children: preact.ComponentChildren
}
```

```css
.card {
  background: var(--card);
  border: 1px solid var(--card-border);
  border-radius: var(--radius);       /* from workspace settings, default 16px */
  overflow: hidden;                   /* clip content to rounded corners */
}

.card-padding-sm  { padding: 16px; }
.card-padding-md  { padding: 24px; }
.card-padding-lg  { padding: 32px; }
.card-padding-none { padding: 0; }    /* for cards with full-bleed content like images or tables */

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.card-title {
  font-size: 0.6875rem;              /* section label style */
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.card-subtitle {
  font-size: 0.8125rem;
  color: var(--text-tertiary);
  margin-top: 2px;
}

.card[data-hover]:hover {
  background: var(--card-hover);
  cursor: pointer;
}
```

### Dashboard widgets specifically

Dashboard widgets are cards managed by `bundled:dashboard`. The guest app declares widgets in its manifest with a size:

```json
"widgets": [
  { "id": "active-keys", "name": "Active keys", "size": "small", "api_route": "GET /widgets/active-keys" },
  { "id": "usage-chart", "name": "Usage over time", "size": "large", "api_route": "GET /widgets/usage-chart" }
]
```

Widget sizes map to grid spans:

| Size | Grid span | Typical content |
|---|---|---|
| `small` | 1 column | Stat card — single number + label + delta |
| `medium` | 1 column | Small list, mini chart, progress bars |
| `large` | 2 columns | Full chart, table, detailed breakdown |
| `full` | Full width | Timeline, kanban board, map |

The dashboard grid handles placement. The user can drag widgets to reorder. Each widget calls its `api_route` through the gateway and renders the response inside a Card:

```
Dashboard
┌──────────┐  ┌──────────┐  ┌──────────┐
│ 12       │  │ 3        │  │ $4.2K    │
│ Active   │  │ Pending  │  │ MRR      │
│ keys     │  │ trials   │  │ ↑ 12%    │
│ [small]  │  │ [small]  │  │ [small]  │
└──────────┘  └──────────┘  └──────────┘

┌────────────────────────┐  ┌──────────┐
│ ▁▂▃▅▆▇ Usage over time │  │ Recent   │
│                        │  │ events   │
│ [large — 2 col span]  │  │ [medium] │
└────────────────────────┘  └──────────┘

┌─────────────────────────────────────┐
│ Credit reconciliation timeline      │
│ [full — full width]                 │
└─────────────────────────────────────┘
```

The widget API returns JSON, and `@ensemble-edge/ui` provides widget-specific renderers:

```typescript
// Widget API response shape
interface WidgetResponse {
  type: 'stat' | 'list' | 'chart' | 'table' | 'custom'
  data: StatData | ListData | ChartData | TableData | string  // 'custom' = raw HTML
}

// Stat widget
{ type: 'stat', data: { value: '12', label: 'Active keys', delta: '+4', direction: 'up' } }

// List widget
{ type: 'list', data: { items: [{ label: 'Trial request', subtitle: 'acme@corp.com', time: '2m ago' }] } }

// Chart widget (Chart.js or similar)
{ type: 'chart', data: { chartType: 'line', labels: [...], datasets: [...] } }
```

This means a guest app developer can ship a dashboard widget without writing ANY frontend code — they just return JSON from an API endpoint, and the workspace renders it as a beautiful card that matches the theme.

---

*This document is the bridge between "functional shell" and "workspace you want to live in." Companies should see their workspace and think "this is ours" — not "this is a tool we use." Start with Phase 1 (canvas + cards), then layer in the customization tiers and layout system. The design system does the heavy lifting so every workspace — from a 3-person startup to a 500-person enterprise — looks like it was custom-built for them.*