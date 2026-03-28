import { ComponentChildren } from 'preact';

export interface ButtonProps {
  children: ComponentChildren;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled,
  onClick,
}: ButtonProps) {
  return (
    <button
      class={`ens-button ens-button--${variant} ens-button--${size}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
