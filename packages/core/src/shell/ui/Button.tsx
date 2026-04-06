/**
 * Button Component
 *
 * The most used component. Four variants, three sizes.
 *
 * Variants:
 * - default: Secondary actions (cancel, dismiss)
 * - primary: Primary CTA (save, approve, create)
 * - danger: Destructive actions (delete, revoke)
 * - ghost: Tertiary actions (inline, icon-only)
 *
 * Features:
 * - Loading state with spinner
 * - Icon support (left/right)
 * - Full width option
 * - Keyboard accessible
 */

import {  ReactNode } from 'react';

export interface ButtonProps {
  /** Button variant */
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Lucide icon name for left icon */
  icon?: string;
  /** Lucide icon name for right icon */
  iconRight?: string;
  /** Show loading spinner */
  loading?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Full width button */
  fullWidth?: boolean;
  /** Button type */
  type?: 'button' | 'submit' | 'reset';
  /** Click handler */
  onClick?: (e: React.MouseEvent) => void;
  /** Button content */
  children?: ReactNode;
  /** Additional class names */
  className?: string;
}

export function Button({
  variant = 'default',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  disabled = false,
  fullWidth = false,
  type = 'button',
  onClick,
  children,
  className = '',
}: ButtonProps) {
  const isIconOnly = !children && (icon || iconRight);

  const classes = [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    fullWidth && 'btn--full-width',
    loading && 'btn--loading',
    isIconOnly && 'btn--icon-only',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading && <span className="btn__spinner" />}
      {!loading && icon && <ButtonIcon name={icon} />}
      {children && <span className="btn__label">{children}</span>}
      {!loading && iconRight && <ButtonIcon name={iconRight} />}
    </button>
  );
}

/**
 * Simple icon renderer.
 * In the future, this could integrate with a Lucide icon library.
 */
function ButtonIcon({ name }: { name: string }) {
  // Common icons inline for now
  const icons: Record<string, JSX.Element> = {
    plus: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    ),
    check: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
    x: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    ),
    save: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
        <polyline points="17 21 17 13 7 13 7 21" />
        <polyline points="7 3 7 8 15 8" />
      </svg>
    ),
    trash: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    ),
  };

  return <span className="btn__icon">{icons[name] || null}</span>;
}

export default Button;
