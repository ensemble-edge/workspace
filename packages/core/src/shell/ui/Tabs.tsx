/**
 * Tabs Component
 *
 * Horizontal tab bar for switching between views within a card or page.
 * Two variants: underline (default) and pill.
 *
 * Features:
 * - Underline: thin accent-colored underline on active tab
 * - Pill: filled background segments
 * - Optional badge count on tabs
 * - Keyboard navigation support
 */

import * as React from 'react';

export interface TabItem {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Optional badge count */
  badge?: number;
  /** Lucide icon name (future: render icon) */
  icon?: string;
}

export interface TabsProps {
  /** Tab configuration */
  tabs: TabItem[];
  /** Currently active tab ID */
  active: string;
  /** Visual variant */
  variant?: 'underline' | 'pill';
  /** Size variant */
  size?: 'sm' | 'md';
  /** Callback when tab changes */
  onChange: (id: string) => void;
}

export function Tabs({
  tabs,
  active,
  variant = 'underline',
  size = 'md',
  onChange,
}: TabsProps) {
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let newIndex = index;

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      newIndex = index > 0 ? index - 1 : tabs.length - 1;
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      newIndex = index < tabs.length - 1 ? index + 1 : 0;
    } else if (e.key === 'Home') {
      e.preventDefault();
      newIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      newIndex = tabs.length - 1;
    } else {
      return;
    }

    onChange(tabs[newIndex].id);
    // Focus the new tab
    const tabList = (e.target as HTMLElement).parentElement;
    const newTab = tabList?.children[newIndex] as HTMLElement;
    newTab?.focus();
  };

  const baseClass = variant === 'pill' ? 'tabs-pill' : 'tabs-underline';
  const tabClass = variant === 'pill' ? 'tab-pill' : 'tab-underline';
  const sizeClass = size === 'sm' ? `${baseClass}--sm` : '';

  return (
    <div
      className={`${baseClass} ${sizeClass}`}
      role="tablist"
      aria-orientation="horizontal"
    >
      {tabs.map((tab, index) => {
        const isActive = tab.id === active;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            className={tabClass}
            data-active={isActive ? '' : undefined}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="tab-badge">{tab.badge > 99 ? '99+' : tab.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
