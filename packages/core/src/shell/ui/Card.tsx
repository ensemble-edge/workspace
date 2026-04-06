/**
 * Card Component
 *
 * Container component for grouping related content.
 * Follows the Hauser aesthetic with dark floating cards.
 *
 * Features:
 * - Header with title and subtitle
 * - Body with content
 * - Footer for actions
 * - Optional padding variations
 */

import {  ReactNode } from 'react';

export interface CardProps {
  /** Card content */
  children: ReactNode;
  /** Additional class names */
  className?: string;
  /** Remove default padding */
  noPadding?: boolean;
}

export function Card({ children, className = '', noPadding = false }: CardProps) {
  const classes = ['card', noPadding && 'card--no-padding', className]
    .filter(Boolean)
    .join(' ');

  return <div className={classes}>{children}</div>;
}

export interface CardHeaderProps {
  /** Header content or structured title/subtitle */
  children?: ReactNode;
  /** Card title */
  title?: string;
  /** Card subtitle/description */
  subtitle?: string;
  /** Right-aligned actions */
  actions?: ReactNode;
  /** Additional class names */
  className?: string;
}

export function CardHeader({
  children,
  title,
  subtitle,
  actions,
  className = '',
}: CardHeaderProps) {
  const classes = ['card__header', className].filter(Boolean).join(' ');

  // If children provided, render them directly
  if (children) {
    return <div className={classes}>{children}</div>;
  }

  // Otherwise render structured title/subtitle/actions
  return (
    <div className={classes}>
      <div className="card__header-content">
        {title && <h2 className="card__title">{title}</h2>}
        {subtitle && <p className="card__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="card__header-actions">{actions}</div>}
    </div>
  );
}

export interface CardBodyProps {
  /** Body content */
  children: ReactNode;
  /** Additional class names */
  className?: string;
}

export function CardBody({ children, className = '' }: CardBodyProps) {
  const classes = ['card__body', className].filter(Boolean).join(' ');
  return <div className={classes}>{children}</div>;
}

export interface CardFooterProps {
  /** Footer content */
  children: ReactNode;
  /** Align items */
  align?: 'left' | 'center' | 'right' | 'between';
  /** Additional class names */
  className?: string;
}

export function CardFooter({
  children,
  align = 'right',
  className = '',
}: CardFooterProps) {
  const classes = ['card__footer', `card__footer--${align}`, className]
    .filter(Boolean)
    .join(' ');

  return <div className={classes}>{children}</div>;
}

export default Card;
