import { ComponentChildren } from 'preact';

export interface BadgeProps {
  children: ComponentChildren;
  variant?: 'default' | 'success' | 'warning' | 'error';
}

export function Badge({ children, variant = 'default' }: BadgeProps) {
  return <span class={`ens-badge ens-badge--${variant}`}>{children}</span>;
}
