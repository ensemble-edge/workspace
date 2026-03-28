import { ComponentChildren } from 'preact';

export interface ContainerProps {
  children: ComponentChildren;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export function Container({ children, maxWidth = 'lg' }: ContainerProps) {
  return <div class={`ens-container ens-container--${maxWidth}`}>{children}</div>;
}
