# @ensemble-edge/ui — Component Library Spec

**Status:** Spec
**Package:** `@ensemble-edge/ui`
**Applies to:** Shell chrome, core apps, bundled apps, guest apps
**Depends on:** workspace-styling.md (design tokens), workspace-page-architecture.md (layout)
**Design north star:** Hauser — dark floating cards, warm canvas, thin strokes, typographic confidence, data density without clutter

---

## Design principles for every component

1. **Dark surfaces, warm palette.** Components render on dark card backgrounds. Text is warm white, not pure white. Borders are barely visible (`rgba(255,255,255,0.06)`). No harsh contrasts.

2. **Thin and quiet.** Icons at 1.5px stroke. Borders at 1px max. Focus rings are subtle glows, not thick outlines. Components recede until interacted with.

3. **Typography carries hierarchy.** No heavy visual chrome needed — font size, weight, and color create all the hierarchy. Uppercase tracked labels for categories. Large bold numbers for data. Muted small text for metadata.

4. **Spacing breathes.** Generous padding inside components (12-16px for inputs, 16-24px for cards). Generous gaps between components (12-16px). Nothing feels cramped.

5. **Consistent radius.** All components use `var(--radius-sm)` (8px) for small elements (buttons, inputs, pills) and `var(--radius)` (16px) for large containers (cards, modals, drawers). Never mix rounded and sharp in the same context.

6. **Every component consumes CSS variables.** No hardcoded colors. Every component works in light mode, dark mode, and any base theme automatically.

---

## Shared tokens

Every component references these CSS variables. See workspace-styling.md for the full token system.

```css
/* Surfaces */
--canvas, --card, --card-hover, --card-elevated, --card-border

/* Text */
--text-primary, --text-secondary, --text-tertiary

/* Accent */
--accent, --accent-dim, --accent-hover, --accent-text

/* Semantic */
--success, --warning, --error, --info

/* Spatial */
--radius (16px), --radius-sm (8px), --radius-lg (20px)
--card-gap (16px)

/* Typography */
--font-heading, --font-body, --font-mono

/* Transitions */
--transition-fast (120ms), --transition-normal (200ms)
```

---

## Buttons

The most used component. Four variants, three sizes.

### Variants

| Variant | Background | Text | Border | Use case |
|---|---|---|---|---|
| `default` | `var(--card-elevated)` | `var(--text-secondary)` | `1px solid var(--card-border)` | Secondary actions, cancel, dismiss |
| `primary` | `var(--accent)` | `var(--accent-text)` | none | Primary CTA — save, approve, create |
| `danger` | transparent | `var(--error)` | `1px solid var(--error)` at 30% opacity | Destructive — delete, revoke, remove |
| `ghost` | transparent | `var(--text-secondary)` | none | Tertiary — inline actions, icon-only buttons |

### Sizes

| Size | Height | Padding | Font size | Icon size |
|---|---|---|---|---|
| `sm` | 28px | 0 12px | 0.75rem (12px) | 14px |
| `md` (default) | 36px | 0 16px | 0.8125rem (13px) | 16px |
| `lg` | 44px | 0 20px | 0.875rem (14px) | 18px |

### States

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: var(--radius-sm);
  font-weight: 500;
  font-family: var(--font-body);
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
  user-select: none;
}

/* Hover — subtle lift */
.btn-default:hover { background: var(--card-hover); color: var(--text-primary); }
.btn-primary:hover { background: var(--accent-hover); }
.btn-danger:hover  { background: rgba(var(--error-rgb), 0.1); }
.btn-ghost:hover   { background: rgba(255,255,255,0.06); color: var(--text-primary); }

/* Active — pressed */
.btn:active { transform: scale(0.98); }

/* Focus — subtle glow, not thick ring */
.btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--accent-dim);
}

/* Disabled */
.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
}

/* Loading */
.btn-loading {
  position: relative;
  color: transparent;
  pointer-events: none;
}
.btn-loading::after {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 600ms linear infinite;
}
```

### Props

```tsx
interface ButtonProps {
  variant?: 'default' | 'primary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  icon?: string                    // lucide icon name, renders left of label
  iconRight?: string               // lucide icon name, renders right of label
  loading?: boolean
  disabled?: boolean
  fullWidth?: boolean              // width: 100%
  onClick?: () => void
  children: preact.ComponentChildren
}
```

### Icon-only button

When a button has only an icon (no children), it renders as a square:

```tsx
<Button icon="plus" size="sm" variant="ghost" aria-label="Add item" />
// Renders as a 28x28px square button with just the icon
```

```css
.btn-icon-only {
  padding: 0;
  width: 28px;  /* matches height for sm */
}
.btn-icon-only.md { width: 36px; }
.btn-icon-only.lg { width: 44px; }
```

---

## Text inputs

### Input

Single-line text input. The foundation for email, URL, number, and search fields.

```tsx
interface InputProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'url' | 'search'
  label?: string                   // renders above the input as a label
  placeholder?: string
  value?: string
  error?: string                   // error message below the input
  hint?: string                    // hint text below the input (hidden when error is shown)
  icon?: string                    // lucide icon inside the input (left side)
  prefix?: string                  // text prefix inside input (e.g., "$", "https://")
  suffix?: string                  // text suffix inside input (e.g., ".com", "%")
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  required?: boolean
  onChange?: (value: string) => void
}
```

```css
.input-wrapper {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.input-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.input-label .required {
  color: var(--error);
  margin-left: 2px;
}

.input {
  height: 36px;                     /* md default */
  padding: 0 12px;
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 0.875rem;
  font-family: var(--font-body);
  transition: all var(--transition-fast);
}

.input::placeholder {
  color: var(--text-tertiary);
}

.input:hover {
  border-color: rgba(255,255,255,0.12);
}

.input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-dim);
  background: rgba(255,255,255,0.06);
}

.input-error .input {
  border-color: var(--error);
  box-shadow: 0 0 0 2px rgba(var(--error-rgb), 0.15);
}

.input-error-message {
  font-size: 0.75rem;
  color: var(--error);
}

.input-hint {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.input:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Sizes */
.input-sm { height: 28px; font-size: 0.8125rem; padding: 0 10px; }
.input-lg { height: 44px; font-size: 0.9375rem; padding: 0 14px; }

/* With icon */
.input-with-icon { padding-left: 36px; }
.input-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-tertiary);
  width: 16px;
  height: 16px;
  stroke-width: 1.5px;
}

/* Prefix / suffix */
.input-prefix, .input-suffix {
  font-size: 0.875rem;
  color: var(--text-tertiary);
  white-space: nowrap;
}
```

### Textarea

Multi-line text input.

```tsx
interface TextareaProps {
  label?: string
  placeholder?: string
  value?: string
  error?: string
  hint?: string
  rows?: number                    // default: 3
  maxLength?: number
  resize?: 'none' | 'vertical' | 'both'   // default: 'vertical'
  disabled?: boolean
  required?: boolean
  onChange?: (value: string) => void
}
```

```css
.textarea {
  padding: 10px 12px;
  min-height: 80px;
  line-height: 1.5;
  resize: vertical;
  /* inherits all .input styles for bg, border, focus, error */
}

.textarea-char-count {
  font-size: 0.6875rem;
  color: var(--text-tertiary);
  text-align: right;
}

.textarea-char-count.near-limit { color: var(--warning); }
.textarea-char-count.at-limit   { color: var(--error); }
```

---

## Select / Dropdown

### Select

A custom dropdown that matches the design system. Never use native `<select>` — it can't be themed.

```tsx
interface SelectProps {
  label?: string
  placeholder?: string
  value?: string
  options: SelectOption[]
  error?: string
  hint?: string
  size?: 'sm' | 'md' | 'lg'
  searchable?: boolean             // filter options by typing
  disabled?: boolean
  required?: boolean
  onChange?: (value: string) => void
}

interface SelectOption {
  value: string
  label: string
  icon?: string                    // lucide icon
  description?: string             // secondary line below label
  disabled?: boolean
}
```

The select trigger looks identical to an input with a chevron-down icon on the right. The dropdown menu is a floating card (`--card-elevated`) with rounded corners:

```css
.select-trigger {
  /* Same styles as .input */
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
}

.select-chevron {
  width: 16px;
  height: 16px;
  color: var(--text-tertiary);
  stroke-width: 1.5px;
  transition: transform 150ms ease-out;
}

.select-trigger[data-open] .select-chevron {
  transform: rotate(180deg);
}

.select-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--card-elevated);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-sm);
  box-shadow: 0 8px 24px rgba(0,0,0,0.2);
  max-height: 240px;
  overflow-y: auto;
  z-index: 20;
  padding: 4px;
}

.select-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 0.875rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.select-option:hover {
  background: rgba(255,255,255,0.06);
  color: var(--text-primary);
}

.select-option[data-selected] {
  color: var(--accent);
}

.select-option-description {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.select-option:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Search input inside dropdown */
.select-search {
  padding: 8px 10px;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--card-border);
}
```

### Multi-select

Same as select but allows multiple selections. Selected items render as removable chips inside the trigger.

```tsx
interface MultiSelectProps extends Omit<SelectProps, 'value' | 'onChange'> {
  value?: string[]
  onChange?: (values: string[]) => void
  max?: number                     // max selections allowed
}
```

```css
.multi-select-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.multi-select-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: var(--accent-dim);
  color: var(--accent);
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.multi-select-chip-remove {
  width: 14px;
  height: 14px;
  cursor: pointer;
  opacity: 0.6;
}

.multi-select-chip-remove:hover {
  opacity: 1;
}
```

---

## Checkbox, radio, toggle

### Checkbox

```tsx
interface CheckboxProps {
  label?: string
  description?: string             // secondary text below label
  checked?: boolean
  indeterminate?: boolean          // for "select all" with partial selection
  disabled?: boolean
  onChange?: (checked: boolean) => void
}
```

```css
.checkbox-wrapper {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  cursor: pointer;
}

.checkbox {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 1.5px solid var(--card-border);
  background: rgba(255,255,255,0.04);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
  transition: all var(--transition-fast);
}

.checkbox:hover {
  border-color: rgba(255,255,255,0.2);
}

.checkbox[data-checked] {
  background: var(--accent);
  border-color: var(--accent);
}

/* Check icon — a simple SVG path */
.checkbox-check {
  width: 12px;
  height: 12px;
  color: var(--accent-text);
  stroke-width: 2.5px;
}

/* Indeterminate — horizontal line instead of check */
.checkbox[data-indeterminate] {
  background: var(--accent);
  border-color: var(--accent);
}

.checkbox-label {
  font-size: 0.875rem;
  color: var(--text-primary);
}

.checkbox-description {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  margin-top: 2px;
}
```

### Radio group

```tsx
interface RadioGroupProps {
  label?: string
  options: { value: string; label: string; description?: string }[]
  value?: string
  direction?: 'vertical' | 'horizontal'   // default: 'vertical'
  disabled?: boolean
  onChange?: (value: string) => void
}
```

```css
.radio {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1.5px solid var(--card-border);
  background: rgba(255,255,255,0.04);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all var(--transition-fast);
}

.radio[data-checked] {
  border-color: var(--accent);
}

.radio-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  transform: scale(0);
  transition: transform 150ms ease-out;
}

.radio[data-checked] .radio-dot {
  transform: scale(1);
}
```

### Toggle

On/off switch. Use for binary settings where the effect is immediate (no save button needed).

```tsx
interface ToggleProps {
  label?: string
  description?: string
  checked?: boolean
  size?: 'sm' | 'md'              // default: 'md'
  disabled?: boolean
  onChange?: (checked: boolean) => void
}
```

```css
.toggle-track {
  position: relative;
  width: 36px;
  height: 20px;
  background: rgba(255,255,255,0.1);
  border-radius: 10px;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.toggle-track[data-checked] {
  background: var(--accent);
}

.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  transition: transform var(--transition-fast);
}

.toggle-track[data-checked] .toggle-thumb {
  transform: translateX(16px);
}

/* Small variant */
.toggle-sm .toggle-track { width: 28px; height: 16px; }
.toggle-sm .toggle-thumb { width: 12px; height: 12px; }
.toggle-sm .toggle-track[data-checked] .toggle-thumb { transform: translateX(12px); }
```

---

## Tabs

Horizontal tab bar for switching between views within a card or page. Distinct from the app-level tabs in workspace-page-architecture.md — these are content-level tabs inside a card.

```tsx
interface TabsProps {
  tabs: { id: string; label: string; badge?: number; icon?: string }[]
  active: string
  variant?: 'underline' | 'pill'   // default: 'underline'
  size?: 'sm' | 'md'              // default: 'md'
  onChange: (id: string) => void
}
```

### Underline variant (default)

A thin accent-colored underline on the active tab. Tabs sit on a subtle bottom border.

```css
.tabs-underline {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--card-border);
}

.tab-underline {
  padding: 10px 16px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-tertiary);
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.tab-underline:hover {
  color: var(--text-secondary);
}

.tab-underline[data-active] {
  color: var(--text-primary);
  border-bottom-color: var(--accent);
}
```

### Pill variant

Tabs render as pill-shaped segments. Active tab has a filled background. Good for small option groups (2-4 tabs).

```css
.tabs-pill {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  background: rgba(255,255,255,0.04);
  border-radius: var(--radius-sm);
}

.tab-pill {
  padding: 6px 14px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-tertiary);
  border-radius: 6px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.tab-pill:hover {
  color: var(--text-secondary);
}

.tab-pill[data-active] {
  background: var(--card-elevated);
  color: var(--text-primary);
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
```

---

## Table

Data tables are the workhorse of internal tools. The Hauser aesthetic: dense but readable, subtle row separators, no heavy grid lines, color-coded status cells.

```tsx
interface TableProps {
  columns: TableColumn[]
  rows: Record<string, any>[]
  sortable?: boolean
  selectable?: boolean             // checkboxes for row selection
  onRowClick?: (row: any) => void  // click to open drawer/navigate
  emptyState?: preact.ComponentChildren
  loading?: boolean
  stickyHeader?: boolean           // default: true
}

interface TableColumn {
  key: string
  label: string
  width?: string | number          // fixed or flex
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  render?: (value: any, row: any) => preact.ComponentChildren  // custom cell renderer
}
```

```css
.table-wrapper {
  overflow-x: auto;
  border-radius: var(--radius-sm);
}

.table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}

/* Header */
.table-header {
  position: sticky;
  top: 0;
  z-index: 1;
}

.table-header-cell {
  padding: 10px 16px;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  text-align: left;
  border-bottom: 1px solid var(--card-border);
  background: var(--card);
  white-space: nowrap;
}

.table-header-cell[data-sortable] {
  cursor: pointer;
}

.table-header-cell[data-sortable]:hover {
  color: var(--text-secondary);
}

.table-sort-icon {
  width: 14px;
  height: 14px;
  margin-left: 4px;
  opacity: 0.4;
  stroke-width: 1.5px;
}

.table-header-cell[data-sorted] .table-sort-icon {
  opacity: 1;
  color: var(--accent);
}

/* Rows */
.table-row {
  transition: background var(--transition-fast);
}

.table-row:hover {
  background: rgba(255,255,255,0.03);
}

.table-row[data-clickable] {
  cursor: pointer;
}

.table-row[data-selected] {
  background: var(--accent-dim);
}

.table-cell {
  padding: 12px 16px;
  font-size: 0.875rem;
  color: var(--text-secondary);
  border-bottom: 1px solid rgba(255,255,255,0.03);
  vertical-align: middle;
}

/* First column — slightly bolder */
.table-cell:first-child {
  color: var(--text-primary);
  font-weight: 500;
}

/* Row selection checkbox */
.table-checkbox-cell {
  width: 40px;
  padding-left: 12px;
  padding-right: 0;
}
```

### Pagination

```tsx
interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}
```

```css
.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-top: 1px solid var(--card-border);
}

.pagination-info {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pagination-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.pagination-btn:hover { background: rgba(255,255,255,0.06); }
.pagination-btn[data-active] { background: var(--accent); color: var(--accent-text); }
.pagination-btn:disabled { opacity: 0.3; cursor: not-allowed; }
```

---

## Avatar

User/workspace identity circles.

```tsx
interface AvatarProps {
  src?: string                     // image URL
  name: string                     // fallback: initials from name
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  status?: 'online' | 'away' | 'offline' | 'busy'
  shape?: 'circle' | 'rounded'    // circle for people, rounded for workspaces
}
```

| Size | Dimensions | Font size | Status dot |
|---|---|---|---|
| `xs` | 24px | 0.625rem (10px) | 6px |
| `sm` | 32px | 0.6875rem (11px) | 8px |
| `md` | 40px | 0.8125rem (13px) | 10px |
| `lg` | 56px | 1rem (16px) | 12px |
| `xl` | 80px | 1.5rem (24px) | 14px |

```css
.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--accent);
  color: var(--accent-text);
  font-weight: 600;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
}

.avatar[data-shape="rounded"] {
  border-radius: var(--radius-sm);
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Status indicator */
.avatar-status {
  position: absolute;
  bottom: 0;
  right: 0;
  border-radius: 50%;
  border: 2px solid var(--card);
}

.avatar-status-online  { background: var(--success); }
.avatar-status-away    { background: var(--warning); }
.avatar-status-offline { background: var(--text-tertiary); }
.avatar-status-busy    { background: var(--error); }
```

### Avatar group (stacked)

```tsx
interface AvatarGroupProps {
  users: { name: string; src?: string }[]
  max?: number                     // show first N, then "+X" overflow
  size?: 'sm' | 'md'
}
```

```css
.avatar-group {
  display: flex;
}

.avatar-group .avatar {
  margin-left: -8px;
  border: 2px solid var(--card);
}

.avatar-group .avatar:first-child {
  margin-left: 0;
}

.avatar-group-overflow {
  background: var(--card-elevated);
  color: var(--text-tertiary);
  font-size: 0.6875rem;
  font-weight: 600;
}
```

---

## Badge

Small count or status indicator. Used on sidebar nav items, tabs, and action buttons.

```tsx
interface BadgeProps {
  count?: number                   // numeric badge
  dot?: boolean                    // just a dot, no number
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'error'
  max?: number                     // "99+" when count exceeds max (default: 99)
}
```

```css
.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  font-size: 0.6875rem;
  font-weight: 700;
}

.badge-default { background: var(--card-elevated); color: var(--text-secondary); }
.badge-accent  { background: var(--accent-dim); color: var(--accent); }
.badge-success { background: rgba(var(--success-rgb), 0.15); color: var(--success); }
.badge-warning { background: rgba(var(--warning-rgb), 0.15); color: var(--warning); }
.badge-error   { background: rgba(var(--error-rgb), 0.15); color: var(--error); }

/* Dot variant — small circle, no text */
.badge-dot {
  width: 8px;
  height: 8px;
  min-width: 8px;
  padding: 0;
  border-radius: 50%;
}
```

---

## Tooltip

Hover hint that appears above/below an element.

```tsx
interface TooltipProps {
  content: string
  position?: 'top' | 'bottom' | 'left' | 'right'    // default: 'top'
  delay?: number                   // ms before showing (default: 400)
  children: preact.ComponentChildren
}
```

```css
.tooltip {
  position: absolute;
  padding: 6px 10px;
  background: var(--card-elevated);
  border: 1px solid var(--card-border);
  border-radius: 6px;
  font-size: 0.75rem;
  color: var(--text-primary);
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  pointer-events: none;
  opacity: 0;
  transform: translateY(4px);
  transition: opacity 150ms, transform 150ms;
  z-index: 50;
}

.tooltip.visible {
  opacity: 1;
  transform: translateY(0);
}
```

---

## Dropdown menu / Action menu

A floating menu triggered by a button click. Used for "more actions" (•••), context menus, and toolbar overflow.

```tsx
interface DropdownMenuProps {
  trigger: preact.ComponentChildren       // the button that opens the menu
  items: MenuItem[]
  align?: 'start' | 'end'                // align to left or right edge of trigger
}

interface MenuItem {
  label: string
  icon?: string                           // lucide icon
  onClick: () => void
  variant?: 'default' | 'danger'
  disabled?: boolean
  separator?: boolean                     // renders a line before this item
}
```

```css
.dropdown-menu {
  position: absolute;
  min-width: 180px;
  background: var(--card-elevated);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-sm);
  box-shadow: 0 8px 24px rgba(0,0,0,0.25);
  padding: 4px;
  z-index: 25;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.dropdown-item:hover {
  background: rgba(255,255,255,0.06);
  color: var(--text-primary);
}

.dropdown-item-danger {
  color: var(--error);
}

.dropdown-item-danger:hover {
  background: rgba(var(--error-rgb), 0.1);
}

.dropdown-item:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.dropdown-separator {
  height: 1px;
  background: var(--card-border);
  margin: 4px 0;
}

.dropdown-item-icon {
  width: 16px;
  height: 16px;
  stroke-width: 1.5px;
  color: var(--text-tertiary);
}

.dropdown-item:hover .dropdown-item-icon {
  color: var(--text-secondary);
}
```

---

## Empty state

When a list, table, or section has no data. Centered illustration area + message + optional action.

```tsx
interface EmptyStateProps {
  icon?: string                    // lucide icon, rendered large and muted
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}
```

```css
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.empty-state-icon {
  width: 48px;
  height: 48px;
  color: var(--text-tertiary);
  opacity: 0.4;
  stroke-width: 1px;
  margin-bottom: 16px;
}

.empty-state-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.empty-state-description {
  font-size: 0.8125rem;
  color: var(--text-tertiary);
  max-width: 320px;
  margin-bottom: 16px;
}
```

---

## Loading states

### Skeleton

Placeholder shimmer that matches the shape of the content being loaded. Use inside cards, tables, and stat displays.

```tsx
interface SkeletonProps {
  variant?: 'text' | 'circle' | 'rect'
  width?: string | number
  height?: string | number
  lines?: number                   // for text variant, renders N lines
}
```

```css
.skeleton {
  background: linear-gradient(
    90deg,
    rgba(255,255,255,0.04) 0%,
    rgba(255,255,255,0.08) 50%,
    rgba(255,255,255,0.04) 100%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
  border-radius: 6px;
}

@keyframes skeleton-shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.skeleton-text {
  height: 14px;
  margin-bottom: 8px;
  border-radius: 4px;
}

.skeleton-text:last-child {
  width: 60%;
}

.skeleton-circle {
  border-radius: 50%;
}
```

### Spinner

Small inline spinner for buttons and loading indicators.

```css
.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--text-tertiary);
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 600ms linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.spinner-sm { width: 14px; height: 14px; }
.spinner-lg { width: 24px; height: 24px; }
```

### Full page loader

Centered in the viewport when an app is loading for the first time.

```css
.page-loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
  gap: 16px;
}

.page-loader-spinner {
  width: 32px;
  height: 32px;
  border: 2.5px solid var(--text-tertiary);
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 800ms linear infinite;
  opacity: 0.5;
}

.page-loader-text {
  font-size: 0.8125rem;
  color: var(--text-tertiary);
}
```

---

## Charts

Charts follow the Hauser aesthetic: dark backgrounds, warm accent colors, thin axes, no chart junk. Use Chart.js as the rendering library (lightweight, canvas-based, theming via options).

### Chart theming

All charts use a consistent configuration object that applies workspace tokens:

```typescript
const ensembleChartDefaults = {
  color: 'var(--text-secondary)',          // default text color
  borderColor: 'var(--card-border)',       // grid lines
  backgroundColor: 'transparent',

  scales: {
    x: {
      grid: {
        color: 'rgba(255,255,255,0.04)',   // barely visible grid
        drawBorder: false,
      },
      ticks: {
        color: 'var(--text-tertiary)',
        font: { size: 11, family: 'var(--font-body)' },
      },
    },
    y: {
      grid: {
        color: 'rgba(255,255,255,0.04)',
        drawBorder: false,
      },
      ticks: {
        color: 'var(--text-tertiary)',
        font: { size: 11, family: 'var(--font-body)' },
      },
    },
  },

  plugins: {
    legend: {
      labels: {
        color: 'var(--text-secondary)',
        font: { size: 12, family: 'var(--font-body)' },
        usePointStyle: true,
        pointStyleWidth: 8,
        padding: 16,
      },
    },
    tooltip: {
      backgroundColor: 'var(--card-elevated)',
      titleColor: 'var(--text-primary)',
      bodyColor: 'var(--text-secondary)',
      borderColor: 'var(--card-border)',
      borderWidth: 1,
      cornerRadius: 8,
      titleFont: { size: 13, weight: 600, family: 'var(--font-body)' },
      bodyFont: { size: 12, family: 'var(--font-body)' },
      padding: 12,
      displayColors: true,
      boxPadding: 4,
    },
  },
}
```

### Chart color palette

A curated set of chart colors that work on dark card backgrounds. Ordered for maximum distinction between adjacent series:

```typescript
const chartColors = [
  'var(--accent)',          // primary series — workspace accent
  '#60a5fa',               // blue
  '#34d399',               // emerald
  '#fbbf24',               // amber
  '#f472b6',               // pink
  '#a78bfa',               // violet
  '#22d3ee',               // cyan
  '#fb923c',               // orange
  '#a3e635',               // lime
  '#e879f9',               // fuchsia
]
```

The first series always uses the workspace accent color. This ties every chart to the brand.

### Line chart

```tsx
interface LineChartProps {
  data: ChartDataset[]
  labels: string[]
  height?: number                  // default: 280
  yLabel?: string
  xLabel?: string
  stacked?: boolean
  showArea?: boolean               // fill area under lines (default: false)
  showPoints?: boolean             // show data points (default: false, show on hover)
  legend?: boolean                 // show legend (default: true if >1 dataset)
}

interface ChartDataset {
  label: string
  data: number[]
  color?: string                   // override from chartColors
  dashed?: boolean                 // dashed line for projections/estimates
}
```

Line styles:
- Solid lines: 2px stroke, no fill by default
- Dashed lines (projections): `borderDash: [6, 4]`, same 2px stroke
- Area fills: 10% opacity of the line color
- Points: hidden by default, 4px circles on hover
- Tension: 0.3 (slight curve, not angular, not overly smooth)

### Bar chart

```tsx
interface BarChartProps {
  data: ChartDataset[]
  labels: string[]
  height?: number
  horizontal?: boolean             // horizontal bars (default: false)
  stacked?: boolean
  showValues?: boolean             // render values on top of bars
  legend?: boolean
}
```

Bar styles:
- Bar border-radius: 4px on top (vertical) or right (horizontal)
- Bar width: 60% of available space (category percentage)
- Stacked bars: no gap between stack segments
- Value labels: 11px, `--text-tertiary`, positioned above bar

### Donut / Pie chart

```tsx
interface DonutChartProps {
  data: { label: string; value: number; color?: string }[]
  height?: number                  // default: 240
  centerLabel?: string             // text in the donut hole
  centerValue?: string             // large number in the donut hole
  showLegend?: boolean             // default: true, renders below the chart
}
```

Donut styles:
- Cutout: 70% (wide donut, not a pie)
- Border width: 0 between segments (clean edges)
- Hover: segment slightly expands (hoverOffset: 4)
- Center text: large bold value + small muted label

### Sparkline

Tiny inline chart for stat cards and table cells. No axes, no labels, just the shape.

```tsx
interface SparklineProps {
  data: number[]
  width?: number                   // default: 80
  height?: number                  // default: 24
  color?: string                   // default: var(--accent)
  showArea?: boolean               // subtle fill (default: true)
}
```

```css
.sparkline {
  display: inline-block;
}

.sparkline-line {
  fill: none;
  stroke-width: 1.5px;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.sparkline-area {
  opacity: 0.1;
}
```

---

## Label

Field labels used above form inputs. Consistent styling across all forms.

```tsx
interface LabelProps {
  text: string
  required?: boolean
  htmlFor?: string
  hint?: string                    // small text to the right of the label
}
```

```css
.label {
  display: flex;
  align-items: baseline;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.label-required {
  color: var(--error);
}

.label-hint {
  margin-left: auto;
  font-weight: 400;
  color: var(--text-tertiary);
}
```

---

## Divider

Horizontal or vertical separator.

```tsx
interface DividerProps {
  direction?: 'horizontal' | 'vertical'
  label?: string                   // optional centered label on the line
  spacing?: 'sm' | 'md' | 'lg'    // margin above and below
}
```

```css
.divider {
  border: none;
  border-top: 1px solid var(--card-border);
}

.divider-sm { margin: 8px 0; }
.divider-md { margin: 16px 0; }
.divider-lg { margin: 24px 0; }

/* Labeled divider */
.divider-labeled {
  display: flex;
  align-items: center;
  gap: 12px;
}

.divider-labeled::before,
.divider-labeled::after {
  content: '';
  flex: 1;
  border-top: 1px solid var(--card-border);
}

.divider-label {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  white-space: nowrap;
}
```

---

## Key-value display

For detail views — labeled data pairs. Hauser uses this for property specs (2 Bed, 2 Bath, 1980 Built, etc.).

```tsx
interface KeyValueProps {
  items: { label: string; value: string | number; icon?: string }[]
  direction?: 'horizontal' | 'vertical'   // default: 'horizontal'
  size?: 'sm' | 'md'
}
```

```css
/* Horizontal (inline) */
.kv-horizontal {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}

.kv-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.kv-icon {
  width: 14px;
  height: 14px;
  color: var(--text-tertiary);
  stroke-width: 1.5px;
}

.kv-label {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.kv-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
}

/* Vertical (stacked label above value) */
.kv-vertical .kv-item {
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}
```

---

## Filter bar

Horizontal bar of filter controls for list/table views. Sits below the page header, above the content.

```tsx
interface FilterBarProps {
  filters: FilterControl[]
  onFilterChange: (filters: Record<string, any>) => void
  searchPlaceholder?: string       // search input on the left
}

interface FilterControl {
  key: string
  label: string
  type: 'select' | 'multi-select' | 'date-range' | 'toggle'
  options?: SelectOption[]         // for select types
  value?: any
}
```

```css
.filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
  flex-wrap: wrap;
}

.filter-bar-search {
  flex: 1;
  min-width: 200px;
  max-width: 320px;
}

.filter-bar-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-active-count {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-dim);
  padding: 2px 8px;
  border-radius: 4px;
}

.filter-clear {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  cursor: pointer;
}

.filter-clear:hover {
  color: var(--accent);
}
```

---

## Breadcrumb

Navigation trail showing the current location in the hierarchy. Renders in the toolbar.

```tsx
interface BreadcrumbProps {
  items: { label: string; path?: string }[]
}
```

```css
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8125rem;
}

.breadcrumb-item {
  color: var(--text-tertiary);
}

.breadcrumb-item[data-link] {
  cursor: pointer;
}

.breadcrumb-item[data-link]:hover {
  color: var(--text-secondary);
}

.breadcrumb-current {
  color: var(--text-primary);
  font-weight: 500;
}

.breadcrumb-separator {
  color: var(--text-tertiary);
  opacity: 0.4;
  font-size: 0.75rem;
}
```

---

## Component summary

All `@ensemble-edge/ui` components in one table:

| Category | Components |
|---|---|
| **Layout** | AppPage, Section, Card, CardGrid, PageCard, SplitLayout |
| **Buttons** | Button (default, primary, danger, ghost), IconButton |
| **Inputs** | Input, Textarea, Select, MultiSelect, Checkbox, Radio, Toggle |
| **Navigation** | Tabs (underline, pill), Breadcrumb, FilterBar |
| **Data display** | Table, Pagination, StatCard, DataCard, DataRow, KeyValue, ProgressBar, Pill, Badge, Sparkline |
| **Charts** | LineChart, BarChart, DonutChart, Sparkline |
| **Media** | Avatar, AvatarGroup |
| **Feedback** | Toast, Spinner, Skeleton, EmptyState, PageLoader |
| **Overlay** | useOverlay (confirm, alert, open), Drawer, Modal, Dialog |
| **Utility** | Tooltip, DropdownMenu, Divider, Label |

Every component:
- Consumes workspace CSS variables (no hardcoded colors)
- Works in light and dark mode
- Is responsive (adapts to viewport width)
- Uses Lucide icons at 1.5px stroke where icons appear
- Follows the Hauser aesthetic (dark surfaces, warm text, thin strokes, generous padding)
- Matches the `--radius-sm` (8px) for small elements, `--radius` (16px) for large containers