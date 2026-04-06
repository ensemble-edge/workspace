# Workspace Animation Spec

**Status:** Spec
**Applies to:** `@ensemble-edge/ui` components, shell chrome, overlays, navigation
**Target:** Web (Chrome, Safari, Firefox) + Tauri v2 native (macOS, iOS, Android, Windows, Linux)
**Philosophy:** The user should never notice the animation. They should only notice when it's missing.

---

## Principles

1. **Invisible until absent.** If a user can describe the animation, it's too much. The goal is feel, not spectacle. Every transition exists to communicate spatial relationships and state changes — not to entertain.

2. **Physics over math.** Linear easing feels robotic. Cubic beziers feel human. Springs feel native. Use ease-out for entries (fast start, gentle landing), ease-in for exits (gentle start, fast departure). Never linear except for continuous loops (spinners).

3. **Faster than you think.** Most web animations are too slow. Native iOS transitions are 250-350ms. The best ones are under 200ms. If you're debating between faster and slower, go faster.

4. **Match the platform.** macOS/iOS users expect spring physics and momentum. Android users expect sharp material easing. Windows users expect snappy fades. The Tauri wrapper can inject platform-specific timing tokens. The defaults target Apple (the highest animation bar).

5. **Respect the user.** Honor `prefers-reduced-motion`. When enabled, all transitions become instant (0ms duration) except opacity fades which drop to 100ms. No exceptions.

---

## Timing tokens

Every animation in the workspace uses one of these durations. No magic numbers in component CSS.

```css
:root {
  /* Durations */
  --duration-instant: 0ms;          /* state changes with no transition needed */
  --duration-micro: 80ms;           /* hover color changes, focus rings */
  --duration-fast: 120ms;           /* button press, toggle flip, checkbox check */
  --duration-normal: 200ms;         /* panel slides, card reveals, tab switches */
  --duration-slow: 300ms;           /* overlay entries, page transitions */
  --duration-deliberate: 500ms;     /* large layout shifts, first-load reveals */

  /* Easing curves */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);           /* entries — fast start, gentle stop */
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);            /* exits — gentle start, fast departure */
  --ease-in-out: cubic-bezier(0.45, 0, 0.55, 1);       /* symmetric — repositioning */
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);    /* slight overshoot — toggles, modals */
  --ease-bounce: cubic-bezier(0.34, 1.8, 0.64, 1);     /* noticeable overshoot — toasts, badges */

  /* Reduced motion override */
  @media (prefers-reduced-motion: reduce) {
    --duration-micro: 0ms;
    --duration-fast: 0ms;
    --duration-normal: 0ms;
    --duration-slow: 100ms;         /* keep a minimal fade so things don't just pop */
    --duration-deliberate: 100ms;
    --ease-spring: var(--ease-out); /* remove overshoot */
    --ease-bounce: var(--ease-out);
  }
}
```

### Why these curves

**`--ease-out` (the workhorse):** 80% of transitions use this. The element arrives quickly and settles gently — like setting a glass down on a table. This is what makes things feel physical.

**`--ease-spring`:** A tiny overshoot (1.56 control point) — the element goes slightly past its target then settles back. Use sparingly: toggle switches, modal entry, toast entry. The overshoot is 2-3px at most — subconscious, not cartoon.

**`--ease-bounce`:** Stronger overshoot (1.8). Reserved for attention-seeking moments: notification badge appearing, toast sliding in. Still subtle — the bounce is ~5px, not a trampoline.

---

## Shell chrome animations

### Sidebar

```css
/* Sidebar item hover — color shift only, no movement */
.sidebar-item {
  transition: 
    background var(--duration-micro) var(--ease-out),
    color var(--duration-micro) var(--ease-out);
}

/* Sidebar subnav expand/collapse */
.sidebar-subnav {
  transition: max-height var(--duration-normal) var(--ease-out);
  overflow: hidden;
}

/* Sidebar section toggle arrow rotation */
.sidebar-parent-toggle {
  transition: transform var(--duration-fast) var(--ease-out);
}

/* Sidebar collapse to icon-only (tablet) */
.sidebar {
  transition: width var(--duration-normal) var(--ease-out);
}

/* Mobile sidebar slide-in */
.sidebar-mobile {
  transition: transform var(--duration-slow) var(--ease-out);
}
.sidebar-mobile-backdrop {
  transition: opacity var(--duration-slow) var(--ease-out);
}
```

### Toolbar

```css
/* Toolbar glass activation on scroll — fade in the blur */
.toolbar {
  transition:
    background var(--duration-normal) var(--ease-out),
    backdrop-filter var(--duration-normal) var(--ease-out),
    border-color var(--duration-normal) var(--ease-out);
}
```

### Right strip panels

```css
/* Panel slide in/out */
.right-panel {
  transition: transform var(--duration-normal) var(--ease-out);
}

/* Right strip button active state */
.right-strip-button {
  transition:
    background var(--duration-micro) var(--ease-out),
    color var(--duration-micro) var(--ease-out);
}
```

### Workspace switcher

```css
/* Workspace icon hover */
.ws-strip-item {
  transition: 
    transform var(--duration-fast) var(--ease-spring),
    opacity var(--duration-fast) var(--ease-out);
}

/* Subtle scale on hover — barely perceptible */
.ws-strip-item:hover {
  transform: scale(1.05);
}

/* Active indicator slide */
.ws-strip-active-indicator {
  transition: top var(--duration-normal) var(--ease-out);
}
```

---

## Navigation transitions

### Page transitions (viewport content swap)

When navigating between pages within an app, the content should feel like it's flowing, not teleporting. But the transition must be fast enough that it never feels like waiting.

```css
/* Exiting page */
.page-exit {
  animation: pageExit var(--duration-fast) var(--ease-in) forwards;
}

@keyframes pageExit {
  to {
    opacity: 0;
    transform: translateY(-4px);    /* slight upward drift, almost invisible */
  }
}

/* Entering page */
.page-enter {
  animation: pageEnter var(--duration-normal) var(--ease-out);
}

@keyframes pageEnter {
  from {
    opacity: 0;
    transform: translateY(6px);     /* slight rise from below */
  }
}
```

The exit is faster (120ms) than the entry (200ms). This creates a "quick out, gentle in" rhythm that feels snappy. The movement is 4-6px — enough for the subconscious to register directionality but not enough to see as "sliding."

### Tab switching

When switching tabs within an app, the transition should indicate direction (left tab to right tab = content slides left).

```css
/* Tab content transition */
.tab-content-enter-left {
  animation: slideFromLeft var(--duration-normal) var(--ease-out);
}

.tab-content-enter-right {
  animation: slideFromRight var(--duration-normal) var(--ease-out);
}

@keyframes slideFromLeft {
  from { opacity: 0; transform: translateX(-12px); }
}

@keyframes slideFromRight {
  from { opacity: 0; transform: translateX(12px); }
}
```

12px of horizontal movement. Just enough to convey "I came from that direction." Combined with a fade, it creates the feeling of panels sliding past each other.

### Back navigation

Navigating back (clicking "← Back to customers" or browser back) reverses the animation direction:

```css
/* Forward: rise from below */
.navigate-forward .page-enter { 
  animation: pageEnter var(--duration-normal) var(--ease-out); 
}

/* Back: drop from above */
.navigate-back .page-enter {
  animation: pageEnterReverse var(--duration-normal) var(--ease-out);
}

@keyframes pageEnterReverse {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
}
```

---

## Overlay animations

### Drawer

The drawer slides from the right. The backdrop fades in. Both start simultaneously but the drawer is slightly delayed to create a "backdrop opens, then content slides in" layering effect.

```css
.overlay-drawer-backdrop {
  opacity: 0;
  transition: opacity var(--duration-normal) var(--ease-out);
}

.overlay-drawer-backdrop.open {
  opacity: 1;
}

.overlay-drawer {
  transform: translateX(100%);
  transition: transform var(--duration-slow) var(--ease-out);
  transition-delay: 30ms;           /* tiny delay — backdrop first, then drawer */
}

.overlay-drawer.open {
  transform: translateX(0);
}

/* Exit — drawer first, then backdrop */
.overlay-drawer.closing {
  transform: translateX(100%);
  transition: transform var(--duration-normal) var(--ease-in);
  transition-delay: 0ms;
}

.overlay-drawer-backdrop.closing {
  opacity: 0;
  transition-delay: 50ms;           /* backdrop fades after drawer starts leaving */
}
```

### Mobile bottom sheet

On mobile, the drawer becomes a bottom sheet with spring physics — it overshoots slightly when opening, creating a "pulled up and snapped into place" feel.

```css
@media (max-width: 639px) {
  .overlay-drawer {
    transform: translateY(100%);
    transition: transform var(--duration-slow) var(--ease-spring);
  }

  .overlay-drawer.open {
    transform: translateY(0);
  }

  /* Drag-to-dismiss velocity threshold */
  .overlay-drawer.dragging {
    transition: none;                /* disable transition during drag */
  }
}
```

### Modal

The modal uses scale + opacity. It appears to "grow" from the center of the screen — not from a point, just a subtle 95% → 100% scale that creates depth.

```css
.overlay-modal-backdrop {
  opacity: 0;
  transition: opacity var(--duration-normal) var(--ease-out);
}

.overlay-modal-backdrop.open {
  opacity: 1;
}

.overlay-modal {
  opacity: 0;
  transform: scale(0.96);
  transition:
    opacity var(--duration-normal) var(--ease-out),
    transform var(--duration-normal) var(--ease-spring);
}

.overlay-modal.open {
  opacity: 1;
  transform: scale(1);
}

/* Exit — faster, no spring */
.overlay-modal.closing {
  opacity: 0;
  transform: scale(0.98);
  transition:
    opacity var(--duration-fast) var(--ease-in),
    transform var(--duration-fast) var(--ease-in);
}
```

### Dialog

Same pattern as modal but faster. Dialogs are urgent — confirmations and alerts shouldn't float in.

```css
.overlay-dialog {
  opacity: 0;
  transform: scale(0.96);
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-spring);
}

.overlay-dialog.open {
  opacity: 1;
  transform: scale(1);
}

.overlay-dialog.closing {
  opacity: 0;
  transition: opacity 80ms var(--ease-in);   /* very fast dismiss */
  transform: none;                            /* no scale on exit — just vanish */
}
```

### Command palette

The command palette drops from the toolbar area — it feels like it's extending from the search button.

```css
.command-palette-backdrop {
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.command-palette-backdrop.open {
  opacity: 1;
}

.command-palette {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.command-palette.open {
  opacity: 1;
  transform: translateY(0) scale(1);
}
```

---

## Component animations

### Button press

The button compresses slightly on mousedown, then springs back on release. This creates a physical "click" feel without any visual change on hover.

```css
.btn {
  transition: 
    background var(--duration-micro) var(--ease-out),
    color var(--duration-micro) var(--ease-out),
    border-color var(--duration-micro) var(--ease-out);
}

.btn:active {
  transform: scale(0.97);
  transition: transform 50ms var(--ease-out);
}

/* Spring back on release — the user doesn't hold the button */
.btn:not(:active) {
  transition: transform var(--duration-fast) var(--ease-spring);
}
```

### Toggle switch

The toggle thumb slides with spring physics — slight overshoot mimics a physical switch snapping into place.

```css
.toggle-thumb {
  transition: transform var(--duration-fast) var(--ease-spring);
}
```

### Checkbox check

The checkmark appears with a quick scale-up from center, creating a "stamp" feel.

```css
.checkbox-check {
  transform: scale(0);
  transition: transform var(--duration-fast) var(--ease-spring);
}

.checkbox[data-checked] .checkbox-check {
  transform: scale(1);
}
```

### Select dropdown

The dropdown menu fades in with a slight upward movement — it feels like it's rising from the input field.

```css
.select-menu {
  opacity: 0;
  transform: translateY(4px);
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
  pointer-events: none;
}

.select-menu.open {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}
```

### Cards

Cards should never animate on page load (no staggered entrance animations — that's a web app cliché). But they do have subtle hover feedback:

```css
.card {
  transition: background var(--duration-micro) var(--ease-out);
}

/* Only hoverable cards get visual feedback */
.card[data-hover]:hover {
  background: var(--card-hover);
}

/* Clickable cards get a press effect */
.card[data-hover]:active {
  transform: scale(0.995);
  transition: transform 50ms var(--ease-out);
}
```

The press scale is 0.995 — half a percent. Completely invisible to the conscious eye. But the subconscious registers the physical response.

### Stat card value changes

When a stat card's value updates (real-time data, dashboard refresh), the number should transition smoothly rather than snapping.

```css
.stat-value {
  transition: opacity var(--duration-fast) var(--ease-out);
}

.stat-value.updating {
  opacity: 0.5;
}

.stat-value.updated {
  animation: statPulse var(--duration-normal) var(--ease-out);
}

@keyframes statPulse {
  0%   { opacity: 0.5; }
  100% { opacity: 1; }
}
```

No number counting animations. No rolling digits. Just a quick dim → restore that says "this value just changed." Subtle.

### Table row hover

```css
.table-row {
  transition: background var(--duration-micro) var(--ease-out);
}
```

No transform, no elevation change. Just a background color shift at 80ms. Tables are dense — any movement animation would be distracting across hundreds of rows.

---

## Toast animations

Toasts slide in from the right and out to the right. The progress bar drains linearly (the only linear animation in the system — it's a timer, not a physical movement).

```css
.toast-enter {
  animation: toastIn var(--duration-normal) var(--ease-bounce);
}

@keyframes toastIn {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.toast-exit {
  animation: toastOut var(--duration-fast) var(--ease-in) forwards;
}

@keyframes toastOut {
  to {
    opacity: 0;
    transform: translateX(40px);
  }
}

/* Progress bar — the only linear animation */
.toast-progress {
  height: 2px;
  background: currentColor;
  opacity: 0.3;
  transform-origin: left;
  animation: toastTimer linear forwards;
}

@keyframes toastTimer {
  from { transform: scaleX(1); }
  to   { transform: scaleX(0); }
}
```

The toast entry uses `--ease-bounce` — the only place in the UI where the overshoot is noticeable. This is intentional: toasts are attention-seeking. They arrive with a slight bounce to say "look at me." Everything else in the UI is invisible.

---

## Badge animations

When a badge count increments (new notification, new trial request), the badge pulses briefly.

```css
.badge-increment {
  animation: badgePulse var(--duration-normal) var(--ease-spring);
}

@keyframes badgePulse {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.2); }
  100% { transform: scale(1); }
}
```

20% scale bump at peak. Lasts 200ms. The user's peripheral vision catches the movement without looking directly at it.

When a badge first appears (count goes from 0 to 1):

```css
.badge-appear {
  animation: badgeAppear var(--duration-fast) var(--ease-spring);
}

@keyframes badgeAppear {
  from {
    transform: scale(0);
    opacity: 0;
  }
}
```

---

## Focus transitions

Focus rings should fade in, not snap. This prevents the jarring flash when tabbing through forms.

```css
/* Global focus transition */
*:focus-visible {
  transition: box-shadow var(--duration-micro) var(--ease-out);
}

/* Input focus — border color + ring */
.input:focus {
  transition:
    border-color var(--duration-micro) var(--ease-out),
    box-shadow var(--duration-micro) var(--ease-out);
}
```

---

## Scroll behavior

### Smooth scroll for anchor jumps

```css
html {
  scroll-behavior: smooth;
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
}
```

### Scroll-linked effects

The floating toolbar glass activation is scroll-linked (see shell chrome). This must be driven by JavaScript (`scrollTop` check), not CSS scroll-timeline (not yet widely supported). The JS handler uses `requestAnimationFrame` and a simple threshold — no heavy scroll listeners.

### Momentum scrolling on iOS

```css
.viewport, .overlay-drawer, .sidebar {
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;      /* prevent scroll chaining to parent */
}
```

---

## Dark mode transition

When toggling dark/light mode, the entire theme transitions smoothly. No flash of white/black.

```css
:root {
  transition:
    --canvas var(--duration-slow) var(--ease-in-out),
    --card var(--duration-slow) var(--ease-in-out),
    --text-primary var(--duration-slow) var(--ease-in-out),
    --text-secondary var(--duration-slow) var(--ease-in-out);
}

/* Fallback: if CSS custom property transitions aren't supported, 
   transition the background and color on key elements */
body, .sidebar, .toolbar, .card, .viewport {
  transition:
    background-color var(--duration-slow) var(--ease-in-out),
    color var(--duration-slow) var(--ease-in-out),
    border-color var(--duration-slow) var(--ease-in-out);
}
```

300ms for theme transitions. Slow enough to feel intentional, fast enough to not feel sluggish.

---

## Platform-specific tuning

### Tauri macOS / iOS

Apple users expect spring physics. The Tauri wrapper can inject platform-specific overrides:

```css
[data-platform="macos"],
[data-platform="ios"] {
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);   /* default is already Apple-tuned */
  --duration-slow: 350ms;                               /* macOS transitions are slightly longer */
}
```

On iOS, also enable:
- Rubber-band scroll at content edges
- Swipe-right to go back (drawer closes, or navigates back)
- Haptic feedback on toggle/checkbox (via Tauri native bridge)

### Tauri Android

Material Design uses sharper easing. Override the spring curves:

```css
[data-platform="android"] {
  --ease-spring: cubic-bezier(0.2, 0, 0, 1);           /* material standard easing */
  --ease-out: cubic-bezier(0.2, 0, 0, 1);
  --duration-normal: 250ms;                             /* material medium duration */
  --duration-slow: 350ms;                               /* material large duration */
}
```

### Tauri Windows / Linux

Keep defaults (Apple-tuned). Windows users don't have strong animation expectations from the OS, so the Apple curves feel premium without feeling foreign.

---

## Performance rules

1. **Only animate `transform` and `opacity`.** These are GPU-composited. Animating `width`, `height`, `top`, `left`, `padding`, or `margin` triggers layout reflow — janky on every platform.

2. **Exception: `background-color` and `border-color`** are ok for hover states. They trigger repaint but not reflow, and at 80ms duration the cost is negligible.

3. **Exception: `box-shadow`** for focus rings. Repaint-only, fast duration.

4. **No animation on page load.** Cards don't stagger in. Stat numbers don't count up. The page appears — fully formed, instantly. Load animations are a web app cliché that screams "I'm not native."

5. **No animation during scroll.** Parallax, scroll-triggered reveals, and intersection observer animations are banned. Content is there when you scroll to it. The only scroll-linked effect is the toolbar glass activation (a single binary state change, not a continuous animation).

6. **`will-change` is opt-in.** Don't blanket-apply `will-change: transform` to everything. Apply it only to elements that actually animate frequently (drawer, modal, toggle thumb). Remove it after the animation completes if it's a one-time transition.

```css
.overlay-drawer {
  will-change: transform;
}

.overlay-modal {
  will-change: transform, opacity;
}

.toggle-thumb {
  will-change: transform;
}
```

---

## Animation inventory

Every animated element in the workspace, in one table:

| Element | Property | Duration | Easing | Trigger |
|---|---|---|---|---|
| Sidebar item | background, color | micro (80ms) | ease-out | hover |
| Sidebar subnav | max-height | normal (200ms) | ease-out | expand/collapse |
| Sidebar toggle arrow | transform (rotate) | fast (120ms) | ease-out | expand/collapse |
| Sidebar width | width | normal (200ms) | ease-out | collapse to icon-only |
| Mobile sidebar | transform (translateX) | slow (300ms) | ease-out | open/close |
| Toolbar glass | background, backdrop-filter | normal (200ms) | ease-out | scroll threshold |
| Right panel | transform (translateX) | normal (200ms) | ease-out | open/close |
| WS strip item | transform (scale) | fast (120ms) | spring | hover |
| Page content | opacity, transform (translateY) | fast→normal (120→200ms) | ease-in→ease-out | navigate |
| Tab content | opacity, transform (translateX) | normal (200ms) | ease-out | tab switch |
| Drawer | transform (translateX) | slow (300ms) | ease-out | open/close |
| Drawer backdrop | opacity | normal (200ms) | ease-out | open/close |
| Bottom sheet | transform (translateY) | slow (300ms) | spring | open/close |
| Modal | opacity, transform (scale) | normal (200ms) | spring | open |
| Modal exit | opacity, transform (scale) | fast (120ms) | ease-in | close |
| Dialog | opacity, transform (scale) | fast (120ms) | spring | open |
| Dialog exit | opacity | micro (80ms) | ease-in | close |
| Command palette | opacity, transform | fast (120ms) | ease-out | open/close |
| Button | background, color | micro (80ms) | ease-out | hover |
| Button press | transform (scale 0.97) | 50ms | ease-out | mousedown |
| Button release | transform (scale 1) | fast (120ms) | spring | mouseup |
| Card hover | background | micro (80ms) | ease-out | hover |
| Card press | transform (scale 0.995) | 50ms | ease-out | mousedown |
| Toggle thumb | transform (translateX) | fast (120ms) | spring | toggle |
| Checkbox check | transform (scale) | fast (120ms) | spring | check |
| Select dropdown | opacity, transform | fast (120ms) | ease-out | open |
| Toast entry | opacity, transform (translateX) | normal (200ms) | bounce | appear |
| Toast exit | opacity, transform (translateX) | fast (120ms) | ease-in | dismiss |
| Toast progress | transform (scaleX) | varies | linear | timer |
| Badge pulse | transform (scale) | normal (200ms) | spring | count change |
| Badge appear | transform (scale), opacity | fast (120ms) | spring | 0→1 |
| Stat value | opacity | fast (120ms) | ease-out | data update |
| Focus ring | box-shadow | micro (80ms) | ease-out | focus |
| Dark mode | background, color, border | slow (300ms) | ease-in-out | theme toggle |
| Table row | background | micro (80ms) | ease-out | hover |

---

*Every animation in this table exists to communicate something: "this moved," "this changed," "this responded to you." None exist to decorate. If an animation doesn't pass the test — "would a user notice if I removed this?" and the answer is "no, but the app would feel slightly cheaper" — it's the right animation.*