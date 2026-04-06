/**
 * WorkspaceBadge Component
 *
 * Reusable workspace icon/badge showing the workspace initial.
 * Used in: WS strip, mobile sidebar, workspace dropdown.
 *
 * Sizes:
 * - sm: 16x16 (nav icon size, for sidebar items)
 * - md: 24x24 (dropdown items)
 * - lg: 36x36 (WS strip icons)
 */

import * as React from 'react';

export interface WorkspaceBadgeProps {
  /** Workspace name (used for initial and title) */
  name: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether this workspace is active/selected */
  isActive?: boolean;
  /** Accent color for active state (defaults to CSS variable) */
  accent?: string;
  /** Additional class names */
  className?: string;
}

export function WorkspaceBadge({
  name,
  size = 'md',
  isActive = false,
  accent,
  className = '',
}: WorkspaceBadgeProps) {
  const initial = name.charAt(0).toUpperCase();

  const classes = [
    'ws-badge',
    `ws-badge--${size}`,
    isActive && 'ws-badge--active',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // Use inline style for dynamic accent color when active
  const style = isActive && accent
    ? { backgroundColor: accent, borderColor: accent }
    : undefined;

  return (
    <span
      className={classes}
      style={style}
      title={name}
      aria-label={name}
    >
      {initial}
    </span>
  );
}

export default WorkspaceBadge;
