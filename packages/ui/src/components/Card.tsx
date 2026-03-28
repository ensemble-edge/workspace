import { ComponentChildren } from 'preact';

export interface CardProps {
  children: ComponentChildren;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ children, padding = 'md' }: CardProps) {
  return <div class={`ens-card ens-card--padding-${padding}`}>{children}</div>;
}
