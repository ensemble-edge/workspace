export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
}

export function Spinner({ size = 'md' }: SpinnerProps) {
  return <div class={`ens-spinner ens-spinner--${size}`} />;
}
