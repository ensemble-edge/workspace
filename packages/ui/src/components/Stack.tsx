import { ComponentChildren } from 'preact';

export interface StackProps {
  children: ComponentChildren;
  direction?: 'row' | 'column';
  gap?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  align?: 'start' | 'center' | 'end' | 'stretch';
}

export function Stack({
  children,
  direction = 'column',
  gap = 'md',
  align = 'stretch',
}: StackProps) {
  return (
    <div class={`ens-stack ens-stack--${direction} ens-stack--gap-${gap} ens-stack--align-${align}`}>
      {children}
    </div>
  );
}
