# Shell Components Skill

> Patterns for building Preact shell components in `@ensemble-edge/shell`.

## Component Structure

```
packages/shell/src/components/
├── Shell.tsx           # Main layout with 6 zones
├── WorkspaceSwitcher.tsx
├── Sidebar.tsx
├── Toolbar.tsx
├── Viewport.tsx
├── AIPanel.tsx
├── BookmarkBar.tsx
├── ToastContainer.tsx
├── OverlayManager.tsx
├── Drawer.tsx
├── Modal.tsx
├── Dialog.tsx
└── index.ts            # Re-exports all components
```

## Component Template

```tsx
import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';

interface MyComponentProps {
  title: string;
  onAction?: () => void;
}

export function MyComponent({ title, onAction }: MyComponentProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div class="my-component">
      <h2>{title}</h2>
      {onAction && (
        <button onClick={onAction}>Action</button>
      )}
    </div>
  );
}
```

## State Management

Use Preact Signals for shared state:

```typescript
// packages/shell/src/state/my-state.ts
import { signal, computed } from '@preact/signals';

export const myValue = signal<string>('initial');

export const derivedValue = computed(() => {
  return myValue.value.toUpperCase();
});

export function updateValue(newValue: string) {
  myValue.value = newValue;
}
```

## Using State in Components

```tsx
import { myValue, updateValue } from '../state/my-state';

export function MyComponent() {
  return (
    <div>
      <span>{myValue.value}</span>
      <button onClick={() => updateValue('new')}>Update</button>
    </div>
  );
}
```

## Styling

Use CSS classes from shell.css or inline styles with CSS variables:

```tsx
export function MyComponent() {
  return (
    <div
      class="shell-component"
      style={{
        backgroundColor: 'var(--color-surface)',
        color: 'var(--color-text)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      Content
    </div>
  );
}
```

## Theme Variables

Available CSS variables (from workspace theme):

```css
/* Colors */
--color-canvas      /* Background */
--color-surface     /* Card/panel background */
--color-accent      /* Primary action color */
--color-text        /* Main text */
--color-text-muted  /* Secondary text */
--color-border      /* Borders */

/* Spacing */
--space-xs, --space-sm, --space-md, --space-lg, --space-xl

/* Radius */
--radius-sm, --radius-md, --radius-lg, --radius-full

/* Typography */
--font-family
--font-size-sm, --font-size-base, --font-size-lg
```

## Overlay Components

Use the overlay state for modals/drawers/dialogs:

```typescript
import { openDrawer, openModal, openDialog, closeOverlay } from '../state/overlay';

// Open a drawer
openDrawer({
  id: 'my-drawer',
  title: 'Settings',
  content: <SettingsContent />,
  width: 400,
});

// Open a modal
openModal({
  id: 'confirm-modal',
  title: 'Confirm Action',
  content: <ConfirmContent />,
});

// Close any overlay
closeOverlay('my-drawer');
```

## Toast Notifications

```typescript
import { showToast, dismissToast } from '../state/toasts';

// Show success toast
showToast({
  type: 'success',
  title: 'Saved',
  message: 'Changes saved successfully',
});

// Show error toast
showToast({
  type: 'error',
  title: 'Error',
  message: 'Failed to save changes',
});
```
